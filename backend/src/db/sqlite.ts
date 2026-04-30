/**
 * SQLite adapter for database operations.
 * Implements all repository functions using better-sqlite3.
 * Mirrors the signatures and return types from db-abstraction.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

// Initialize database
const dbPath = path.join(process.cwd(), 'app.db');
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema on startup
export function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

// Types (copied from db-abstraction.ts for reference)
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

export interface Chat {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

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

export interface TabularReview {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  columns_json: unknown;
  created_at: string;
  updated_at: string;
}

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

export interface WorkflowShare {
  id?: string;
  workflow_id: string;
  shared_with_email: string;
  shared_by_user_id: string;
  allow_edit: boolean;
  created_at?: string;
}

// Helper: parse JSON fields
function parseRow(row: any, jsonFields: string[]): any {
  if (!row) return row;
  const parsed = { ...row };
  for (const field of jsonFields) {
    if (parsed[field] && typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch (e) {
        // Keep as string if parse fails
      }
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// User Profile Repo
// ---------------------------------------------------------------------------

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const stmt = db.prepare(`SELECT * FROM user_profiles WHERE user_id = ?`);
  const row = stmt.get(userId);
  return (row as UserProfile | null) ?? null;
}

export async function upsertUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const stmt = db.prepare(`
      INSERT INTO user_profiles (user_id) VALUES (?)
      ON CONFLICT(user_id) DO UPDATE SET user_id = user_id
    `);
    stmt.run(userId);
    return getUserProfile(userId);
  } catch (err) {
    return null;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<UserProfile | null> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'user_id' && key !== 'created_at') {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (setClauses.length === 0) return getUserProfile(userId);
    
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(userId);
    
    const sql = `UPDATE user_profiles SET ${setClauses.join(', ')} WHERE user_id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);
    return getUserProfile(userId);
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Project Repo
// ---------------------------------------------------------------------------

export async function listProjectsByUser(userId: string): Promise<Project[]> {
  const stmt = db.prepare(`
    SELECT * FROM projects 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as any[];
  return rows.map(row => parseRow(row, ['shared_with'])) as Project[];
}

export async function getProject(projectId: string): Promise<Project | null> {
  const stmt = db.prepare(`SELECT * FROM projects WHERE id = ?`);
  const row = stmt.get(projectId) as any;
  return parseRow(row, ['shared_with']) as Project | null;
}

export async function createProject(
  userId: string,
  name: string,
  cm_number?: string | null,
  shared_with?: string[] | null
): Promise<Project | null> {
  try {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, cm_number, shared_with)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      userId,
      name.trim(),
      cm_number ?? null,
      shared_with ? JSON.stringify(shared_with) : null
    );
    return getProject(id);
  } catch (err) {
    return null;
  }
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: Partial<Project>
): Promise<Project | null> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
        setClauses.push(`${key} = ?`);
        if (key === 'shared_with' && value) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }
    if (setClauses.length === 0) return getProject(projectId);
    
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(projectId);
    values.push(userId);
    
    const sql = `UPDATE projects SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);
    return getProject(projectId);
  } catch (err) {
    return null;
  }
}

export async function deleteProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  try {
    const stmt = db.prepare(`DELETE FROM projects WHERE id = ? AND user_id = ?`);
    stmt.run(projectId, userId);
    return true;
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chat Repo
// ---------------------------------------------------------------------------

export async function listChatsByUser(userId: string): Promise<Chat[]> {
  const stmt = db.prepare(`
    SELECT * FROM chats 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  return stmt.all(userId) as Chat[];
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const stmt = db.prepare(`SELECT * FROM chats WHERE id = ?`);
  const row = stmt.get(chatId);
  return (row as Chat | null) ?? null;
}

export async function createChat(
  userId: string,
  projectId?: string | null
): Promise<Chat | null> {
  try {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO chats (id, user_id, project_id)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, userId, projectId ?? null);
    return getChat(id);
  } catch (err) {
    return null;
  }
}

export async function updateChat(
  chatId: string,
  userId: string,
  updates: Partial<Chat>
): Promise<Chat | null> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (setClauses.length === 0) return getChat(chatId);
    
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(chatId);
    values.push(userId);
    
    const sql = `UPDATE chats SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);
    return getChat(chatId);
  } catch (err) {
    return null;
  }
}

export async function deleteChat(chatId: string, userId: string): Promise<boolean> {
  try {
    const stmt = db.prepare(`DELETE FROM chats WHERE id = ? AND user_id = ?`);
    stmt.run(chatId, userId);
    return true;
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Document Repo
// ---------------------------------------------------------------------------

export async function listDocumentsByUser(userId: string): Promise<Document[]> {
  const stmt = db.prepare(`
    SELECT * FROM documents 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  return stmt.all(userId) as Document[];
}

export async function listDocumentsByProject(projectId: string): Promise<Document[]> {
  const stmt = db.prepare(`
    SELECT * FROM documents 
    WHERE project_id = ? 
    ORDER BY created_at DESC
  `);
  return stmt.all(projectId) as Document[];
}

export async function getDocument(documentId: string): Promise<Document | null> {
  const stmt = db.prepare(`SELECT * FROM documents WHERE id = ?`);
  const row = stmt.get(documentId);
  return (row as Document | null) ?? null;
}

export async function deleteDocument(documentId: string, userId: string): Promise<boolean> {
  try {
    const stmt = db.prepare(`DELETE FROM documents WHERE id = ? AND user_id = ?`);
    stmt.run(documentId, userId);
    return true;
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Workflow Repo
// ---------------------------------------------------------------------------

export async function listWorkflowsByUser(userId: string): Promise<Workflow[]> {
  const stmt = db.prepare(`
    SELECT * FROM workflows 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as any[];
  return rows.map(row => parseRow(row, ['columns_config'])) as Workflow[];
}

export async function getWorkflow(workflowId: string): Promise<Workflow | null> {
  const stmt = db.prepare(`SELECT * FROM workflows WHERE id = ?`);
  const row = stmt.get(workflowId) as any;
  return parseRow(row, ['columns_config']) as Workflow | null;
}

// ---------------------------------------------------------------------------
// Tabular Review Repo
// ---------------------------------------------------------------------------

export async function listTabularReviewsByUser(userId: string): Promise<TabularReview[]> {
  const stmt = db.prepare(`
    SELECT * FROM tabular_reviews 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as any[];
  return rows.map(row => parseRow(row, ['columns_config'])) as TabularReview[];
}

export async function getTabularReview(reviewId: string): Promise<TabularReview | null> {
  const stmt = db.prepare(`SELECT * FROM tabular_reviews WHERE id = ?`);
  const row = stmt.get(reviewId) as any;
  return parseRow(row, ['columns_config']) as TabularReview | null;
}

// ---------------------------------------------------------------------------
// Extended Project Repo
// ---------------------------------------------------------------------------

export async function listSharedProjects(
  userEmail: string,
  userId: string
): Promise<Project[]> {
  const stmt = db.prepare(`
    SELECT * FROM projects 
    WHERE user_id != ? 
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId) as any[];
  // Filter by shared_with on client side (SQLite JSON filtering is complex)
  return rows.filter(row => {
    const sharedWith = parseRow(row, ['shared_with']).shared_with;
    return sharedWith && Array.isArray(sharedWith) && sharedWith.includes(userEmail);
  }) as Project[];
}

export async function countDocumentsInProject(projectId: string): Promise<number> {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM documents WHERE project_id = ?`);
  const result = stmt.get(projectId) as { count: number };
  return result.count ?? 0;
}

export async function countChatsInProject(projectId: string): Promise<number> {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM chats WHERE project_id = ?`);
  const result = stmt.get(projectId) as { count: number };
  return result.count ?? 0;
}

export async function countReviewsInProject(projectId: string): Promise<number> {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM tabular_reviews WHERE project_id = ?`);
  const result = stmt.get(projectId) as { count: number };
  return result.count ?? 0;
}

export async function listDocumentsByProjectAsc(projectId: string): Promise<Document[]> {
  const stmt = db.prepare(`
    SELECT * FROM documents 
    WHERE project_id = ? 
    ORDER BY created_at ASC
  `);
  return stmt.all(projectId) as Document[];
}

export async function listProjectSubfolders(projectId: string): Promise<Record<string, unknown>[]> {
  const stmt = db.prepare(`
    SELECT * FROM project_subfolders 
    WHERE project_id = ? 
    ORDER BY created_at ASC
  `);
  return stmt.all(projectId) as Record<string, unknown>[];
}

export async function getUserProfilesByIds(
  userIds: string[]
): Promise<Pick<UserProfile, "user_id" | "display_name" | "organisation">[]> {
  if (userIds.length === 0) return [];
  const placeholders = userIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT user_id, display_name, organisation FROM user_profiles 
    WHERE user_id IN (${placeholders})
  `);
  return stmt.all(...userIds) as Pick<UserProfile, "user_id" | "display_name" | "organisation">[];
}

// ---------------------------------------------------------------------------
// Extended Chat Repo
// ---------------------------------------------------------------------------

export async function listChatsByProject(projectId: string): Promise<Chat[]> {
  const stmt = db.prepare(`
    SELECT * FROM chats 
    WHERE project_id = ? 
    ORDER BY created_at DESC
  `);
  return stmt.all(projectId) as Chat[];
}

export async function listChatsForUserAndProjects(
  userId: string,
  projectIds: string[]
): Promise<Chat[]> {
  if (projectIds.length === 0) {
    const stmt = db.prepare(`
      SELECT * FROM chats 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
    return stmt.all(userId) as Chat[];
  }
  
  const placeholders = projectIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT * FROM chats 
    WHERE user_id = ? OR project_id IN (${placeholders})
    ORDER BY created_at DESC
  `);
  return stmt.all(userId, ...projectIds) as Chat[];
}

export async function updateChatTitle(chatId: string, title: string): Promise<void> {
  const stmt = db.prepare(`UPDATE chats SET title = ? WHERE id = ?`);
  stmt.run(title, chatId);
}

// ---------------------------------------------------------------------------
// Chat Message Repo
// ---------------------------------------------------------------------------

export async function listChatMessages(chatId: string): Promise<Record<string, unknown>[]> {
  const stmt = db.prepare(`
    SELECT * FROM chat_messages 
    WHERE chat_id = ? 
    ORDER BY created_at ASC
  `);
  const rows = stmt.all(chatId) as any[];
  return rows.map(row => parseRow(row, ['files', 'workflow', 'annotations'])) as Record<string, unknown>[];
}

export async function insertChatMessage(
  payload: {
    chat_id: string;
    role: string;
    content: unknown;
    files?: unknown;
    workflow?: unknown;
    annotations?: unknown;
  }
): Promise<void> {
  const id = randomUUID();
  const stmt = db.prepare(`
    INSERT INTO chat_messages (id, chat_id, role, content, files, workflow, annotations)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id,
    payload.chat_id,
    payload.role,
    typeof payload.content === 'string' ? payload.content : JSON.stringify(payload.content),
    payload.files ? JSON.stringify(payload.files) : null,
    payload.workflow ? JSON.stringify(payload.workflow) : null,
    payload.annotations ? JSON.stringify(payload.annotations) : null
  );
}

export async function getEditStatuses(
  editIds: string[]
): Promise<{ id: string; status: "pending" | "accepted" | "rejected" }[]> {
  if (editIds.length === 0) return [];
  const placeholders = editIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT id, status FROM document_edits 
    WHERE id IN (${placeholders})
  `);
  return stmt.all(...editIds) as { id: string; status: "pending" | "accepted" | "rejected" }[];
}

export async function getVersionNumbers(
  versionIds: string[]
): Promise<{ id: string; version_number: number | null }[]> {
  if (versionIds.length === 0) return [];
  const placeholders = versionIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT id, version_number FROM document_versions 
    WHERE id IN (${placeholders})
  `);
  return stmt.all(...versionIds) as { id: string; version_number: number | null }[];
}

// ---------------------------------------------------------------------------
// Extended Document Repo
// ---------------------------------------------------------------------------

export async function listDocumentsByUserNoProject(userId: string): Promise<Document[]> {
  const stmt = db.prepare(`
    SELECT * FROM documents 
    WHERE user_id = ? AND project_id IS NULL
    ORDER BY created_at DESC
  `);
  return stmt.all(userId) as Document[];
}

export async function getDocumentByOwner(
  documentId: string,
  userId: string
): Promise<Document | null> {
  const stmt = db.prepare(`
    SELECT * FROM documents 
    WHERE id = ? AND user_id = ?
  `);
  const row = stmt.get(documentId, userId);
  return (row as Document | null) ?? null;
}

export async function getDocumentVersionsByDocumentId(
  documentId: string
): Promise<{ storage_path: string; pdf_storage_path: string | null }[]> {
  const stmt = db.prepare(`
    SELECT storage_path, pdf_storage_path FROM document_versions 
    WHERE document_id = ?
  `);
  return stmt.all(documentId) as { storage_path: string; pdf_storage_path: string | null }[];
}

export async function getDocumentVersionByStoragePath(
  storagePath: string
): Promise<{ id: string; document_id: string } | null> {
  const stmt = db.prepare(`
    SELECT id, document_id FROM document_versions 
    WHERE storage_path = ?
  `);
  const row = stmt.get(storagePath);
  return (row as { id: string; document_id: string } | null) ?? null;
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
  }
): Promise<Workflow | null> {
  try {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO workflows (
        id, user_id, title, type, prompt_md, columns_config, practice, is_system
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.user_id,
      data.title.trim(),
      data.type,
      data.prompt_md ?? null,
      data.columns_config ? JSON.stringify(data.columns_config) : null,
      data.practice ?? null,
      0
    );
    return getWorkflow(id);
  } catch (err) {
    return null;
  }
}

export async function updateWorkflowById(
  workflowId: string,
  updates: Record<string, unknown>
): Promise<Workflow | null> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'is_system' && key !== 'created_at') {
        setClauses.push(`${key} = ?`);
        if (key === 'columns_config' && value) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }
    if (setClauses.length === 0) return getWorkflow(workflowId);
    
    values.push(workflowId);
    
    const sql = `UPDATE workflows SET ${setClauses.join(', ')} WHERE id = ? AND is_system = 0`;
    const stmt = db.prepare(sql);
    stmt.run(...values);
    return getWorkflow(workflowId);
  } catch (err) {
    return null;
  }
}

export async function deleteWorkflowById(
  workflowId: string,
  userId: string
): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      DELETE FROM workflows 
      WHERE id = ? AND user_id = ? AND is_system = 0
    `);
    stmt.run(workflowId, userId);
    return true;
  } catch (err) {
    return false;
  }
}

export async function listWorkflowSharesByEmail(email: string): Promise<WorkflowShare[]> {
  const stmt = db.prepare(`
    SELECT workflow_id, shared_by_user_id, allow_edit FROM workflow_shares 
    WHERE shared_with_email = ?
  `);
  return stmt.all(email) as WorkflowShare[];
}

export async function getWorkflowShareByEmail(
  workflowId: string,
  email: string
): Promise<WorkflowShare | null> {
  const stmt = db.prepare(`
    SELECT allow_edit FROM workflow_shares 
    WHERE workflow_id = ? AND shared_with_email = ?
  `);
  const row = stmt.get(workflowId, email);
  return (row as WorkflowShare | null) ?? null;
}

export async function getWorkflowsByIds(ids: string[]): Promise<Workflow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT * FROM workflows 
    WHERE id IN (${placeholders})
  `);
  const rows = stmt.all(...ids) as any[];
  return rows.map(row => parseRow(row, ['columns_config'])) as Workflow[];
}

export async function listWorkflowSharesByWorkflow(workflowId: string): Promise<WorkflowShare[]> {
  const stmt = db.prepare(`
    SELECT id, shared_with_email, allow_edit, created_at FROM workflow_shares 
    WHERE workflow_id = ? 
    ORDER BY created_at ASC
  `);
  return stmt.all(workflowId) as WorkflowShare[];
}

export async function upsertWorkflowShares(
  rows: Omit<WorkflowShare, "id" | "created_at">[]
): Promise<boolean> {
  try {
    const insertStmt = db.prepare(`
      INSERT INTO workflow_shares (workflow_id, shared_by_user_id, shared_with_email, allow_edit)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(workflow_id, shared_with_email) 
      DO UPDATE SET allow_edit = excluded.allow_edit
    `);
    
    for (const row of rows) {
      insertStmt.run(
        row.workflow_id,
        row.shared_by_user_id,
        row.shared_with_email,
        row.allow_edit ? 1 : 0
      );
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteWorkflowShareById(
  shareId: string,
  workflowId: string
): Promise<void> {
  const stmt = db.prepare(`
    DELETE FROM workflow_shares 
    WHERE id = ? AND workflow_id = ?
  `);
  stmt.run(shareId, workflowId);
}

export async function listHiddenWorkflowIds(userId: string): Promise<string[]> {
  const stmt = db.prepare(`
    SELECT workflow_id FROM hidden_workflows 
    WHERE user_id = ?
  `);
  const rows = stmt.all(userId) as { workflow_id: string }[];
  return rows.map(r => r.workflow_id);
}

export async function upsertHiddenWorkflow(
  userId: string,
  workflowId: string
): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      INSERT INTO hidden_workflows (user_id, workflow_id)
      VALUES (?, ?)
      ON CONFLICT(user_id, workflow_id) DO NOTHING
    `);
    stmt.run(userId, workflowId);
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteHiddenWorkflow(
  userId: string,
  workflowId: string
): Promise<boolean> {
  try {
    const stmt = db.prepare(`
      DELETE FROM hidden_workflows 
      WHERE user_id = ? AND workflow_id = ?
    `);
    stmt.run(userId, workflowId);
    return true;
  } catch (err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Tabular Cell Repo
// ---------------------------------------------------------------------------

export async function listTabularCellsByReview(reviewId: string): Promise<TabularCell[]> {
  const stmt = db.prepare(`
    SELECT * FROM tabular_cells 
    WHERE review_id = ?
  `);
  const rows = stmt.all(reviewId) as any[];
  return rows.map(row => parseRow(row, ['content'])) as TabularCell[];
}

export async function insertTabularReview(
  data: {
    user_id: string;
    title: string | null;
    columns_config: unknown;
    project_id?: string | null;
    workflow_id?: string | null;
  }
): Promise<TabularReview | null> {
  try {
    const id = randomUUID();
    const stmt = db.prepare(`
      INSERT INTO tabular_reviews (
        id, user_id, title, columns_config, project_id, workflow_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      data.user_id,
      data.title ?? null,
      JSON.stringify(data.columns_config),
      data.project_id ?? null,
      data.workflow_id ?? null
    );
    return getTabularReview(id);
  } catch (err) {
    return null;
  }
}

export async function insertTabularCells(
  cells: { review_id: string; document_id: string; column_index: number; status: string }[]
): Promise<void> {
  if (cells.length === 0) return;
  const stmt = db.prepare(`
    INSERT INTO tabular_cells (id, review_id, document_id, column_index, status)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const cell of cells) {
    const id = randomUUID();
    stmt.run(
      id,
      cell.review_id,
      cell.document_id,
      cell.column_index,
      cell.status
    );
  }
}

export async function updateTabularReview(
  reviewId: string,
  updates: Record<string, unknown>
): Promise<TabularReview | null> {
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'user_id' && key !== 'created_at') {
        setClauses.push(`${key} = ?`);
        if (key === 'columns_config' && value) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }
    if (setClauses.length === 0) return getTabularReview(reviewId);
    
    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(reviewId);
    
    const sql = `UPDATE tabular_reviews SET ${setClauses.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...values);
    return getTabularReview(reviewId);
  } catch (err) {
    return null;
  }
}

export async function deleteTabularReview(reviewId: string): Promise<boolean> {
  try {
    const stmt = db.prepare(`DELETE FROM tabular_reviews WHERE id = ?`);
    stmt.run(reviewId);
    return true;
  } catch (err) {
    return false;
  }
}

export async function listTabularCellKeysForReview(
  reviewId: string
): Promise<{ document_id: string; column_index: number }[]> {
  const stmt = db.prepare(`
    SELECT document_id, column_index FROM tabular_cells 
    WHERE review_id = ?
  `);
  return stmt.all(reviewId) as { document_id: string; column_index: number }[];
}

export async function deleteTabularCellsForDocs(
  reviewId: string,
  documentIds: string[]
): Promise<void> {
  if (documentIds.length === 0) return;
  const placeholders = documentIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    DELETE FROM tabular_cells 
    WHERE review_id = ? AND document_id IN (${placeholders})
  `);
  stmt.run(reviewId, ...documentIds);
}

export async function countDocumentsByReviewIds(
  reviewIds: string[]
): Promise<Record<string, number>> {
  if (reviewIds.length === 0) return {};
  const placeholders = reviewIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT review_id, document_id FROM tabular_cells 
    WHERE review_id IN (${placeholders})
  `);
  const rows = stmt.all(...reviewIds) as { review_id: string; document_id: string }[];
  const docCounts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.review_id}:${row.document_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      docCounts[row.review_id] = (docCounts[row.review_id] ?? 0) + 1;
    }
  }
  return docCounts;
}
