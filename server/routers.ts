import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createSessionToken } from "./_core/sdk";
import {
  getAllUsers, setUserRole, getUserByEmail, createUser,
  updatePasswordHash, setCalendlyUrl, getTherapeutList, setSupabaseId,
} from "./db";
import {
  getSupabase,
  getProfileById, getAllProfiles, getTherapeutProfiles,
  getCoinTransactions, insertCoinTransaction,
  getPatientSessions, getTherapeutSessions, markSessionDone, bookSession,
  getUserReferrals, createReferral,
  submitReview, getTherapistReviews,
  getAllBillingRequests, updateBillingStatus,
  getAdminStats,
} from "./supabase";

// ─── ROLLENPRÜFUNGS-MIDDLEWARE ─────────────────────────────────────────────────

/** Nur Patienten dürfen diese Procedures aufrufen */
const patientProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "patient") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nur Patienten haben Zugang zu diesem Bereich." });
  }
  return next({ ctx });
});

/** Nur Therapeuten dürfen diese Procedures aufrufen */
const therapeutProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "therapeut") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nur Therapeuten haben Zugang zu diesem Bereich." });
  }
  return next({ ctx });
});

/** Nur Admins dürfen diese Procedures aufrufen */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nur Admins haben Zugang zu diesem Bereich." });
  }
  return next({ ctx });
});

// ─── PATIENT ROUTER ────────────────────────────────────────────────────────────

const patientRouter = router({
  /**
   * Aktuellen Coin-Kontostand aus Supabase profiles.coins_balance abrufen.
   * Der Nutzer wird über seine supabaseId verknüpft.
   */
  getCoinBalance: patientProcedure.query(async ({ ctx }) => {
    const profile = ctx.user.supabaseId
      ? await getProfileById(ctx.user.supabaseId)
      : null;
    const balance = profile?.coins_balance ?? 0;
    return { balance };
  }),

  /**
   * Coin-Transaktionshistorie aus Supabase coin_transactions abrufen.
   * Normalisiert snake_case Felder für das Frontend.
   */
  getTransactionHistory: patientProcedure.query(async ({ ctx }) => {
    if (!ctx.user.supabaseId) return { transactions: [] };
    const raw = await getCoinTransactions(ctx.user.supabaseId);
    const transactions = raw.map((t: any) => ({
      id: t.id,
      amount: t.amount,
      reason: t.reason,
      referenceType: t.reference_type,
      createdAt: t.created_at,
    }));
    return { transactions };
  }),

  /**
   * Eigene Therapiesitzungen aus Supabase sessions abrufen.
   * Normalisiert snake_case Felder und nested profiles für das Frontend.
   */
  getMySessions: patientProcedure.query(async ({ ctx }) => {
    if (!ctx.user.supabaseId) return { sessions: [] };
    const raw = await getPatientSessions(ctx.user.supabaseId);
    const sessions = raw.map((s: any) => ({
      id: s.id,
      therapeutId: s.therapeut_id,
      therapeutName: Array.isArray(s.profiles) ? (s.profiles[0]?.full_name ?? "Unbekannt") : (s.profiles?.full_name ?? "Unbekannt"),
      status: s.status,
      rating: s.rating ?? null,
      scheduledAt: s.scheduled_at ?? s.created_at ?? null,
      createdAt: s.created_at,
    }));
    return { sessions };
  }),

  /**
   * Alle Therapeuten mit ihren Calendly-Links aus Supabase profiles abrufen.
   * Wird für die Therapeuten-Auswahl beim Buchen verwendet.
   */
  getTherapeutList: patientProcedure.query(async () => {
    // Erst aus App-DB (hat calendlyUrl), dann aus Supabase profiles ergänzen
    const appTherapists = await getTherapeutList();
    const supabaseTherapists = await getTherapeutProfiles();
    // Merge: Supabase hat full_name + calendly_url, App-DB hat calendlyUrl
    // profiles table has no email column, so we match by name as best-effort
    const merged = supabaseTherapists.map((st: any) => ({
      id: st.id, // Supabase UUID
      name: st.full_name,
      email: null as string | null,  // no email in profiles table
      calendlyUrl: st.calendly_url ?? null,
    }));
    // Fallback: App-DB Therapeuten (have email + calendlyUrl)
    const supabaseIds = new Set(supabaseTherapists.map((s: any) => s.id));
    const appOnly = appTherapists
      .filter((at) => !supabaseIds.has(String(at.id)))
      .map((at) => ({
        id: String(at.id),
        name: at.name,
        email: at.email,
        calendlyUrl: at.calendlyUrl ?? null,
      }));
    return { therapeuten: [...merged, ...appOnly] };
  }),

  /**
   * Alle eigenen Referrals und deren Status aus Supabase referrals abrufen.
   * Normalisiert snake_case Felder für das Frontend.
   */
  getReferralStatus: patientProcedure.query(async ({ ctx }) => {
    if (!ctx.user.supabaseId) return { referrals: [] };
    const raw = await getUserReferrals(ctx.user.supabaseId);
    const referrals = raw.map((r: any) => ({
      id: r.id,
      code: r.referral_token,           // Frontend erwartet 'code'
      status: r.status,
      coinAwarded: r.status === "rewarded",
      inviteeEmail: null as string | null,  // profiles table has no email column
      inviteeName: Array.isArray(r.profiles) ? (r.profiles[0]?.full_name ?? null) : (r.profiles?.full_name ?? null),
      createdAt: r.created_at,
    }));
    return { referrals };
  }),

  /**
   * Neuen Einladungslink generieren.
   * Erstellt einen Referral-Eintrag in Supabase und gibt den Token zurück.
   */
  generateReferralLink: patientProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user.supabaseId) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Kein Supabase-Profil verknüpft." });
    }
    const token = await createReferral(ctx.user.supabaseId);
    const baseUrl = process.env.VITE_OAUTH_PORTAL_URL ?? "https://healinghumans.de";
    return { code: token, url: `${baseUrl}/join?ref=${token}` };
  }),

  /**
   * Therapiesitzung buchen – HARTE GRENZE: mindestens 7 Coins erforderlich.
   * Bucht in Supabase sessions und zieht 7 Coins ab.
   */
  bookSession: patientProcedure
    .input(z.object({
      therapeutId: z.string().min(1), // Supabase UUID des Therapeuten
      calendlyEventId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.supabaseId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Kein Supabase-Profil verknüpft." });
      }
      try {
        await bookSession(ctx.user.supabaseId, input.therapeutId);
        return { success: true, message: "Sitzung gebucht. 7 Coins eingelöst." };
      } catch (err: any) {
        throw new TRPCError({ code: "FORBIDDEN", message: err.message });
      }
    }),

  /**
   * Bewertung nach abgeschlossener Sitzung abgeben (1–5 Sterne).
   * Schreibt in Supabase reviews und vergibt 20 Coins.
   */
  submitRating: patientProcedure
    .input(z.object({
      sessionId: z.string().min(1), // Supabase UUID der Sitzung
      therapistId: z.string().min(1), // Supabase UUID des Therapeuten
      rating: z.number().int().min(1).max(5),
      feedback: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.supabaseId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Kein Supabase-Profil verknüpft." });
      }
      try {
        await submitReview(input.sessionId, ctx.user.supabaseId, input.therapistId, input.rating, input.feedback);
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),
});

