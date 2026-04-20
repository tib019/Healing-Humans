/**
 * Seed-Script: Admin-Account in der Produktions-Datenbank anlegen
 * Ausführen mit: node scripts/seed-admin.mjs
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL nicht gesetzt");
  process.exit(1);
}

// bcrypt-Hash für admin123 generieren
const passwordHash = await bcrypt.hash("admin123", 10);
console.log("✅ bcrypt-Hash generiert");

// Datenbankverbindung
const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// Prüfen ob Admin bereits existiert
const [existing] = await connection.execute(
  "SELECT id FROM users WHERE email = ?",
  ["admin@healinghumans.de"]
);

if (existing.length > 0) {
  console.log("ℹ️  Admin-Account existiert bereits (ID:", existing[0].id, ")");
  // Passwort-Hash aktualisieren
  await connection.execute(
    "UPDATE users SET passwordHash = ?, role = 'admin', name = 'Admin', loginMethod = 'email' WHERE email = ?",
    [passwordHash, "admin@healinghumans.de"]
  );
  console.log("✅ Admin-Passwort aktualisiert");
} else {
  // Admin-Account anlegen
  await connection.execute(
    "INSERT INTO users (email, name, passwordHash, role, loginMethod) VALUES (?, ?, ?, 'admin', 'email')",
    ["admin@healinghumans.de", "Admin", passwordHash]
  );
  console.log("✅ Admin-Account angelegt: admin@healinghumans.de / admin123");
}

await connection.end();
console.log("✅ Fertig!");
