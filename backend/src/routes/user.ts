import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { getUserProfile, upsertUserProfile } from "../lib/db-abstraction";

export const userRouter = Router();

// GET /user/profile
userRouter.get("/profile", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const profile = await getUserProfile(userId, db);
  if (!profile) return void res.status(404).json({ detail: "Profile not found" });
  res.json(profile);
});

// POST /user/profile
userRouter.post("/profile", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const ok = await upsertUserProfile(userId, db);
  if (!ok) return void res.status(500).json({ detail: "Failed to upsert profile" });
  res.json({ ok: true });
});

// DELETE /user/account
userRouter.delete("/account", requireAuth, async (_req, res) => {
  const userId = res.locals.userId as string;
  const db = createServerSupabase();
  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return void res.status(500).json({ detail: error.message });
  res.status(204).send();
});