// ─── THERAPEUT ROUTER ─────────────────────────────────────────────────────────

const therapeutRouter = router({
  /**
   * Alle zugewiesenen Sitzungen aus Supabase sessions abrufen.
   * Normalisiert snake_case Felder und nested profiles für das Frontend.
   */
  getSessions: therapeutProcedure.query(async ({ ctx }) => {
    if (!ctx.user.supabaseId) return { sessions: [] };
    const raw = await getTherapeutSessions(ctx.user.supabaseId);
    const sessions = raw.map((s: any) => ({
      id: s.id,
      patientName: Array.isArray(s.profiles) ? (s.profiles[0]?.full_name ?? "Unbekannt") : (s.profiles?.full_name ?? "Unbekannt"),
      patientEmail: null as string | null,  // profiles table has no email column
      status: s.status,
      rating: s.rating ?? null,
      scheduledAt: s.scheduled_at ?? s.created_at ?? null,
      createdAt: s.created_at,
    }));
    return { sessions };
  }),

  /**
   * Sitzung als "abgeschlossen" markieren in Supabase sessions.
   * Akzeptiert sowohl Supabase UUID (string) als auch numerische IDs (Fallback).
   */
  markSessionDone: therapeutProcedure
    .input(z.object({ sessionId: z.union([z.string().min(1), z.number().int().positive()]) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.supabaseId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Kein Supabase-Profil verknüpft." });
      }
      try {
        await markSessionDone(String(input.sessionId), ctx.user.supabaseId);
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message });
      }
    }),

  /**
   * Bewertungen und Feedback der Patienten aus Supabase reviews abrufen.
   * Normalisiert snake_case Felder und nested profiles für das Frontend.
   */
  getPatientFeedback: therapeutProcedure.query(async ({ ctx }) => {
    if (!ctx.user.supabaseId) return { feedback: [] };
    const raw = await getTherapistReviews(ctx.user.supabaseId);
    const feedback = raw.map((r: any) => ({
      id: r.id,
      patientName: Array.isArray(r.profiles) ? (r.profiles[0]?.full_name ?? "Unbekannt") : (r.profiles?.full_name ?? "Unbekannt"),
      rating: r.rating,
      feedback: r.comment ?? null,   // Supabase nennt es 'comment', Frontend erwartet 'feedback'
      scheduledAt: r.created_at,     // reviews haben kein scheduledAt, wir nutzen created_at
      createdAt: r.created_at,
    }));
    return { feedback };
  }),
});

