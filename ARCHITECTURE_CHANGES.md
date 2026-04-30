# Architecture Changes: Phase 1-3 Complete, Phase 4 Path Clear

## Before (Original Multi-User Cloud Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Pages: login, signup, assistant, projects, etc.           │ │
│  │ Contexts: AuthContext (Supabase session), UserProfile... │ │
│  │ API Client: mikeApi.ts + Authorization: Bearer {token}  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                    (HTTP with JWT)                              │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │  SUPABASE AUTH (Supabase.io)                 │
        │  - Verify JWT token                          │
        │  - Manage user sessions                       │
        │  - Multi-user registration/login             │
        └──────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────┐      ┌─────────────┐     ┌─────────┐
    │ Backend│◄────►│  POSTGRES   │     │    R2   │
    │Express │ DB   │ (Supabase)  │     │ Storage │
    │  API   │      │  Database   │     │ (Cloud) │
    │        │      │             │     │         │
    │ Routes │      └─────────────┘     └─────────┘
    │--------|
    │ /chat  │      Multi-user sharing
    │ /projects     Project ownership
    │ /docs  │      Per-user quotas
    │ /wf... │
    │        │
    └────────┘

Key flows:
1. User logs in → Supabase Auth issues JWT
2. Frontend stores JWT in Supabase session
3. API calls include JWT in Authorization header
4. Backend verifies JWT with Supabase
5. Backend queries Postgres with user_id filter
6. Files stored in R2, signed URLs for download
```

---

## After Phase 3 (Current State ✅ COMPLETE)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Pages: dashboard, projects, chat, etc.                    │ │
│  │ Contexts: AuthContext (local@localhost), UserProfile...  │ │
│  │ API Client: mikeApi.ts (no JWT - local only)             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                   (HTTP, no auth)                               │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────┐
    │     BACKEND EXPRESS API             │
    │  ┌───────────────────────────────┐  │
    │  │ Routes (projects, chat, etc)  │  │
    │  │ NO direct db.from() calls     │  │
    │  │ ✅ Only use repository layer  │  │
    │  └───────┬───────────────────────┘  │
    │          │                           │
    │  ┌───────▼──────────────────────┐   │
    │  │  db-abstraction.ts (REPO)    │   │
    │  │ 100+ repository functions    │   │
    │  │ Supabase implementation      │   │
    │  └───────┬─────────┬────────────┘   │
    │          │         │                 │
    └──────────┼─────────┼─────────────────┘
               │         │
               ▼         ▼
        ┌─────────┐  ┌──────────┐
        │POSTGRES │  │ R2 Files │
        │(Supabase)  │(Cloudflare)
        └─────────┘  └──────────┘

Architecture Changes (Phase 1-3):
✅ 1. Auth removed - all requests treated as "local@localhost"
✅ 2. Routes use repository layer, not direct Supabase calls
✅ 3. NO JWT verification - local only
✅ 4. All database access goes through abstraction

Key flows:
1. Frontend loads without login (no auth page)
2. API calls have NO Authorization header
3. Backend middleware injects userId = "local@localhost"
4. All queries go through repository functions
5. Files still stored in R2 (can swap in Phase 4)
```

---

