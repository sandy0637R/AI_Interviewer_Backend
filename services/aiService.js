import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const generateAIResponse = async (prompt) => {
  try {
    if (!process.env.GROQ_API_KEY) return "Server error: Missing Groq API key.";

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `
You are a professional AI Interviewer.

Behavior rules:
- Sound natural, human, and conversational
- Start interviews with a polite greeting when appropriate
- Ask follow-up questions like a real interviewer
- Be concise but not robotic
- Do NOT add unnecessary explanations
- Do NOT repeat the question number unless explicitly asked
- When asked to greet or introduce, be warm and friendly
- When asked technical questions, be precise and job-focused
          `.trim(),
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Groq AI Error:", error?.message || error);
    return "AI system error. Please try again.";
  }
};
