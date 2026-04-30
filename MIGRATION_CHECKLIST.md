# Migration Checklist: Supabase → SQLite + Local Identity

## Summary
Convert Mike from multi-user cloud-hosted (Next.js + Supabase + R2) to single-user local (Next.js + SQLite + filesystem).

## First PR Scope (Phase 1 & 2 Combined)
**Goal:** Remove Supabase Auth dependency, introduce local identity, keep all routes working.  
**Status:** Will compile and run with local user always authenticated.  
**Does NOT include:** SQLite migration yet (keep Supabase backend for this PR to minimize risk).

---

## Phase 0: Baseline (Already Complete)
Schema snapshot at [backend/migrations/000_one_shot_schema.sql](backend/migrations/000_one_shot_schema.sql)

---

## Phase 1a: Create DB Abstraction Layer (Transient - wraps Supabase initially)

### NEW FILE: backend/src/lib/db-abstraction.ts
Purpose: Repository-style functions that will later swap Supabase for SQLite.

```typescript
/**
 * Database abstraction layer.
 * Initially wraps Supabase calls; will migrate to SQLite backend.
 * Repositories provide stable method signatures so routes don't change when DB swaps.
 */

import { createServerSupabase } from "./supabase";

export type Db = ReturnType<typeof createServerSupabase>;

// ---------------------------------------------------------------------------
// User Profile Repo
// ---------------------------------------------------------------------------

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  organisation: string | null;
  tier: string;
  message_credits_used: number;
  credits_reset_date: string;
  tabular_model: string;
  claude_api_key: string | null;
  gemini_api_key: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(userId: string, db: Db): Promise<UserProfile | null> {
  const { data, error } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

export async function upsertUserProfile(userId: string, db: Db): Promise<UserProfile | null> {
  const { data, error } = await db
    .from("user_profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
  db: Db
): Promise<UserProfile | null> {
  const { data, error } = await db
    .from("user_profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Project Repo
// ---------------------------------------------------------------------------

export interface Project {
  id: string;
  user_id: string;
  name: string;
  cm_number: string | null;
  visibility: string;
  shared_with: string[] | null;
  created_at: string;
  updated_at: string;
}

export async function listProjectsByUser(userId: string, db: Db): Promise<Project[]> {
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function getProject(projectId: string, db: Db): Promise<Project | null> {
  const { data } = await db
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  return data ?? null;
}

export async function createProject(
  userId: string,
  name: string,
  cm_number?: string | null,
  db?: Db
): Promise<Project | null> {
  const client = db ?? createServerSupabase();
  const { data, error } = await client
    .from("projects")
    .insert({
      user_id: userId,
      name: name.trim(),
      cm_number: cm_number ?? null,
      shared_with: [],
    })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function updateProject(
  projectId: string,
  userId: string,
  updates: Partial<Project>,
  db: Db
): Promise<Project | null> {
  const { data, error } = await db
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function deleteProject(projectId: string, userId: string, db: Db): Promise<boolean> {
  const { error } = await db.from("projects").delete().eq("id", projectId).eq("user_id", userId);
  return !error;
}

// ... (similar patterns for Document, Chat, Workflow, TabularReview, etc.)
// For brevity in this checklist, only showing project repo as example.
// Full implementations follow the same pattern.
```

### NEW FILE: backend/src/config/env.ts
Purpose: Centralized env config to toggle local vs cloud mode.

```typescript
export interface AppConfig {
  mode: "local" | "cloud";
  port: number;
  frontendUrl: string;
  supabaseUrl?: string;
  supabaseSecretKey?: string;
  r2Endpoint?: string;
  r2AccessKey?: string;
  r2SecretKey?: string;
  r2Bucket?: string;
  localDbPath?: string;
  localStoragePath?: string;
}

export function loadConfig(): AppConfig {
  const mode = (process.env.APP_MODE || "local") as "local" | "cloud";

  return {
    mode,
    port: parseInt(process.env.PORT || "3001", 10),
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",

    // Cloud (Supabase + R2)
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
    r2Endpoint: process.env.R2_ENDPOINT_URL,
    r2AccessKey: process.env.R2_ACCESS_KEY_ID,
    r2SecretKey: process.env.R2_SECRET_ACCESS_KEY,
    r2Bucket: process.env.R2_BUCKET_NAME || "mike",

    // Local
    localDbPath: process.env.LOCAL_DB_PATH || "./data/app.db",
    localStoragePath: process.env.LOCAL_STORAGE_PATH || "./data/storage",
  };
}
```