## After Phase 4 (Target: Fully Local ← READY TO IMPLEMENT)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Pages: dashboard, projects, chat, etc.                    │ │
│  │ Contexts: AuthContext (local@localhost), UserProfile...  │ │
│  │ API Client: mikeApi.ts (no JWT - local only)             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                   (HTTP, no auth)                               │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────┐
    │     BACKEND EXPRESS API             │
    │  ┌───────────────────────────────┐  │
    │  │ Routes (projects, chat, etc)  │  │
    │  │ ✅ ONLY use repository layer  │  │
    │  └───────┬───────────────────────┘  │
    │          │                           │
    │  ┌───────▼──────────────────────┐   │
    │  │  db-abstraction.ts (REPO)    │   │
    │  │ 100+ repository functions    │   │
    │  │ ✨ SQLite implementation ✨   │   │
    │  └───────┬───────────────────────┘   │
    │          │                           │
    │  ┌───────▼──────────────────────┐   │
    │  │  storage adapter             │   │
    │  │ ✨ Local filesystem ✨        │   │
    │  └───────┬───────────────────────┘   │
    │          │                           │
    └──────────┼───────────────────────────┘
               │
      ┌────────┴─────────┐
      │                  │
      ▼                  ▼
  ┌─────────┐      ┌──────────────┐
  │ app.db  │      │   storage/   │
  │(SQLite) │      │ (local files)│
  └─────────┘      └──────────────┘

 🎉 FULLY LOCAL - NO CLOUD DEPENDENCIES 🎉

Phase 4 Changes:
✨ 1. SQLite replaces Postgres
✨ 2. Local filesystem replaces R2
✨ 3. NO Supabase connection needed
✨ 4. Works completely offline
✨ 5. Single app.db file for all data
✨ 6. storage/ folder for all files

Deployment:
- Single binary with embedded database
- Works on any machine
- Easy backup/restore (copy app.db)
- Zero subscription costs
```

---

## After Phase 1-2 (Local Auth, Abstracted DB)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Pages: auto-load /assistant (no login page)               │ │
│  │ Contexts: AuthContext (hardcoded local user)             │ │
│  │ API Client: mikeApi.ts (NO Authorization header)         │ │
│  │ No Supabase imports anywhere                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
│                    (HTTP, no JWT)                               │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────┐
    │  Backend (Express)                       │
    │  ┌─────────────────────────────────────┐ │
    │  │ requireAuth Middleware              │ │
    │  │ if (APP_MODE == 'local'):           │ │
    │  │   userId = 'local'                  │ │
    │  │ else:                               │ │
    │  │   verify JWT with Supabase ✅      │ │
    │  └─────────────────────────────────────┘ │
    │                                          │
    │  ┌─────────────────────────────────────┐ │
    │  │ New Repository Layer                │ │
    │  │ (db-abstraction.ts)                 │ │
    │  │                                     │ │
    │  │ projectRepo.list()                  │ │
    │  │ chatRepo.create()                   │ │
    │  │ documentRepo.get()                  │ │
    │  │ ... etc ...                         │ │
    │  └─────────────────────────────────────┘ │
    │                                          │
    │  Routes still call repos                 │
    │  (not direct db.from() yet)             │
    └──────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────┐      ┌─────────────┐     ┌─────────┐
    │Supabase│      │ POSTGRES    │     │   R2    │
    │  (can  │      │ (Supabase)  │     │ Storage │
    │ still  │      │ Database    │     │ (still) │
    │  use)  │      │             │     │         │
    └────────┘      └─────────────┘     └─────────┘
        OR
    ┌────────┐      (Phase 4 adds)
    │ SQLite │
    │ (TODO) │
    └────────┘

Key changes:
1. No JWT verification when APP_MODE=local
2. Frontend doesn't import Supabase
3. All DB access through repository layer
4. Routes unchanged externally (API still works)
5. Ready for Phase 3 (use repos everywhere)
6. Ready for Phase 4 (swap to SQLite)
```

---

