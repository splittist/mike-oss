/**
 * Database abstraction layer.
 * Repository-style functions provide stable method signatures.
 * Initially wraps Supabase; will migrate to SQLite backend without changing routes.
 */

import { createServerSupabase } from "./supabase";
import { config } from "../config/env";
import * as sqlite from "../db/sqlite";

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
  if (config.mode === "local") {
    return sqlite.getUserProfile(userId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.upsertUserProfile(userId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.updateUserProfile(userId, updates);
  }
  
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
  if (config.mode === "local") {
    return sqlite.listProjectsByUser(userId);
  }
  
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function getProject(projectId: string, db: Db): Promise<Project | null> {
  if (config.mode === "local") {
    return sqlite.getProject(projectId);
  }
  
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
  shared_with?: string[] | null,
  db?: Db
): Promise<Project | null> {
  if (config.mode === "local") {
    return sqlite.createProject(userId, name, cm_number, shared_with);
  }
  
  const client = db ?? createServerSupabase();
  const { data, error } = await client
    .from("projects")
    .insert({
      user_id: userId,
      name: name.trim(),
      cm_number: cm_number ?? null,
      shared_with: shared_with ?? [],
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
  if (config.mode === "local") {
    return sqlite.updateProject(projectId, userId, updates);
  }
  
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
  if (config.mode === "local") {
    return sqlite.deleteProject(projectId, userId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.listChatsByUser(userId);
  }
  
  const { data } = await db
    .from("chats")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Chat[];
}

export async function getChat(chatId: string, db: Db): Promise<Chat | null> {
  if (config.mode === "local") {
    return sqlite.getChat(chatId);
  }
  
  const { data } = await db.from("chats").select("*").eq("id", chatId).single();
  return (data as Chat | null) ?? null;
}

export async function createChat(
  userId: string,
  projectId?: string | null,
  db?: Db
): Promise<Chat | null> {
  if (config.mode === "local") {
    return sqlite.createChat(userId, projectId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.updateChat(chatId, userId, updates);
  }
  
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
  if (config.mode === "local") {
    return sqlite.deleteChat(chatId, userId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.listDocumentsByUser(userId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.listDocumentsByProject(projectId);
  }
  
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Document[];
}

export async function getDocument(documentId: string, db: Db): Promise<Document | null> {
  if (config.mode === "local") {
    return sqlite.getDocument(documentId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.deleteDocument(documentId, userId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.listWorkflowsByUser(userId);
  }
  
  const { data } = await db
    .from("workflows")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Workflow[];
}

export async function getWorkflow(workflowId: string, db: Db): Promise<Workflow | null> {
  if (config.mode === "local") {
    return sqlite.getWorkflow(workflowId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.listTabularReviewsByUser(userId);
  }
  
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
  if (config.mode === "local") {
    return sqlite.getTabularReview(reviewId);
  }
  
  const { data } = await db
    .from("tabular_reviews")
    .select("*")
    .eq("id", reviewId)
    .single();
  return (data as TabularReview | null) ?? null;
}

// ---------------------------------------------------------------------------
// Extended Project Repo
// ---------------------------------------------------------------------------

export async function listSharedProjects(
  userEmail: string,
  userId: string,
  db: Db
): Promise<Project[]> {
  if (config.mode === "local") {
    return sqlite.listSharedProjects(userEmail, userId);
  }
  
  const { data } = await db
    .from("projects")
    .select("*")
    .contains("shared_with", [userEmail])
    .neq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function countDocumentsInProject(
  projectId: string,
  db: Db
): Promise<number> {
  if (config.mode === "local") {
    return sqlite.countDocumentsInProject(projectId);
  }
  
  const { count } = await db
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

export async function countChatsInProject(
  projectId: string,
  db: Db
): Promise<number> {
  if (config.mode === "local") {
    return sqlite.countChatsInProject(projectId);
  }
  
  const { count } = await db
    .from("chats")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

export async function countReviewsInProject(
  projectId: string,
  db: Db
): Promise<number> {
  if (config.mode === "local") {
    return sqlite.countReviewsInProject(projectId);
  }
  
  const { count } = await db
    .from("tabular_reviews")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

export async function listDocumentsByProjectAsc(
  projectId: string,
  db: Db
): Promise<Document[]> {
  if (config.mode === "local") {
    return sqlite.listDocumentsByProjectAsc(projectId);
  }
  
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Document[];
}

export async function listProjectSubfolders(
  projectId: string,
  db: Db
): Promise<Record<string, unknown>[]> {
  if (config.mode === "local") {
    return sqlite.listProjectSubfolders(projectId);
  }
  
  const { data } = await db
    .from("project_subfolders")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Record<string, unknown>[];
}

export async function getUserProfilesByIds(
  userIds: string[],
  db: Db
): Promise<Pick<UserProfile, "user_id" | "display_name" | "organisation">[]> {
  if (config.mode === "local") {
    return sqlite.getUserProfilesByIds(userIds);
  }
  
  if (userIds.length === 0) return [];
  const { data } = await db
    .from("user_profiles")
    .select("user_id, display_name, organisation")
    .in("user_id", userIds);
  return (data ?? []) as Pick<UserProfile, "user_id" | "display_name" | "organisation">[];
}

// ---------------------------------------------------------------------------
// Extended Chat Repo
// ---------------------------------------------------------------------------

export async function listChatsByProject(
  projectId: string,
  db: Db
): Promise<Chat[]> {
  if (config.mode === "local") {
    return sqlite.listChatsByProject(projectId);
  }
  
  const { data } = await db
    .from("chats")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Chat[];
}

export async function listChatsForUserAndProjects(
  userId: string,
  projectIds: string[],
  db: Db
): Promise<Chat[]> {
  if (config.mode === "local") {
    return sqlite.listChatsForUserAndProjects(userId, projectIds);
  }
  
  const filter =
    projectIds.length > 0
      ? `user_id.eq.${userId},project_id.in.(${projectIds.join(",")})`
      : `user_id.eq.${userId}`;
  const { data } = await db
    .from("chats")
    .select("*")
    .or(filter)
    .order("created_at", { ascending: false });
  return (data ?? []) as Chat[];
}

export async function updateChatTitle(
  chatId: string,
  title: string,
  db: Db
): Promise<void> {
  if (config.mode === "local") {
    return sqlite.updateChatTitle(chatId, title);
  }
  
  await db.from("chats").update({ title }).eq("id", chatId);
}

// ---------------------------------------------------------------------------
// Chat Message Repo
// ---------------------------------------------------------------------------

export async function listChatMessages(
  chatId: string,
  db: Db
): Promise<Record<string, unknown>[]> {
  if (config.mode === "local") {
    return sqlite.listChatMessages(chatId);
  }
  
  const { data } = await db
    .from("chat_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Record<string, unknown>[];
}

export async function insertChatMessage(
  payload: {
    chat_id: string;
    role: string;
    content: unknown;
    files?: unknown;
    workflow?: unknown;
    annotations?: unknown;
  },
  db: Db
): Promise<void> {
  if (config.mode === "local") {
    return sqlite.insertChatMessage(payload);
  }
  
  await db.from("chat_messages").insert({
    chat_id: payload.chat_id,
    role: payload.role,
    content: payload.content,
    files: payload.files ?? null,
    workflow: payload.workflow ?? null,
    annotations: payload.annotations ?? null,
  });
}

export async function getEditStatuses(
  editIds: string[],
  db: Db
): Promise<{ id: string; status: "pending" | "accepted" | "rejected" }[]> {
  if (config.mode === "local") {
    return sqlite.getEditStatuses(editIds);
  }
  
  if (editIds.length === 0) return [];
  const { data } = await db
    .from("document_edits")
    .select("id, status")
    .in("id", editIds);
  return (data ?? []) as { id: string; status: "pending" | "accepted" | "rejected" }[];
}

export async function getVersionNumbers(
  versionIds: string[],
  db: Db
): Promise<{ id: string; version_number: number | null }[]> {
  if (config.mode === "local") {
    return sqlite.getVersionNumbers(versionIds);
  }
  
  if (versionIds.length === 0) return [];
  const { data } = await db
    .from("document_versions")
    .select("id, version_number")
    .in("id", versionIds);
  return (data ?? []) as { id: string; version_number: number | null }[];
}

// ---------------------------------------------------------------------------
// Extended Document Repo
// ---------------------------------------------------------------------------

export async function listDocumentsByUserNoProject(
  userId: string,
  db: Db
): Promise<Document[]> {
  if (config.mode === "local") {
    return sqlite.listDocumentsByUserNoProject(userId);
  }
  
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .is("project_id", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as Document[];
}

export async function getDocumentByOwner(
  documentId: string,
  userId: string,
  db: Db
): Promise<Document | null> {
  if (config.mode === "local") {
    return sqlite.getDocumentByOwner(documentId, userId);
  }
  
  const { data } = await db
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();
  return (data as Document | null) ?? null;
}

export async function getDocumentVersionsByDocumentId(
  documentId: string,
  db: Db
): Promise<{ storage_path: string; pdf_storage_path: string | null }[]> {
  if (config.mode === "local") {
    return sqlite.getDocumentVersionsByDocumentId(documentId);
  }
  
  const { data } = await db
    .from("document_versions")
    .select("storage_path, pdf_storage_path")
    .eq("document_id", documentId);
  return (data ?? []) as { storage_path: string; pdf_storage_path: string | null }[];
}

export async function getDocumentVersionByStoragePath(
  storagePath: string,
  db: Db
): Promise<{ id: string; document_id: string } | null> {
  if (config.mode === "local") {
    return sqlite.getDocumentVersionByStoragePath(storagePath);
  }
  
  const { data } = await db
    .from("document_versions")
    .select("id, document_id")
    .eq("storage_path", storagePath)
    .maybeSingle();
  return (data as { id: string; document_id: string } | null) ?? null;
}

// ---------------------------------------------------------------------------
// Workflow Extended Repo
// ---------------------------------------------------------------------------

export async function createWorkflow(
  data: {
    user_id: string;
    title: string;
    type: string;
    prompt_md?: string | null;
    columns_config?: unknown;
    practice?: string | null;
  },
  db: Db
): Promise<Workflow | null> {
  if (config.mode === "local") {
    return sqlite.createWorkflow(data);
  }
  
  const { data: row, error } = await db
    .from("workflows")
    .insert({
      user_id: data.user_id,
      title: data.title.trim(),
      type: data.type,
      prompt_md: data.prompt_md ?? null,
      columns_config: data.columns_config ?? null,
      practice: data.practice ?? null,
      is_system: false,
    })
    .select("*")
    .single();
  if (error) return null;
  return row as Workflow | null;
}

export async function updateWorkflowById(
  workflowId: string,
  updates: Record<string, unknown>,
  db: Db
): Promise<Workflow | null> {
  if (config.mode === "local") {
    return sqlite.updateWorkflowById(workflowId, updates);
  }
  
  const { data, error } = await db
    .from("workflows")
    .update(updates)
    .eq("id", workflowId)
    .eq("is_system", false)
    .select("*")
    .single();
  if (error) return null;
  return data as Workflow | null;
}

export async function deleteWorkflowById(
  workflowId: string,
  userId: string,
  db: Db
): Promise<boolean> {
  if (config.mode === "local") {
    return sqlite.deleteWorkflowById(workflowId, userId);
  }
  
  const { error } = await db
    .from("workflows")
    .delete()
    .eq("id", workflowId)
    .eq("user_id", userId)
    .eq("is_system", false);
  return !error;
}

export interface WorkflowShare {
  id?: string;
  workflow_id: string;
  shared_with_email: string;
  shared_by_user_id: string;
  allow_edit: boolean;
  created_at?: string;
}

export async function listWorkflowSharesByEmail(
  email: string,
  db: Db
): Promise<WorkflowShare[]> {
  if (config.mode === "local") {
    return sqlite.listWorkflowSharesByEmail(email);
  }
  
  const { data } = await db
    .from("workflow_shares")
    .select("workflow_id, shared_by_user_id, allow_edit")
    .eq("shared_with_email", email);
  return (data ?? []) as WorkflowShare[];
}

export async function getWorkflowShareByEmail(
  workflowId: string,
  email: string,
  db: Db
): Promise<WorkflowShare | null> {
  if (config.mode === "local") {
    return sqlite.getWorkflowShareByEmail(workflowId, email);
  }
  
  const { data } = await db
    .from("workflow_shares")
    .select("allow_edit")
    .eq("workflow_id", workflowId)
    .eq("shared_with_email", email)
    .maybeSingle();
  return (data as WorkflowShare | null) ?? null;
}

export async function getWorkflowsByIds(
  ids: string[],
  db: Db
): Promise<Workflow[]> {
  if (config.mode === "local") {
    return sqlite.getWorkflowsByIds(ids);
  }
  
  if (ids.length === 0) return [];
  const { data } = await db.from("workflows").select("*").in("id", ids);
  return (data ?? []) as Workflow[];
}

export async function listWorkflowSharesByWorkflow(
  workflowId: string,
  db: Db
): Promise<WorkflowShare[]> {
  if (config.mode === "local") {
    return sqlite.listWorkflowSharesByWorkflow(workflowId);
  }
  
  const { data } = await db
    .from("workflow_shares")
    .select("id, shared_with_email, allow_edit, created_at")
    .eq("workflow_id", workflowId)
    .order("created_at", { ascending: true });
  return (data ?? []) as WorkflowShare[];
}

export async function upsertWorkflowShares(
  rows: Omit<WorkflowShare, "id" | "created_at">[],
  db: Db
): Promise<boolean> {
  if (config.mode === "local") {
    return sqlite.upsertWorkflowShares(rows);
  }
  
  const { error } = await db
    .from("workflow_shares")
    .upsert(rows, { onConflict: "workflow_id,shared_with_email" });
  return !error;
}

export async function deleteWorkflowShareById(
  shareId: string,
  workflowId: string,
  db: Db
): Promise<void> {
  if (config.mode === "local") {
    return sqlite.deleteWorkflowShareById(shareId, workflowId);
  }
  
  await db
    .from("workflow_shares")
    .delete()
    .eq("id", shareId)
    .eq("workflow_id", workflowId);
}

export async function listHiddenWorkflowIds(
  userId: string,
  db: Db
): Promise<string[]> {
  if (config.mode === "local") {
    return sqlite.listHiddenWorkflowIds(userId);
  }
  
  const { data } = await db
    .from("hidden_workflows")
    .select("workflow_id")
    .eq("user_id", userId);
  return ((data ?? []) as { workflow_id: string }[]).map((r) => r.workflow_id);
}

export async function upsertHiddenWorkflow(
  userId: string,
  workflowId: string,
  db: Db
): Promise<boolean> {
  if (config.mode === "local") {
    return sqlite.upsertHiddenWorkflow(userId, workflowId);
  }
  
  const { error } = await db
    .from("hidden_workflows")
    .upsert({ user_id: userId, workflow_id: workflowId }, { onConflict: "user_id,workflow_id" });
  return !error;
}

export async function deleteHiddenWorkflow(
  userId: string,
  workflowId: string,
  db: Db
): Promise<boolean> {
  if (config.mode === "local") {
    return sqlite.deleteHiddenWorkflow(userId, workflowId);
  }
  
  const { error } = await db
    .from("hidden_workflows")
    .delete()
    .eq("user_id", userId)
    .eq("workflow_id", workflowId);
  return !error;
}

// ---------------------------------------------------------------------------
// Tabular Cell Repo
// ---------------------------------------------------------------------------

export interface TabularCell {
  id: string;
  review_id: string;
  document_id: string;
  column_index: number;
  status: string;
  content: unknown;
  created_at: string;
  updated_at: string;
}

export async function listTabularCellsByReview(
  reviewId: string,
  db: Db
): Promise<TabularCell[]> {
  if (config.mode === "local") {
    return sqlite.listTabularCellsByReview(reviewId);
  }
  
  const { data } = await db
    .from("tabular_cells")
    .select("*")
    .eq("review_id", reviewId);
  return (data ?? []) as TabularCell[];
}

export async function insertTabularReview(
  data: {
    user_id: string;
    title: string | null;
    columns_config: unknown;
    project_id?: string | null;
    workflow_id?: string | null;
  },
  db: Db
): Promise<TabularReview | null> {
  if (config.mode === "local") {
    return sqlite.insertTabularReview(data);
  }
  
  const { data: row, error } = await db
    .from("tabular_reviews")
    .insert({
      user_id: data.user_id,
      title: data.title ?? null,
      columns_config: data.columns_config,
      project_id: data.project_id ?? null,
      workflow_id: data.workflow_id ?? null,
    })
    .select("*")
    .single();
  if (error) return null;
  return row as TabularReview | null;
}

export async function insertTabularCells(
  cells: { review_id: string; document_id: string; column_index: number; status: string }[],
  db: Db
): Promise<void> {
  if (config.mode === "local") {
    return sqlite.insertTabularCells(cells);
  }
  
  if (cells.length === 0) return;
  await db.from("tabular_cells").insert(cells);
}

export async function updateTabularReview(
  reviewId: string,
  updates: Record<string, unknown>,
  db: Db
): Promise<TabularReview | null> {
  if (config.mode === "local") {
    return sqlite.updateTabularReview(reviewId, updates);
  }
  
  const { data, error } = await db
    .from("tabular_reviews")
    .update(updates)
    .eq("id", reviewId)
    .select("*")
    .single();
  if (error) return null;
  return data as TabularReview | null;
}

export async function deleteTabularReview(
  reviewId: string,
  db: Db
): Promise<boolean> {
  if (config.mode === "local") {
    return sqlite.deleteTabularReview(reviewId);
  }
  
  const { error } = await db
    .from("tabular_reviews")
    .delete()
    .eq("id", reviewId);
  return !error;
}

export async function listTabularCellKeysForReview(
  reviewId: string,
  db: Db
): Promise<{ document_id: string; column_index: number }[]> {
  if (config.mode === "local") {
    return sqlite.listTabularCellKeysForReview(reviewId);
  }
  
  const { data } = await db
    .from("tabular_cells")
    .select("document_id, column_index")
    .eq("review_id", reviewId);
  return (data ?? []) as { document_id: string; column_index: number }[];
}

export async function deleteTabularCellsForDocs(
  reviewId: string,
  documentIds: string[],
  db: Db
): Promise<void> {
  if (config.mode === "local") {
    return sqlite.deleteTabularCellsForDocs(reviewId, documentIds);
  }
  
  if (documentIds.length === 0) return;
  await db
    .from("tabular_cells")
    .delete()
    .eq("review_id", reviewId)
    .in("document_id", documentIds);
}

export async function countDocumentsByReviewIds(
  reviewIds: string[],
  db: Db
): Promise<Record<string, number>> {
  if (config.mode === "local") {
    return sqlite.countDocumentsByReviewIds(reviewIds);
  }
  
  if (reviewIds.length === 0) return {};
  const { data } = await db
    .from("tabular_cells")
    .select("review_id, document_id")
    .in("review_id", reviewIds);
  const docCounts: Record<string, number> = {};
  if (!data) return docCounts;
  const seen = new Set<string>();
  for (const cell of data as { review_id: string; document_id: string }[]) {
    const key = `${cell.review_id}:${cell.document_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      docCounts[cell.review_id] = (docCounts[cell.review_id] ?? 0) + 1;
    }
  }
  return docCounts;
}
