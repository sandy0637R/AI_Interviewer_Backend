import InterviewSession from "../models/interviewSession.js";
import { generateAIResponse } from "../services/aiService.js";
import { checkAnswerRelevance } from "../services/relevanceService.js";
import User from "../models/user.js";

// ------------------- START INTERVIEW -------------------
export const startInterview = async (req, res) => {
  try {
    const { role, userId, isAnonymous, totalQuestions } = req.body;

    if (!totalQuestions || totalQuestions < 1) {
      return res
        .status(400)
        .json({ success: false, message: "totalQuestions must be provided" });
    }

    const userIP = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!userId) {
      const previousAnonymousSession = await InterviewSession.findOne({
        userId: null,
        ip: userIP,
      });

      if (previousAnonymousSession) {
        return res.status(403).json({
          success: false,
          message:
            "Free interview already used. Please login to start a new interview.",
        });
      }
    }

    const session = await InterviewSession.create({
      role,
      userId: userId || null,
      isAnonymous: isAnonymous ?? true,
      totalQuestions,
      questionsAsked: 0,
      answers: [],
      isCompleted: false,
      status: "in_progress", // ✅
      ip: userIP,
    });

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $push: { sessions: session._id },
      });
    }

    let question = await generateAIResponse(`
You are an AI interviewer.
Ask Question Q1 for the role: ${role}.
ONLY ask the question. No intro or explanation.
    `);

    if (!question?.trim()) {
      question = "Q1: What is your understanding of this role?";
    } else {
      question = `Q1: ${question.trim()}`;
    }

    session.lastQuestion = question;
    await session.save();

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

// ------------------- NEXT QUESTION -------------------
export const nextQuestion = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;

    const session = await InterviewSession.findById(sessionId);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    const currentQuestionNumber = session.questionsAsked + 1;
    const normalizedAnswer = answer?.toLowerCase() || "";

    const repeatKeywords = [
      "repeat",
      "say again",
      "tell again",
      "can you repeat",
      "please repeat",
      "didn't understand",
      "dont understand",
      "explain again",
    ];

    if (repeatKeywords.some((k) => normalizedAnswer.includes(k))) {
      return res.json({
        success: true,
        repeat: true,
        questionNumber: currentQuestionNumber,
        question: session.lastQuestion,
      });
    }

    const relevance = await checkAnswerRelevance(
      `Question Q${currentQuestionNumber} for role ${session.role}`,
      answer
    );

    if (relevance === "irrelevant") {
      return res.json({
        success: false,
        askAgain: true,
        message:
          "Your answer doesn't match the question. Please answer again correctly.",
      });
    }

    session.questionsAsked += 1;
    session.answers.push({
      questionNumber: session.questionsAsked,
      question: session.lastQuestion,
      answer,
    });

    // ---------------- FINAL FEEDBACK ----------------
    if (session.questionsAsked === session.totalQuestions) {
      const feedbackPrompt = `
You are an AI interviewer.

Return feedback STRICTLY in JSON:
{
  "rating": number out of 10,
  "plusPoints": ["point1","point2"],
  "improvements": ["point1","point2"],
  "summary": "3-4 line summary"
}

Answers:
${session.answers.map((a) => `Q${a.questionNumber}: ${a.answer}`).join("\n")}
      `;

      const feedback = await generateAIResponse(feedbackPrompt);

      session.feedback = JSON.parse(feedback);
      session.isCompleted = true;
      session.status = "completed"; // ✅ BEST PRACTICE
      await session.save();

      return res.json({
        success: true,
        completed: true,
        feedback: session.feedback,
      });
    }

    // ---------------- NEXT QUESTION ----------------
    const nextQuestionNumber = session.questionsAsked + 1;

    let nextQuestion = await generateAIResponse(`
You are an AI interviewer.
Ask Question Q${nextQuestionNumber} for the role: ${session.role}.
ONLY ask the question.
    `);

    if (!nextQuestion?.trim()) {
      nextQuestion = `Q${nextQuestionNumber}: Describe your experience relevant to this role.`;
    } else {
      nextQuestion = `Q${nextQuestionNumber}: ${nextQuestion.trim()}`;
    }

    session.lastQuestion = nextQuestion;
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

// ------------------- RESUME INTERVIEW -------------------
export const resumeInterview = async (req, res) => {
  try {
    const { sessionId } = req.body;

    const session = await InterviewSession.findById(sessionId).lean();
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    return res.json({
      success: true,
      session: {
        _id: session._id,
        role: session.role,
        questionsAsked: session.questionsAsked,
        totalQuestions: session.totalQuestions,
        answers: session.answers,
        lastQuestion: session.lastQuestion,
        feedback: session.feedback || null,
        isCompleted: session.isCompleted,
        status: session.status, // ✅ exposed safely
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    console.error("Resume Interview Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
