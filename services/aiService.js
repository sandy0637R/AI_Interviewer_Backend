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
          content:
            "You are an AI Interviewer. Provide short, clear, job-focused responses. Avoid extra text or greetings.",
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
