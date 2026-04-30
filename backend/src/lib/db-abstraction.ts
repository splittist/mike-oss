/**
 * Database abstraction layer.
 * Repository-style functions provide stable method signatures.
 * Initially wraps Supabase; will migrate to SQLite backend without changing routes.
 */

import { createServerSupabase } from "./supabase";

export type Db = ReturnType<typeof createServerSupabase>;

// ---------------------------------------------------------------------------
// User Profile Repo
// ---------------------------------------------------------------------------

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  organisation: string | null;
  tier: string;
  message_credits_used: number;
  credits_reset_date: string;
  tabular_model: string;
  claude_api_key: string | null;
  gemini_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(
  userId: string,
  db: Db
): Promise<UserProfile | null> {
  const { data, error } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data as UserProfile | null;
}

export async function upsertUserProfile(
  userId: string,
  db: Db
): Promise<UserProfile | null> {
  const { data, error } = await db
    .from("user_profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("*")
    .single();
  if (error) return null;
  return data as UserProfile | null;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
  db: Db
): Promise<UserProfile | null> {
  const { data, error } = await db
    .from("user_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data as UserProfile | null;
}

// ---------------------------------------------------------------------------
// Project Repo
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  user_id: string;
  name: string;
  cm_number: string | null;
  visibility: string;
  shared_with: string[] | null;
  created_at: string;
  updated_at: string;
}

export async function listProjectsByUser(
  userId: string,
  db: Db
): Promise<Project[]> {
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function getProject(projectId: string, db: Db): Promise<Project | null> {
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  return (data as Project | null) ?? null;
}

export async function createProject(
  userId: string,
  name: string,
  cm_number?: string | null,
  db?: Db
): Promise<Project | null> {
  const client = db ?? createServerSupabase();
  const { data, error } = await client
    .from("projects")
    .insert({
      user_id: userId,
      name: name.trim(),
      cm_number: cm_number ?? null,
      shared_with: [],
    })
    .select("*")
    .single();
  if (error) return null;
  return data as Project | null;
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: Partial<Project>,
  db: Db
): Promise<Project | null> {
  const { data, error } = await db
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data as Project | null;
}

export async function deleteProject(
  projectId: string,
  userId: string,
  db: Db
): Promise<boolean> {
  const { error } = await db
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);
  return !error;
}

// ---------------------------------------------------------------------------
// Chat Repo
// ---------------------------------------------------------------------------

export interface Chat {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export async function listChatsByUser(userId: string, db: Db): Promise<Chat[]> {
  const { data } = await db
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Chat[];
}

export async function getChat(chatId: string, db: Db): Promise<Chat | null> {
  const { data } = await db.from("chats").select("*").eq("id", chatId).single();
  return (data as Chat | null) ?? null;
}

export async function createChat(
  userId: string,
  projectId?: string | null,
  db?: Db
): Promise<Chat | null> {
  const client = db ?? createServerSupabase();
  const { data, error } = await client
    .from("chats")
    .insert({ user_id: userId, project_id: projectId ?? undefined })
    .select("*")
    .single();
  if (error) return null;
  return data as Chat | null;
}

export async function updateChat(
  chatId: string,
  userId: string,
  updates: Partial<Chat>,
  db: Db
): Promise<Chat | null> {
  const { data, error } = await db
    .from("chats")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data as Chat | null;
}

export async function deleteChat(chatId: string, userId: string, db: Db): Promise<boolean> {
  const { error } = await db.from("chats").delete().eq("id", chatId).eq("user_id", userId);
  return !error;
}

// ---------------------------------------------------------------------------
// Document Repo
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  project_id: string | null;
  user_id: string;
  filename: string;
  file_type: string | null;
  size_bytes: number;
  page_count: number | null;
  structure_tree: unknown | null;
  status: string;
  folder_id: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listDocumentsByUser(userId: string, db: Db): Promise<Document[]> {
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Document[];
}

export async function listDocumentsByProject(
  projectId: string,
  db: Db
): Promise<Document[]> {
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Document[];
}

export async function getDocument(documentId: string, db: Db): Promise<Document | null> {
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();
  return (data as Document | null) ?? null;
}

export async function deleteDocument(
  documentId: string,
  userId: string,
  db: Db
): Promise<boolean> {
  const { error } = await db
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);
  return !error;
}

// ---------------------------------------------------------------------------
// Workflow Repo
// ---------------------------------------------------------------------------

export interface Workflow {
  id: string;
  user_id: string | null;
  title: string;
  type: string;
  prompt_md: string | null;
  columns_config: unknown | null;
  practice: string | null;
  is_system: boolean;
  created_at: string;
}

export async function listWorkflowsByUser(userId: string, db: Db): Promise<Workflow[]> {
  const { data } = await db
    .from("workflows")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Workflow[];
}

export async function getWorkflow(workflowId: string, db: Db): Promise<Workflow | null> {
  const { data } = await db
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .single();
  return (data as Workflow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Tabular Review Repo
// ---------------------------------------------------------------------------

export interface TabularReview {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  columns_json: unknown;
  created_at: string;
  updated_at: string;
}

export async function listTabularReviewsByUser(userId: string, db: Db): Promise<TabularReview[]> {
  const { data } = await db
    .from("tabular_reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as TabularReview[];
}

export async function getTabularReview(
  reviewId: string,
  db: Db
): Promise<TabularReview | null> {
  const { data } = await db
    .from("tabular_reviews")
    .select("*")
    .eq("id", reviewId)
    .single();
  return (data as TabularReview | null) ?? null;
}
