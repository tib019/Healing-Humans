# ADR-003: JWT-Session in HttpOnly Cookie statt localStorage

**Status:** Accepted  
**Datum:** 2025-05

## Kontext

Nach erfolgreichem Login muss die Session des Nutzers clientseitig persistiert werden. Der Server muss bei jedem Request die Identität des Nutzers prüfen können.

Die zwei verbreitetsten Ansätze:

- **localStorage:** Das JWT wird nach dem Login im Browser-Storage gespeichert und bei jedem API-Request als `Authorization: Bearer`-Header mitgesendet.
- **HttpOnly Cookie:** Das JWT wird vom Server als HttpOnly Cookie gesetzt. Der Browser sendet ihn automatisch mit jeder Anfrage an die gleiche Origin mit.

## Entscheidung

Wir speichern das JWT in einem **HttpOnly Cookie** (`Set-Cookie: session=...; HttpOnly; SameSite=Strict; Path=/`).

```typescript
// server/_core/cookies.ts
res.setHeader('Set-Cookie',
  `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 7}`
);
```

Der tRPC-Context liest das Cookie serverseitig aus und verifiziert das JWT:

```typescript
// server/_core/context.ts
const token = parseCookies(req.headers.cookie ?? '').session;
const user = token ? await verifyJwt(token) : null;
```

**Warum nicht localStorage?**  
JavaScript-Code — inklusive injizierter Scripts bei einem XSS-Angriff — kann auf localStorage zugreifen und ein dort gespeichertes Token stehlen. HttpOnly Cookies sind für JavaScript nicht lesbar; der Angriff ist strukturell ausgeschlossen.

Für eine Anwendung, die mit Patientendaten und therapeutischen Informationen arbeitet, ist das eine bewusste Sicherheitsentscheidung.

**CSRF-Risiko:** HttpOnly Cookies sind anfällig für Cross-Site Request Forgery. Das wird durch `SameSite=Strict` mitigiert: Der Browser sendet den Cookie nicht bei Requests von fremden Origins.

## Konsequenzen

**Positiv:**
- XSS kann das JWT nicht exfiltrieren
- Kein manuelles Token-Management im Frontend-Code erforderlich
- Logout ist serverseitig kontrollierbar (Cookie löschen)

**Negativ:**
- Funktioniert only für Browser-Clients mit gleicher Origin — keine direkte Mobile-App-Unterstützung ohne angepasste Cookie-Handling-Logik
- `SameSite=Strict` bedeutet: nach externem Redirect zur App wird der Cookie initial nicht mitgesendet (kein Problem im aktuellen Flow)
- Debugging erfordert DevTools → Application → Cookies statt einfachem `console.log`
