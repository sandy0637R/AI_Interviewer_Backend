import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const connStr = process.env.MONGO_URI;

    if (!connStr) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }

    await mongoose.connect(connStr);
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
