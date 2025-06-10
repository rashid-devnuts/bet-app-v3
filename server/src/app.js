import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { notFound, errorHandler } from "./middlewares/index.js";
import sportsMonkRouter from "./routes/sportsMonk.routes.js";
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

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

// Add more routes here as needed
// app.use('/api/users', userRoutes);
// app.use('/api/auth', authRoutes);
app.use("/api/sportsmonk", sportsMonkRouter);

// 404 handler - must be after all routes
app.use(notFound);
// Global error handler - must be last middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
