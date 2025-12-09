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
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
  },
  { _id: false, timestamps: true }
);

// ---------------- MAIN SESSION SCHEMA ----------------
const InterviewSessionSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, trim: true, minlength: 2, maxlength: 200, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    isAnonymous: { type: Boolean, default: true },
    questionsAsked: { type: Number, default: 0, min: 0, max: 100 },
    totalQuestions: { type: Number, required: true, min: 1, max: 100 }, // 🔥 NEW FIELD
    answers: { type: [answerSchema], default: [] },
    feedback: { type: String, default: null, trim: true, maxlength: 15000 },
    isCompleted: { type: Boolean, default: false, index: true },
    ip: { type: String, index: true },
  },
  { timestamps: true }
);

InterviewSessionSchema.index({ createdAt: -1 });

export default mongoose.model("InterviewSession", InterviewSessionSchema);
