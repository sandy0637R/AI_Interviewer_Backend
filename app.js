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
import authRoutes from "./routes/authRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js"
app.use("/auth", authRoutes);
app.use("/interview", interviewRoutes);
app.use("/sessions",sessionRoutes)
export default app;
