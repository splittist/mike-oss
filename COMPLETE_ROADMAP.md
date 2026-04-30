# Complete Migration Roadmap: Supabase → SQLite + Local

## Executive Summary

This document outlines the complete path from multi-user cloud (Supabase + R2 + Next.js) to single-user local (SQLite + filesystem + Next.js).

**Total Effort:** 40-60 engineer-hours  
**Risk Level:** Low (each phase can be reverted independently)  
**Can be parallelized?** Yes, phases 1-2 and 3 can overlap  
**Minimum viable product:** After Phase 3 (runs locally, no cloud dependency)  

---

## Phase Timeline & Dependencies

```
Phase 0: Stabilize & Document (BASELINE - already done)
         └─ Snapshot current behavior ✅

Phase 1-2: Auth Removal & Abstraction (FIRST PR - COMPLETE)
         ├─ Remove Supabase Auth JWT verification ✅
         ├─ Introduce local identity (local@localhost) ✅
         ├─ Create repository abstraction layer ✅
         └─ Add APP_MODE config toggle ✅
         ~6-8 hours ✅

         ↓ (First PR shipped, tested, merged)

Phase 3: Route Migration to Repository Layer (SECOND PR)
         ├─ Migrate all backend routes to use repositores
         ├─ Add backend endpoints for frontend profile access
         ├─ Ensure all routes still work with Supabase backend
         └─ Frontend stops using Supabase client
         ~6-8 hours (can start immediately after Phase 1-2)

         ↓ (Second PR shipped, tested, merged)

Phase 4: SQLite Adapter & Schema (THIRD PR - Optional but recommended)
         ├─ Implement SQLite adapter with identical repository API
         ├─ Create SQLite schema mirroring Supabase
         ├─ Implement migration runner
         ├─ Toggle APP_MODE=local to use SQLite
         └─ Test end-to-end with local DB
         ~12-16 hours

         ↓ (Third PR shipped, working locally)

Phase 5: Local File Storage Adapter (FOURTH PR - Optional)
         ├─ Replace R2 storage with local filesystem
         ├─ Implement versioning by date/uuid
         ├─ Add backup/restore features
         └─ Ensure all document operations work locally
         ~8-10 hours

         ↓ (Fourth PR shipped, fully local)

Phase 6: Schema Simplification for Single-User (FIFTH PR - Optional)
         ├─ Remove sharing/ownership complexity
         ├─ Collapse user_profiles to app_settings
         ├─ Simplify access control (always current user)
         └─ Remove workflow_shares, project shared_with
         ~4-6 hours

         ↓ (Fifth PR shipped, schema simplified)

Phase 7: Next.js Replacement (SIXTH PR - Optional, deferred)
         ├─ Replace App Router with React Router / TanStack
         ├─ Remove next/link, next/navigation, next/font
         ├─ Migrate to Vite build (or keep Next.js)
         ├─ Update styles/components if using Next.js-specific features
         └─ Test end-to-end
         ~16-20 hours

         ↓ (Sixth PR shipped, no Next.js dependency)

Phase 8: Electron/Tauri Shell (SEVENTH PR - Optional, future enhancement)
         ├─ Wrap frontend + backend in desktop app shell
         ├─ System tray, native UI integrations
         └─ Cross-platform builds (Windows, Mac, Linux)
         ~20-30 hours
```

---

## Recommended Stopping Points

### MVP After Phase 3 (6-14 hours total)
- ✅ Single-user, local API
- ✅ No Supabase Auth
- ✅ Still uses Supabase database + R2 storage (or can run standalone)
- ✅ All routes abstracted, ready for SQLite swap
- ✅ Frontend runs without Supabase client

**Good for:** Teams wanting to remove Supabase Auth + frontend coupling, keep current stack.

---

### Fully Local After Phase 5 (30-50 hours total)
- ✅ Single-user, local API
- ✅ SQLite database
- ✅ Local filesystem storage
- ✅ No cloud dependencies
- ✅ Next.js frontend

**Good for:** Fully self-contained app, easy to share/backup, works offline.

---

### Simplified After Phase 6 (34-56 hours total)
- ✅ Everything above
- ✅ Schema optimized for single-user
- ✅ Simplified access control
- ✅ Smaller codebase (removed sharing/multi-user logic)

**Good for:** Cleaner, maintainable codebase.

---

### Frameworkless After Phase 7 (50-76 hours total)
- ✅ Everything above
- ✅ No Next.js, no Node build complexity
- ✅ Vanilla React + Vite
- ✅ Simpler deployment

**Good for:** Maximum portability, ease of hacking.

---

## Phase Details & Implementation Plan

### Phase 1-2: Auth Removal (DONE - First PR)
**What it does:**
- Removes Supabase Auth JWT verification
- Returns local@localhost user in all contexts
- Removes auth forms (login/signup pages)
- Adds APP_MODE config toggle

**Implementation:**
- ✅ Create `backend/src/config/env.ts`
- ✅ Create `backend/src/lib/db-abstraction.ts`
- ✅ Modify `backend/src/middleware/auth.ts`
- ✅ Modify `frontend/src/contexts/AuthContext.tsx`
- ✅ Modify `frontend/src/app/lib/mikeApi.ts`
- ✅ Simplify login/signup pages

**Files changed:** 8  
**Lines modified:** ~500  
**Tests needed:** Auth bypassed, API calls work, no Supabase errors  

---

### Phase 3: Route Migration (SECOND PR - Ready to start)
**What it does:**
- Moves all database queries behind repository layer
- Ensures frontend accesses user profile via API, not Supabase
- Leaves database unchanged (still Supabase)

