# Phase 4: SQLite Migration Path

**Status:** Ready to implement after Phase 3 (currently complete)  
**Estimated Time:** 14-18 hours  
**Difficulty:** Medium (lots of repetitive function implementations, then testing)  
**Risk Level:** Low (can be toggled via APP_MODE)

---

## Overview: What Phase 4 Does

**Goal:** Replace Supabase with SQLite database + local filesystem storage while keeping ALL route code unchanged.

**Result:**
- ✅ Zero Supabase dependencies
- ✅ Works completely offline
- ✅ Single-file SQLite database (`app.db`)
- ✅ Local file storage in `./storage/`
- ✅ Same API, same functionality

**How it works:**
1. Replace functions in `backend/src/lib/db-abstraction.ts` — change from Supabase calls to SQLite calls
2. Replace functions in `backend/src/lib/storage.ts` — change from R2 to local filesystem
3. Add database initialization + schema creation
4. Toggle with `APP_MODE=local` environment variable

---

## Implementation: Step-by-Step

### Step 1: Add SQLite Dependencies (30 min)

**Add to `backend/package.json`:**

```json
{
  "dependencies": {
    "better-sqlite3": "^9.0.0",
    "node-localstorage": "^2.2.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.5"
  }
}
```

Then run: `npm install`

### Step 2: Create SQLite Schema (1 hour)

Create `backend/src/db/schema.sql`:

```sql
-- Users & Profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  organisation TEXT,
  tier TEXT DEFAULT 'free',
  message_credits_used INTEGER DEFAULT 0,
  credits_reset_date TEXT,
  tabular_model TEXT DEFAULT 'claude-3-sonnet-20240229',
  claude_api_key TEXT,
  gemini_api_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cm_number TEXT,
  visibility TEXT DEFAULT 'private',
  shared_with JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  filename TEXT NOT NULL,
  file_type TEXT,
  size_bytes INTEGER,
  current_version_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Document Versions
CREATE TABLE IF NOT EXISTS document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  storage_path TEXT,
  pdf_storage_path TEXT,
  version_number INTEGER,
  source TEXT,
  display_name TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Document Edits (Tracked Changes)
CREATE TABLE IF NOT EXISTS document_edits (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  del_w_id TEXT,
  ins_w_id TEXT,
  status TEXT DEFAULT 'pending',
  resolved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Chats
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  role TEXT,
  content TEXT,
  files JSON,
  workflow JSON,
  annotations JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT,
  prompt_md TEXT,
  columns_config JSON,
  practice TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
);

-- Workflow Shares
CREATE TABLE IF NOT EXISTS workflow_shares (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  shared_by_user_id TEXT,
  shared_with_email TEXT,
  allow_edit BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE(workflow_id, shared_with_email)
);

-- Hidden Workflows
CREATE TABLE IF NOT EXISTS hidden_workflows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  UNIQUE(user_id, workflow_id)
);

-- Tabular Reviews
CREATE TABLE IF NOT EXISTS tabular_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT,
  columns_config JSON,
  shared_with JSON,
  workflow_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Tabular Cells
CREATE TABLE IF NOT EXISTS tabular_cells (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  column_index INTEGER,
  content TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES tabular_reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Project Subfolders
CREATE TABLE IF NOT EXISTS project_subfolders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT,
  parent_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES project_subfolders(id)
);

-- Download Tokens (for signed URLs)
CREATE TABLE IF NOT EXISTS download_tokens (
  token TEXT PRIMARY KEY,
  storage_path TEXT NOT NULL,
  filename TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for common queries
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_project_id ON chats(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_shares_workflow_id ON workflow_shares(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tabular_reviews_user_id ON tabular_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_tabular_cells_review_id ON tabular_cells(review_id);
```

### Step 3: Create SQLite Adapter (3-4 hours)

Create `backend/src/db/sqlite.ts`. This file implements all repository functions using SQLite instead of Supabase:

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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

// Example: listProjectsByUser
export async function listProjectsByUser(userId: string): Promise<Project[]> {
  const stmt = db.prepare(`
    SELECT * FROM projects 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  return stmt.all(userId) as Project[];
}

// Example: createProject
export async function createProject(
  userId: string,
  name: string,
  cm_number?: string | null,
  shared_with?: string[] | null
): Promise<Project | null> {
  try {
    const id = crypto.randomUUID();
    const stmt = db.prepare(`
      INSERT INTO projects (id, user_id, name, cm_number, shared_with)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, userId, name, cm_number ?? null, 
             shared_with ? JSON.stringify(shared_with) : null);
    
    const result = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    return (result as any) ?? null;
  } catch (err) {
    console.error('createProject error:', err);
    return null;
  }
}

