import express from "express";
import { getUserSessions } from "../controllers/sessionController.js";

const router = express.Router();

router.get("/user/:userId", getUserSessions);

export default router;
