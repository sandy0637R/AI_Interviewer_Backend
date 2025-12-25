import express from "express";
import { getUserSessions,deleteSession } from "../controllers/sessionController.js";
import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();

router.get("/user/:userId",protect, getUserSessions);
router.delete("/:sessionId",protect, deleteSession);


export default router;
