import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected:", mongoose.connection.host);
  } catch (error) {
    console.error("❌ MongoDB Error:", error);
    process.exit(1);
  }
};

export default connectDB;