// ... repeat pattern for all ~100 repository functions
// Copy signatures from backend/src/lib/db-abstraction.ts
// Replace db.from("table").select(...) with db.prepare().get()/all()
```

**Important Notes:**
- Copy ALL function signatures from `db-abstraction.ts` (don't change signatures)
- Only change the implementation (Supabase → SQLite)
- Use `db.prepare()` for queries, `.get()` for single row, `.all()` for multiple rows
- Return exact same types as Supabase version
- Handle NULL values the same way

**Time Estimate:** 3-4 hours (tedious but mechanical)

### Step 4: Update db-abstraction.ts to Use SQLite (30 min)

Modify `backend/src/lib/db-abstraction.ts` to switch between Supabase and SQLite based on `APP_MODE`:

```typescript
import { createServerSupabase } from "./supabase";
import * as sqlite from "../db/sqlite";
import { config } from "../config/env";

// At the top of each export async function, check mode:
export async function listProjectsByUser(
  userId: string,
  db: Db
): Promise<Project[]> {
  if (config.appMode === "local") {
    return sqlite.listProjectsByUser(userId);
  }
  
  // Original Supabase code
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}
```

Or better approach: **Replace entire file with adapter factory pattern** if you want cleaner code.

### Step 5: Update Storage to Use Local Filesystem (1 hour)

Modify `backend/src/lib/storage.ts`:

```typescript
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';

const STORAGE_DIR = path.join(process.cwd(), 'storage');

export async function uploadFile(
  key: string,
  content: ArrayBuffer,
  contentType?: string
): Promise<void> {
  if (config.appMode === "local") {
    const filePath = path.join(STORAGE_DIR, key);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, Buffer.from(content));
    return;
  }
  
  // Original R2 code
  // ... existing implementation
}

export async function downloadFile(key: string): Promise<ArrayBuffer | null> {
  if (config.appMode === "local") {
    try {
      const filePath = path.join(STORAGE_DIR, key);
      const buffer = await fs.readFile(filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } catch (err) {
      console.error('downloadFile error:', err);
      return null;
    }
  }
  
  // Original R2 code
  // ... existing implementation
}

export async function deleteFile(key: string): Promise<void> {
  if (config.appMode === "local") {
    try {
      const filePath = path.join(STORAGE_DIR, key);
      await fs.unlink(filePath);
    } catch (err) {
      console.error('deleteFile error:', err);
    }
    return;
  }
  
  // Original R2 code
  // ... existing implementation
}

export async function getSignedUrl(
  key: string,
  expirationSeconds: number,
  filename: string
): Promise<string | null> {
  if (config.appMode === "local") {
    // Return a local path that the API can serve
    return `/api/files/${key}`;
  }
  
  // Original R2 code
  // ... existing implementation
}
```

### Step 6: Add Database Initialization to Server Startup (15 min)

Modify `backend/src/index.ts`:

```typescript
import express from 'express';
import { config } from './config/env';
import { initializeDatabase } from './db/sqlite';

const app = express();

// Initialize database if in local mode
if (config.appMode === "local") {
  console.log('🗄️ Initializing SQLite database...');
  initializeDatabase();
  console.log('✅ SQLite ready at app.db');
}

// ... rest of server setup
```

### Step 7: Add GET /api/files/:path Route for Local Files (30 min)

Add to `backend/src/index.ts` or new `backend/src/routes/files.ts`:

```typescript
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';

export const filesRouter = express.Router();

// GET /api/files/:path
// Serves files from local storage when in local mode
filesRouter.get('/:path(*)', async (req, res) => {
  if (config.appMode !== "local") {
    return void res.status(404).json({ detail: 'Not available in cloud mode' });
  }

  try {
    const filePath = path.join(process.cwd(), 'storage', req.params.path);
    
    // Security: prevent directory traversal
    if (!filePath.startsWith(path.join(process.cwd(), 'storage'))) {
      return void res.status(403).json({ detail: 'Forbidden' });
    }

    const stat = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ detail: 'File not found' });
  }
});
```

Then add to app:
```typescript
app.use('/api/files', filesRouter);
```

### Step 8: Test Local Mode (2-3 hours)

**Setup:**

1. Create `.env.local`:
```
APP_MODE=local
DATABASE_URL=file:./app.db
```

2. Start backend:
```bash
cd backend
npm run dev
```

3. In another terminal, start frontend:
```bash
cd frontend
npm run dev
```

**Test Checklist:**

- [ ] Backend starts without Supabase errors
- [ ] SQLite database file created (`app.db`)
- [ ] Storage directory created with documents
- [ ] Can load home page (no auth needed)
- [ ] Can create a project
- [ ] Can upload a document
- [ ] Can view documents
- [ ] Can create a chat
- [ ] Can send chat message
- [ ] Can create workflow
- [ ] Can create tabular review
- [ ] No errors in browser console
- [ ] No errors in backend logs
- [ ] App works after restart (data persists)

**If errors occur:**

1. Check `app.db` exists: `ls -la app.db`
2. Check logs for SQL errors
3. Check `storage/` directory has files
4. Try resetting: `rm app.db; npm run dev`

### Step 9: Implement Backup/Restore (1-2 hours, optional)

Create `backend/src/routes/admin.ts` for backup/restore:

```typescript
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';