## After Phase 3 (Routes Use Repositories)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ No Supabase imports anywhere                              │ │
│  │ UserProfileContext uses /user/profile API (not Supabase) │ │
│  │ All user data fetched via backend API                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────┐
    │  Backend (Express)                       │
    │  ┌─────────────────────────────────────┐ │
    │  │ Routes using Repository Layer       │ │
    │  │                                     │ │
    │  │ GET /projects ───────────┐          │ │
    │  │ POST /projects       ┌────┼────┐    │ │
    │  │ GET /chat           │    │    │    │ │
    │  │ POST /chat  ───────►│ DB │ AB │    │ │
    │  │ GET /documents      │    │    │    │ │
    │  │ POST /documents ────┤    └────┘    │ │
    │  │ GET /workflows      │              │ │
    │  │ ...etc...           │              │ │
    │  │                     │              │ │
    │  └─────────────────────┼──────────────┘ │
    │                        │                │
    │  AB = db-abstraction.ts (Repository)   │
    │                                        │
    └────────────────────────┼────────────────┘
                             │
        ┌────────────────────┼────────────────┐
        │                    │                │
        ▼                    ▼                ▼
    ┌────────┐      ┌─────────────┐     ┌─────────┐
    │Can use │      │ POSTGRES    │     │   R2    │
    │Supabase│  OR  │ (Supabase)  │     │ Storage │
    │ (old)  │      │             │     │ (still) │
    └────────┘      └─────────────┘     └─────────┘
        OR
    ┌────────┐
    │ SQLite │ ← Ready for Phase 4
    └────────┘

Key changes:
1. ALL routes use repository functions
2. Repository functions abstract database
3. Can swap Supabase for SQLite by changing ONE file
4. Frontend completely decoupled from Supabase
5. Ready for Phase 4 (SQLite swap)
```

---

## After Phase 4 (SQLite Backend)

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Zero cloud dependencies                                   │ │
│  │ All data via local API                                    │ │
│  │ Can work completely offline                              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────┐
    │  Backend (Express)                       │
    │  ┌─────────────────────────────────────┐ │
    │  │ Routes using Repository Layer       │ │
    │  │ (no changes from Phase 3)           │ │
    │  │                                     │ │
    │  │ projectRepo.list() ────┐            │ │
    │  │ chatRepo.create() ─────┤            │ │
    │  │ documentRepo.get() ────┼──► DB AB   │ │
    │  │ workflowRepo.* ────────┤   (updated)│ │
    │  │ ...etc...              │            │ │
    │  │                        │            │ │
    │  └────────────────────────┼────────────┘ │
    │                           │              │
    │  AB now calls SQLite adapter             │
    │  (same repository interface)             │
    │                                          │
    └─────────────────────────────┼────────────┘
                                  │
                                  ▼
                            ┌────────────┐
                            │  SQLite    │
                            │ ./data/    │
                            │ app.db     │
                            │            │
                            │ Single     │
                            │ local user │
                            │ schema     │
                            └────────────┘

Key changes:
1. createServerSupabase() returns SQLite adapter
2. SQLite implements same repository interface
3. Schema matches Supabase (or simplified if Phase 6 done)
4. ALL data local, no cloud calls
5. Can share/backup just ./data/ folder
6. Ready for Phase 5 (local file storage)
```

---

## After Phase 5 (Local File Storage)

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                     (completely local)                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
    ┌──────────────────────────────────────────┐
    │  Backend (Express) - Local Only          │
    │  - No cloud dependencies                 │
    │  - No auth required                      │
    │  - Single-user always                    │
    └──────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    ┌────────┐      ┌─────────────┐     ┌─────────┐
    │ SQLite │      │   SQLite    │     │ Local   │
    │ Schema │      │   Data      │     │ Files   │
    │        │      │   Tables    │     │         │
    │ ./data/│      │ ./data/     │     │ ./data/ │
    │ app.db │      │ app.db      │     │ storage/│
    │        │      │             │     │         │
    └────────┘      └─────────────┘     └─────────┘
    (migrations)     (runtime data)    (document
                                        versions,
                                        converted
                                        PDFs, etc.)

Entirely self-contained:
- Single ./data/ folder contains EVERYTHING
- Easy to backup (cp -r ./data ~/backup)
- Easy to version control (if using Git LFS)
- Works completely offline
- Zero external dependencies
```

---

## After Phase 6 (Schema Simplified)

```
SQLite Schema (before Phase 6):
├─ user_profiles (multi-user remnants)
├─ projects
│  └─ shared_with (users this is shared with)
├─ workflow_shares
├─ project_shares
└─ ... etc (multi-user logic)

