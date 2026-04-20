import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarInset, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Coins, Link2, History, Calendar, Star, LogOut,
  PanelLeft, Copy, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { useState, CSSProperties } from "react";

// Navigationsmenü für Patienten
const NAV_ITEMS = [
  { icon: Coins,   label: "Meine Coins",   tab: "overview" },
  { icon: Link2,   label: "Einladungen",   tab: "referrals" },
  { icon: History, label: "Transaktionen", tab: "history" },
  { icon: Calendar,label: "Sitzungen",     tab: "sessions" },
];

/** Gibt das passende Status-Badge zurück */
function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Ausstehend", confirmed: "Bestätigt",
    completed: "Abgeschlossen", cancelled: "Abgesagt",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

/** Coin-Fortschrittsbalken: zeigt wie viele Coins bis zur nächsten Sitzung fehlen */
function CoinProgress({ balance }: { balance: number }) {
  const target = 7;
  const progress = Math.min(balance, target);
  const pct = (progress / target) * 100;
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-muted-foreground">Fortschritt zur nächsten Sitzung</span>
        <span className="mono text-sm font-semibold text-[var(--cyan-dark)]">{progress}/{target}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: balance >= target
              ? "linear-gradient(90deg, #10b981, #34d399)"
              : "linear-gradient(90deg, var(--cyan-dark), var(--cyan))",
          }}
        />
      </div>
      {balance >= target ? (
        <p className="text-xs text-emerald-600 mt-1.5 mono">✓ Sitzung verfügbar – jetzt buchen!</p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1.5 mono">
          Noch {target - balance} Coin{target - balance !== 1 ? "s" : ""} bis zur nächsten Sitzung
        </p>
      )}
    </div>
  );
}

