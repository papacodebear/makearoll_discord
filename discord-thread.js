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

export async function getThreadHistory(threadId, initialQuestion, hasStarterMessage = false) {
    const fetchMessagesEndpoint = `channels/${threadId}/messages`;
    const fetchMessagesOptions = { params: { limit: 100 } };
    const messagesResponse = await DiscordRequest(fetchMessagesEndpoint, fetchMessagesOptions);

    const messages = await messagesResponse.json();
    // Discord returns messages newest-first; the oldest one is the starter
    // message we posted for initialQuestion, so drop it to avoid double-counting.
    if (hasStarterMessage) messages.pop();
    let history = [["user", initialQuestion]];
    for (let i = messages.length - 1; i >= 0; i--) {
        let message = messages[i];
        let role = ((message.author.bot) ? "assistant" : "user");
        if (message.content) {
            history.push([role, message.content]);
        }
    }
    return history;
}

// Posts a plain bot message (not a webhook message) as the first message in a
// thread, used to durably store the full question when it didn't fit in the
// (100-char max) thread name.
export async function sendChannelMessage(channelId, content) {
    const endpoint = `channels/${channelId}/messages`;
    await DiscordRequest(endpoint, { method: 'POST', body: { content } });
}

// Fetches the oldest message in a thread, i.e. the starter message posted by
// sendChannelMessage when the thread name was truncated.
export async function getThreadStarterMessage(threadId) {
    const endpoint = `channels/${threadId}/messages`;
    const options = { params: { limit: 1, after: '0' } };
    const response = await DiscordRequest(endpoint, options);
    const messages = await response.json();
    return messages[0]?.content ?? "";
}

export async function createWebHook(channelId) {
    const webHookEndpoint = `channels/${channelId}/webhooks`;
    const getWebHookOptions = { method: 'GET' };
    const currentWebHooksResponse = await DiscordRequest(webHookEndpoint, getWebHookOptions);
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


