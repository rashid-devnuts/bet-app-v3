import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import connectDB from "./config/database.js";
import { notFound, errorHandler, requireAdmin } from "./middlewares/index.js";
import sportsMonkRouter from "./routes/sportsMonk.routes.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import financeRoutes from "./routes/finance.routes.js";
const app = express();
const PORT = process.env.PORT || 4000;

// Connect to MongoDB
connectDB();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Simple Morgan configuration - shows device and request type
morgan.token("device", (req) => {
  const userAgent = req.headers["user-agent"] || "Unknown";
  if (userAgent.includes("Mobile")) return "Mobile";
  if (userAgent.includes("Tablet")) return "Tablet";
  if (userAgent.includes("Chrome")) return "Chrome Browser";
  if (userAgent.includes("Firefox")) return "Firefox Browser";
  if (userAgent.includes("Safari")) return "Safari Browser";
  if (userAgent.includes("Postman")) return "Postman";
  if (userAgent.includes("curl")) return "cURL";
  return "Unknown Device";
});

// Custom format: Device and Request Type
app.use(morgan(":device made :method request to: :url"));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sportsmonk", sportsMonkRouter);
app.use("/api/finance", requireAdmin, financeRoutes);

// 404 handler - must be after all routes
app.use(notFound);
// Global error handler - must be last middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
