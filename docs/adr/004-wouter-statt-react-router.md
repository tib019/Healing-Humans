# ADR-004: Wouter statt React Router

**Status:** Accepted  
**Datum:** 2025-05

## Kontext

Das Frontend benötigt Client-seitiges Routing für die rollenbasierten Dashboards (`/login`, `/patient`, `/therapeut`, `/admin`). React Router v6/v7 ist die De-facto-Standard-Lösung im React-Ökosystem. Wouter ist eine minimalistische Alternative.

## Entscheidung

Wir verwenden **Wouter v3**.

Wouter liefert dieselben Kern-Primitiven (`<Route>`, `<Link>`, `useLocation`, `useParams`) bei ~1.3 kB gzip statt ~50 kB für React Router v6. Für eine SPA mit einer Handvoll fester Routen ist der Funktionsumfang von React Router (Loader, Actions, Nested Routes, Data-Fetching-Integration) kein Mehrwert.

```typescript
// client/src/App.tsx — typisches Muster
import { Route, Switch } from 'wouter';

<Switch>
  <Route path="/login" component={LoginPage} />
  <Route path="/patient/*" component={PatientDashboard} />
  <Route path="/therapeut/*" component={TherapeuthDashboard} />
  <Route path="/admin/*" component={AdminDashboard} />
</Switch>
```

## Bekanntes Problem: Wildcard-Routen-Bug in v3

Bei der Migration auf wouter v3 trat ein Bug mit Wildcard-Matching (`/patient/*`) auf: Sub-Routen wurden nicht korrekt aufgelöst. Das Problem wurde durch einen lokalen Patch behoben:

```
patches/wouter@3.7.1.patch
```

Dieses Patch-File wird von pnpm automatisch beim `install` angewendet. Es handelt sich um eine minimale Änderung im Matching-Algorithmus. Sobald der Fix upstream in wouter gemergt ist, kann der Patch entfernt werden.

## Konsequenzen

**Positiv:**
- Kleineres Bundle, schnellere initiale Ladezeit
- Einfachere API für den tatsächlichen Anwendungsfall

**Negativ:**
- Kleineres Ökosystem, weniger Stack-Overflow-Antworten
- Der Wildcard-Bug erforderte einen lokalen Patch — technische Schuld bis zum Fix upstream
- Bei Anforderung nach komplexem Routing (z.B. Loader-basiertes Data-Fetching) wäre eine Migration auf React Router nötig