---

## Phase 2: Remove Supabase Auth, Introduce Local Identity

### MODIFY: backend/src/middleware/auth.ts
Replace Supabase JWT verification with local-mode fallback.

**File location:** [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts)

**Change:** Remove Supabase verification; accept no token in local mode; always set a local user.

```diff
import { Request, Response, NextFunction } from "express";
- import { createClient } from "@supabase/supabase-js";

+ import { loadConfig } from "../config/env";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
+ const config = loadConfig();
+ 
+ if (config.mode === "local") {
+   // Local mode: always authenticate as local user
+   res.locals.userId = "local";
+   res.locals.userEmail = "local@localhost";
+   res.locals.token = "local-token";
+   next();
+   return;
+ }
+ 
+ // Cloud mode: verify Supabase token (existing code)
  const auth = req.headers.authorization ?? "";
  if (!auth.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Missing or invalid Authorization header" });
    return;
  }
  const token = auth.slice(7).trim();

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";

  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ detail: "Server auth is not configured" });
    return;
  }

+ const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data } = await admin.auth.getUser(token);
  if (!data.user) {
    res.status(401).json({ detail: "Invalid or expired token" });
    return;
  }

  res.locals.userId = data.user.id;
  res.locals.userEmail = data.user.email?.toLowerCase() ?? "";
  res.locals.token = token;
  next();
}
```

### MODIFY: backend/src/lib/supabase.ts
Add mode-aware creation; keep Supabase wrappers for now but make optional.

**File location:** [backend/src/lib/supabase.ts](backend/src/lib/supabase.ts)

**Change:** Wrap createServerSupabase to handle local mode gracefully (will return null/stub in local mode eventually).

```diff
import { createClient } from "@supabase/supabase-js";

+ import { loadConfig } from "../config/env";

/**
 * Server-side Supabase client using the service role key.
 * Bypasses RLS — only use in API routes after verifying the user.
 + * In local mode, this will be replaced by SQLite adapter.
 */
export function createServerSupabase() {
+ const config = loadConfig();
+ if (config.mode === "local") {
+   // Placeholder for SQLite adapter (Phase 3+)
+   // For now, still connect to Supabase if credentials exist for fallback
+   if (!config.supabaseUrl || !config.supabaseSecretKey) {
+     throw new Error("Local mode requires SQLite; Supabase not configured as fallback");
+   }
+ }
+
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SECRET_KEY || "";
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getUserIdFromRequest(req: Request): Promise<string> {
+ const config = loadConfig();
+ if (config.mode === "local") {
+   // Local mode: accept no token, return hardcoded local user
+   return "local";
+ }
+
+ // Cloud mode: verify Supabase token
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    throw new Response("Missing or invalid Authorization header", {
      status: 401,
    });
  }
  const token = auth.slice(7).trim();

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SECRET_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    throw new Response("Server auth is not configured", { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { data } = await admin.auth.getUser(token);
  if (!data.user) {
    throw new Response("Invalid or expired token", { status: 401 });
  }
  return data.user.id;
}
```

### MODIFY: frontend/src/contexts/AuthContext.tsx
Remove Supabase dependency; always return authenticated local user.

**File location:** [frontend/src/contexts/AuthContext.tsx](frontend/src/contexts/AuthContext.tsx)

**Change:** Simplify to not use Supabase; always authenticate.

