/**
 * Auth SDK – E-Mail/Passwort-basierte Authentifizierung.
 * Session-Cookie enthält einen JWT mit { userId, role, supabaseId }.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// ─── JWT-Session-Payload ───────────────────────────────────────────────────────

export type SessionPayload = {
  userId: number;
  role: string;
  supabaseId?: string;
};

// Rückwärtskompatibilität
export type { SessionPayload as OAuthSessionPayload };

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function getSessionSecret() {
  const secret = ENV.cookieSecret || "fallback-dev-secret-change-in-prod";
  return new TextEncoder().encode(secret);
}

function parseCookies(cookieHeader: string | undefined): Map<string, string> {
  if (!cookieHeader) return new Map();
  return new Map(Object.entries(parseCookieHeader(cookieHeader)));
}

// ─── Session-Token erstellen ──────────────────────────────────────────────────

export async function createSessionToken(
  userId: number,
  role: string,
  expiresInMs: number = ONE_YEAR_MS,
  supabaseId?: string
): Promise<string> {
  const secretKey = getSessionSecret();
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  const jwtPayload: Record<string, unknown> = { userId, role };
  if (supabaseId) jwtPayload.supabaseId = supabaseId;
  return new SignJWT(jwtPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(secretKey);
}

// ─── Session-Token verifizieren ───────────────────────────────────────────────

export async function verifySessionToken(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) {
    console.warn("[Auth] Missing session cookie");
    return null;
  }
  try {
    const secretKey = getSessionSecret();
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ["HS256"] });
    const { userId, role, supabaseId } = payload as Record<string, unknown>;

    if (typeof userId !== "number" || typeof role !== "string") {
      console.warn("[Auth] Session payload missing required fields");
      return null;
    }
    return {
      userId,
      role,
      supabaseId: typeof supabaseId === "string" ? supabaseId : undefined,
    };
  } catch (error) {
    console.warn("[Auth] Session verification failed", String(error));
    return null;
  }
}

// ─── Request-Authentifizierung (wird von context.ts aufgerufen) ───────────────

class SDKServer {
  /**
   * Liest den Session-Cookie, verifiziert den JWT und gibt den Nutzer zurück.
   * supabaseId wird aus dem JWT gelesen und in den User-Record injiziert.
   */
  async authenticateRequest(req: Request): Promise<User> {
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await verifySessionToken(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const user = await db.getUserById(session.userId);
    if (!user) {
      throw ForbiddenError("User not found");
    }

    // supabaseId aus JWT in den User-Record injizieren (falls vorhanden)
    if (session.supabaseId && !user.supabaseId) {
      (user as User & { supabaseId?: string }).supabaseId = session.supabaseId;
    }

    // lastSignedIn asynchron aktualisieren
    db.updateLastSignedIn(user.id).catch(() => {});

    return user;
  }

  /** @deprecated Nicht mehr verwendet */
  async createSessionToken(openId: string, options: { name?: string; expiresInMs?: number } = {}) {
    return createSessionToken(0, "patient", options.expiresInMs);
  }

  /** @deprecated Nicht mehr verwendet */
  async signSession(payload: { openId: string; appId: string; name: string }) {
    return createSessionToken(0, "patient");
  }

  /** @deprecated Nicht mehr verwendet */
  async verifySession(cookieValue: string | undefined | null) {
    const result = await verifySessionToken(cookieValue);
    if (!result) return null;
    return { openId: String(result.userId), appId: ENV.appId, name: "" };
  }
}

export const sdk = new SDKServer();
