/**
 * OAuth-Callback-Route – deaktiviert.
 * Das System verwendet jetzt E-Mail/Passwort-Auth über tRPC.
 * Diese Datei bleibt als Stub erhalten, damit der Import in index.ts nicht bricht.
 */
import type { Express } from "express";

export function registerOAuthRoutes(app: Express) {
  // OAuth-Callback ist nicht mehr aktiv.
  // Login erfolgt über POST /api/trpc/auth.login (tRPC-Procedure).
  app.get("/api/oauth/callback", (_req, res) => {
    res.redirect(302, "/login");
  });
}
