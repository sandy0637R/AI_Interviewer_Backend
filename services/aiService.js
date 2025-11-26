import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";


const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const generateAIResponse = async (prompt) => {
  try {
    console.log("🔑 Current GROQ_API_KEY:", process.env.GROQ_API_KEY);

    if (!process.env.GROQ_API_KEY) {
      return "Server error: Missing Groq API key.";
    }

    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content;

  } catch (error) {
    console.error("❌ Groq Error:", error?.message || error);
    return "Sorry, I couldn't process that. Please try again.";
  }
};
