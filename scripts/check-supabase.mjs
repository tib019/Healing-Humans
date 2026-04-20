/**
 * Debug-Script: Supabase profiles-Tabelle prüfen
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY nicht gesetzt");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Alle Spalten der profiles-Tabelle abrufen
const { data, error } = await sb.from("profiles").select("*").limit(5);
if (error) {
  console.error("❌ Fehler:", error.message);
} else {
  console.log(`✅ ${data.length} Profile gefunden`);
  if (data.length > 0) {
    console.log("Spalten:", Object.keys(data[0]));
    console.log("Erster Eintrag:", JSON.stringify(data[0], null, 2));
  }
}
