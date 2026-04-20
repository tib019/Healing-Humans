import { test, expect } from "@playwright/test";

/**
 * Healing Humans – E2E Auth-Tests
 * Testet Login, Rollenweiterleitung und Logout.
 *
 * Voraussetzung: Admin-Account admin@healinghumans.de / admin123 existiert in der DB.
 */

const ADMIN_EMAIL = "admin@healinghumans.de";
const ADMIN_PASSWORD = "admin123";
const WRONG_PASSWORD = "wrongpassword";

test.describe("Login-Seite", () => {
  test("zeigt das Login-Formular an", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='email']")).toBeVisible();
    await expect(page.locator("input[type='password']")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("zeigt Fehlermeldung bei falschen Zugangsdaten", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", ADMIN_EMAIL);
    await page.fill("input[type='password']", WRONG_PASSWORD);
    await page.click("button[type='submit']");
    // Fehlermeldung erscheint
    await expect(page.locator("text=falsch")).toBeVisible({ timeout: 5000 });
  });

  test("zeigt Fehlermeldung bei ungültiger E-Mail-Adresse", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", "kein-email-format");
    await page.fill("input[type='password']", "irgendwas");
    await page.click("button[type='submit']");
    // HTML5-Validierung oder tRPC-Fehler
    const emailInput = page.locator("input[type='email']");
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });
});

test.describe("Admin-Login und Rollenweiterleitung", () => {
  test("Admin wird nach Login zu /admin weitergeleitet", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", ADMIN_EMAIL);
    await page.fill("input[type='password']", ADMIN_PASSWORD);
    await page.click("button[type='submit']");
    // Weiterleitung zu /admin
    await page.waitForURL(/\/admin/, { timeout: 8000 });
    expect(page.url()).toContain("/admin");
  });

  test("Admin-Dashboard zeigt Statistiken und Navigation", async ({ page }) => {
    await page.goto("/login");
    await page.fill("input[type='email']", ADMIN_EMAIL);
    await page.fill("input[type='password']", ADMIN_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/admin/, { timeout: 8000 });
    // Dashboard-Inhalte prüfen (h1 mit Admin-Dashboard)
    await expect(page.getByRole("heading", { name: "Admin-Dashboard" })).toBeVisible({ timeout: 5000 });
  });

  test("Logout leitet zu /login weiter", async ({ page }) => {
    // Erst einloggen
    await page.goto("/login");
    await page.fill("input[type='email']", ADMIN_EMAIL);
    await page.fill("input[type='password']", ADMIN_PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForURL(/\/admin/, { timeout: 8000 });
    // Avatar-Button in der Sidebar-Footer anklicken um Dropdown zu öffnen
    await page.locator("[data-sidebar='footer'] button").click({ timeout: 5000 });
    // "Abmelden" im Dropdown klicken (AdminDashboard verwendet deutschen Text)
    await page.getByRole("menuitem", { name: /abmelden/i }).click({ timeout: 5000 });
    // Weiterleitung zu /login
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Geschützte Routen", () => {
  test("Direktaufruf /admin ohne Login leitet zu /login weiter", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("Direktaufruf /patient ohne Login leitet zu /login weiter", async ({ page }) => {
    await page.goto("/patient");
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });

  test("Direktaufruf /therapeut ohne Login leitet zu /login weiter", async ({ page }) => {
    await page.goto("/therapeut");
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain("/login");
  });
});
