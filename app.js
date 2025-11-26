// app.js
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

connectDB();
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
import interviewRoutes from "./routes/interviewRoutes.js";
app.use("/interview", interviewRoutes);

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
