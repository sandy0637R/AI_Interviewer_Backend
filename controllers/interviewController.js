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
      questionsAsked: 1,
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

    // Strip AI's potential "Q1: " prefix
    if (greeting) {
      greeting = greeting.replace(/^(Q\d+|Question\s*\d+)[:.]?\s*/i, "").trim();
    }

    if (!greeting) {
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
// ------------------- NEXT QUESTION -------------------
export const nextQuestion = async (req, res) => {
  try {
    const { sessionId, answer } = req.body;

    const session = await InterviewSession.findById(sessionId);
    if (!session)
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });

    const currentQuestionNumber = session.questionsAsked;
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

    const skipKeywords = ["i don't know", "dont know", "no idea", "not sure", "pass"];
    const shouldSkipRelevance = skipKeywords.some((k) => normalizedAnswer.includes(k));

    // ---------------- PREPARE PROMPTS ----------------
    // Next question number should be current + 1 (State 1 -> Asking Q2)
    const nextQuestionNumber = currentQuestionNumber + 1;
    let nextQuestionPrompt = "";

    const previousQuestions = session.answers
      .map((a) => a.question)
      .concat(session.lastQuestion)
      .join("\n");

    const duplicateInstruction = `
Do NOT ask any of the following questions (or similar variants):
${previousQuestions}
`;

    // Determine prompt for the *future* question matches what logic we had
    if (nextQuestionNumber === 2) {
      nextQuestionPrompt = `
You are an interviewer.
Ask a VERY EASY and basic question about the role: ${session.role}.
Do NOT ask about background, education, or personal details.
Keep it strictly technical but beginner-friendly.
${duplicateInstruction}
      `;
    } else if (nextQuestionNumber === 3) {
      nextQuestionPrompt = `
You are an interviewer.
Ask another VERY EASY question about the role: ${session.role}.
Do NOT ask about personal history.
${duplicateInstruction}
      `;
    } else {
      nextQuestionPrompt = `
You are an AI interviewer.
Ask a VERY EASY technical question for the role: ${session.role}.
Do NOT ask complex or tricky questions.
Maintain a friendly tone.
ONLY ask the question.
${duplicateInstruction}
      `;
    }

    // ---------------- PARALLEL EXECUTION ----------------
    // We start both tasks immediately
    const relevancePromise = (async () => {
      if (shouldSkipRelevance) return "relevant"; // Allow "I don't know" to pass

      if (currentQuestionNumber === 1) {
        // Q1 Logic
        const wordCount = answer?.trim().split(/\s+/).length || 0;
        const hasLetters = /[a-zA-Z]/.test(answer);
        return (wordCount < 2 || !hasLetters) ? "irrelevant" : "relevant";
      } else {
        return checkAnswerRelevance(
          `Question Q${currentQuestionNumber} for role ${session.role}`,
          answer
        );
      }
    })();

    const nextQuestionPromise = (async () => {
      // If we are answering the last question (questionsAsked == totalQuestions), we generate feedback.
      // E.g. total 5. Asking 1 -> Answering 1. Next is 2.
      // Asking 4 -> Answering 4. Next is 5.
      // Asking 5 -> Answering 5. Next is NULL (Feedback).

      if (currentQuestionNumber >= session.totalQuestions) {
        return null; // Signals we need feedback
      }
      return generateAIResponse(nextQuestionPrompt);
    })();

    // Await both
    const [relevance, nextQuestionText] = await Promise.all([
      relevancePromise,
      nextQuestionPromise
    ]);

    // ---------------- CHECK RELEVANCE ----------------
    // Ensure strict normalization
    const safeRelevance = relevance?.toString().trim().toLowerCase() || "relevant";

    if (safeRelevance.includes("irrelevant") || safeRelevance === "dont_know") {
      return res.json({
        success: false,
        askAgain: true,
        message:
          "Your answer doesn't match the question. Please answer again correctly.",
      });
    }

    // If valid, Proceed

    // SAFETY: Ensure questionNumber is valid (Schema min: 1)
    if (session.questionsAsked < 1) {
      console.warn(`⚠️ Fixed invalid questionsAsked (0) for session ${session._id}`);
      session.questionsAsked = 1;
    }

    const saveQuestionNumber = session.questionsAsked;

    // SAVE ANSWER for current question BEFORE incrementing
    session.answers.push({
      questionNumber: saveQuestionNumber,
      question: session.lastQuestion,
      answer,
    });
    session.questionsAsked += 1;

    // ---------------- FINAL FEEDBACK (If end) ----------------
    if (session.questionsAsked > session.totalQuestions) {
      const feedbackPrompt = `
You are an AI interviewer.
Evaluate the candidate's answers based on technical accuracy, depth, and communication.

CRITICAL SCORING RULES:
- If the candidate answers "I don't know", "pass", or irrelevant nonsense to ANY question, significantly lower the rating.
- If the candidate fails to answer most questions technically or answers "I don't know" repeatedly, the rating MUST be below 4.
- A rating of 6 or higher is reserved ONLY for candidates who demonstrate actual technical knowledge.
- Be strict. Do not give participation points for empty answers.

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

    // ---------------- NEXT QUESTION ----------------
    let finalNextQuestion = nextQuestionText;

    if (!finalNextQuestion?.trim()) {
      finalNextQuestion = `Describe your experience related to this role.`;
    }

    // Strip AI's potential "Q2: " or "Question 2:" prefix
    finalNextQuestion = finalNextQuestion.replace(/^(Q\d+|Question\s*\d+)[:.]?\s*/i, "").trim();

    finalNextQuestion = `Q${nextQuestionNumber}: ${finalNextQuestion}`;

    session.lastQuestion = finalNextQuestion;
    await session.save();

    res.json({
      success: true,
      questionNumber: nextQuestionNumber,
      question: finalNextQuestion,
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
