# Second PR Scope: Migrate Backend Routes to Repository Layer (Phase 3)

## Status: ✅ COMPLETE

**Commit:** f0ccb30  
**Completed on:** April 30, 2026

### What Was Done
- ✅ Extended db-abstraction.ts with ~350 new repository functions
- ✅ Migrated all 8 backend route files
- ✅ Added GET /user/profile endpoint
- ✅ Verified TypeScript compilation (0 errors)
- ✅ All routes now use repository layer exclusively

### Routes Migrated
1. ✅ projects.ts - Projects CRUD + document listing
2. ✅ chat.ts - Chat CRUD + LLM streaming endpoints
3. ✅ workflows.ts - Workflows + sharing + hidden workflows  
4. ✅ documents.ts - Document CRUD + versions + tracked changes
5. ✅ tabular.ts - Tabular reviews CRUD + cell management
6. ✅ projectChat.ts - Project streaming chat
7. ✅ downloads.ts - File download with token verification
8. ✅ user.ts - User profile endpoints

---

## Next Phase: SQLite Migration (Phase 4)

Now that all routes use the repository layer, you can implement SQLite without changing ANY route code.

**See:** [SQLITE_MIGRATION_PATH.md](SQLITE_MIGRATION_PATH.md) for complete implementation guide.

**Estimated time:** 14-18 hours  
**Difficulty:** Medium (lots of repetitive function implementations)

---

## Overview (For Reference)
After Phase 1-2 (Auth Removal), the second PR migrated backend routes to use the new repository abstraction layer. This isolates database access, making it easy to swap Supabase for SQLite later.

**Goal:** All routes call repository functions instead of direct `.from("table")` calls.  
**Result:** ✅ Achieved - All routes abstracted.  
**Status:** Ready for Phase 4 (SQLite implementation).

---

## Files Modified (Completed)

### 1. backend/src/routes/projects.ts ✅
**Changes made:**
- Added imports for repository functions
- Replaced all `db.from("projects").select()` with `listProjectsByUser()`
- Replaced `db.from("projects").insert()` with `createProject()`
- Replaced direct queries with repository functions throughout

**Total edits:** 7 replacements

### 2. backend/src/routes/chat.ts ✅
**Changes made:**
- Added imports for repository functions
- Replaced chat queries with `getChat()`, `createChat()`, `updateChat()`
- Replaced message operations with repository functions
- Updated title generation to use `updateChatTitle()`

**Total edits:** 6 replacements

### 3. backend/src/routes/documents.ts
**Changes needed:**
- Similar pattern to projects/chat
- Handle both standalone documents and project documents
- Use `projectRepo.listDocumentsByProject(projectId, db)` where applicable

**Total edits:** ~6-10 replacements

### 4. backend/src/routes/workflows.ts
**Changes needed:**
- Add `import * as workflowRepo from "../lib/db-abstraction"`
- Replace workflow queries with `workflowRepo.listWorkflowsByUser(...)`
- Handle system workflows separately (is_system flag)

**Total edits:** ~4-6 replacements

### 5. backend/src/routes/tabular.ts
**Changes needed:**
- Similar pattern; use `tabularRepo.*` functions
- Handle cell reads/writes

**Total edits:** ~5-8 replacements

### 6. backend/src/routes/projectChat.ts
**Changes needed:**
- Already imports chatTools; add chatRepo import
- Replace chats table access with `chatRepo.*`

**Total edits:** ~3-5 replacements

### 7. backend/src/routes/downloads.ts
**Changes needed:**
- Replace document queries with `documentRepo.*`

**Total edits:** ~2-4 replacements

### 8. frontend/src/contexts/UserProfileContext.tsx
**Current pattern:**
```typescript
const { data, error } = await supabase
  .from("user_profiles")
  .select("*")
  .eq("user_id", userId)
  .single();
```

**New pattern (move to backend API call):**
```typescript
const response = await fetch(`${apiBase}/user/profile/${userId}`, {
  method: "GET",
});
```

**Note:** This requires a new backend endpoint `GET /user/profile` that returns the profile. Currently only `POST /user/profile` exists (for upsert).

**Changes needed:**
- Remove all Supabase table access from this file
- Add new backend endpoint `GET /user/profile/:userId`
- Implement that endpoint in `backend/src/routes/user.ts` using `profileRepo.getUserProfile(...)`
- Update frontend to call the endpoint instead of querying Supabase

