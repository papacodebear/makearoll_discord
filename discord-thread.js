import 'dotenv/config';
import { DiscordRequest } from './utils.js';
import { gunzipSync } from 'node:zlib';


function chunkString(str, chunkSize = 2000) {
    let chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
}

export async function createThread(channelId, threadName) {
    // Create the thread
    // const channelId = interaction.channel_id;
    const createThreadEndpoint = `channels/${channelId}/threads`;
    const createThreadBody = {
        name: threadName,
        type: 11, // GUILD_PUBLIC_THREAD
        auto_archive_duration: 60,
    };
    const createThreadOptions = { method: 'POST', "body": createThreadBody };
    const threadResponse = await DiscordRequest(createThreadEndpoint, createThreadOptions);
    const thread = await threadResponse.json();
    return thread;
}

export async function getThreadHistory(threadId, initialQuestion) {
    const fetchMessagesEndpoint = `channels/${threadId}/messages`;
    const fetchMessagesBody = { params: { limit: 100 } };
    const messagesResponse = await DiscordRequest(fetchMessagesEndpoint, fetchMessagesBody);

    const messages = await messagesResponse.json();
    let history = [["user", initialQuestion]];
    for (let i = messages.length - 1; i >= 0; i--) {
        let message = messages[i];
        let role = ((message.author.bot) ? "assistant" : "user");
        if (message.content) {
            history.push([role, message.content]);
        }
    }
    // const history = ["user", messages.map(msg => msg.content).join('\n')];
    return history;
}

export async function createWebHook(channelId) {
    const webHookEndpoint = `channels/${channelId}/webhooks`;
    const getWebHookOptions = { method: 'GET' };
    const currentWebHooksResponse = await DiscordRequest(webHookEndpoint, getWebHookOptions, true);
    const currentWebHooks = await currentWebHooksResponse.json();
    let webHookExists = false;
    let webHook = null;
    let webHookName = "makearoll";
    for (const currentWebHook of currentWebHooks) {
        if (currentWebHook.name === webHookName) {
            return currentWebHook;
        }
    }
    const createWebHookOptions = { method: 'POST', body: { name: webHookName } };
    const createWebHookResponse = await DiscordRequest(webHookEndpoint, createWebHookOptions);
    webHook = await createWebHookResponse.json();
    return webHook;
}

export async function sendThreadMessage(webHook, threadId, message) {
    const sendThreadMessageEndpoint = `webhooks/${webHook.id}/${webHook.token}?thread_id=${threadId}`;
    const chunkedMessage = chunkString(message);
    for (const chunk of chunkedMessage) {
        const sendMessageBody = { content: chunk };
        const sendMessageOptions = { method: 'POST', body: sendMessageBody };
        await DiscordRequest(sendThreadMessageEndpoint, sendMessageOptions);
    }
}

export async function sendInteractionMessage(interactionId, message) {
    const sendMessageEndpoint = `webhooks/${process.env.APP_ID}/${interactionId}/messages/@original`;
    const sendMessageBody = { content: message };
    const sendMessageOptions = { method: 'PATCH', body: sendMessageBody };
    await DiscordRequest(sendMessageEndpoint, sendMessageOptions);
}

export async function deleteInteractionMessage(interactionToken) {
    const deleteMessageEndpoint = `webhooks/${process.env.APP_ID}/${interactionToken}/messages/@original`;
    const deleteMessageOptions = { method: 'DELETE' };
    await DiscordRequest(deleteMessageEndpoint, deleteMessageOptions);
}


