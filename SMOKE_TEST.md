# Local Mode Smoke Test

Repeatable checklist for validating that the app works correctly in `APP_MODE=local`.
Run this after any significant change to the backend, SQLite adapter, or storage layer.

---

## Prerequisites

- Node.js installed
- Both `backend/` and `frontend/` dependencies installed (`npm install --prefix backend && npm install --prefix frontend`)
- No previous `backend/app.db` (delete it to start clean, or keep it to test persistence)

---

## 1. Start the App

**macOS / Linux:**
```bash
./start-local.sh
```

**Windows (PowerShell):**
```powershell
.\start-local.ps1
```

**Or manually in two terminals:**

Terminal 1 – backend:
```bash
# bash/zsh
cd backend
APP_MODE=local npm run dev
```
```powershell
# PowerShell
cd backend
$env:APP_MODE = "local"
npm run dev
```

Terminal 2 – frontend:
```bash
cd frontend
npm run dev
```

---

## 2. Startup Checks

- [ ] Backend starts without errors on `http://localhost:3001`
- [ ] Backend log shows `APP_MODE=local` or SQLite init message
- [ ] `backend/app.db` is created on first run
- [ ] `backend/storage/` directory is created on first run
- [ ] Frontend starts without errors on `http://localhost:3000`
- [ ] No Supabase connection errors in backend console
- [ ] Health endpoint responds: `curl http://localhost:3001/health` returns `{"ok":true}`

---

## 3. Authentication & Identity

Open `http://localhost:3000`.

- [ ] Dashboard loads without a login prompt
- [ ] User is automatically identified as `local@localhost`
- [ ] No auth-related errors in the browser console
- [ ] No redirect to a login page

---

## 4. Projects

- [ ] Dashboard shows a projects list (empty on first run)
- [ ] Create a new project (e.g. "Smoke Test Project")
- [ ] Project appears in the list
- [ ] Reload the page — project is still listed (data persisted in SQLite)
- [ ] Rename the project — new name is saved after page reload
- [ ] Delete the project — it no longer appears after page reload

---

## 5. Documents

Using the project created above (re-create if deleted):

- [ ] Navigate into the project
- [ ] Upload a document (PDF or DOCX)
- [ ] Document appears in the document list
- [ ] Reload — document still listed
- [ ] Open the document — content displays correctly
- [ ] Delete the document — it no longer appears
- [ ] Confirm the corresponding file is removed from `backend/storage/`

---

## 6. Chat

- [ ] Open a single-document chat (from any document)
- [ ] Send a message — response streams back without error
- [ ] Reload the chat page — message history is preserved
- [ ] Create a project-level chat
- [ ] Send a message in the project chat — response streams back

---

## 7. Workflows

- [ ] Navigate to Workflows
- [ ] Create a new workflow with a name and at least one prompt step
- [ ] Workflow appears in the list
- [ ] Reload — workflow is still listed
- [ ] Edit the workflow — changes are saved after reload
- [ ] Delete the workflow — it no longer appears

---

## 8. Tabular Reviews

- [ ] Navigate to Tabular Reviews
- [ ] Create a new tabular review (attach at least one document)
- [ ] Review appears in the list
- [ ] Add a column definition
- [ ] Run the review (AI fills cells)
- [ ] Reload — review state is preserved
- [ ] Export results (if UI supports it)

---

## 9. Persistence After Backend Restart

- [ ] Stop the backend (`Ctrl+C`)
- [ ] Restart: `APP_MODE=local npm run dev` in `backend/`
- [ ] Previously created projects, documents, chats, and reviews are still visible

---

## 10. File Storage Verification

```bash
# After uploading at least one document, confirm storage exists
ls backend/storage/
```

- [ ] At least one file or directory is present under `backend/storage/`
- [ ] Paths are subdirectory-structured (not all flat at root)

---

## 11. No Cloud Dependencies

- [ ] Disconnect from the internet (or block external traffic) and restart the backend
- [ ] App still loads and serves data from SQLite and local storage
- [ ] No errors about missing Supabase / R2 credentials in the backend log

---

## 12. Cloud Fallback (Optional)

If `.env` credentials are configured:

```bash
cd backend
APP_MODE=cloud npm run dev
```

- [ ] Backend starts in cloud mode (Supabase / R2)
- [ ] Switching back to `APP_MODE=local` restores local SQLite data

---

## Pass Criteria

All checked items in sections 2–9 must pass for the smoke test to be considered green.
Sections 10–12 are supplementary verifications.

Record any failures with reproduction steps and the relevant backend/browser console output.
