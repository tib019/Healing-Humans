import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Coins, Users, Calendar, ShieldCheck } from "lucide-react";

/**
 * Landing Page für nicht eingeloggte Nutzer.
 * Blueprint-Ästhetik: Raster-Hintergrund, Cyan-Akzente, technische Typografie.
 */
export default function Home() {
  const { loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {/* Logo-Bereich mit Cyan-Akzent */}
            <div className="w-8 h-8 rounded-lg bg-[var(--cyan-dark)] flex items-center justify-center">
              <Coins className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-foreground">Healing Humans</span>
              <span className="mono text-muted-foreground ml-2 text-xs">v1.0</span>
            </div>
          </div>
          <Button
            onClick={() => { window.location.href = "/login"; }}
            className="bg-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/90 text-white"
          >
            Anmelden
          </Button>
        </div>
      </header>

      {/* Hero-Bereich */}
      <main className="flex-1">
        <section className="container py-24 text-center">
          {/* Technisches Label */}
          <div className="inline-flex items-center gap-2 bg-[var(--cyan)]/20 border border-[var(--cyan)] rounded-full px-4 py-1.5 mb-8">
            <span className="mono text-[var(--cyan-dark)] text-xs">SYSTEM_STATUS: ACTIVE</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-foreground mb-6 leading-none">
            Healing Humans
            <br />
            <span className="text-[var(--cyan-dark)]">Coin-System</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Das Vergütungssystem für therapeutische Gemeinschaften.
            Empfehle Freunde, sammle Coins, buche kostenlose Therapiesitzungen.
          </p>

          <Button
            size="lg"
            onClick={() => { window.location.href = "/login"; }}
            className="bg-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/90 text-white text-lg px-8 h-14"
          >
            Jetzt einloggen
          </Button>
        </section>

        {/* Feature-Karten */}
        <section className="container pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Karte 1: Coins */}
            <div className="blueprint-card blueprint-card-cyan p-6">
              <div className="w-10 h-10 rounded-lg bg-[var(--cyan)]/30 flex items-center justify-center mb-4">
                <Coins className="w-5 h-5 text-[var(--cyan-dark)]" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Coin-System</h3>
              <p className="text-sm text-muted-foreground">
                1 erfolgreiche Empfehlung = 1 Coin.
                Bei 7 Coins wird eine kostenlose Therapiesitzung freigeschaltet.
              </p>
              <div className="mt-4 mono text-xs text-[var(--cyan-dark)]">
                7 coins → 1 session
              </div>
            </div>

            {/* Karte 2: Therapeuten */}
            <div className="blueprint-card blueprint-card-pink p-6">
              <div className="w-10 h-10 rounded-lg bg-[var(--pink)]/30 flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-[var(--pink-dark)]" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Therapeuten-Portal</h3>
              <p className="text-sm text-muted-foreground">
                Therapeuten verwalten Termine, markieren Sitzungen als abgeschlossen
                und sehen Patienten-Feedback.
              </p>
              <div className="mt-4 mono text-xs text-[var(--pink-dark)]">
                role: therapeut
              </div>
            </div>

            {/* Karte 3: Admin */}
            <div className="blueprint-card blueprint-card-cyan p-6">
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-slate-600" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Admin-Panel</h3>
              <p className="text-sm text-muted-foreground">
                Vollständige Übersicht über Nutzer, Zahlungen und Coins.
                Manuelle Eingriffe möglich.
              </p>
              <div className="mt-4 mono text-xs text-slate-500">
                role: admin
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="container flex items-center justify-between">
          <span className="mono text-muted-foreground text-xs">
            © 2026 Healing Humans GmbH
          </span>
          <span className="mono text-muted-foreground text-xs">
            build: 2026.04
          </span>
        </div>
      </footer>
    </div>
  );
}
