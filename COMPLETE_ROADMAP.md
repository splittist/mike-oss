# Complete Migration Roadmap: Supabase → SQLite + Local

## Executive Summary

This document outlines the complete path from multi-user cloud (Supabase + R2 + Next.js) to single-user local (SQLite + filesystem + Next.js).

**Total Effort:** 40-60 engineer-hours  
**Risk Level:** Low (each phase can be reverted independently)  
**Can be parallelized?** Yes, phases 1-2 and 3 can overlap  
**Minimum viable product:** After Phase 4 (runs locally, no cloud dependency)  

---

## Phase Timeline & Dependencies

```
Phase 0: Stabilize & Document (BASELINE)
         └─ Snapshot current behavior ✅ DONE

Phase 1-2: Auth Removal & Abstraction (FIRST PR)
         ├─ Remove Supabase Auth JWT verification ✅ DONE
         ├─ Introduce local identity (local@localhost) ✅ DONE
         ├─ Create repository abstraction layer ✅ DONE
         └─ Add APP_MODE config toggle ✅ DONE
         ~6-8 hours ✅ COMPLETE

         ↓ (First PR merged)

Phase 3: Route Migration to Repository Layer (SECOND PR)
         ├─ Migrate all 8 backend routes to use repositories ✅ DONE
         ├─ Create GET /user/profile endpoint ✅ DONE
         ├─ Extended db-abstraction with ~350 new functions ✅ DONE
         ├─ All routes abstracted from database ✅ DONE
         ├─ Ensure all routes work with Supabase backend ✅ DONE
         └─ Backend compiles without errors ✅ DONE
         ~6-8 hours ✅ COMPLETE (Commit: f0ccb30)

         ↓ (Second PR merged)

Phase 4: SQLite Adapter & Local Storage (THIRD PR)
         ├─ Implement SQLite adapter with identical repository API ✅ DONE
         ├─ Create SQLite schema mirroring Supabase tables ✅ DONE
         ├─ Implement local filesystem storage (replace R2) ✅ DONE
         ├─ Implement migration runner ✅ DONE
         ├─ Toggle APP_MODE=local to use SQLite ✅ DONE
         └─ Smoke test end-to-end with local DB + storage ✅ DONE
         ~14-18 hours ✅ COMPLETE

         ↓ (Third PR shipped, fully local - CURRENT STATE)

Phase 5: Schema Simplification for Single-User (OPTIONAL)
         ├─ Remove sharing/ownership complexity
         ├─ Collapse user_profiles to app_settings
         ├─ Simplify access control (always current user)
         └─ Remove workflow_shares, project shared_with
         ~4-6 hours

         ↓

Phase 6: Next.js Replacement (OPTIONAL, deferred)
         ├─ Replace App Router with React Router / TanStack
         ├─ Remove next/link, next/navigation dependencies
         ├─ Migrate to Vite build (or keep Next.js)
         └─ Test end-to-end
         ~16-20 hours

         ↓

Phase 7: Electron/Tauri Shell (OPTIONAL, future enhancement)
         ├─ Wrap frontend + backend in desktop app shell
         ├─ System tray, native UI integrations
         └─ Cross-platform builds
         ~20-30 hours
```

---

## Recommended Stopping Points

### MVP After Phase 3 (12-16 hours total)
- ✅ All routes abstracted to repository layer
- ✅ Single-user, local API
- ✅ No Supabase Auth
- ✅ No direct DB calls in route files
- ✅ Still uses Supabase database + R2 storage
- ✅ Backend ready for database swap
- ✅ All code compiles and runs

**Good for:** Teams wanting clean architecture, API abstraction, easy to migrate to SQLite later.

---

### Fully Local After Phase 4 (26-34 hours total) ← CURRENTLY HERE
- ✅ Everything from Phase 3
- ✅ SQLite database (no Supabase)
- ✅ Local filesystem storage (no R2)
- ✅ No cloud dependencies
- ✅ Works completely offline
- ✅ Easy to backup/restore
- ✅ Next.js frontend

**Good for:** Fully self-contained app, runs on any machine, no subscriptions.

---

### Fully Local + Simplified After Phase 5 (30-40 hours total)
- ✅ Everything from Phase 4
- ✅ Schema optimized for single-user
- ✅ Simplified access control
- ✅ Smaller codebase (removed sharing logic)

**Good for:** Cleaner, more maintainable codebase.

---

### Fully Local + No Next.js After Phase 6 (46-60 hours total)
- ✅ Everything from Phase 5
- ✅ React Router instead of Next.js
- ✅ Vite build system
- ✅ Simpler deployment

**Good for:** Maximum portability, lighter build.

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

### Phase 3: Route Migration (SECOND PR - ✅ COMPLETE)
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

### Phase 4: SQLite Adapter (THIRD PR - ✅ COMPLETE)
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

**Status:** Implemented and smoke tested in local mode.

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
2. Phase 3 (Second PR) ✅ DONE
3. Phase 4 (Third PR) ✅ DONE

**Stop here.** You have a fully functional local single-user app.

---

### For Production-Ready (40-50 hours)
1. Phase 1-2 ✅
2. Phase 3 ✅
3. Phase 4 (SQLite) ✅
4. Phase 5 (Schema simplification)
5. Phase 6 (Next.js replacement)

**Optionally add Phase 7 later** if you want to remove Next.js.

---

## Risk Mitigation

### Testing Strategy
- **Phase 1-2:** No functionality lost (just auth removed), easy to revert
- **Phase 3:** Ensure routes still return same data shapes
- **Phase 4:** Test SQLite schema parity with Supabase
- **Phase 5:** Remove sharing/ownership logic carefully with regression tests
- **Phase 6:** Ensure routing, navigation, and build outputs match existing behavior
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

1. **Finalize docs and release notes** for Phase 4 completion
2. **Default local development docs to `APP_MODE=local`**
3. **Decide whether to start Phase 5** (schema simplification for single-user)
4. **Keep Phase 6/7 deferred** unless there is a clear product need

---

## Decision Matrix: When to Stop

| Goal | Stop After |
|------|------------|
| Remove Supabase Auth, keep current stack | Phase 2 ✅ |
| Run fully local, no cloud | Phase 4 ✅ |
| Simplified codebase | Phase 6 |
| No frameworks | Phase 7 |
| Desktop app | Phase 8 |

**Recommendation:** Stop after Phase 4 for a fully local app. Phase 5+ are optional quality-of-life improvements.

