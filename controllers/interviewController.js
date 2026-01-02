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
      status: "in_progress",
      ip: userIP,
    });

    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $push: { sessions: session._id },
      });
    }

    // 🎤 INTERVIEW GREETING (Q1)
    let greeting = await generateAIResponse(`
You are a professional interviewer.
Start with a warm greeting and ask the candidate to briefly introduce themselves.
Keep it natural and friendly.
    `);

    if (!greeting?.trim()) {
      greeting =
        "Hi, welcome! I'm glad you're here today. Could you please introduce yourself briefly?";
    }

    const question = `Q1: ${greeting.trim()}`;

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

    // ---------------- RELEVANCE CHECK ----------------
    let relevance = "relevant";

    // Q1 → Introduction, single warm-up question
    if (session.questionsAsked === 0) {
      // Reject complete nonsense or gibberish
      const wordCount = answer?.trim().split(/\s+/).length || 0;
      const hasLetters = /[a-zA-Z]/.test(answer);

      if (wordCount < 2 || !hasLetters) relevance = "irrelevant";
    } else {
      // All other questions, use AI relevance
      relevance = await checkAnswerRelevance(
        `Question Q${currentQuestionNumber} for role ${session.role}`,
        answer
      );
    }

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
      session.status = "completed";
      await session.save();

      return res.json({
        success: true,
        completed: true,
        feedback: session.feedback,
      });
    }

    // ---------------- NEXT QUESTION LOGIC ----------------
    const nextQuestionNumber = session.questionsAsked + 1;
    let nextQuestionPrompt = "";

    // Q2 → Background
    if (nextQuestionNumber === 2) {
      nextQuestionPrompt = `
You are an interviewer.
Ask about the candidate's background, experience level, or education.
Keep it conversational.
      `;
    }
    // Q3 → Experience / Skills
    else if (nextQuestionNumber === 3) {
      nextQuestionPrompt = `
You are an interviewer.
Ask about the candidate's experience, skills, or technologies they have worked with.
      `;
    }
    // Q4+ → Technical interview
    else {
      nextQuestionPrompt = `
You are an AI interviewer.
Ask a technical interview question for the role: ${session.role}.
ONLY ask the question.
      `;
    }

    let nextQuestion = await generateAIResponse(nextQuestionPrompt);

    if (!nextQuestion?.trim()) {
      nextQuestion = `Describe your experience related to this role.`;
    }

    nextQuestion = `Q${nextQuestionNumber}: ${nextQuestion.trim()}`;

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
        status: session.status,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    console.error("Resume Interview Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
