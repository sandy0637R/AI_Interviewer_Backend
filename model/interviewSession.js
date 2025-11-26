// models/interviewSession.js
import mongoose from "mongoose";

// Sub-schema for individual answers
const answerSchema = new mongoose.Schema({
  questionNumber: { type: Number, required: true },
  answer: { type: String, required: true },
});

const InterviewSessionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isAnonymous: {
      type: Boolean,
      default: true,
    },

    questionsAsked: {
      type: Number,
      default: 0,
    },

    answers: {
      type: [answerSchema], // <-- updated to store objects
      default: [],
    },

    feedback: {
      type: String,
      default: null,
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InterviewSession", InterviewSessionSchema);
