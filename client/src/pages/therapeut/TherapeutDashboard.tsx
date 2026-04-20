import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Calendar, MessageSquare, LayoutDashboard, LogOut,
  CheckCircle2, Clock, Star, User,
} from "lucide-react";
import { CSSProperties, useState } from "react";

// Navigationsmenü für Therapeuten
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Übersicht",  tab: "overview" },
  { icon: Calendar,        label: "Sitzungen",  tab: "sessions" },
  { icon: MessageSquare,   label: "Feedback",   tab: "feedback" },
];

/** Status-Badge Komponente */
function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Ausstehend", confirmed: "Bestätigt",
    completed: "Abgeschlossen", cancelled: "Abgesagt",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

/** Hauptinhalt je nach aktivem Tab */
function TherapeutContent({ activeTab }: { activeTab: string }) {
  const { data: sessData, isLoading } = trpc.therapeut.getSessions.useQuery();
  const { data: feedbackData } = trpc.therapeut.getPatientFeedback.useQuery();
  const markDone = trpc.therapeut.markSessionDone.useMutation();
  const utils = trpc.useUtils();

  /** Sitzung als abgeschlossen markieren */
  async function handleMarkDone(sessionId: number) {
    await markDone.mutateAsync({ sessionId });
    await utils.therapeut.getSessions.invalidate();
    toast.success("Sitzung als abgeschlossen markiert.");
  }

  const sessions = sessData?.sessions ?? [];
  const pendingSessions = sessions.filter((s) => s.status === "pending" || s.status === "confirmed");
  const completedSessions = sessions.filter((s) => s.status === "completed");

  // ── Übersicht-Tab ──────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Therapeuten-Übersicht</h1>
          <p className="text-muted-foreground mono text-sm mt-1">therapeut.getSessions()</p>
        </div>

        {/* Statistik-Karten */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Gesamt",         value: sessions.length,          color: "var(--cyan-dark)" },
            { label: "Ausstehend",     value: pendingSessions.length,   color: "#f59e0b" },
            { label: "Abgeschlossen",  value: completedSessions.length, color: "#10b981" },
            { label: "Mit Feedback",   value: feedbackData?.feedback.length ?? 0, color: "var(--pink-dark)" },
          ].map((stat) => (
            <div key={stat.label} className="blueprint-card p-5">
              <p className="mono text-xs text-muted-foreground mb-1">{stat.label.toUpperCase()}</p>
              <p className="text-4xl font-black" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Nächste Sitzungen */}
        <div className="blueprint-card blueprint-card-cyan p-6">
          <h2 className="font-bold mb-4">Nächste Sitzungen</h2>
          {pendingSessions.length === 0 ? (
            <p className="text-muted-foreground text-sm mono py-4 text-center">
              Keine ausstehenden Sitzungen.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingSessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{session.patientName}</p>
                      {session.scheduledAt && (
                        <p className="mono text-xs text-muted-foreground">
                          {new Date(session.scheduledAt).toLocaleDateString("de-DE", {
                            weekday: "short", day: "2-digit", month: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={session.status} />
                    <Button
                      size="sm"
                      onClick={() => handleMarkDone(session.id)}
                      disabled={markDone.isPending}
                      style={{ background: "var(--cyan-dark)", color: "white" }}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Abschließen
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Sitzungen-Tab ──────────────────────────────────────────────────────────
  if (activeTab === "sessions") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Alle Sitzungen</h1>
          <p className="text-muted-foreground mono text-sm mt-1">therapeut.getSessions()</p>
        </div>

        <div className="blueprint-card blueprint-card-cyan p-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm mono py-8 text-center">
              Keine Sitzungen vorhanden.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">PATIENT</th>
                    <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">DATUM</th>
                    <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">STATUS</th>
                    <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">BEWERTUNG</th>
                    <th className="text-right pb-3 mono text-xs text-muted-foreground font-medium">AKTION</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-border/30 last:border-0">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{session.patientName}</span>
                        </div>
                      </td>
                      <td className="py-3 mono text-xs text-muted-foreground">
                        {session.scheduledAt
                          ? new Date(session.scheduledAt).toLocaleDateString("de-DE")
                          : "—"}
                      </td>
                      <td className="py-3"><StatusBadge status={session.status} /></td>
                      <td className="py-3">
                        {session.rating !== null ? (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: session.rating }).map((_, i) => (
                              <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                            ))}
                          </div>
                        ) : (
                          <span className="mono text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {(session.status === "pending" || session.status === "confirmed") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkDone(session.id)}
                            disabled={markDone.isPending}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Abschließen
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Feedback-Tab ───────────────────────────────────────────────────────────
  if (activeTab === "feedback") {
    const feedback = feedbackData?.feedback ?? [];
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Patienten-Feedback</h1>
          <p className="text-muted-foreground mono text-sm mt-1">therapeut.getPatientFeedback()</p>
        </div>

        {feedback.length === 0 ? (
          <div className="blueprint-card p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold">Noch kein Feedback</p>
            <p className="text-sm text-muted-foreground mt-1">
              Feedback erscheint hier, sobald Patienten ihre Sitzungen bewertet haben.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {feedback.map((session) => (
              <div key={session.id} className="blueprint-card blueprint-card-pink p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{session.patientName}</span>
                    <span className="mono text-xs text-muted-foreground">
                      {session.scheduledAt
                        ? new Date(session.scheduledAt).toLocaleDateString("de-DE")
                        : ""}
                    </span>
                  </div>
                  {/* Sterne-Bewertung */}
                  {session.rating !== null && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < session.rating! ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                        />
                      ))}
                      <span className="mono text-xs text-muted-foreground ml-1">{session.rating}/5</span>
                    </div>
                  )}
                </div>
                {session.feedback && (
                  <p className="text-sm text-foreground bg-slate-50 rounded-lg p-3 italic">
                    „{session.feedback}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

/** Therapeuten-Dashboard mit Sidebar-Navigation */
export default function TherapeutDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <SidebarProvider style={{ "--sidebar-width": "240px" } as CSSProperties}>
      <div className="relative">
        <Sidebar collapsible="icon" className="border-r border-border/50">
          <SidebarHeader className="h-16 justify-center px-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[var(--pink-dark)] flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-bold text-sm text-sidebar-foreground">Healing Humans</p>
                <p className="mono text-xs text-sidebar-accent-foreground">Therapeut</p>
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
                    <AvatarFallback className="text-xs">{user?.name?.charAt(0) ?? "T"}</AvatarFallback>
                  </Avatar>
                  <div className="group-data-[collapsible=icon]:hidden min-w-0">
                    <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name ?? "Therapeut"}</p>
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
        <div className="flex md:hidden border-b h-14 items-center px-4 bg-background/95 backdrop-blur sticky top-0 z-40">
          <SidebarTrigger className="mr-3" />
          <span className="font-semibold">Healing Humans</span>
        </div>
        <main className="flex-1 p-6 max-w-5xl">
          <TherapeutContent activeTab={activeTab} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