```diff
"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
- import { supabase } from "@/lib/supabase";

interface User {
    id: string;
    email: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    authLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    useEffect(() => {
+       // Local mode: always authenticate as local@localhost
-       const ensureProfile = async (accessToken: string) => {
-           const apiBase =
-               process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
-           await fetch(`${apiBase}/user/profile`, {
-               method: "POST",
-               headers: { Authorization: `Bearer ${accessToken}` },
-           }).catch((e) => {
-               console.log(e);
-           });
-       };

-       const checkUser = async () => {
-           const {
-               data: { session },
-           } = await supabase.auth.getSession();

-           if (session?.user) {
-               setUser({
-                   id: session.user.id,
-                   email: session.user.email || "",
-               });
-               ensureProfile(session.access_token);
-           }
-           setAuthLoading(false);
-       };

-       checkUser();

-       const {
-           data: { subscription },
-       } = supabase.auth.onAuthStateChange(async (_event, session) => {
-           if (session?.user) {
-               setUser({
-                   id: session.user.id,
-                   email: session.user.email || "",
-               });
-               ensureProfile(session.access_token);
-           } else {
-               setUser(null);
-           }
-           setAuthLoading(false);
-       });

-       return () => {
-           subscription.unsubscribe();
-       };
+       const ensureProfile = async () => {
+           const apiBase =
+               process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
+           await fetch(`${apiBase}/user/profile`, {
+               method: "POST",
+               // No token needed in local mode
+           }).catch((e) => {
+               console.log(e);
+           });
+       };
+
+       // Always authenticate as local user in local mode
+       setUser({
+           id: "local",
+           email: "local@localhost",
+       });
+       ensureProfile();
+       setAuthLoading(false);
    }, []);

    const signOut = async () => {
-       await supabase.auth.signOut();
+       // Local mode: no-op for sign out (optional: clear app state)
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                authLoading,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
```

