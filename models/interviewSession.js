import mongoose from "mongoose";

// ---------------- ANSWER SUB-SCHEMA ----------------
const answerSchema = new mongoose.Schema(
  {
    questionNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
  },
  { _id: false, timestamps: true }
);

// ---------------- FEEDBACK SUB-SCHEMA ----------------
const feedbackSchema = new mongoose.Schema(
  {
    rating: { type: Number, min: 0, max: 10 },
    plusPoints: { type: [String], default: [] },
    improvements: { type: [String], default: [] },
    summary: { type: String, maxlength: 2000 },
  },
  { _id: false }
);

// ---------------- MAIN SESSION SCHEMA ----------------
const InterviewSessionSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, trim: true, minlength: 2, maxlength: 200, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    isAnonymous: { type: Boolean, default: true },

    // 🔹 INTERVIEW FLOW CONTROL (NEW)
    stage: {
      type: String,
      enum: ["greeting", "introduction", "interview", "completed"],
      default: "greeting",
      index: true,
    },

    questionsAsked: { type: Number, default: 0, min: 0, max: 100 },
    totalQuestions: { type: Number, required: true, min: 1, max: 100 },
    answers: { type: [answerSchema], default: [] },
    lastQuestion: { type: String, default: null },
    feedback: { type: feedbackSchema, default: null },

    // ✅ EXISTING STATUS (UNCHANGED)
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
      index: true,
    },

    isCompleted: { type: Boolean, default: false, index: true },
    ip: { type: String, index: true },
  },
  { timestamps: true }
);

InterviewSessionSchema.index({ createdAt: -1 });

export default mongoose.model("InterviewSession", InterviewSessionSchema);
