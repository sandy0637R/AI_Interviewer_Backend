import InterviewSession from "../models/interviewSession.js";

export const getUserSessions = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const sessions = await InterviewSession.find({ userId })
      .sort({ createdAt: -1 }) // latest first
      .lean(); // 🔹 ensures full plain JSON object

    res.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error("Get User Sessions Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "sessionId is required",
      });
    }

    const deletedSession = await InterviewSession.findByIdAndDelete(sessionId);

    if (!deletedSession) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    res.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("Delete Session Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};