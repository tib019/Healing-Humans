/**
 * Zapier-Webhook-Endpoint: POST /api/zapier/create-user
 *
 * Ermöglicht Zapier, neue Nutzer aus Ablefy oder Skool automatisch anzulegen.
 * Gesichert über einen statischen API-Key (ZAPIER_API_KEY Umgebungsvariable).
 *
 * Erwarteter Request-Body:
 *   { email: string, name?: string, role?: "patient"|"therapeut"|"admin", password?: string }
 *
 * Antwort bei Erfolg (201):
 *   { success: true, userId: number, email: string, temporaryPassword?: string }
 */

import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { createUser, getUserByEmail, setSupabaseId } from "./db";
import { nanoid } from "nanoid";
import { getSupabase } from "./supabase";

export function registerZapierRoutes(app: Router) {
  app.post("/api/zapier/create-user", async (req: Request, res: Response) => {
    // ── 1. API-Key-Prüfung ────────────────────────────────────────────────────
    const apiKey = process.env.ZAPIER_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: "ZAPIER_API_KEY ist nicht konfiguriert.",
      });
    }

    const authHeader = req.headers["authorization"] ?? "";
    const providedKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.headers["x-api-key"] ?? "";

    if (providedKey !== apiKey) {
      return res.status(401).json({ success: false, error: "Ungültiger API-Key." });
    }

    // ── 2. Input-Validierung ──────────────────────────────────────────────────
    const { email, name, role, password } = req.body as {
      email?: string;
      name?: string;
      role?: string;
      password?: string;
    };

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Gültige E-Mail-Adresse erforderlich." });
    }

    const validRoles = ["patient", "therapeut", "admin"];
    const userRole = validRoles.includes(role ?? "") ? (role as "patient" | "therapeut" | "admin") : "patient";

    // ── 3. Duplikat-Prüfung ───────────────────────────────────────────────────
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Ein Nutzer mit dieser E-Mail-Adresse existiert bereits.",
        userId: existing.id,
      });
    }

    // ── 4. Passwort vorbereiten ───────────────────────────────────────────────
    let temporaryPassword: string | undefined;
    let passwordHash: string | undefined;

    if (password && password.length >= 6) {
      passwordHash = await bcrypt.hash(password, 10);
    } else {
      // Zufälliges Passwort generieren (8 Zeichen, URL-sicher)
      temporaryPassword = nanoid(10);
      passwordHash = await bcrypt.hash(temporaryPassword, 10);
    }

    // ── 5. Nutzer anlegen ─────────────────────────────────────────────────────
    try {
      const userId = await createUser({
        email,
        name: name ?? undefined,
        passwordHash,
        role: userRole,
      });

      // ── 6. Supabase-Profil automatisch anlegen ─────────────────────────────
      let supabaseId: string | null = null;
      try {
        const sb = getSupabase();
        const { data: sbProfile, error: sbError } = await sb
          .from("profiles")
          .insert({
            full_name: name ?? email.split("@")[0],
            role: userRole,
            coins_balance: 0,
          })
          .select("id")
          .single();
        if (!sbError && sbProfile?.id) {
          supabaseId = sbProfile.id;
          // Supabase-UUID in App-DB speichern für spätere Verknüpfung
          await setSupabaseId(userId, supabaseId!);
          console.log(`[Zapier] Supabase-Profil angelegt: ${supabaseId} für ${email}`);
        } else {
          console.warn(`[Zapier] Supabase-Profil konnte nicht angelegt werden: ${sbError?.message}`);
        }
      } catch (sbErr) {
        // Supabase-Fehler sollen den Nutzer-Anlege-Prozess nicht blockieren
        console.warn("[Zapier] Supabase-Profil-Erstellung fehlgeschlagen:", sbErr);
      }

      const responseBody: Record<string, unknown> = {
        success: true,
        userId,
        supabaseId,
        email: email.toLowerCase().trim(),
        role: userRole,
        name: name ?? null,
      };

      // Temporäres Passwort nur zurückgeben wenn keins übergeben wurde
      if (temporaryPassword) {
        responseBody.temporaryPassword = temporaryPassword;
        responseBody.note = "Bitte das temporäre Passwort sicher an den Nutzer übermitteln.";
      }

      return res.status(201).json(responseBody);
    } catch (err) {
      console.error("[Zapier] Fehler beim Anlegen des Nutzers:", err);
      return res.status(500).json({ success: false, error: "Interner Serverfehler." });
    }
  });

  // ── Health-Check für Zapier-Verbindungstest ───────────────────────────────
  app.get("/api/zapier/health", (req: Request, res: Response) => {
    const apiKey = process.env.ZAPIER_API_KEY;
    const authHeader = req.headers["authorization"] ?? "";
    const providedKey = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : req.headers["x-api-key"] ?? "";

    if (!apiKey || providedKey !== apiKey) {
      return res.status(401).json({ success: false, error: "Ungültiger API-Key." });
    }
    return res.status(200).json({ success: true, message: "Zapier-Endpoint ist erreichbar." });
  });
}
