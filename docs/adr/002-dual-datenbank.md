# ADR-002: Dual-Datenbank-Strategie (Drizzle/MySQL + Supabase)

**Status:** Accepted  
**Datum:** 2025-05

## Kontext

Das System hat zwei strukturell unterschiedliche Datenbereiche:

1. **User Identity & Auth:** E-Mail, Passwort-Hash, Rolle, Login-Methode, Calendly-Link. Diese Daten gehören der Applikation und müssen zur Laufzeit der Anwendung erreichbar sein — auch ohne externen Service.

2. **Operationale Daten:** Sessions, Coin-Transaktionen, Abrechnungsanfragen, Referrals, Bewertungen. Diese Daten sind transaktional, wachsen mit der Nutzung und könnten in Zukunft Realtime-Features benötigen.

Beide Bereiche in einer einzigen Lösung zu halten ist möglich, erzeugt aber unterschiedliche Trade-offs je nach Wahl.

## Entscheidung

Wir verwenden **zwei Datenbanken mit getrennten Verantwortlichkeiten**:

| Bereich | Lösung | Zugriff |
|---------|--------|---------|
| User Identity | MySQL + Drizzle ORM | `server/db.ts` |
| Operationale Daten | Supabase (PostgreSQL) | `server/supabase.ts` |

Beide Systeme werden über das `supabaseId`-Feld in der `users`-Tabelle verknüpft: Beim ersten Login über E-Mail wird die Supabase-User-UUID nachgeschlagen und in der App-Datenbank gespeichert.

```typescript
// drizzle/schema.ts
supabaseId: varchar('supabase_id', { length: 36 })
// Brücke zwischen den zwei Systemen
```

**Warum nicht nur Supabase?**  
Supabase hat eine eigene Auth-Schicht (GoTrue). Diese zu umgehen und stattdessen die eigene bcrypt/JWT-Auth zu verwenden erfordert Service-Role-Zugriff für jede Nutzeroperation — ein erhöhtes Sicherheitsrisiko. Außerdem sind Auth-Daten in der eigenen Datenbank einfacher zu migrieren und unabhängig von einem externen Service.

**Warum nicht nur MySQL?**  
Supabase liefert PostgreSQL mit managed Backups, Row-Level Security und einer strukturierten JavaScript-Client-Library. Die operationalen Tabellen (Sessions, Coins etc.) profitieren von diesen Features. Eigene MySQL-Tabellen für diese Daten zu pflegen wäre mehr Eigenentwicklung ohne Mehrwert.

## Konsequenzen

**Positiv:**
- Auth-Daten bleiben unter direkter Kontrolle der Applikation
- Supabase-Schema für operationale Daten ist unabhängig von der App-DB-Migration
- Klare Trennung: `db.ts` = Identität, `supabase.ts` = Geschäftsdaten

**Negativ:**
- Zwei Verbindungen statt einer — zwei Failure-Points
- Das `supabaseId`-Bridging-Feld muss konsistent gehalten werden (wird beim Zapier-Import und beim ersten Login gesetzt)
- Joins über Systemgrenzen hinweg sind nicht möglich; beide Seiten müssen separat abgefragt werden
