import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";

const SUPABASE_URL = "https://lazyikoawttfcflpdixs.supabase.co";
// Publishable key only. The lesson-plan tables have no direct anon policies;
// access goes through session-checked RPC functions. Never add a service key here.
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_RNdKa5FTqDB4KAPSpYP4lg_jIcwVjVI";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
    });
  }
  return client;
}
