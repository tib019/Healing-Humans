import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * App-eigene Nutzertabelle.
 * Auth: E-Mail + Passwort (bcrypt-Hash) — kein Manus OAuth mehr.
 * Rollen: patient / therapeut / admin
 *
 * Die eigentlichen Fach-Tabellen (sessions, coin_transactions, billing_requests, profiles)
 * liegen in Muhannads Supabase-Projekt und werden NICHT hier gespiegelt.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),

  /** Manus OAuth Identifier – optional, für Rückwärtskompatibilität */
  openId: varchar("openId", { length: 64 }).unique(),

  name: text("name"),

  /** E-Mail ist der primäre Login-Identifier */
  email: varchar("email", { length: 320 }).unique(),

  /** bcrypt-Hash des Passworts. NULL = noch kein Passwort gesetzt (Einladung ausstehend) */
  passwordHash: varchar("passwordHash", { length: 255 }),

  loginMethod: varchar("loginMethod", { length: 64 }).default("email"),

  /** Rolle bestimmt den Zugang zu den drei Dashboard-Bereichen */
  role: mysqlEnum("role", ["patient", "therapeut", "admin"]).default("patient").notNull(),

  /** Calendly-Link des Therapeuten (nur für Therapeuten relevant) */
  calendlyUrl: varchar("calendlyUrl", { length: 512 }),

  /**
   * Supabase UUID aus profiles.id.
   * Wird beim ersten Login per E-Mail-Lookup aus Supabase befüllt.
   * Ermöglicht direkte Verknüpfung mit Muhannads Datenbank.
   */
  supabaseId: varchar("supabaseId", { length: 36 }).unique(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
