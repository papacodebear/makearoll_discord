import 'dotenv/config';
import express from 'express';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes,
    verifyKeyMiddleware
} from 'discord-interactions';
import { Client, GatewayIntentBits } from 'discord.js';
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest } from './utils.js';
import { createThread, sendThreadMessage, sendChannelMessage, getThreadStarterMessage, deleteInteractionMessage, createWebHook, getThreadHistory } from './discord-thread.js';
import { askAssistantQuestion } from './genai.js';

let botReady = false;

// Discord thread names are capped at 100 characters. When a question doesn't
// fit, the truncated name ends in an ellipsis and the full question is instead
// posted as the thread's first message (see sendChannelMessage below), making
// Discord itself the durable store for the full question.
const DISCORD_THREAD_NAME_MAX_LENGTH = 100;

function buildThreadName(shortName, question) {
    const name = `${shortName} ${question}`;
    if (name.length <= DISCORD_THREAD_NAME_MAX_LENGTH) return name;
    return name.slice(0, DISCORD_THREAD_NAME_MAX_LENGTH - 1) + "…";
}

const DND_INSTRUCTIONS = "You are an assistant who provides reference information for how the tabletop game dungeons and dragons operates. You search the given pdf documents for information, summarize responses, and then below the response, return up to two of the most relevant quotes from the pdf. Answer concisely if possible.";
const SAVAGE_WORLDS_INSTRUCTIONS = "You are an assistant who provides reference information for how the tabletop game savage worlds operates. You search the given pdf documents for information, summarize responses, and then below the response, return the most relevant two quotes from the pdf.";

const RPG_ASSISTANTS = {
    "dnd": {
        "vector_store_id": process.env.DND_PLAYER_VECTOR_STORE_ID,
        "instructions": DND_INSTRUCTIONS,
        "short_name": "[DnD]"
    },
    "sw": {
        "vector_store_id": process.env.SAVAGE_WORLDS_VECTOR_STORE_ID,
        "instructions": SAVAGE_WORLDS_INSTRUCTIONS,
        "short_name": "[SW]"
    }
};

let RPG_SHORT_NAMES = {}
for (const rpg in RPG_ASSISTANTS) {
    let rpg_short_name = RPG_ASSISTANTS[rpg]["short_name"];
    RPG_SHORT_NAMES[rpg_short_name] = RPG_ASSISTANTS[rpg];
}

// Handle messages sent inside a thread created by the bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
// Set up ready listener
client.once('clientReady', () => {
    console.log(`Logged in as ${client.user.tag}`);
    botReady = true;
});
// Set up messageCreate listener
client.on('messageCreate', async (message) => {
    // Check if the message is in a thread or "channel" created by the bot
    if (!message.author.bot && message.channel.ownerId === process.env.APP_ID) {
        const threadId = message.channel.id;
        const webHookChannelId = message.channel.parentId;
        const webHook = await createWebHook(webHookChannelId);
        let shortName = message.channel.name.split(" ")[0];
        let threadResponse = "Unable to determine which RPG assistant created the thread.";
        if (shortName in RPG_SHORT_NAMES) {
            console.log(`[THREAD_RESPONSE] ${shortName} ${message.content}`);
            let vectorStoreId = RPG_SHORT_NAMES[shortName]["vector_store_id"];
            let instructions = RPG_SHORT_NAMES[shortName]["instructions"];
            const wasTruncated = message.channel.name.endsWith("…");
            let initialQuestion = wasTruncated
                ? await getThreadStarterMessage(threadId)
                : message.channel.name.replace(`${shortName} `, "");
            const threadHistory = await getThreadHistory(threadId, initialQuestion, wasTruncated);
            // const interval = setInterval(async () => {
            //     await message.channel.sendTyping();
            // }, 5000);
            await message.channel.sendTyping();
            threadResponse = await askAssistantQuestion(message.content, threadHistory, instructions, vectorStoreId);
            // clearInterval(interval);
        }
        await sendThreadMessage(webHook, threadId, threadResponse);
    }
});

client.login(process.env.DISCORD_TOKEN);

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
/**
 * Interactions endpoint URL where Discord will send HTTP requests
*/
app.post('/interactions', verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
    // Interaction type and data
    console.log("in /interactions")
    const { type, id, data, token } = req.body;
    let channelId = req.body.channel_id;
    let threadId = null;
    if (req.body.channel) {
        if (req.body.channel.owner_id === process.env.APP_ID && req.body.channel.parent_id !== null) {
            channelId = req.body.channel.parent_id;
            threadId = req.body.channel.id;
        }
    }
    let webHook = null;

    // Create webhook
    if (channelId) {
        webHook = await createWebHook(channelId);
    }
    /**
     * Handle slash command requests
     * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;

        if (name in RPG_ASSISTANTS) {
            let vectorStoreId = RPG_ASSISTANTS[name]["vector_store_id"];
            let instructions = RPG_ASSISTANTS[name]["instructions"];
            let shortName = RPG_ASSISTANTS[name]["short_name"];
            // Make the name of the thread the question that was asked
            const question = data.options[0].value;
            console.log(`/${name} ${question}`);
            await res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            });
            let threadHistory = [];
            let deleteInteraction = false;
            // if in a thread get the history
            if (threadId) {
                const wasTruncated = req.body.channel.name.endsWith("…");
                let initialQuestion = wasTruncated
                    ? await getThreadStarterMessage(threadId)
                    : req.body.channel.name.replace(shortName, "");
                threadHistory = await getThreadHistory(threadId, initialQuestion, wasTruncated);
            }
            // Send the request to OpenAI
            const answer = await askAssistantQuestion(question, threadHistory, instructions, vectorStoreId);
            // else create a thread
            if (!threadId) {
                const threadName = buildThreadName(shortName, question);
                const thread = await createThread(channelId, threadName);
                threadId = thread.id;
                if (threadName.endsWith("…")) {
                    await sendChannelMessage(threadId, question);
                }
            }

            await deleteInteractionMessage(token);

            return sendThreadMessage(webHook, threadId, answer);

        }
    }
});

app.get('/health', (req, res) => {
    if (botReady) {
        res.status(200).send('OK');
    } else {
        res.status(500).send('Bot not ready');
    }
});

app.listen(PORT, () => {
    console.log('Listening on port', PORT);
});
