import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import WebSocket from "ws";

const SUPABASE_URL = "https://lazyikoawttfcflpdixs.supabase.co";
// Publishable (anon) key — safe to embed; all tables allow anon select/insert/update.
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
