# Quick Start: Phase 4 Implementation

> Historical note: Phase 4 is complete. Keep this guide as an implementation reference, not as the current task list.
> For current status and next decisions, see [CURRENT_STATUS.md](CURRENT_STATUS.md) and [COMPLETE_ROADMAP.md](COMPLETE_ROADMAP.md).

**Ready to go local? Start here.**

---

## TL;DR

Replace Supabase+R2 with SQLite+Local Files. Takes 14-18 hours. Fully local when done.

```bash
# 1. Add library
cd backend
npm install better-sqlite3 @types/better-sqlite3

# 2. Create schema (copy-paste from below)
touch src/db/schema.sql

# 3. Implement adapter (tedious, 3-4 hours)
touch src/db/sqlite.ts

# 4. Update abstraction layer
# Edit src/lib/db-abstraction.ts - add APP_MODE check

# 5. Update storage
# Edit src/lib/storage.ts - add APP_MODE check

# 6. Initialize on startup
# Edit src/index.ts - call initializeDatabase()

# 7. Test
APP_MODE=local npm run dev
```

---

## 1. Install SQLite Library

```bash
cd backend
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

Done in: **5 minutes**

---

## 2. Create Database Schema

Create `backend/src/db/schema.sql`:

Copy the full schema from [SQLITE_MIGRATION_PATH.md](SQLITE_MIGRATION_PATH.md#step-2-create-sqlite-schema-1-hour) (all 14 tables).

Or simplified version:

```sql
-- Save as backend/src/db/schema.sql
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  display_name TEXT,
  organisation TEXT,
  tier TEXT DEFAULT 'free',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  cm_number TEXT,
  shared_with JSON,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id)
);

-- ... add all 14 tables from full schema
```

Done in: **30 minutes**

---

## 3. Create SQLite Adapter

Create `backend/src/db/sqlite.ts`:

**Key pattern:**
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'app.db');
export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

export function initializeDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);
}

// For EVERY function in db-abstraction.ts:
export async function listProjectsByUser(userId: string): Promise<Project[]> {
  const stmt = db.prepare(`
    SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC
  `);
  return stmt.all(userId) as Project[];
}

// Pattern:
// 1. Copy function signature from db-abstraction.ts
// 2. Replace db.from("table").select(...) with db.prepare(...).get()/all()
// 3. Return exact same type
```

**How many functions?** ~100  
**Difficulty?** Copy-paste pattern. Every function follows same structure.  
**Time estimate:** 3-4 hours

**Pro tip:** Do a few key ones first (listProjectsByUser, createProject, getChat) to verify pattern works, then do batch of similar functions.

Done in: **3-4 hours**

---

## 4. Update db-abstraction.ts with Mode Check

Edit `backend/src/lib/db-abstraction.ts`:

Add at top:
```typescript
import { config } from "../config/env";
import * as sqlite from "../db/sqlite";

// Check if env.ts exports APP_MODE
// If not, add to backend/src/config/env.ts:
// export const appMode = process.env.APP_MODE || 'cloud';
```

For each function, add mode check:
```typescript
export async function listProjectsByUser(
  userId: string,
  db: Db
): Promise<Project[]> {
  if (config.appMode === "local") {
    return sqlite.listProjectsByUser(userId);
  }

  // Original Supabase code here...
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId);
  return (data ?? []) as Project[];
}
```

Done in: **30 minutes** (just wrapping existing functions)

---

## 5. Update storage.ts with Mode Check

Edit `backend/src/lib/storage.ts`:

```typescript
import { config } from "../config/env";
import fs from "fs/promises";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), "storage");

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

  // Original R2 code...
}

export async function downloadFile(key: string): Promise<ArrayBuffer | null> {
  if (config.appMode === "local") {
    try {
      const filePath = path.join(STORAGE_DIR, key);
      const buffer = await fs.readFile(filePath);
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
    } catch (err) {
      return null;
    }
  }

  // Original R2 code...
}

// Same for deleteFile, getSignedUrl
```

Done in: **1 hour**

---

## 6. Initialize Database on Startup

Edit `backend/src/index.ts`:

```typescript
import { config } from "./config/env";
import { initializeDatabase } from "./db/sqlite";

const app = express();

// Add this near top, after imports
if (config.appMode === "local") {
  console.log("🗄️ Initializing SQLite database...");
  initializeDatabase();
  console.log("✅ SQLite ready at app.db");
}

// ... rest of server setup
```