SQLite Schema (after Phase 6):
├─ app_settings (one row: display_name, org, model preference)
├─ projects (no shared_with column)
├─ documents
├─ chats
├─ workflows (only system workflows, no shares)
├─ tabular_reviews
└─ ... (single-user only)

Benefits:
- Smaller schema
- Simpler access control (always current user)
- Cleaner codebase (remove shared_with checks)
- Fewer edge cases
- Easier to understand

Trade-off:
- No multi-user sharing (by design, single-user app)
- Can't revert to multi-user without migration
```

---

## Dependency Graph: Which Phases Depend on Which?

```
Phase 0: Stabilize (baseline)
    │
    ▼
Phase 1-2: Auth Removal ✅ DONE
    │
    ├─► Phase 3: Route Migration (6-8 hours)
    │       │
    │       ├─► Phase 4: SQLite (12-16 hours)
    │       │       │
    │       │       ├─► Phase 5: Local Storage (8-10 hours)
    │       │       │       │
    │       │       │       └─► Phase 6: Simplify Schema (4-6 hours)
    │       │       │
    │       │       └─► Phase 7: Vite Swap (16-20 hours) [optional]
    │       │
    │       └─► Phase 8: Electron Shell (20-30 hours) [future]
    │
    └─► Can stop here: Cloud mode still works

Can be done in parallel:
- Phase 1-2 and design of Phase 3-4 (while Phase 1-2 in review)
- Phase 3 and Phase 4 implementation (independent of UI)
- Phase 5 and Phase 6 can overlap

Must be sequential:
- Phase 1-2 → Phase 3 (routes must use repos before swapping DB)
- Phase 3 → Phase 4 (repos must exist before using SQLite)
```

---

## File Size & Complexity

### Before (Multi-user Cloud)
- Schema: 35+ tables (sharing, multi-user, auth)
- Frontend code: Supabase client + session management
- Backend code: JWT verification + sharing/ownership checks
- Complexity: High (multi-user logic throughout)

### After Phase 2 (Local Auth)
- Schema: Unchanged (still Supabase compatible)
- Frontend code: No Supabase, simpler auth context
- Backend code: Repositories added, routes unchanged
- Complexity: Medium (starting to separate concerns)

### After Phase 3 (Routes Using Repos)
- Schema: Unchanged
- Frontend code: No Supabase, API calls only
- Backend code: All access via repositories
- Complexity: Medium (clear abstraction boundary)

### After Phase 4 (SQLite)
- Schema: Can be simplified (optional)
- Backend code: SQLite adapter swappable
- Complexity: Reduces if Phase 6 done

### After Phase 6 (Simplified)
- Schema: ~15 tables (single-user only)
- Backend code: No sharing/ownership logic
- Complexity: Low (straightforward single-user app)
- Codebase size: ~30% smaller than multi-user

---

## Technology Stack Comparison

| Aspect | Before | After Phase 2 | After Phase 4 | After Phase 6 |
|--------|--------|---------------|---------------|---------------|
| Frontend | Next.js + Supabase | Next.js (no Supabase) | Next.js (local) | Next.js (local) |
| Backend API | Express | Express | Express | Express |
| Database | Supabase Postgres | Supabase (swappable) | SQLite | SQLite (simplified) |
| File Storage | Cloudflare R2 | R2 (swappable) | Local FS | Local FS |
| Auth | Supabase Auth | Local (hardcoded) | Local | Local |
| Users | Multi-user | Multi-user (disabled) | Single-user | Single-user |
| Cloud Deps | 2 (Supabase, R2) | 2 (optional) | 0 | 0 |
| Dev Setup | Requires Supabase account | Just npm install | Just npm install | Just npm install |
