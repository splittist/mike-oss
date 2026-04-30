# Migration Implementation Package - Start Here

## Current State

### Phase 1-2: Auth Removal and Abstraction ✅ COMPLETE
### Phase 3: Route Migration to Repository Layer ✅ COMPLETE
### Phase 4: SQLite and Local Filesystem ✅ COMPLETE

The app now supports fully local operation in `APP_MODE=local`.

---

## What To Read First

1. [CURRENT_STATUS.md](CURRENT_STATUS.md)
2. [COMPLETE_ROADMAP.md](COMPLETE_ROADMAP.md)
3. [SQLITE_MIGRATION_PATH.md](SQLITE_MIGRATION_PATH.md)

---

## Run Locally

### Backend (PowerShell)
```powershell
cd backend
$env:APP_MODE = "local"
npm run dev
```

### Frontend
```bash
cd frontend
npm run dev
```

If you see `EADDRINUSE` on port `3001`, stop the process using that port and restart backend.

---

## Suggested Next Steps

### 1. Stabilize Phase 4 (recommended)
- keep local smoke test checklist current
- verify all core endpoints in local mode
- document backup/restore workflow for `app.db` and `storage/`

### 2. Optional: Start Phase 5
- simplify single-user schema
- remove sharing-oriented complexity
- reduce maintenance overhead

### 3. Optional: Defer framework changes
- keep Phase 6 and Phase 7 deferred unless there is product value

---

## Notes

- `APP_MODE=cloud` remains available for fallback behavior.
- Repository abstraction remains the contract layer for both local and cloud backends.
- Routes should continue to avoid direct database calls.