export const adminRouter = express.Router();

// POST /api/admin/backup
adminRouter.post('/backup', async (req, res) => {
  if (config.appMode !== "local") {
    return void res.status(400).json({ detail: 'Only available in local mode' });
  }

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    // Copy database
    const dbPath = path.join(process.cwd(), 'app.db');
    const backupDbPath = path.join(backupDir, `app-${timestamp}.db`);
    await fs.copyFile(dbPath, backupDbPath);

    // Zip storage (optional)
    // For now just return success
    res.json({ backup: backupDbPath, timestamp });
  } catch (err) {
    res.status(500).json({ detail: String(err) });
  }
});

// POST /api/admin/restore
adminRouter.post('/restore', async (req, res) => {
  if (config.appMode !== "local") {
    return void res.status(400).json({ detail: 'Only available in local mode' });
  }

  try {
    const { backupFile } = req.body as { backupFile: string };
    const dbPath = path.join(process.cwd(), 'app.db');
    const backupPath = path.join(process.cwd(), 'backups', backupFile);

    // Verify file exists
    await fs.access(backupPath);

    // Restore (in production would restart DB connection)
    await fs.copyFile(backupPath, dbPath);
    res.json({ restored: backupFile });
  } catch (err) {
    res.status(500).json({ detail: String(err) });
  }
});
```

---

## File-by-File Summary

| File | Change | Time |
|------|--------|------|
| `package.json` | Add better-sqlite3 | 5 min |
| `backend/src/db/schema.sql` | Create tables | 30 min |
| `backend/src/db/sqlite.ts` | Implement all repo functions | 3-4 hours |
| `backend/src/lib/db-abstraction.ts` | Add mode check, switch implementations | 30 min |
| `backend/src/lib/storage.ts` | Add local filesystem adapter | 1 hour |
| `backend/src/index.ts` | Initialize DB, add file route | 30 min |
| Testing | Verify all operations work | 2-3 hours |
| **Total** | | **14-18 hours** |

---

## Deployment: Single Binary

After Phase 4, you can package the entire app:

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build

# Create single deployment:
# - backend executable/binary
# - frontend static files
# - app.db (SQLite database)
# - storage/ directory
# - .env (with APP_MODE=local)

# Can run as single executable or Docker container
```

---

## Rollback Plan

If anything breaks:

```bash
# Revert to Supabase
unset APP_MODE  # or set APP_MODE=cloud
npm run dev
```

All your Supabase data is untouched. Phase 4 creates new local SQLite but doesn't modify your cloud setup.

---

## Next Steps After Phase 4

- **Phase 5 (Optional, 4-6 hours):** Simplify schema for single-user (remove sharing logic)
- **Phase 6 (Optional, 16-20 hours):** Replace Next.js with React Router + Vite
- **Phase 7 (Optional, 20-30 hours):** Wrap in Electron/Tauri desktop app

For now: **You have a fully functional, offline, local-only app! 🎉**

---

## Support

If you get stuck:

1. Check backend logs: `npm run dev` shows SQLite errors
2. Verify schema: `sqlite3 app.db ".schema"`
3. Check storage: `ls -la storage/`
4. Reset everything: `rm app.db storage -rf && npm run dev`
