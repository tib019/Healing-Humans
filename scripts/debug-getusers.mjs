/**
 * Debug: warum gibt getUsers [] zurück obwohl 4 Profile in Supabase sind?
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Exakt wie getAllProfiles in supabase.ts
const { data, error } = await sb
  .from("profiles")
  .select("id, full_name, role, coins_balance, calendly_url")
  .order("full_name");

console.log("Error:", error);
console.log("Data:", JSON.stringify(data, null, 2));