/** Hauptinhalt je nach aktivem Tab */
function PatientContent({ activeTab }: { activeTab: string }) {
  const { user } = useAuth();
  const { data: balanceData, isLoading: balanceLoading } = trpc.patient.getCoinBalance.useQuery();
  const { data: txData } = trpc.patient.getTransactionHistory.useQuery();
  const { data: refData } = trpc.patient.getReferralStatus.useQuery();
  const { data: sessData } = trpc.patient.getMySessions.useQuery();
  const generateLink = trpc.patient.generateReferralLink.useMutation();
  const submitRating = trpc.patient.submitRating.useMutation();
  const utils = trpc.useUtils();

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [ratingDialog, setRatingDialog] = useState<{ sessionId: string; therapistId: string; open: boolean } | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [selectedTherapeutId, setSelectedTherapeutId] = useState<string | null>(null);
  const { data: therapeutData } = trpc.patient.getTherapeutList.useQuery();

  const balance = balanceData?.balance ?? 0;
  const canBook = balance >= 7;

  /** Einladungslink in Zwischenablage kopieren */
  async function handleCopyLink(code: string) {
    const url = `${window.location.origin}/join?ref=${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    toast.success("Link kopiert!");
    setTimeout(() => setCopiedCode(null), 2000);
  }

  /** Neuen Referral-Code generieren */
  async function handleGenerateLink() {
    const result = await generateLink.mutateAsync();
    await utils.patient.getReferralStatus.invalidate();
    toast.success(`Neuer Code erstellt: ${result.code}`);
  }

  /** Bewertung abschicken */
  async function handleSubmitRating() {
    if (!ratingDialog || selectedRating === 0) return;
    await submitRating.mutateAsync({
      sessionId: ratingDialog.sessionId,
      therapistId: ratingDialog.therapistId,
      rating: selectedRating,
      feedback: feedbackText || undefined,
    });
    await utils.patient.getMySessions.invalidate();
    toast.success("Bewertung gespeichert!");
    setRatingDialog(null);
    setSelectedRating(0);
    setFeedbackText("");
  }

  // ── Coins-Tab ──────────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Meine Coins</h1>
          <p className="text-muted-foreground mono text-sm mt-1">patient.getCoinBalance()</p>
        </div>

        {/* Coin-Kontostand – große Zahl */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 blueprint-card blueprint-card-cyan p-8">
            <p className="mono text-xs text-muted-foreground mb-3">AKTUELLER KONTOSTAND</p>
            {balanceLoading ? (
              <div className="h-20 flex items-center">
                <div className="w-24 h-16 bg-slate-100 rounded animate-pulse" />
              </div>
            ) : (
              <div className="flex items-end gap-3 mb-6">
                <span className="text-8xl font-black coin-value leading-none">{balance}</span>
                <span className="text-2xl text-muted-foreground mb-2">Coins</span>
              </div>
            )}
            <CoinProgress balance={balance} />
          </div>

          {/* Buchungs-CTA */}
          <div className="blueprint-card p-6 flex flex-col justify-between">
            <div>
              <p className="mono text-xs text-muted-foreground mb-2">NÄCHSTE AKTION</p>
              <h3 className="font-bold text-lg mb-2">
                {canBook ? "Sitzung buchen" : "Coins sammeln"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {canBook
                  ? "Du hast genug Coins! Buche jetzt deine kostenlose Therapiesitzung."
                  : `Lade ${7 - balance} weitere Person${7 - balance !== 1 ? "en" : ""} ein, um eine Sitzung zu buchen.`}
              </p>
            </div>
            <Button
              className="mt-4 w-full"
              disabled={!canBook}
              onClick={() => setBookingOpen(true)}
              style={canBook ? { background: "var(--cyan-dark)", color: "white" } : {}}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {canBook ? "Jetzt buchen" : `${balance}/7 Coins`}
            </Button>
          </div>
        </div>

        {/* Letzte Transaktionen */}
        <div className="blueprint-card p-6">
          <h2 className="font-bold mb-4">Letzte Transaktionen</h2>
          {txData?.transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm mono">Noch keine Transaktionen.</p>
          ) : (
            <div className="space-y-2">
              {txData?.transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-foreground">{tx.reason}</span>
                  <span className={`mono font-bold text-sm ${tx.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Calendly-Buchungsdialog */}
        <Dialog open={bookingOpen} onOpenChange={(open) => { setBookingOpen(open); if (!open) setSelectedTherapeutId(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Therapiesitzung buchen</DialogTitle>
              <DialogDescription className="mono text-xs">
                7 Coins werden eingelöst · Calendly-Buchung
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              {/* Therapeuten-Auswahl */}
              {!selectedTherapeutId ? (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Therapeuten wählen:</p>
                  {therapeutData?.therapeuten.length === 0 ? (
                    <p className="text-muted-foreground text-sm mono py-4 text-center">
                      Aktuell kein Therapeut verfügbar. Bitte wende dich an den Admin.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {therapeutData?.therapeuten.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => t.calendlyUrl ? setSelectedTherapeutId(t.id) : toast.error("Dieser Therapeut hat noch keinen Buchungslink.")}
                          className={`flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                            t.calendlyUrl
                              ? "border-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/5 cursor-pointer"
                              : "border-border opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">{t.name?.charAt(0) ?? "T"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{t.name ?? t.email}</p>
                              <p className="mono text-xs text-muted-foreground">{t.email}</p>
                            </div>
                          </div>
                          {t.calendlyUrl
                            ? <span className="mono text-xs text-[var(--cyan-dark)]">Buchung möglich →</span>
                            : <span className="mono text-xs text-muted-foreground">Kein Link</span>
                          }
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setSelectedTherapeutId(null)}
                    className="mono text-xs text-[var(--cyan-dark)] hover:underline"
                  >
                    ← Anderen Therapeuten wählen
                  </button>
                  {/* Calendly Inline-Widget via iframe – zuverlässiger als das Calendly-Script-Widget
                      weil der iframe bei jedem Therapeuten-Wechsel neu gerendert wird */}
                  {(() => {
                    const url = therapeutData?.therapeuten.find(t => t.id === selectedTherapeutId)?.calendlyUrl;
                    if (!url) return null;
                    const iframeUrl = url.includes("?") ? `${url}&embed_type=Inline&hide_event_type_details=1` : `${url}?embed_type=Inline&hide_event_type_details=1`;
                    return (
                      <iframe
                        key={selectedTherapeutId} // key erzwingt Re-Mount bei Therapeuten-Wechsel
                        src={iframeUrl}
                        width="100%"
                        height="500px"
                        frameBorder="0"
                        className="rounded-lg border border-border"
                        title="Therapiesitzung buchen"
                      />
                    );
                  })()}
                </>
              )}
              <p className="mono text-xs text-muted-foreground text-center">
                Nach der Buchung werden 7 Coins automatisch abgezogen.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Referrals-Tab ──────────────────────────────────────────────────────────
  if (activeTab === "referrals") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Einladungen</h1>
          <p className="text-muted-foreground mono text-sm mt-1">patient.getReferralStatus()</p>
        </div>

        {/* Erklärung */}
        <div className="blueprint-card blueprint-card-pink p-6">
          <h2 className="font-bold mb-2">So funktioniert es</h2>
          <div className="grid grid-cols-3 gap-4 text-center mt-4">
            {[
              { step: "01", label: "Link teilen", desc: "Sende deinen persönlichen Einladungslink" },
              { step: "02", label: "Membership", desc: "Dein Kontakt schließt ein Membership ab" },
              { step: "03", label: "Coin erhalten", desc: "Du bekommst automatisch 1 Coin gutgeschrieben" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center gap-2">
                <span className="mono text-2xl font-black text-[var(--pink-dark)]">{s.step}</span>
                <span className="font-semibold text-sm">{s.label}</span>
                <span className="text-xs text-muted-foreground">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Link generieren */}
        <div className="blueprint-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold">Meine Einladungslinks</h2>
            <Button
              size="sm"
              onClick={handleGenerateLink}
              disabled={generateLink.isPending}
              style={{ background: "var(--cyan-dark)", color: "white" }}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Neuen Link erstellen
            </Button>
          </div>

          {refData?.referrals.length === 0 ? (
            <p className="text-muted-foreground text-sm mono py-4 text-center">
              Noch keine Einladungslinks erstellt.
            </p>
          ) : (
            <div className="space-y-3">
              {refData?.referrals.map((ref) => (
                <div key={ref.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="mono font-bold text-sm text-[var(--cyan-dark)]">{ref.code}</span>
                    <StatusBadge status={ref.status} />
                    {ref.coinAwarded && (
                      <span className="mono text-xs text-emerald-600">+1 Coin</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(ref.code)}
                  >
                    {copiedCode === ref.code
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Transaktionen-Tab ──────────────────────────────────────────────────────
  if (activeTab === "history") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Transaktionshistorie</h1>
          <p className="text-muted-foreground mono text-sm mt-1">patient.getTransactionHistory()</p>
        </div>

        <div className="blueprint-card blueprint-card-cyan p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">DATUM</th>
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">GRUND</th>
                  <th className="text-right pb-3 mono text-xs text-muted-foreground font-medium">COINS</th>
                </tr>
              </thead>
              <tbody>
                {txData?.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-muted-foreground mono text-xs">
                      Keine Transaktionen vorhanden.
                    </td>
                  </tr>
                ) : (
                  txData?.transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/30 last:border-0">
                      <td className="py-3 mono text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString("de-DE")}
                      </td>
                      <td className="py-3 text-foreground">{tx.reason}</td>
                      <td className={`py-3 text-right mono font-bold ${tx.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Sitzungen-Tab ──────────────────────────────────────────────────────────
  if (activeTab === "sessions") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Meine Sitzungen</h1>
          <p className="text-muted-foreground mono text-sm mt-1">patient.getMySessions()</p>
        </div>

        <div className="space-y-3">
          {sessData?.sessions.length === 0 ? (
            <div className="blueprint-card p-12 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold">Noch keine Sitzungen</p>
              <p className="text-sm text-muted-foreground mt-1">
                Sammle 7 Coins und buche deine erste Therapiesitzung.
              </p>
            </div>
          ) : (
            sessData?.sessions.map((session) => (
              <div key={session.id} className="blueprint-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {session.status === "completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : session.status === "confirmed" ? (
                      <Clock className="w-5 h-5 text-blue-500 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">Therapiesitzung #{session.id}</p>
                      {session.scheduledAt && (
                        <p className="text-sm text-muted-foreground mono">
                          {new Date(session.scheduledAt).toLocaleDateString("de-DE", {
                            weekday: "long", year: "numeric", month: "long", day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={session.status} />
                    {/* Bewertungs-Button für abgeschlossene Sitzungen ohne Rating */}
                    {session.status === "completed" && session.rating === null && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRatingDialog({ sessionId: session.id, therapistId: session.therapeutId ?? "", open: true })}
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Bewerten
                      </Button>
                    )}
                    {session.rating !== null && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: session.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bewertungs-Dialog */}
        <Dialog
          open={ratingDialog?.open ?? false}
          onOpenChange={(open) => !open && setRatingDialog(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sitzung bewerten</DialogTitle>
              <DialogDescription>Wie war deine Therapiesitzung?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Sterne-Auswahl */}
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star)}
                    className="focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 transition-colors ${
                        star <= selectedRating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {/* Feedback-Textfeld */}
              <textarea
                className="w-full border border-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]"
                rows={3}
                placeholder="Optionales Feedback (max. 1000 Zeichen)..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                maxLength={1000}
              />
              <Button
                className="w-full"
                disabled={selectedRating === 0 || submitRating.isPending}
                onClick={handleSubmitRating}
                style={{ background: "var(--cyan-dark)", color: "white" }}
              >
                Bewertung abschicken
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return null;
}

/** Patient-Dashboard mit Sidebar-Navigation */
export default function PatientDashboard() {
   const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <SidebarProvider style={{ "--sidebar-width": "240px" } as CSSProperties}>
      <div className="relative">
        <Sidebar collapsible="icon" className="border-r border-border/50">
          <SidebarHeader className="h-16 justify-center px-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[var(--cyan-dark)] flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-bold text-sm text-sidebar-foreground">Healing Humans</p>
                <p className="mono text-xs text-sidebar-accent-foreground">Patient</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-2">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = activeTab === item.tab;
                return (
                  <SidebarMenuItem key={item.tab}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setActiveTab(item.tab)}
                      tooltip={item.label}
                      className="h-10"
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 w-full rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors text-left">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">{user?.name?.charAt(0) ?? "P"}</AvatarFallback>
                  </Avatar>
                  <div className="group-data-[collapsible=icon]:hidden min-w-0">
                    <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name ?? "Patient"}</p>
                    <p className="mono text-xs text-sidebar-accent-foreground truncate">{user?.email ?? ""}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
      </div>

      <SidebarInset>
        {/* Mobile Header */}
        <div className="flex md:hidden border-b h-14 items-center px-4 bg-background/95 backdrop-blur sticky top-0 z-40">
          <SidebarTrigger className="mr-3" />
          <span className="font-semibold">Healing Humans</span>
        </div>
        <main className="flex-1 p-6 max-w-5xl">
          <PatientContent activeTab={activeTab} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
