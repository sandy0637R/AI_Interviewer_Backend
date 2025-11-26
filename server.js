// server.js
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import InterviewSession from "./models/interviewSession.js";
import { generateAIResponse } from "./services/aiService.js";

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }, // allow React Native app
});

io.on("connection", (socket) => {
  console.log("💡 Client connected:", socket.id);

  // Handle user answer
  socket.on("user_message", async ({ sessionId, answer }) => {
    const session = await InterviewSession.findById(sessionId);
    if (!session) return;

    // Save answer
    session.questionsAsked += 1;
    session.answers.push({ questionNumber: session.questionsAsked, answer });
    await session.save();

    // If 5 questions done → generate feedback
    if (session.questionsAsked === 5) {
      const prompt = `
        Role: ${session.role}
        User answers:
        ${session.answers.map(a => `Q${a.questionNumber}: ${a.answer}`).join("\n")}
        Generate final feedback in 4–5 lines
      `;
      const feedback = await generateAIResponse(prompt);
      session.isCompleted = true;
      session.feedback = feedback;
      await session.save();

      return socket.emit("ai_feedback", { feedback });
    }

    // Generate next question
    const nextPrompt = `Ask Question ${session.questionsAsked + 1} for role ${session.role}`;
    const nextQuestion = await generateAIResponse(nextPrompt);

    socket.emit("ai_message", { questionNumber: session.questionsAsked + 1, question: nextQuestion });
  });

  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

server.listen(PORT, () => {
  console.log(`🚀 Server + Socket.io running on port ${PORT}`);
});