**Implementation:**
- Migrate 7 backend routes (projects, chat, documents, workflows, tabular, projectChat, downloads)
- Add GET /user/profile endpoint
- Refactor UserProfileContext to use API
- See SECOND_PR_SCOPE.md for detailed changes per file

**Files changed:** 9  
**Estimated edits:** 35-52 replacements (can be done incrementally)  
**Tests needed:** All routes return data, no regressions  

**Decision Point:** After this phase, you have a working local app that depends only on Supabase backend. You can stop here or continue to full local.

---

### Phase 4: SQLite Adapter (THIRD PR - Can start after Phase 3)
**What it does:**
- Implements SQLite backend matching repository interface
- Adds schema migration runner
- Swaps database backend via APP_MODE=local

**Files to create:**
- `backend/src/db/sqlite.ts` - SQLite adapter with repository interface
- `backend/src/db/migrations.ts` - Schema creation and migrations
- `backend/src/db/init.ts` - Startup initialization

**Implementation outline:**
```typescript
// backend/src/db/sqlite.ts
export class SQLiteAdapter {
  async listProjectsByUser(userId: string): Promise<Project[]> { ... }
  async createProject(...): Promise<Project | null> { ... }
  // ... (same methods as Supabase adapter)
}
```

**When to do this:** After Phase 3 is merged and routes are using repositories.

---

### Phase 5: Local File Storage (FOURTH PR)
**What it does:**
- Replaces Cloudflare R2 with local filesystem
- Maintains versioning and file structure
- All document operations work locally

**Files to modify:**
- `backend/src/lib/storage.ts` - Add filesystem adapter

**Implementation outline:**
```typescript
// backend/src/lib/storage.ts
export async function uploadFile(key: string, content: ArrayBuffer): Promise<void> {
  if (config.mode === "local") {
    const path = `${config.localStoragePath}/${key}`;
    fs.writeFileSync(path, Buffer.from(content));
  } else {
    // R2 upload (existing code)
  }
}
```

---

### Phase 6: Schema Simplification (FIFTH PR - Optional)
**What it does:**
- Removes sharing/ownership logic
- Collapses user tables
- Simplifies access control

**Files to modify:**
- `backend/migrations/*.sql` - New schema
- `backend/src/lib/access.ts` - Simplify access checks
- Routes - Remove shared_with logic

**Example changes:**
- Remove workflow_shares table (only system workflows, no sharing)
- Remove project.shared_with column
- Collapse user_profiles into app_settings (one row)
- Remove ownership checks (current user always owns)

---

### Phase 7: Next.js Replacement (SIXTH PR - Deferred, optional)
**What it does:**
- Removes Next.js dependency
- Switches to Vite + React Router

**Effort:** ~20 hours (mostly mechanical)

**Files to modify:**
- Replace [frontend/src/app](frontend/src/app) routing with React Router
- Remove next/link, next/navigation, next/font
- Update build scripts in package.json
- Migrate layouts/components as needed

---

## Implementation Sequence Recommendation

### For Quick Local App (12-20 hours)
1. Phase 1-2 (First PR) ✅ DONE
2. Phase 3 (Second PR) - Do next
3. Phase 4 (Third PR) - SQLite swap

**Stop here.** You have a fully functional local single-user app.

---

### For Production-Ready (40-50 hours)
1. Phase 1-2 ✅
2. Phase 3
3. Phase 4 (SQLite)
4. Phase 5 (Local storage)
5. Phase 6 (Schema simplification)

**Optionally add Phase 7 later** if you want to remove Next.js.

---

## Risk Mitigation

### Testing Strategy
- **Phase 1-2:** No functionality lost (just auth removed), easy to revert
- **Phase 3:** Ensure routes still return same data shapes
- **Phase 4:** Test SQLite schema parity with Supabase
- **Phase 5:** Ensure document versioning works locally
- **Phase 6:** Remove features carefully (with feature flags if needed)
- **Phase 7:** UI should work identically (React component-level)

### Rollback Plan
Each phase can be reverted independently:
- Phase 1-2: `git revert <commit>` + restore Supabase env vars
- Phase 3: Routes go back to direct db.from() calls
- Phase 4: Switch APP_MODE back to "cloud"
- etc.

---

## Estimated Hours by Role

| Phase | Frontend | Backend | DevOps | Total |
|-------|----------|---------|--------|-------|
| 1-2 | 3 | 4 | 1 | 8 |
| 3 | 2 | 5 | 1 | 8 |
| 4 | 1 | 12 | 3 | 16 |
| 5 | 1 | 8 | 1 | 10 |
| 6 | 1 | 4 | 1 | 6 |
| 7 | 15 | 3 | 2 | 20 |
| **Total** | **23** | **36** | **9** | **68** |

---

## Next Steps

1. **Review this PR:** Phase 1-2 is complete and ready for review
2. **Merge Phase 1-2** (first PR)
3. **Start Phase 3** using SECOND_PR_SCOPE.md as guide
4. **Decide:** Stop at Phase 3 (quick local) or continue to Phase 5 (full local)?
5. **Defer Phase 7** (Next.js replacement) until later if at all

---

## Decision Matrix: When to Stop

| Goal | Stop After |
|------|------------|
| Remove Supabase Auth, keep current stack | Phase 2 ✅ |
| Run fully local, no cloud | Phase 5 |
| Simplified codebase | Phase 6 |
| No frameworks | Phase 7 |
| Desktop app | Phase 8 |

**Recommendation:** Stop after Phase 5 (fully local). Phase 6 & 7 are quality-of-life improvements, not essential.

