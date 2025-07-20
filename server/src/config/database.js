import mongoose from "mongoose";
import betService from "../services/bet.service.js";
const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/bet-app";
  
  mongoose
    .connect(mongoURI)
    .then(async () => {
      console.log("Connected to MongoDB");
      console.log("MongoDB URI:", mongoURI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")); // Hide credentials in logs
      // Recover missed bets on startup
    })
    .catch((error) => {
      console.error("MongoDB connection error:", error);
    });
};

export default connectDB;
