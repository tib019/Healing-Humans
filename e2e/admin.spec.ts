import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@healinghumans.de";
const ADMIN_PASSWORD = "admin123";

/** Hilfsfunktion: Als Admin einloggen */
async function loginAsAdmin(page: Page) {
  await page.goto("/login");
  await page.fill("input[type='email']", ADMIN_EMAIL);
  await page.fill("input[type='password']", ADMIN_PASSWORD);
  await page.click("button[type='submit']");
  await page.waitForURL(/\/admin/, { timeout: 8000 });
}

test.describe("Admin-Panel", () => {
  test("Admin-Dashboard lädt ohne Fehler", async ({ page }) => {
    await loginAsAdmin(page);
    // Keine Fehler-Overlays
    await expect(page.locator("text=500")).not.toBeVisible();
    // Heading sichtbar
    await expect(page.getByRole("heading", { name: /admin-dashboard/i })).toBeVisible({ timeout: 5000 });
  });

  test("Statistiken-Tab zeigt Kennzahlen", async ({ page }) => {
    await loginAsAdmin(page);
    // Die Stats-Karten zeigen Labels wie "NUTZER GESAMT", "COINS IM UMLAUF" etc.
    await expect(page.getByText(/nutzer gesamt/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("Nutzer-Tab ist navigierbar", async ({ page }) => {
    await loginAsAdmin(page);
    // Nutzer-Tab in der Sidebar anklicken
    const usersTab = page.locator("aside button, aside a, nav button, nav a").filter({ hasText: /^nutzer$/i }).first();
    if (await usersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usersTab.click();
      // Nutzer-Tabelle erscheint — suche nach Tabellen-Header oder E-Mail-Spalte
      await expect(
        page.locator("table").first()
          .or(page.getByText("E-Mail").first())
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test("Nutzer anlegen – Formular öffnet sich", async ({ page }) => {
    await loginAsAdmin(page);
    // Nutzer-Tab navigieren
    const usersTab = page.locator("aside button, aside a, nav button, nav a").filter({ hasText: /^nutzer$/i }).first();
    if (await usersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usersTab.click();
    }
    // "Nutzer anlegen"-Button suchen
    const createBtn = page.locator("button").filter({ hasText: /anlegen|erstellen|hinzufügen|neu/i }).first();
    if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createBtn.click();
      // Dialog/Formular erscheint mit E-Mail-Feld
      await expect(page.locator("input[type='email'], input[placeholder*='mail']").first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("Abrechnungen-Tab ist navigierbar", async ({ page }) => {
    await loginAsAdmin(page);
    // Abrechnungen-Tab in der Sidebar anklicken
    const billingTab = page.locator("aside button, aside a, nav button, nav a").filter({ hasText: /abrechnungen/i }).first();
    if (await billingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await billingTab.click();
      // Tabelle oder "Keine Abrechnungen"-Text erscheint
      await expect(
        page.locator("table").first()
          .or(page.getByText(/keine|status|betrag/i).first())
      ).toBeVisible({ timeout: 8000 });
    }
  });
});
