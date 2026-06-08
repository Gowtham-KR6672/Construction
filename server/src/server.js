import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { connectDatabase } from "./utils/db.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import teamRoutes from "./routes/team.routes.js";
import approvalRoutes from "./routes/approval.routes.js";
import adminAttendanceRoutes from "./routes/adminAttendance.routes.js";

dotenv.config();

const app = express();

const allowedOrigins = (process.env.CLIENT_ORIGINS || "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const isLocalNetwork = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+):\d+$/.test(origin);
      const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

      if (allowedOrigins.includes(origin) || isLocalNetwork || isVercelPreview) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json());

app.use(async (_req, _res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "construction-admin-login-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/admin-attendance", adminAttendanceRoutes);

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Server error" });
});

const isServerless = Boolean(process.env.VERCEL);

if (!isServerless) {
  const port = process.env.PORT || 5000;
  connectDatabase()
    .then(() => {
      const server = app.listen(port, () => {
        console.log(`API running on http://localhost:${port}`);
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`Port ${port} is already in use. Stop the existing server or set PORT to another value.`);
          process.exit(1);
        }

        throw err;
      });
    })
    .catch((err) => {
      console.error("Failed to start API:", err);
      process.exit(1);
    });
}

export default app;
