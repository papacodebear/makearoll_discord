import 'dotenv/config';
import OpenAI from "openai";

const openai = new OpenAI();
openai.apiKey = process.env.OPENAI_API_KEY;

export async function askAssistantQuestion(message, context = [], assistantId, instructions) {
    const openAiThread = await openai.beta.threads.create();

    context.push(["user", message]);
    for (const item of context) {
        const [role, content] = item;
        const message = await openai.beta.threads.messages.create(
            openAiThread.id,
            {
                role: role,
                content: content
            }
        );
    }

    let run = await openai.beta.threads.runs.createAndPoll(
        openAiThread.id,
        {
            assistant_id: assistantId,
            instructions: instructions
        }
    );
    const messages = await openai.beta.threads.messages.list(
        run.thread_id
    );
    return messages.data[0]["content"][0]["text"]["value"];
}

