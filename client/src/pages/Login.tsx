import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, HeartPulse, AlertCircle } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      // Session-Cache invalidieren damit me-Query den neuen Nutzer lädt
      await utils.auth.me.invalidate();
      // Zum passenden Dashboard weiterleiten
      const roleRedirects: Record<string, string> = {
        admin: "/admin",
        therapeut: "/therapeut",
        patient: "/patient",
      };
      setLocation(roleRedirects[data.role] ?? "/patient");
    },
    onError: (err) => {
      setErrorMsg(err.message ?? "Login fehlgeschlagen. Bitte versuche es erneut.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    loginMutation.mutate({ email: email.trim(), password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-grid)] px-4">
      {/* Hintergrund-Raster */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0,180,216,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,180,216,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo + Titel */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-[var(--cyan-dark)] flex items-center justify-center shadow-lg">
            <HeartPulse className="w-7 h-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Healing Humans</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Melde dich mit deinen Zugangsdaten an</p>
          </div>
        </div>

        {/* Login-Karte */}
        <Card className="shadow-xl border border-border/60 bg-card/95 backdrop-blur-sm">
          <CardHeader className="pb-0 pt-6 px-6">
            <span className="mono text-xs text-[var(--cyan-dark)] font-medium tracking-widest uppercase">
              auth.login()
            </span>
          </CardHeader>
          <CardContent className="pt-4 px-6 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* E-Mail */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  E-Mail-Adresse
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="max@healing-humans.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10"
                  disabled={loginMutation.isPending}
                />
              </div>

              {/* Passwort */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Passwort
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10"
                  disabled={loginMutation.isPending}
                />
              </div>

              {/* Fehlermeldung */}
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-10 bg-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/90 text-white font-medium"
                disabled={loginMutation.isPending || !email || !password}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wird angemeldet…
                  </>
                ) : (
                  "Anmelden"
                )}
              </Button>
            </form>

            {/* Hinweis */}
            <p className="text-xs text-muted-foreground text-center mt-5 leading-relaxed">
              Zugangsdaten werden von deiner Schule bereitgestellt.
              <br />
              Bei Problemen wende dich an deinen Administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
