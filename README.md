# Mike

Open-source release containing the Mike frontend and backend.

## Contents

- `frontend/` - Next.js application
- `backend/` - Express API, document processing, and migrations
- `backend/src/db/schema.sql` - SQLite schema for local mode
- `backend/migrations/000_one_shot_schema.sql` - one-shot Supabase schema for cloud mode

## Quick Start (Local Mode)

The app runs fully offline with SQLite and local filesystem storage. No Supabase or R2 account required.

Install dependencies:

```bash
npm install --prefix backend
npm install --prefix frontend
```

### One-command startup

**macOS / Linux:**
```bash
./start-local.sh
```

**Windows (PowerShell):**
```powershell
.\start-local.ps1
```

Both scripts install dependencies (if missing), start the backend on `http://localhost:3001` with `APP_MODE=local`, and start the frontend on `http://localhost:3000`. Press Ctrl+C to stop both.

### Manual startup (two terminals)

Start the backend in local mode:

```powershell
# PowerShell
cd backend
$env:APP_MODE = "local"
npm run dev
```

```bash
# bash/zsh
cd backend
APP_MODE=local npm run dev
```

Start the frontend:

```bash
npm run dev --prefix frontend
```

Open `http://localhost:3000`.

The backend will auto-create `backend/app.db` and `backend/storage/` on first run.

## Cloud Mode (Optional)

To run against Supabase + R2 instead:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.local.example frontend/.env.local
# Fill in SUPABASE_URL, SUPABASE_SECRET_KEY, and R2 credentials
# Leave APP_MODE unset or set APP_MODE=cloud
npm run dev --prefix backend
```

Run `backend/migrations/000_one_shot_schema.sql` in the Supabase SQL editor for a fresh cloud database.

## Required for Cloud Mode

- Supabase Auth and Postgres
- S3-compatible object storage, such as Cloudflare R2
- At least one supported model provider key
- LibreOffice for DOC/DOCX to PDF conversion

## Checks

```bash
npm run build --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

## Documentation

### Current (source of truth)
| File | Purpose |
|------|---------|
| [CURRENT_STATUS.md](CURRENT_STATUS.md) | Where things stand today and recommended next steps |
| [COMPLETE_ROADMAP.md](COMPLETE_ROADMAP.md) | Full phase-by-phase roadmap with completion status |
| [START_HERE.md](START_HERE.md) | Onboarding entry point and quick run instructions |
| [SMOKE_TEST.md](SMOKE_TEST.md) | Repeatable checklist for validating local mode |
| [SQLITE_MIGRATION_PATH.md](SQLITE_MIGRATION_PATH.md) | SQLite implementation reference and patterns |
| [ARCHITECTURE_CHANGES.md](ARCHITECTURE_CHANGES.md) | Architectural decisions and abstractions |

### Historical (reference only)
| File | Purpose |
|------|---------|
| [FIRST_PR_SUMMARY.md](FIRST_PR_SUMMARY.md) | Phase 1-2 milestone: auth removal |
| [SECOND_PR_SCOPE.md](SECOND_PR_SCOPE.md) | Phase 3 milestone: repository layer |
| [QUICK_START_PHASE4.md](QUICK_START_PHASE4.md) | Phase 4 implementation guide (complete) |
| [PHASE4_VISION.md](PHASE4_VISION.md) | Phase 4 product vision (achieved) |
| [SESSION_COMPLETE.md](SESSION_COMPLETE.md) | Phase 3→4 handoff notes |
| [MIGRATION_CHECKLIST.md](MIGRATION_CHECKLIST.md) | Detailed migration checklist |

## License

AGPL-3.0-only. See `LICENSE`.