Done in: **5 minutes**

---

## 7. Add File Serving Route (Optional but Recommended)

Create `backend/src/routes/files.ts`:

```typescript
import express from "express";
import fs from "fs/promises";
import path from "path";
import { config } from "../config/env";

export const filesRouter = express.Router();

filesRouter.get("/:path(*)", async (req, res) => {
  if (config.appMode !== "local") {
    return void res.status(404).json({ detail: "Not available in cloud mode" });
  }

  try {
    const filePath = path.join(process.cwd(), "storage", req.params.path);

    // Security check
    if (!filePath.startsWith(path.join(process.cwd(), "storage"))) {
      return void res.status(403).json({ detail: "Forbidden" });
    }

    const buffer = await fs.readFile(filePath);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ detail: "File not found" });
  }
});
```

Add to main app:
```typescript
app.use("/api/files", filesRouter);
```

Done in: **30 minutes**

---

## 8. Test It

```bash
# Set local mode
export APP_MODE=local

# Start backend
cd backend
npm run dev

# In another terminal, start frontend
cd frontend
npm run dev

# Open http://localhost:3000
# Should see dashboard with no login

# Test:
# - Create project
# - Upload document
# - Create chat
# - Send message
# - Create workflow
# - Create tabular review
```

**Checkpoints:**
- ✅ No Supabase errors in console
- ✅ `app.db` file created in `backend/`
- ✅ `storage/` directory created with files
- ✅ Can create/edit data
- ✅ Data persists after page reload
- ✅ Data persists after backend restart

Done in: **2-3 hours** (including debugging)

---

## Common Gotchas

### SQLite requires prepared statements
```typescript
// ✅ Good
const stmt = db.prepare("SELECT * FROM projects WHERE user_id = ?");
stmt.all(userId);

// ❌ Bad
db.exec(`SELECT * FROM projects WHERE user_id = ${userId}`); // SQL injection!
```

### Remember JSON serialization
```typescript
// Documents with JSON fields:
const shared_with = JSON.stringify(["user1@email.com"]);
db.prepare("INSERT INTO projects (..., shared_with) VALUES (..., ?)").run(
  ...,
  shared_with
);

// Reading:
const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
const shared = JSON.parse(row.shared_with);
```

### File paths need escaping
```typescript
const filePath = path.join(STORAGE_DIR, key);
// Don't assume key is safe! Use path.join to handle edge cases
```

### Database locking
SQLite locks on writes. If you get "database is locked":
```typescript
// Add to sqlite.ts after db initialization
db.pragma("busy_timeout = 5000"); // Wait up to 5 seconds
```

---

## If Stuck

**Database won't initialize:**
```bash
# Reset everything
rm app.db storage -rf

# Restart server
npm run dev
```

**TypeScript errors:**
```bash
# Check types align
npx tsc --noEmit
```

**"Cannot find module 'better-sqlite3'":**
```bash
cd backend
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

**SQL errors in logs:**
```
# Look for "Error: table X already exists" - normal on second run
# Look for "foreign key constraint failed" - check relationships
# Look for "UNIQUE constraint failed" - check duplicate insertions
```

---

## Full Timeline

| Step | Time | Difficulty |
|------|------|------------|
| Install library | 5 min | ⭐ |
| Create schema | 30 min | ⭐ |
| Implement adapter | 3-4 hours | ⭐⭐ (repetitive) |
| Update abstraction | 30 min | ⭐ |
| Update storage | 1 hour | ⭐⭐ |
| Initialize DB | 5 min | ⭐ |
| Add file route | 30 min | ⭐ |
| **Total** | **6-8 hours active work** | |
| Testing | 2-3 hours | ⭐⭐ |
| **TOTAL** | **14-18 hours** | |

---

## You're Done When...

✅ Backend starts with `APP_MODE=local`  
✅ `app.db` created and populated  
✅ Files stored in `storage/`  
✅ All CRUD operations work  
✅ Data persists  
✅ No Supabase errors  

**Result: Fully local, offline-capable app with zero cloud dependencies! 🎉**

---

## Full Details

See [SQLITE_MIGRATION_PATH.md](SQLITE_MIGRATION_PATH.md) for:
- Complete schema.sql (all 14 tables)
- Full sqlite.ts template (all 100+ functions)
- Backup/restore endpoints
- Deployment instructions
- Troubleshooting

---

**Ready? Start with installing the library and creating the schema. You got this! 💪**
