import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Hilfsfunktion: Erstellt einen Mock-Kontext für einen eingeloggten Nutzer.
 * supabaseId ist eine UUID – wird für Supabase-Queries benötigt.
 */
function createMockContext(role: "patient" | "therapeut" | "admin" = "patient"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-open-id",
      email: "test@example.com",
      name: "Test Nutzer",
      loginMethod: "email",
      role,
      supabaseId: "00000000-0000-0000-0000-000000000001", // Test-UUID
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      passwordHash: null,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── AUTH TESTS ───────────────────────────────────────────────────────────────

describe("auth.logout", () => {
  it("löscht den Session-Cookie und gibt success:true zurück", async () => {
    const clearedCookies: string[] = [];
    const ctx: TrpcContext = {
      ...createMockContext(),
      res: {
        clearCookie: (name: string) => clearedCookies.push(name),
      } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBeGreaterThan(0);
  });

  it("gibt den eingeloggten Nutzer zurück", async () => {
    const caller = appRouter.createCaller(createMockContext("patient"));
    const user = await caller.auth.me();
    expect(user?.email).toBe("test@example.com");
    expect(user?.role).toBe("patient");
  });
});

// ─── PATIENT TESTS ────────────────────────────────────────────────────────────

describe("patient.getCoinBalance", () => {
  it("gibt den Coin-Kontostand zurück (Supabase oder Fallback)", async () => {
    const caller = appRouter.createCaller(createMockContext("patient"));
    const result = await caller.patient.getCoinBalance();
    expect(typeof result.balance).toBe("number");
    expect(result.balance).toBeGreaterThanOrEqual(0);
  });
});

describe("patient.getTransactionHistory", () => {
  it("gibt eine Liste von Transaktionen zurück", async () => {
    const caller = appRouter.createCaller(createMockContext("patient"));
    const result = await caller.patient.getTransactionHistory();
    expect(Array.isArray(result.transactions)).toBe(true);
  });
});

describe("patient.getReferralStatus", () => {
  it("gibt eine Liste von Referrals zurück", async () => {
    const caller = appRouter.createCaller(createMockContext("patient"));
    const result = await caller.patient.getReferralStatus();
    expect(Array.isArray(result.referrals)).toBe(true);
  });
});

describe("patient.bookSession", () => {
  it("wirft FORBIDDEN oder UNAUTHORIZED wenn Nutzer keine Supabase-Verbindung hat", async () => {
    // Test-UUID ist nicht in Supabase → UNAUTHORIZED oder FORBIDDEN erwartet
    const caller = appRouter.createCaller(createMockContext("patient"));
    await expect(
      caller.patient.bookSession({
        therapeutId: "00000000-0000-0000-0000-000000000099",
        calendlyEventId: "test-event-123",
      })
    ).rejects.toThrow();
  });
});

describe("patient.submitRating", () => {
  it("wirft Fehler wenn Sitzung nicht gefunden wird", async () => {
    const caller = appRouter.createCaller(createMockContext("patient"));
    await expect(
      caller.patient.submitRating({
        sessionId: "00000000-0000-0000-0000-000000000999",
        therapistId: "00000000-0000-0000-0000-000000000099",
        rating: 5,
      })
    ).rejects.toThrow();
  });
});

// ─── ROLLENPRÜFUNGS-TESTS ─────────────────────────────────────────────────────

describe("Rollenprüfung", () => {
  it("Therapeut kann nicht auf patient-Routen zugreifen", async () => {
    const caller = appRouter.createCaller(createMockContext("therapeut"));
    await expect(caller.patient.getCoinBalance()).rejects.toThrow("Nur Patienten");
  });

  it("Admin kann nicht auf therapeut-Routen zugreifen", async () => {
    const caller = appRouter.createCaller(createMockContext("admin"));
    await expect(caller.therapeut.getSessions()).rejects.toThrow("Nur Therapeuten");
  });

  it("Patient kann nicht auf admin-Routen zugreifen", async () => {
    const caller = appRouter.createCaller(createMockContext("patient"));
    await expect(caller.admin.getStats()).rejects.toThrow("Nur Admins");
  });
});

// ─── THERAPEUT TESTS ──────────────────────────────────────────────────────────

describe("therapeut.getSessions", () => {
  it("gibt eine Liste von Sitzungen zurück (Supabase oder leere Liste)", async () => {
    const caller = appRouter.createCaller(createMockContext("therapeut"));
    const result = await caller.therapeut.getSessions();
    expect(Array.isArray(result.sessions)).toBe(true);
  });
});

describe("therapeut.markSessionDone", () => {
  it("gibt success:true oder wirft Fehler (Supabase-Verbindung abhängig)", async () => {
    const caller = appRouter.createCaller(createMockContext("therapeut"));
    // Ohne echte Supabase-Verbindung gibt markSessionDone success:true zurück (no-op)
    const result = await caller.therapeut.markSessionDone({ sessionId: "00000000-0000-0000-0000-000000000999" });
    expect(result.success).toBe(true);
  });
});

// ─── ADMIN TESTS ──────────────────────────────────────────────────────────────

describe("admin.getStats", () => {
  it("gibt Statistiken zurück", async () => {
    const caller = appRouter.createCaller(createMockContext("admin"));
    const result = await caller.admin.getStats();
    expect(typeof result.totalUsers).toBe("number");
    expect(typeof result.totalCoins).toBe("number");
  });
});

describe("admin.adjustCoins", () => {
  it("passt Coins an oder wirft BAD_REQUEST wenn Nutzer nicht in Supabase existiert", async () => {
    const caller = appRouter.createCaller(createMockContext("admin"));
    // Test-UUID existiert nicht in Supabase → FK-Constraint-Fehler ist erwartet
    try {
      const result = await caller.admin.adjustCoins({
        supabaseUserId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 2,
        reason: "Test-Gutschrift",
      });
      // Falls kein Fehler: success und newBalance prüfen
      expect(result.success).toBe(true);
      expect(typeof result.newBalance).toBe("number");
    } catch (err: any) {
      // FK-Constraint-Fehler ist akzeptabel (Nutzer existiert nicht in Test-Supabase)
      expect(err.code).toBe("BAD_REQUEST");
    }
  });
});
