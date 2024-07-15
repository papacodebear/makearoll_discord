import 'dotenv/config';
import express from 'express';
import {
    InteractionType,
    InteractionResponseType,
    InteractionResponseFlags,
    MessageComponentTypes,
    ButtonStyleTypes
} from 'discord-interactions';
import { Client, GatewayIntentBits } from 'discord.js';
import { VerifyDiscordRequest, getRandomEmoji, DiscordRequest } from './utils.js';
import { createThread, sendThreadMessage, deleteInteractionMessage, createWebHook, getThreadHistory } from './discord-thread.js';
import { askAssistantQuestion } from './genai.js';

let botReady = false;
// Handle messages sent inside a thread created by the bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
// Set up ready listener
client.once('ready', () => {
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
        const threadHistory = await getThreadHistory(threadId, message.channel.name);
        await message.channel.sendTyping();
        const answer = await askAssistantQuestion(message.content, threadHistory);
        await sendThreadMessage(webHook, threadId, answer);
    }
});

client.login(process.env.DISCORD_TOKEN);

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Store for in-progress games. In production, you'd want to use a DB
/**
 * Interactions endpoint URL where Discord will send HTTP requests
*/
app.post('/interactions', async function (req, res) {
    // Interaction type and data
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
     * Handle verification requests
     */
    if (type === InteractionType.PING) {
        return res.send({ type: InteractionResponseType.PONG });
    }

    /**
     * Handle slash command requests
     * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
     */
    if (type === InteractionType.APPLICATION_COMMAND) {
        const { name } = data;

        if (name === 'dnd') {
            // Make the name of the thread the question that was asked
            const question = data.options[0].value;
            await res.send({
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
            });
            let threadHistory = [];
            let deleteInteraction = false;
            // if in a thread get the history
            if (threadId) {
                threadHistory = await getThreadHistory(threadId, req.body.channel.name);
            }
            // Send the request to OpenAI
            const answer = await askAssistantQuestion(question, threadHistory);
            // else create a thread
            if (!threadId) {
                const thread = await createThread(channelId, question);
                threadId = thread.id;
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
