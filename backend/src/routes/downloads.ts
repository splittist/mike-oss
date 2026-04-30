import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
import { buildContentDisposition, downloadFile } from "../lib/storage";
import { verifyDownload } from "../lib/downloadTokens";
import { ensureDocAccess } from "../lib/access";
import { getDocumentVersionByStoragePath, getDocument } from "../lib/db-abstraction";

export const downloadsRouter = Router();

function contentTypeFor(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".docx"))
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".xlsx"))
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/octet-stream";
}

// GET /download/:token
downloadsRouter.get("/:token", requireAuth, async (req, res) => {
    const userId = res.locals.userId as string;
    const userEmail = res.locals.userEmail as string | undefined;
    const info = verifyDownload(req.params.token);
    if (!info)
        return void res.status(404).json({ detail: "Invalid link" });

    const db = createServerSupabase();
    
    const version = await getDocumentVersionByStoragePath(info.path, db);
    if (!version)
        return void res.status(404).json({ detail: "File not found" });

    const doc = await getDocument((version as any).document_id, db);
    if (!doc)
        return void res.status(404).json({ detail: "File not found" });

    const access = await ensureDocAccess(doc as any, userId, userEmail, db);
    if (!access.ok)
        return void res.status(404).json({ detail: "File not found" });

    const raw = await downloadFile(info.path);
    if (!raw)
        return void res.status(404).json({ detail: "File not found" });

    res.setHeader("Content-Type", contentTypeFor(info.filename));
    res.setHeader(
        "Content-Disposition",
        buildContentDisposition("attachment", info.filename),
    );
    res.send(Buffer.from(raw));
});
