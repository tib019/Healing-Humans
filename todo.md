# Healing Humans Dashboard – TODO

## Phase 1–7: Abgeschlossen ✓
- [x] drizzle/schema.ts: Nur users-Tabelle mit Rollen patient/therapeut/admin
- [x] tRPC-Routers mit Mock-Daten für alle 3 Rollen
- [x] Rollenprüfung in allen protected procedures
- [x] Blueprint-Ästhetik, Google Fonts
- [x] Rollenbasiertes Routing (wouter v3 Wildcard-Fix)
- [x] Patient-Dashboard (Coins, Referrals, Buchung, Bewertung)
- [x] Therapeuten-View (Sitzungen, done-Markierung, Feedback)
- [x] Admin-Panel (Nutzer, Abrechnungen, Coin-Verwaltung)
- [x] 15/15 Vitest-Tests bestanden

## Phase 8: Auth-Umbau (E-Mail/Passwort statt Manus OAuth)
- [x] Schema: passwordHash-Feld zur users-Tabelle hinzufügen + Migration (0002_known_logan.sql)
- [x] bcrypt installieren
- [x] Backend: login-Procedure (E-Mail + Passwort → JWT-Cookie)
- [x] Backend: logout-Procedure (Cookie löschen)
- [x] Backend: me-Procedure (Session aus Cookie lesen)
- [x] Backend: Admin kann Nutzer anlegen + Passwort setzen (Skool-Import)
- [x] Frontend: Login-Seite (E-Mail + Passwort Formular)
- [x] Frontend: useAuth-Hook auf eigenes System umstellen (kein OAuth-Redirect)
- [x] App.tsx: OAuth-Redirect entfernen, zu /login weiterleiten
- [x] Tests für neues Auth-System (15/15 bestanden)
- [x] Checkpoint erstellt (6ec03899)

## Phase 9: 404-Fix für Sub-Routen
- [x] Admin-Dashboard: Sub-Routen auf Tab-State umgestellt (kein URL-Reload mehr)
- [x] Patient-Dashboard: Sub-Routen auf Tab-State umgestellt
- [x] Therapeuten-Dashboard: Sub-Routen auf Tab-State umgestellt
- [x] Checkpoint erstellt

## Phase 10: Zapier-Endpoint + Badge-Entfernung
- [x] POST /api/zapier/create-user Endpoint mit ZAPIER_API_KEY-Absicherung
- [x] Endpoint akzeptiert: email, name, role (optional, default: patient), password (optional)
- [x] Antwort: userId, email, temporaryPassword (falls auto-generiert)
- [x] "Made with Manus"-Badge: wird von Manus-Plattform injiziert, verschwindet beim Vercel-Export automatisch
- [x] Tests für Zapier-Endpoint (15/15 bestanden)
- [x] Checkpoint erstellt (5117a525)

## Phase 10b: Calendly-Link pro Therapeut
- [x] Schema: calendlyUrl-Feld zur users-Tabelle hinzugefügt
- [x] Migration generieren und anwenden (0003)
- [x] tRPC: admin.setCalendlyUrl Procedure
- [x] tRPC: patient.getTherapeutList (gibt Therapeuten mit Calendly-Link zurück)
- [x] Admin-UI: Calendly-Link pro Therapeut setzen (Cal-Button in Nutzertabelle)
- [x] Patient-Dashboard: Therapeuten-Auswahl beim Buchen mit individuellem Calendly-Link
- [x] Checkpoint erstellt (5117a525)

## Phase 11: Supabase-Anbindung (echte Daten)
- [x] @supabase/supabase-js installieren
- [x] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY als Secrets gesetzt
- [x] server/supabase.ts: Supabase-Client-Helper angelegt
- [x] Patient-Router: getCoinBalance → profiles.coins_balance
- [x] Patient-Router: getTransactionHistory → coin_transactions
- [x] Patient-Router: getReferralStatus → referrals
- [x] Patient-Router: bookSession → sessions INSERT
- [x] Patient-Router: submitRating → reviews INSERT
- [x] Therapeut-Router: getSessions → sessions WHERE therapeut_id
- [x] Therapeut-Router: markSessionDone → sessions UPDATE status
- [x] Admin-Router: getUsers → profiles
- [x] Admin-Router: getBillingRequests → billing_requests
- [x] Admin-Router: adjustCoins → coin_transactions INSERT
- [x] Admin-Router: getStats → aggregierte Queries
- [x] Auth: Login-Nutzer mit profiles.id verknüpft (UUID-Mapping via E-Mail + supabaseId im JWT)
- [x] Tests aktualisiert (15/15 bestanden)
- [x] Checkpoint erstellt (5e9b30c4)

## Phase 12: QA & Playwright E2E-Tests
- [x] Playwright installieren (@playwright/test)
- [x] playwright.config.ts konfigurieren (baseURL, Browser, Timeouts)
- [x] E2E: Login mit falschen Zugangsdaten → Fehlermeldung
- [x] E2E: Login als Admin → Weiterleitung zu /admin
- [x] E2E: Login als Patient → Weiterleitung zu /patient
- [x] E2E: Login als Therapeut → Weiterleitung zu /therapeut
- [x] E2E: Admin kann Nutzer anlegen
- [x] E2E: Admin kann Rolle ändern
- [x] E2E: Patient-Dashboard lädt (Coins, Tabs sichtbar)
- [x] E2E: Therapeuten-Dashboard lädt (Sessions-Tab sichtbar)
- [x] E2E: Logout funktioniert → Weiterleitung zu /login
- [x] 22/22 E2E-Tests bestanden (9 auth + 5 admin + 8 dashboard)
- [x] Checkpoint erstellen

## Phase 13: Supabase-Kompatibilitäts-Fix
- [x] Bug: getUsers gab 0 zurück weil profiles.email nicht existiert → email aus allen Supabase-Queries entfernt
- [x] Zapier-Endpoint: erstellt jetzt automatisch Supabase-Profil beim Anlegen eines Nutzers
- [x] supabaseId wird nach Profil-Erstellung in App-DB gespeichert (setSupabaseId)
- [x] TypeScript-Fehler behoben (0 Fehler)
- [x] 15/15 Vitest-Tests bestanden
- [x] Checkpoint erstellen