// ─── ADMIN ROUTER ─────────────────────────────────────────────────────────────

const adminRouter = router({
  /**
   * Alle registrierten Nutzer aus App-DB abrufen.
   * Für Rollen-Verwaltung und Passwort-Setzen.
   */
  getUsers: adminProcedure.query(async () => {
    // Use Supabase profiles as the source of truth for user management
    const profiles = await getAllProfiles();
    const users = profiles.map((p: any) => ({
      id: p.id,           // Supabase UUID
      email: null as string | null,  // profiles table has no email column
      name: p.full_name,
      role: p.role as "patient" | "therapeut" | "admin",
      coinsBalance: p.coins_balance ?? 0,
      calendlyUrl: p.calendly_url ?? null,
    }));
    return { users };
  }),

  /**
   * Alle Supabase-Profile abrufen (für Coin-Verwaltung).
   */
  getProfiles: adminProcedure.query(async () => {
    const profiles = await getAllProfiles();
    return { profiles };
  }),

  /** Nutzerrolle in Supabase profiles ändern */
  setUserRole: adminProcedure
    .input(z.object({
      userId: z.string().min(1), // Supabase UUID
      role: z.enum(["patient", "therapeut", "admin"]),
    }))
    .mutation(async ({ input }) => {
      // Update role in Supabase profiles
      const sb = getSupabase();
      const { error } = await sb.from("profiles").update({ role: input.role }).eq("id", input.userId);
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      // Also update in App-DB if user exists there
      try { await setUserRole(Number(input.userId), input.role); } catch { /* ignore if not in app-db */ }
      return { success: true };
    }),

  /**
   * Alle Abrechnungsanfragen aus Supabase billing_requests abrufen.
   * Normalisiert snake_case Felder und nested profiles für das Frontend.
   */
  getBillingRequests: adminProcedure.query(async () => {
    const raw = await getAllBillingRequests();
    const billingRequests = raw.map((b: any) => ({
      id: b.id,
      sessionId: b.session_id,
      therapeutId: b.therapeut_id,
      therapeutName: Array.isArray(b.profiles) ? (b.profiles[0]?.full_name ?? "Unbekannt") : (b.profiles?.full_name ?? "Unbekannt"),
      therapeutEmail: null as string | null,  // profiles table has no email column
      amount: b.amount,
      status: b.status,
      reviewedBy: b.reviewed_by,
      reviewedAt: b.reviewed_at,
      // Fix Bug #4: Supabase-Spalte heißt 'submitted_at', nicht 'created_at'
      createdAt: b.submitted_at ?? b.reviewed_at,
    }));
    return { billingRequests };
  }),

  /**
   * Abrechnungsstatus in Supabase billing_requests aktualisieren.
   */
  updateBillingStatus: adminProcedure
    .input(z.object({
      billingId: z.string().min(1), // Supabase UUID
      status: z.enum(["approved", "rejected", "paid"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // reviewedBy = aktueller Admin (Supabase UUID falls vorhanden, sonst E-Mail)
      const reviewedBy = ctx.user.supabaseId ?? ctx.user.email ?? "admin";
      try {
        await updateBillingStatus(input.billingId, input.status, reviewedBy);
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: "NOT_FOUND", message: err.message });
      }
    }),

  /**
   * Coins manuell gutschreiben oder abziehen in Supabase.
   * Schreibt in coin_transactions und aktualisiert profiles.coins_balance.
   */
  adjustCoins: adminProcedure
    .input(z.object({
      supabaseUserId: z.string().uuid("Bitte eine gültige Supabase-UUID angeben."),
      amount: z.number().int(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        await insertCoinTransaction(input.supabaseUserId, input.amount, input.reason, "admin");
        const profile = await getProfileById(input.supabaseUserId);
        return { success: true, newBalance: profile?.coins_balance ?? 0 };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  /**
   * Alle Coin-Transaktionen aller Nutzer aus Supabase abrufen.
   * Normalisiert snake_case Felder für das Frontend.
   */
  getAllTransactions: adminProcedure.query(async () => {
    const profiles = await getAllProfiles();
    const allTxRaw = await Promise.all(
      profiles.slice(0, 20).map((p) => getCoinTransactions(p.id))
    );
    const transactions = allTxRaw.flat().map((t: any) => ({
      id: t.id,
      amount: t.amount,
      reason: t.reason,
      referenceType: t.reference_type,
      createdAt: t.created_at,
    }));
    return { transactions };
  }),

  /**
   * Neuen Nutzer anlegen (für Skool/Ablefy-Import via Zapier oder manuell).
   */
  createUser: adminProcedure
    .input(z.object({
      email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
      name: z.string().min(1, "Name darf nicht leer sein."),
      role: z.enum(["patient", "therapeut", "admin"]).default("patient"),
      password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben.").optional(),
    }))
    .mutation(async ({ input }) => {
      let passwordHash: string | undefined;
      if (input.password) {
        passwordHash = await bcrypt.hash(input.password, 10);
      }
      const userId = await createUser({
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash,
      });
      return { success: true, userId };
    }),

  /**
   * Passwort eines Nutzers setzen oder zurücksetzen.
   * Sucht den App-DB-Nutzer per E-Mail (via Supabase) und setzt den Hash.
   */
  setPassword: adminProcedure
    .input(z.object({
      userId: z.string().min(1), // Supabase UUID or App-DB numeric ID as string
      password: z.string().min(6, "Passwort muss mindestens 6 Zeichen haben."),
    }))
    .mutation(async ({ input }) => {
      const passwordHash = await bcrypt.hash(input.password, 10);
      // Try numeric App-DB ID first
      const numericId = parseInt(input.userId, 10);
      if (!isNaN(numericId)) {
        await updatePasswordHash(numericId, passwordHash);
      } else {
        // Look up by Supabase UUID → get email → find App-DB user
        // profiles table has no email column — cannot look up App-DB user by Supabase UUID
        throw new TRPCError({ code: "NOT_FOUND", message: "Passwort kann nur für App-DB Nutzer gesetzt werden (numerische ID erforderlich)." });
      }
      return { success: true };
    }),

  /**
   * Calendly-Link eines Therapeuten setzen oder entfernen.
   * Speichert in Supabase profiles.calendly_url und App-DB.
   */
  setCalendlyUrl: adminProcedure
    .input(z.object({
      userId: z.string().min(1), // Supabase UUID or App-DB numeric ID as string
      calendlyUrl: z.string().url("Bitte eine gültige URL eingeben.").nullable().or(z.literal("")).nullable(),
    }))
    .mutation(async ({ input }) => {
      const url = input.calendlyUrl || null;
      // Update in Supabase profiles
      const numericId = parseInt(input.userId, 10);
      if (!isNaN(numericId)) {
        // App-DB numeric ID → also update App-DB
        await setCalendlyUrl(numericId, url);
      } else {
        // Supabase UUID → update Supabase profiles.calendly_url
        const sb = getSupabase();
        await sb.from("profiles").update({ calendly_url: url }).eq("id", input.userId);
          // Note: profiles table has no email column, App-DB sync not possible via Supabase UUID
      }
      return { success: true };
    }),

  /**
   * Dashboard-Statistiken aus Supabase abrufen.
   */
  getStats: adminProcedure.query(async () => {
    try {
      return await getAdminStats();
    } catch {
      // Fallback auf App-DB wenn Supabase nicht erreichbar
      const userList = await getAllUsers();
      return {
        totalUsers: userList.length,
        totalPatients: userList.filter((u) => u.role === "patient").length,
        totalTherapists: userList.filter((u) => u.role === "therapeut").length,
        totalCoins: 0,
        openSessions: 0,
        completedSessions: 0,
        pendingBilling: 0,
        totalBillingAmount: 0,
      };
    }
  }),
});

// ─── APP ROUTER ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    /** Eingeloggten Nutzer abrufen (null wenn nicht eingeloggt) */
    me: publicProcedure.query((opts) => opts.ctx.user),

    /**
     * Login mit E-Mail + Passwort.
     * Setzt einen JWT-Session-Cookie bei Erfolg.
     */
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Bitte eine gültige E-Mail-Adresse eingeben."),
        password: z.string().min(1, "Passwort darf nicht leer sein."),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);

        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-Mail oder Passwort falsch.",
          });
        }

        const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
        if (!passwordValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "E-Mail oder Passwort falsch.",
          });
        }

        // Note: profiles table has no email column, so Supabase UUID cannot be auto-linked at login.
        // Admin must manually link via setSupabaseId or the Zapier endpoint sets it on user creation.

        const sessionToken = await createSessionToken(user.id, user.role, ONE_YEAR_MS, user.supabaseId ?? undefined);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return { success: true, role: user.role } as const;
      }),

    /** Ausloggen – Session-Cookie löschen */
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  patient: patientRouter,
  therapeut: therapeutRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
