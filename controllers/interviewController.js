import InterviewSession from "../models/interviewSession.js";
import { generateAIResponse } from "../services/aiService.js";
import { checkAnswerRelevance } from "../services/relevanceService.js";

// ------------------- START INTERVIEW -------------------
export const startInterview = async (req, res) => {
  try {
    const { role, userId, isAnonymous } = req.body;
    console.log("🟢 startInterview called with role:", role, "userId:", userId);

    const session = await InterviewSession.create({
      role,
      userId: userId || null,
      isAnonymous: isAnonymous ?? true,
      questionsAsked: 0,
      answers: [],
      isCompleted: false,
    });
    console.log("🟢 New session created:", session._id);

    const prompt = `
You are an AI interviewer.
Ask Question 1 for the role: ${role}.
ONLY ask the question. No intro or explanation.
    `;
    console.log("🟢 startInterview prompt:\n", prompt);

    let question = await generateAIResponse(prompt);
    console.log("🟢 AI response for first question:\n", question);

    if (!question?.trim()) {
      question = "Please answer this question: What is your understanding of this role?";
      console.log("🟠 Fallback question used.");
    }

    res.json({ success: true, sessionId: session._id, questionNumber: 1, question });
  } catch (error) {
    console.error("Start Interview Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- NEXT QUESTION -------------------
export const nextQuestion = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    console.log("🟢 nextQuestion called. sessionId:", sessionId, "answer:", answer);

    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      console.log("🔴 Session not found:", sessionId);
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    if (session.isCompleted) {
      console.log("🟠 Session already completed.");
      return res.json({ success: true, message: "Interview already completed", feedback: session.feedback });
    }

    const currentQuestionNumber = session.questionsAsked + 1;
    const normalizedAnswer = answer?.toLowerCase() || "";

    // ------------------ REPEAT LOGIC ------------------
    const repeatKeywords = [
      "repeat", "say again", "tell again", "can you repeat", "please repeat",
      "didn't understand", "didnt understand", "do not understand", "dont understand", "explain again"
    ];

    if (repeatKeywords.some((k) => normalizedAnswer.includes(k))) {
      console.log("🟡 Detected repeat request in answer:", answer);
      const repeatedPrompt = `
You are an AI interviewer.
Repeat Question ${currentQuestionNumber} for the role: ${session.role}.
ONLY repeat the question. No extra text.
      `;
      console.log("🟢 repeatPrompt:\n", repeatedPrompt);

      let repeated = await generateAIResponse(repeatedPrompt);
      console.log("🟢 AI repeated question response:\n", repeated);

      if (!repeated?.trim()) repeated = "Let me repeat the question: What is your understanding of this role?";

      return res.json({ success: true, repeat: true, questionNumber: currentQuestionNumber, question: repeated });
    }

    // ------------------ RELEVANCE CHECK ------------------
    console.log("🟢 Checking relevance of answer...");
    const relevance = await checkAnswerRelevance(
      `Question ${currentQuestionNumber} for role ${session.role}`,
      answer
    );
    console.log("🟢 Relevance result:", relevance);

    if (relevance === "irrelevant") {
      console.log("🟠 Answer marked irrelevant.");
      return res.json({
        success: false,
        askAgain: true,
        message: "Your answer doesn't match the question. Please answer again correctly.",
      });
    }

    session.questionsAsked += 1;
    session.answers.push({ questionNumber: session.questionsAsked, answer });

    // ------------------ FINAL FEEDBACK ------------------
    if (session.questionsAsked === 5) {
      const feedbackPrompt = `
You are an AI interviewer evaluating a candidate for: ${session.role}

Here are the user's answers:
${session.answers.map((a) => `Q${a.questionNumber}: ${a.answer}`).join("\n")}

Provide structured feedback in EXACTLY this format:

Rating: X/10

Plus Points:
- point 1
- point 2

Areas to Improve:
- point 1
- point 2

Summary:
3–4 line summary of performance.
      `;
      console.log("🟢 feedbackPrompt:\n", feedbackPrompt);

      let feedback = await generateAIResponse(feedbackPrompt);
      console.log("🟢 AI feedback response:\n", feedback);

      if (!feedback?.trim()) feedback = "Feedback unavailable. Please retry the interview.";

      session.isCompleted = true;
      session.feedback = feedback;
      await session.save();

      return res.json({ success: true, completed: true, feedback });
    }

    // ------------------ NEXT QUESTION ------------------
    const nextQuestionNumber = session.questionsAsked + 1;
    const nextPrompt = `
You are an AI interviewer.
Ask Question ${nextQuestionNumber} for the role: ${session.role}.
ONLY ask the question. No extra sentences.
    `;
    console.log("🟢 nextPrompt:\n", nextPrompt);

    let nextQuestion = await generateAIResponse(nextPrompt);
    console.log("🟢 AI next question response:\n", nextQuestion);

    if (!nextQuestion?.trim()) nextQuestion = "Please describe your previous experience relevant to this role.";

    await session.save();
    return res.json({ success: true, questionNumber: nextQuestionNumber, question: nextQuestion });
  } catch (error) {
    console.error("Next Question Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- RESUME INTERVIEW -------------------
export const resumeInterview = async (req, res) => {
  try {
    const { sessionId } = req.body;
    console.log("🟢 resumeInterview called. sessionId:", sessionId);

    const session = await InterviewSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    if (session.isCompleted) return res.json({ success: true, completed: true, feedback: session.feedback });

    const nextQuestionNumber = session.questionsAsked + 1;
    const prompt = `
You are an AI interviewer.
Ask Question ${nextQuestionNumber} for the role: ${session.role}.
ONLY ask the question. No extra text.
    `;
    console.log("🟢 resume prompt:\n", prompt);

    let question = await generateAIResponse(prompt);
    console.log("🟢 AI resume question response:\n", question);

    if (!question?.trim()) question = "What skills make you suitable for this role?";

    return res.json({ success: true, questionNumber: nextQuestionNumber, question, answersSoFar: session.answers });
  } catch (error) {
    console.error("Resume Interview Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
