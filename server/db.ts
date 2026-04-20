import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

// Drizzle-Instanz wird lazy erstellt
let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Verbindung fehlgeschlagen:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Nutzer anhand der E-Mail-Adresse abrufen.
 * Wird beim Login verwendet.
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return result[0] ?? undefined;
}

/** Nutzer anhand der ID abrufen (für Session-Validierung) */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? undefined;
}

/** Nutzer anhand der Manus openId abrufen (Rückwärtskompatibilität) */
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] ?? undefined;
}

/**
 * Neuen Nutzer anlegen (vom Admin für Skool-Import).
 * Gibt die neue Nutzer-ID zurück.
 */
export async function createUser(data: {
  email: string;
  name?: string;
  passwordHash?: string;
  role?: "patient" | "therapeut" | "admin";
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");

  const result = await db.insert(users).values({
    email: data.email.toLowerCase().trim(),
    name: data.name ?? null,
    passwordHash: data.passwordHash ?? null,
    role: data.role ?? "patient",
    loginMethod: "email",
    lastSignedIn: new Date(),
  });
  return (result[0] as { insertId: number }).insertId;
}

/**
 * Passwort-Hash eines Nutzers aktualisieren.
 * Wird beim Passwort-Reset und beim ersten Passwort-Setzen verwendet.
 */
export async function updatePasswordHash(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** lastSignedIn-Zeitstempel aktualisieren */
export async function updateLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

/** Alle Nutzer abrufen (nur für Admin-Übersicht) */
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

/** Nutzer-Rolle manuell setzen (nur Admin darf das) */
export async function setUserRole(userId: number, role: "patient" | "therapeut" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

/** Calendly-Link eines Therapeuten setzen oder entfernen (nur Admin) */
export async function setCalendlyUrl(userId: number, calendlyUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Keine Datenbankverbindung");
  await db.update(users).set({ calendlyUrl, updatedAt: new Date() }).where(eq(users.id, userId));
}

/** Supabase-UUID eines Nutzers setzen (beim ersten Login per E-Mail-Lookup) */
export async function setSupabaseId(userId: number, supabaseId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ supabaseId }).where(eq(users.id, userId));
}

/** Alle Therapeuten mit ihren Calendly-Links abrufen (für Patient-Buchung) */
export async function getTherapeutList() {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ id: users.id, name: users.name, email: users.email, calendlyUrl: users.calendlyUrl })
    .from(users)
    .where(eq(users.role, "therapeut"));
  return result;
}

/**
 * Upsert via openId (Manus OAuth – Rückwärtskompatibilität).
 * Kann entfernt werden sobald alle Nutzer auf E-Mail/Passwort migriert sind.
 */
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId ist erforderlich");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Kein Datenbankzugriff – upsertUser übersprungen");
    return;
  }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const val = user[field];
    if (val !== undefined) {
      values[field] = val ?? null;
      updateSet[field] = val ?? null;
    }
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn = new Date();
  updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
