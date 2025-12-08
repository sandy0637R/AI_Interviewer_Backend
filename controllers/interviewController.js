import InterviewSession from "../models/interviewSession.js";
import { generateAIResponse } from "../services/aiService.js";
import { checkAnswerRelevance } from "../services/relevanceService.js";

// ------------------- START INTERVIEW -------------------
export const startInterview = async (req, res) => {
  try {
    const { role, userId, isAnonymous, totalQuestions } = req.body;

    if (!totalQuestions || totalQuestions < 1) {
      return res.status(400).json({ success: false, message: "totalQuestions must be provided" });
    }

    const session = await InterviewSession.create({
      role,
      userId: userId || null,
      isAnonymous: isAnonymous ?? true,
      totalQuestions,
      questionsAsked: 0,
      answers: [],
      isCompleted: false,
    });

    const prompt = `
You are an AI interviewer.
Ask Question Q1 for the role: ${role}.
ONLY ask the question. No intro or explanation.
    `;

    let question = await generateAIResponse(prompt);
    if (!question?.trim()) {
      question = "Q1: Please answer this question: What is your understanding of this role?";
    } else {
      question = `Q1: ${question.trim()}`;
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

    const session = await InterviewSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    const currentQuestionNumber = session.questionsAsked + 1;
    const normalizedAnswer = answer?.toLowerCase() || "";

    // ------------------ REPEAT LOGIC ------------------
    const repeatKeywords = [
      "repeat", "say again", "tell again", "can you repeat", "please repeat",
      "didn't understand", "didnt understand", "do not understand", "dont understand", "explain again"
    ];

    if (repeatKeywords.some((k) => normalizedAnswer.includes(k))) {
      const repeatedPrompt = `
You are an AI interviewer.
Repeat Question Q${currentQuestionNumber} for the role: ${session.role}.
ONLY repeat the question. No extra text.
      `;
      let repeated = await generateAIResponse(repeatedPrompt);
      if (!repeated?.trim()) repeated = `Q${currentQuestionNumber}: Let me repeat the question: What is your understanding of this role?`;
      else repeated = `Q${currentQuestionNumber}: ${repeated.trim()}`;

      return res.json({
        success: true,
        repeat: true,
        questionNumber: currentQuestionNumber,
        question: repeated,
      });
    }

    // ------------------ RELEVANCE CHECK ------------------
    const relevance = await checkAnswerRelevance(
      `Question Q${currentQuestionNumber} for role ${session.role}`,
      answer
    );

    if (relevance === "irrelevant") {
      return res.json({
        success: false,
        askAgain: true,
        message: "Your answer doesn't match the question. Please answer again correctly.",
      });
    }

    // Save answer with serial
    session.questionsAsked += 1;
    session.answers.push({ questionNumber: session.questionsAsked, answer });

    // ------------------ FINAL FEEDBACK ------------------
    if (session.questionsAsked === session.totalQuestions) {
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

      let feedback = await generateAIResponse(feedbackPrompt);
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
Ask Question Q${nextQuestionNumber} for the role: ${session.role}.
ONLY ask the question. No extra sentences.
    `;

    let nextQuestion = await generateAIResponse(nextPrompt);
    if (!nextQuestion?.trim()) nextQuestion = `Q${nextQuestionNumber}: Please describe your previous experience relevant to this role.`;
    else nextQuestion = `Q${nextQuestionNumber}: ${nextQuestion.trim()}`;

    await session.save();

    return res.json({
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

    const session = await InterviewSession.findById(sessionId);
    if (!session) return res.status(404).json({ success: false, message: "Session not found" });

    if (session.isCompleted)
      return res.json({ success: true, completed: true, feedback: session.feedback });

    const nextQuestionNumber = session.questionsAsked + 1;
    const prompt = `
You are an AI interviewer.
Ask Question Q${nextQuestionNumber} for the role: ${session.role}.
ONLY ask the question. No extra text.
    `;

    let question = await generateAIResponse(prompt);
    if (!question?.trim()) question = `Q${nextQuestionNumber}: What skills make you suitable for this role?`;
    else question = `Q${nextQuestionNumber}: ${question.trim()}`;

    return res.json({
      success: true,
      questionNumber: nextQuestionNumber,
      question,
      totalQuestions: session.totalQuestions,
      answersSoFar: session.answers.map(a => ({ ...a, questionNumber: `Q${a.questionNumber}` })),
    });
  } catch (error) {
    console.error("Resume Interview Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
