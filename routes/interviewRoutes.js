import express from "express";
import {
  startInterview,
  nextQuestion,
  resumeInterview
} from "../controllers/interviewController.js";

const router = express.Router();

// Start interview
router.post("/start", startInterview);

// Next question (save answer)
router.post("/next", nextQuestion);

// Resume an existing session
router.post("/resume", resumeInterview);

export default router;