---

## Estimated Changes Per File

| File | Current Direct DB Calls | Estimated Replacements | Complexity |
|------|------------------------|------------------------|------------|
| projects.ts | ~6 | 6-8 | Low |
| chat.ts | ~5 | 5-7 | Low |
| documents.ts | ~8 | 6-10 | Medium |
| workflows.ts | ~4 | 4-6 | Low |
| tabular.ts | ~6 | 5-8 | Medium |
| projectChat.ts | ~3 | 3-5 | Low |
| downloads.ts | ~2 | 2-4 | Low |
| user.ts | ~1 | 1 (add GET endpoint) | Low |
| UserProfileContext.tsx | ~3 | Remove, add API calls | Medium |
| **Total** | **~38** | **~35-52** | - |

---

## Implementation Checklist

### Before Starting
- [ ] First PR merged and deployed to a branch
- [ ] Run existing tests to ensure baseline passes
- [ ] One developer assigned to avoid conflicts

### Phase 3 PR Implementation (In Order)
- [ ] Update `backend/src/routes/projects.ts` (simplest, good warm-up)
- [ ] Update `backend/src/routes/chat.ts`
- [ ] Update `backend/src/routes/workflows.ts`
- [ ] Update `backend/src/routes/documents.ts` (most complex)
- [ ] Update `backend/src/routes/tabular.ts`
- [ ] Update `backend/src/routes/projectChat.ts`
- [ ] Update `backend/src/routes/downloads.ts`
- [ ] Add new backend endpoints in `backend/src/routes/user.ts` (GET /user/profile)
- [ ] Refactor `frontend/src/contexts/UserProfileContext.tsx` to use API instead of Supabase

### Testing Each Route
- [ ] GET /projects → returns list
- [ ] POST /projects → creates project
- [ ] GET /projects/:projectId → returns project
- [ ] PATCH /projects/:projectId → updates project
- [ ] DELETE /projects/:projectId → deletes project
- [ ] Same for chat, documents, workflows, tabular, etc.

### Integration Test
- [ ] Frontend loads without Supabase client
- [ ] Create a project via UI
- [ ] Upload a document
- [ ] Create a chat
- [ ] Verify all data persists in backend (still Supabase, no SQLite yet)

---

## Backward Compatibility Safeguards

**Before each replacement:**
1. Check if the db client is still Supabase (first PR still uses Supabase, just abstracted)
2. Ensure repository functions pass `db` parameter correctly
3. Error handling: repository functions return `null` on error, routes check for null
4. No changes to HTTP response formats

---

## Example Diff: projects.ts

```diff
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
+ import * as projectRepo from "../lib/db-abstraction";

export const projectsRouter = Router();

// GET /projects
projectsRouter.get("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const db = createServerSupabase();

-   const { data: ownProjects, error: ownError } = await db
-     .from("projects")
-     .select("*")
-     .eq("user_id", userId)
-     .order("created_at", { ascending: false });
-   if (ownError) return void res.status(500).json({ detail: ownError.message });

+   const ownProjects = await projectRepo.listProjectsByUser(userId, db);
+   if (!ownProjects) return void res.status(500).json({ detail: "Failed to fetch projects" });

  // ... rest of function unchanged ...
});
```

---

## Post Phase 3: What's Achieved

After this PR is complete:
- ✅ All database access routed through repositories
- ✅ Supabase client only instantiated in `createServerSupabase()`
- ✅ Easy to swap DB backend by modifying repository layer only
- ✅ Frontend no longer touches Supabase (all via API)
- ✅ Ready for Phase 4 (SQLite migration)

---

## Phase 4 Preview (After Phase 3)

Once all routes use repositories, Phase 4 becomes straightforward:

1. Create `backend/src/db/sqlite.ts` with SQLite adapter
2. Create `backend/src/db/migrations.ts` with schema
3. Modify `createServerSupabase()` to return SQLite adapter when `APP_MODE=local`
4. Repositories call identical methods on both Supabase and SQLite clients
5. No route code changes needed

---

## Timeline & Risk

**Timeline:** 2-3 hours for experienced TypeScript dev  
**Risk Level:** Low  
**Can be split?** Yes, one route per commit  
**Reviewers should check:** Each route still returns correct data shapes  

