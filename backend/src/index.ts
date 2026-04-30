import "dotenv/config";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat";
import { projectsRouter } from "./routes/projects";
import { projectChatRouter } from "./routes/projectChat";
import { documentsRouter } from "./routes/documents";
import { tabularRouter } from "./routes/tabular";
import { workflowsRouter } from "./routes/workflows";
import { userRouter } from "./routes/user";
import { downloadsRouter } from "./routes/downloads";
import { config } from "./config/env";
import { initializeDatabase, db as sqliteDb } from "./db/sqlite";
import * as dbRepo from "./lib/db-abstraction";
import { createServerSupabase } from "./lib/supabase";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));

app.use("/chat", chatRouter);
app.use("/projects", projectsRouter);
app.use("/projects/:projectId/chat", projectChatRouter);
app.use("/single-documents", documentsRouter);
app.use("/tabular-review", tabularRouter);
app.use("/workflows", workflowsRouter);
app.use("/user", userRouter);
app.use("/users", userRouter);
app.use("/download", downloadsRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

// Initialize database if in local mode
if (config.mode === "local") {
  console.log("🔧 Initializing local SQLite database...");
  try {
    initializeDatabase();
    console.log("✅ Database initialized successfully");

    // Initialize default user profile for local development
    (async () => {
      const userId = "local@localhost";
      const existingProfile = await dbRepo.getUserProfile(userId, sqliteDb as any);
      if (!existingProfile) {
        console.log("👤 Creating default local user profile...");
        await dbRepo.upsertUserProfile(userId, sqliteDb as any);
        console.log(`✅ User profile created for ${userId}`);
      }
    })().catch((err) => {
      console.error("❌ Failed to initialize user profile:", err);
    });
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  }
}

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`Mike backend running on port ${PORT} (mode: ${config.mode})`);
});
