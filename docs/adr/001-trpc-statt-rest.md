# ADR-001: tRPC statt klassischer REST-API

**Status:** Accepted  
**Datum:** 2025-05

## Kontext

Das Projekt ist ein TypeScript-Monorepo: Client (React) und Server (Node.js) liegen im selben Repository und werden gemeinsam deployed. Es wird eine API-Schicht benötigt, die Frontend und Backend verbindet.

Die klassische Alternative wäre eine REST-API mit Express-Routen und manuell definierten Request/Response-Typen. Um End-to-end-Typsicherheit zu erhalten, würde das entweder manuelle Typ-Duplikation zwischen Client und Server bedeuten oder einen Codegenerierungsschritt über OpenAPI/Swagger.

## Entscheidung

Wir verwenden **tRPC v11** als API-Layer.

tRPC exportiert den vollständigen Router-Typ vom Server und der Client importiert ihn direkt. TypeScript inferiert alle Input- und Output-Typen aller Procedures automatisch — ohne Codegenerierung, ohne Schema-Dateien, ohne Synchronisationsaufwand.

```typescript
// server/routers.ts — Procedure-Definition
patient: {
  getCoinBalance: protectedProcedure
    .query(async ({ ctx }) => {
      return supabase.getCoinBalance(ctx.user.supabaseId);
    }),
}

// client — vollständig typisiert, kein Import nötig
const { data } = trpc.patient.getCoinBalance.useQuery();
//             ↑ data: { balance: number; ... } — inferiert vom Server
```

Zusätzlich ist TanStack Query (React Query) direkt integriert: `useQuery`, `useMutation`, automatisches Caching und Invalidierung funktionieren ohne Boilerplate.

## Abgewogene Alternativen

**REST + OpenAPI:** Universell, sprachunabhängig, gut für öffentliche APIs. Aber erfordert Codegenerierung oder manuelle Typ-Synchronisation. Overhead für ein Single-Team TypeScript-Projekt ohne externe Consumer.

**GraphQL:** Flexibel für komplexe, verschachtelte Datenabfragen. Aber erheblich mehr Setup (Schema-Datei, Resolver-Boilerplate, separate Codegen-Pipeline). Für dieses Projekt mit klar definierten, rollenspezifischen Datenzugriffen kein Mehrwert.

## Konsequenzen

**Positiv:**
- Kompilierungsfehler statt Runtime-Fehler bei API-Änderungen
- Kein Codegenerierungsschritt im Build
- `protectedProcedure` und `roleProcedure` als typisierte Middleware für Auth-Guards
- TanStack Query out-of-the-box

**Negativ:**
- Setzt TypeScript auf dem Client voraus — kein Plain-JavaScript-Consumer möglich
- Weniger bekannt als REST; neue Entwickler brauchen eine kurze Einarbeitungszeit
- Zapier-Integration (externer Service) musste als klassischer REST-Endpoint separat umgesetzt werden (`server/zapier.ts`), da Zapier kein tRPC-Client ist
