import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for the Content Machine project (the shared
 * catalog + sell-through store). Reads work with the anon key because the
 * catalog tables carry an `allow_all` policy; `part_valuations` and any
 * future restricted tables require the service-role key.
 */

/**
 * When `CONTENT_MACHINE_SUPABASE_URL` is set, only the matching
 * `CONTENT_MACHINE_*` keys are used — generic `SUPABASE_*` variables in
 * the shell often belong to a different project and would be rejected.
 */
const explicit = (): boolean => Boolean(process.env.CONTENT_MACHINE_SUPABASE_URL);

function url(): string {
  const v = process.env.CONTENT_MACHINE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("CONTENT_MACHINE_SUPABASE_URL is not set");
  return v;
}

function key(): { value: string; role: "service_role" | "anon" } {
  const service = process.env.CONTENT_MACHINE_SUPABASE_SERVICE_ROLE_KEY || (explicit() ? undefined : process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (service) return { value: service, role: "service_role" };
  const anon = process.env.CONTENT_MACHINE_SUPABASE_ANON_KEY || (explicit() ? undefined : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (anon) return { value: anon, role: "anon" };
  throw new Error("No Supabase key configured (CONTENT_MACHINE_SUPABASE_SERVICE_ROLE_KEY or CONTENT_MACHINE_SUPABASE_ANON_KEY)");
}

let cached: { client: SupabaseClient; role: "service_role" | "anon" } | null = null;

export function getSupabase(): SupabaseClient {
  return getSupabaseWithRole().client;
}

export function getSupabaseWithRole(): { client: SupabaseClient; role: "service_role" | "anon" } {
  if (cached) return cached;
  const k = key();
  const client = createClient(url(), k.value, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  cached = { client, role: k.role };
  return cached;
}

/** True when the configured key can read service-role-only tables. */
export function hasServiceRole(): boolean {
  return getSupabaseWithRole().role === "service_role";
}
