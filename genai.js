import 'dotenv/config';
import OpenAI from "openai";

const openai = new OpenAI();
openai.apiKey = process.env.OPENAI_API_KEY;
const DND_INSTRUCTIONS = "You are an assistant who provides reference information for how the tabletop game dungeons and dragons operates. You search the given pdf documents for information, summarize responses, and then below the response, return the most relevant two quotes from the pdf.";


export async function askAssistantQuestion(message, context = [], assistantId = process.env.DND_PLAYER_ASSISTANT_ID) {
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
            instructions: DND_INSTRUCTIONS
        }
    );
    const messages = await openai.beta.threads.messages.list(
        run.thread_id
    );
    return messages.data[0]["content"][0]["text"]["value"];
}

