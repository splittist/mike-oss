import { createClient } from "@supabase/supabase-js";

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredSupabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const hasSupabaseConfig =
    Boolean(configuredSupabaseUrl) && Boolean(configuredSupabaseAnonKey);

// In local/offline mode we still create a client with stub values so imports do not crash.
const supabaseUrl = configuredSupabaseUrl || "http://127.0.0.1:54321";
const supabaseAnonKey = configuredSupabaseAnonKey || "local-stub-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (!hasSupabaseConfig && process.env.NODE_ENV !== "production") {
    console.warn(
        "[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY are not set. Using local stub client.",
    );
}
