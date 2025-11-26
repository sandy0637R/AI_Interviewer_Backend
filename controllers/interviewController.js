// controllers/interviewController.js
import InterviewSession from "../models/interviewSession.js";
import { generateAIResponse } from "../services/aiService.js";

// ------------------- 1) START INTERVIEW -------------------
export const startInterview = async (req, res) => {
  try {
    const { role, userId, isAnonymous } = req.body;

    // Create a new session
    const session = await InterviewSession.create({
      role,
      userId: userId || null,
      isAnonymous: isAnonymous ?? true,
      questionsAsked: 0,
      answers: [],
      isCompleted: false,
    });

    // Generate first question
    const prompt = `You are an AI interviewer. Ask Question 1 for the role: ${role}. Only ask 1 question.`;
    const question = await generateAIResponse(prompt);

    res.json({
      success: true,
      sessionId: session._id,
      questionNumber: 1,
      question,
    });
  } catch (error) {
    console.error("Start Interview Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- 2) NEXT QUESTION -------------------
export const nextQuestion = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;

    // Find session
    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    // If interview already completed
    if (session.isCompleted) {
      return res.json({
        success: true,
        message: "Interview already completed",
        feedback: session.feedback,
      });
    }

    // Save user answer
    session.questionsAsked += 1;
    session.answers.push({
      questionNumber: session.questionsAsked,
      answer,
    });

    // If 5 questions done → generate feedback
    if (session.questionsAsked === 5) {
      const prompt = `
        You are an AI interviewer.
        Role: ${session.role}
        User's answers:
        ${session.answers.map(a => `Q${a.questionNumber}: ${a.answer}`).join("\n")}
        Generate a concise final feedback summary in 4–5 lines.
      `;

      const feedback = await generateAIResponse(prompt);

      session.isCompleted = true;
      session.feedback = feedback;
      await session.save();

      return res.json({
        success: true,
        completed: true,
        feedback,
      });
    }

    // Ask next question
    const nextQuestionNumber = session.questionsAsked + 1;
    const prompt = `
      You are an AI interviewer.
      Ask Question ${nextQuestionNumber} for the role ${session.role}.
      Ask ONLY 1 question.
    `;

    const nextQuestion = await generateAIResponse(prompt);
    await session.save();

    res.json({
      success: true,
      questionNumber: nextQuestionNumber,
      question: nextQuestion,
    });
  } catch (error) {
    console.error("Next Question Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- 3) RESUME SESSION -------------------
export const resumeInterview = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await InterviewSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    // If completed → return final feedback
    if (session.isCompleted) {
      return res.json({
        success: true,
        completed: true,
        feedback: session.feedback,
      });
    }

    const nextQuestionNumber = session.questionsAsked + 1;
    const prompt = `
      You are an AI interviewer.
      Ask Question ${nextQuestionNumber} for the role ${session.role}.
      Only ask 1 question.
    `;
    const question = await generateAIResponse(prompt);

    res.json({
      success: true,
      questionNumber: nextQuestionNumber,
      question,
      answersSoFar: session.answers,
    });
  } catch (error) {
    console.error("Resume Interview Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
