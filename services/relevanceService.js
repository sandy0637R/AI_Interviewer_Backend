import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const checkAnswerRelevance = async (question, answer) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      console.warn("❌ Missing GROQ_API_KEY, defaulting to 'relevant'");
      return "relevant";
    }

    const prompt = `
You are an AI relevance evaluator.
Check if the user's answer relates to the question.

======================
STRICT RULES
======================
- POLITE and LENIENT.
- Accept answers that are even slightly related.
- Accept "I don't know" or "No idea" as RELEVANT (do not reject them).
- Output ONLY one word: "relevant" or "irrelevant".
- Default to "relevant" if unsure.
- NO explanations. NO markdown.

### Question:
${question}

### Answer:
${answer}
    `;

    console.log("🟢 Relevance prompt:\n", prompt);

    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: "Classify relevance. Output one word only: relevant / irrelevant / dont_know" },
        { role: "user", content: prompt },
      ],
      temperature: 0.3, // lenient
      max_tokens: 5,
    });

    let raw = response.choices[0].message.content;
    console.log("🟢 Raw AI relevance response:", raw);

    // Normalize response
    let relevance = raw.trim().toLowerCase().replace(/[^\w]/g, "");

    // Treat "dontknow" as relevant for leniency
    if (relevance === "dontknow") relevance = "relevant";

    if (!["relevant", "irrelevant"].includes(relevance)) {
      console.warn("⚠️ Unexpected relevance result, defaulting to 'relevant'");
      return "relevant";
    }

    console.log("🟢 Final relevance:", relevance);
    return relevance;
  } catch (error) {
    console.error("Relevance Check Error:", error?.message || error);
    return "relevant"; // safe fallback
  }
};
