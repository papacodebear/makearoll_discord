import OpenAI from "openai";

const openai = new OpenAI();

export async function askAssistantQuestion(message, context = [], instructions, vectorStoreId) {
    const input = [
        { role: "system", content: instructions },
        ...context.map(([role, content]) => ({ role, content })),
        { role: "user", content: message },
    ];

    const response = await openai.responses.create({
        model: "gpt-5.6-luna",
        tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
        input,
    });
    console.log(`response.output_text: ${response.output_text}`);

    return response.output_text;
}
