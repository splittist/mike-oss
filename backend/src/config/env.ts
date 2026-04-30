/**
 * Centralized environment configuration.
 * Toggles between local (SQLite + local files) and cloud (Supabase + R2) modes.
 */

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