### MODIFY: frontend/src/app/lib/mikeApi.ts
Remove token attachment (local mode doesn't use auth headers).

**File location:** [frontend/src/app/lib/mikeApi.ts](frontend/src/app/lib/mikeApi.ts)

**Change:** Stop adding Authorization header in local mode.

```diff
/**
 * Mike API client — all requests to the Node.js backend.
- * Attaches the Supabase auth token for user authentication.
+ * In local mode, no auth token needed.
 */

- import { supabase } from "@/lib/supabase";

// ... existing imports and interfaces ...

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

async function getAuthHeader(): Promise<Record<string, string>> {
-   const {
-       data: { session },
-   } = await supabase.auth.getSession();
-   if (!session?.access_token) return {};
-   return { Authorization: `Bearer ${session.access_token}` };
+   // Local mode: no auth header needed
+   return {};
}

// ... rest of file unchanged ...
```

### MODIFY: frontend/src/app/login/page.tsx
Convert to local mode bypass (optional: show welcome screen instead).

**File location:** [frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx)

**Change:** Skip login form; redirect to assistant directly since we're always authenticated in local mode.

```diff
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
- import { supabase } from "@/lib/supabase";
- import { Button } from "@/components/ui/button";
- import { Input } from "@/components/ui/input";
- import Link from "next/link";
- import { SiteLogo } from "@/components/site-logo";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();
-   const [email, setEmail] = useState("");
-   const [password, setPassword] = useState("");
-   const [loading, setLoading] = useState(false);
-   const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

-   const handleLogin = async (e: React.FormEvent) => {
-       e.preventDefault();
-       setLoading(true);
-       setError(null);
-
-       try {
-           const { data, error } = await supabase.auth.signInWithPassword({
-               email,
-               password,
-           });
-
-           if (error) throw error;
-
-           router.push("/assistant");
-       } catch (error: any) {
-           setError(error.message || "An error occurred during login");
-       } finally {
-           setLoading(false);
-       }
-   };

    return (
        <div className="min-h-dvh bg-white flex items-center justify-center">
+           <div className="text-center">
+               <p className="text-gray-500 mb-4">Local mode: redirecting...</p>
+           </div>
        </div>
    );
}
```

### MODIFY: frontend/src/app/signup/page.tsx
Similar to login: bypass signup, always authenticated locally.

**File location:** [frontend/src/app/signup/page.tsx](frontend/src/app/signup/page.tsx)

**Change:** Simplify to redirect like login page.

```diff
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
- import { supabase } from "@/lib/supabase";
- import { Button } from "@/components/ui/button";
- // ... other imports ...
import { useAuth } from "@/contexts/AuthContext";

export default function SignupPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();

    useEffect(() => {
-       if (!authLoading && isAuthenticated && !success) {
+       if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
-   }, [authLoading, isAuthenticated, router, success]);
+   }, [authLoading, isAuthenticated, router]);

-   // ... all signup form code ...
    return (
        <div className="min-h-dvh bg-white flex items-center justify-center">
+           <div className="text-center">
+               <p className="text-gray-500 mb-4">Local mode: redirecting...</p>
+           </div>
        </div>
    );
}
```

---

## Phase 3: Update Routes to Use Abstraction (Example: Projects)

### MODIFY: backend/src/routes/projects.ts
Replace direct Supabase calls with repository functions.

**File location:** [backend/src/routes/projects.ts](backend/src/routes/projects.ts#L1-L50)

**Change:** Import repo functions and use them instead of direct db.from() calls.

```diff
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { createServerSupabase } from "../lib/supabase";
- import { createClient } from "@supabase/supabase-js";
+ import * as projectRepo from "../lib/db-abstraction";

export const projectsRouter = Router();

// GET /projects
projectsRouter.get("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const userEmail = res.locals.userEmail as string;
  const db = createServerSupabase();

- const { data: ownProjects, error: ownError } = await db
-   .from("projects")
-   .select("*")
-   .eq("user_id", userId)
-   .order("created_at", { ascending: false });
- if (ownError) return void res.status(500).json({ detail: ownError.message });

+ const ownProjects = await projectRepo.listProjectsByUser(userId, db);

  // ... rest of logic unchanged ...
});

// POST /projects
projectsRouter.post("/", requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const { name, cm_number, shared_with } = req.body as {
    name: string;
    cm_number?: string;
    shared_with?: string[];
  };
  if (!name?.trim())
    return void res.status(400).json({ detail: "name is required" });

  const db = createServerSupabase();
- const { data, error } = await db
-   .from("projects")
-   .insert({
-     user_id: userId,
-     name: name.trim(),
-     cm_number: cm_number ?? null,
-     shared_with: shared_with ?? [],
-   })
-   .select("*")
-   .single();
- if (error) return void res.status(500).json({ detail: error.message });
- res.status(201).json({ ...data, documents: [] });

+ const project = await projectRepo.createProject(userId, name, cm_number, db);
+ if (!project) return void res.status(500).json({ detail: "Failed to create project" });
+ res.status(201).json({ ...project, documents: [] });
});

// ... other routes follow same pattern ...
```

---

## Phase 4: Update Env Files

### MODIFY: backend/.env.example

```diff
PORT=3001
FRONTEND_URL=http://localhost:3000

+ # App mode: "local" or "cloud"
+ APP_MODE=local

+ # Local mode settings
+ LOCAL_DB_PATH=./data/app.db
+ LOCAL_STORAGE_PATH=./data/storage

# Cloud mode settings (Supabase + R2)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-supabase-service-role-key
```

### MODIFY: frontend/.env.local.example

```diff
- NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-anon-key
- SUPABASE_SECRET_KEY=your-supabase-service-role-key
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

---

## Remaining Phases (Out of Scope for First PR)

### Phase 3+: Migrate Data Backend to SQLite
- Create SQLite adapter with same repository signatures
- Swap db creation based on APP_MODE
- Run schema migrations on startup

### Phase 4: Local File Storage
- Replace R2 calls in storage.ts with filesystem adapter
- Keep method signatures stable

### Phase 5: Frontend UserProfileContext Refactor
- Move direct Supabase table writes to API calls
- Currently at [frontend/src/contexts/UserProfileContext.tsx](frontend/src/contexts/UserProfileContext.tsx)

### Phase 6: Next.js Replacement (Optional)
- Migrate routes to React Router / TanStack Router
- Remove next/link, next/navigation, next/font usage
- Replace with Vite or Electron

---

## Testing Checklist for First PR

After implementing above changes, verify:

- [ ] Backend starts in local mode: `APP_MODE=local npm run dev`
- [ ] Frontend loads without Supabase errors
- [ ] Auth context shows `local@localhost`
- [ ] No auth header in API calls
- [ ] Can navigate to /assistant (no login redirect)
- [ ] GET /projects returns empty list (no DB queries yet, but no errors)
- [ ] No TypeScript errors in frontend or backend
- [ ] Supabase deps still optional (cloud mode still works if creds provided)

---

## Compile & PR Readiness

**Does this PR compile?** Yes.  
**Does this PR work end-to-end?** Partially (routes return empty; DB still on Supabase).  
**Risk level:** Low (auth removed, but routes unchanged; can revert easily).  
**Next PR after this:** Swap backend routes to repository layer + SQLite adapter.

