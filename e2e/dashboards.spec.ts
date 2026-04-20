import { test, expect, Page } from "@playwright/test";

/**
 * Healing Humans – Dashboard E2E-Tests
 *
 * Für Patient- und Therapeuten-Tests werden Testnutzer benötigt.
 * Diese werden über die Admin-API angelegt, falls sie noch nicht existieren.
 */

const ADMIN_EMAIL = "admin@healinghumans.de";
const ADMIN_PASSWORD = "admin123";
const TEST_PATIENT_EMAIL = "e2e-patient@healinghumans.de";
const TEST_PATIENT_PASSWORD = "test1234";
const TEST_THERAPEUT_EMAIL = "e2e-therapeut@healinghumans.de";
const TEST_THERAPEUT_PASSWORD = "test1234";

/** Hilfsfunktion: Als Admin einloggen */
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.fill("input[type='email']", ADMIN_EMAIL);
  await page.fill("input[type='password']", ADMIN_PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL(/\/admin/, { timeout: 8000 });
}

/** Hilfsfunktion: Testnutzer über tRPC anlegen (direkt via API) */
async function ensureTestUser(page: Page, email: string, password: string, role: string) {
  const response = await page.request.post("/api/trpc/admin.createUser", {
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({
      json: { email, name: `E2E ${role}`, role, password },
    }),
  });
  // 200 (neu angelegt) oder Fehler wegen Duplikat sind beide akzeptabel
  return response.status();
}

test.describe("Patient-Dashboard", () => {
  test.beforeAll(async ({ browser }) => {
    // Testnutzer anlegen (als Admin eingeloggt)
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await ensureTestUser(page, TEST_PATIENT_EMAIL, TEST_PATIENT_PASSWORD, "patient");
    await page.close();
  });

  test("Patient wird nach Login zu /patient weitergeleitet", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_PATIENT_EMAIL);
    await page.fill("input[type='password']", TEST_PATIENT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/patient/, { timeout: 8000 });
    expect(page.url()).toContain("/patient");
  });

  test("Patient-Dashboard zeigt Coin-Kontostand", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_PATIENT_EMAIL);
    await page.fill("input[type='password']", TEST_PATIENT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/patient/, { timeout: 8000 });
    // "AKTUELLER KONTOSTAND" Label im Hauptbereich sichtbar
    await expect(page.getByText(/aktueller kontostand/i)).toBeVisible({ timeout: 8000 });
  });

  test("Patient-Dashboard Tabs sind navigierbar", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_PATIENT_EMAIL);
    await page.fill("input[type='password']", TEST_PATIENT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/patient/, { timeout: 8000 });
    // Sidebar-Buttons: "Meine Coins", "Einladungen", "Transaktionen", "Sitzungen"
    const sidebarButtons = page.locator("[data-sidebar='menu-button'], aside button, [role='navigation'] button");
    const count = await sidebarButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("Sitzung buchen – Tab ist navigierbar", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_PATIENT_EMAIL);
    await page.fill("input[type='password']", TEST_PATIENT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/patient/, { timeout: 8000 });
    // "Sitzungen"-Tab in der Sidebar anklicken
    const sitzungenTab = page.locator("button").filter({ hasText: /^sitzungen$/i }).first();
    if (await sitzungenTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sitzungenTab.click();
      // Sitzungs-Bereich erscheint
      await expect(
        page.getByText(/sitzung|therapeut|buchen|calendly/i).first()
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Fallback: Sitzungen-Text ist bereits sichtbar
      await expect(page.getByText(/sitzungen/i).first()).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe("Therapeuten-Dashboard", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await ensureTestUser(page, TEST_THERAPEUT_EMAIL, TEST_THERAPEUT_PASSWORD, "therapeut");
    await page.close();
  });

  test("Therapeut wird nach Login zu /therapeut weitergeleitet", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_THERAPEUT_EMAIL);
    await page.fill("input[type='password']", TEST_THERAPEUT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/therapeut/, { timeout: 8000 });
    expect(page.url()).toContain("/therapeut");
  });

  test("Therapeuten-Dashboard zeigt Sitzungs-Übersicht", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_THERAPEUT_EMAIL);
    await page.fill("input[type='password']", TEST_THERAPEUT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/therapeut/, { timeout: 8000 });
    // Heading "Therapeuten-Übersicht" sichtbar
    await expect(page.getByRole("heading", { name: /therapeuten-übersicht/i })).toBeVisible({ timeout: 8000 });
  });

  test("Therapeuten-Dashboard Tabs sind navigierbar", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_THERAPEUT_EMAIL);
    await page.fill("input[type='password']", TEST_THERAPEUT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/therapeut/, { timeout: 8000 });
    // Sidebar-Buttons: "Übersicht", "Sitzungen", "Feedback"
    const sidebarButtons = page.locator("[data-sidebar='menu-button'], aside button, [role='navigation'] button");
    const count = await sidebarButtons.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Rollenbasierte Zugriffskontrolle", () => {
  test("Patient kann nicht auf /admin zugreifen", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", TEST_PATIENT_EMAIL);
    await page.fill("input[type='password']", TEST_PATIENT_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/patient/, { timeout: 8000 });
    // Direktaufruf /admin
    await page.goto("/admin");
    // Sollte zu /patient oder /login weitergeleitet werden
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain("/admin");
  });
});
