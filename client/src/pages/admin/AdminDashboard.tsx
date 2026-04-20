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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, CreditCard, Coins, LogOut,
  ShieldCheck, TrendingUp, AlertCircle, CheckCircle2,
} from "lucide-react";
import { CSSProperties, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, KeyRound, Link as LinkIcon } from "lucide-react";
// Navigationsmenü für Admins
const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard",      tab: "overview" },
  { icon: Users,           label: "Nutzer",          tab: "users" },
  { icon: CreditCard,      label: "Abrechnungen",    tab: "billing" },
  { icon: Coins,           label: "Coin-Verwaltung", tab: "coins" },
];

/** Status-Badge */
function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending: "Ausstehend", approved: "Genehmigt",
    paid: "Bezahlt", rejected: "Abgelehnt",
  };
  return <span className={`status-badge status-${status}`}>{labels[status] ?? status}</span>;
}

/** Rollen-Badge */
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    patient:   "bg-blue-50 text-blue-700 border-blue-200",
    therapeut: "bg-purple-50 text-purple-700 border-purple-200",
    admin:     "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`status-badge border ${styles[role] ?? ""}`}>
      {role}
    </span>
  );
}

/** Hauptinhalt je nach aktivem Tab */
function AdminContent({ activeTab }: { activeTab: string }) {
  const { data: statsData } = trpc.admin.getStats.useQuery();
  const { data: usersData, isLoading: usersLoading } = trpc.admin.getUsers.useQuery();
  const { data: billingData } = trpc.admin.getBillingRequests.useQuery();
  const { data: txData } = trpc.admin.getAllTransactions.useQuery();

  const setRole = trpc.admin.setUserRole.useMutation();
  const updateBilling = trpc.admin.updateBillingStatus.useMutation();
  const adjustCoins = trpc.admin.adjustCoins.useMutation();
  const createUserMutation = trpc.admin.createUser.useMutation();
  const setPasswordMutation = trpc.admin.setPassword.useMutation();

  const utils = trpc.useUtils();

  // Coin-Anpassungs-Dialog
  const [coinDialog, setCoinDialog] = useState<{ userId: string; name: string } | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [coinReason, setCoinReason] = useState("");

  // Nutzer-anlegen-Dialog
  const [createUserDialog, setCreateUserDialog] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"patient" | "therapeut" | "admin">("patient");
  const [newUserPassword, setNewUserPassword] = useState("");

  // Passwort-setzen-Dialog
  const [pwDialog, setPwDialog] = useState<{ userId: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Calendly-Link-Dialog (nur für Therapeuten)
  const [calendlyDialog, setCalendlyDialog] = useState<{ userId: string; name: string; currentUrl: string | null } | null>(null);
  const [calendlyInput, setCalendlyInput] = useState("");
  const setCalendlyMutation = trpc.admin.setCalendlyUrl.useMutation();

  async function handleSetCalendlyUrl() {
    if (!calendlyDialog) return;
    await setCalendlyMutation.mutateAsync({
      userId: calendlyDialog.userId,
      calendlyUrl: calendlyInput.trim() || null,
    });
    await utils.admin.getUsers.invalidate();
    toast.success(`Calendly-Link für ${calendlyDialog.name} gesetzt.`);
    setCalendlyDialog(null);
    setCalendlyInput("");
  }

  async function handleCreateUser() {
    if (!newUserEmail || !newUserName) return;
    await createUserMutation.mutateAsync({
      email: newUserEmail,
      name: newUserName,
      role: newUserRole,
      password: newUserPassword || undefined,
    });
    await utils.admin.getUsers.invalidate();
    toast.success(`Nutzer ${newUserName} angelegt.`);
    setCreateUserDialog(false);
    setNewUserEmail(""); setNewUserName(""); setNewUserPassword(""); setNewUserRole("patient");
  }

  async function handleSetPassword() {
    if (!pwDialog || !newPassword) return;
    await setPasswordMutation.mutateAsync({ userId: pwDialog.userId, password: newPassword });
    toast.success(`Passwort für ${pwDialog.name} gesetzt.`);
    setPwDialog(null);
    setNewPassword("");
  }

  /** Nutzerrolle ändern */
  async function handleRoleChange(userId: string, role: "patient" | "therapeut" | "admin") {
    await setRole.mutateAsync({ userId, role });
    await utils.admin.getUsers.invalidate();
    toast.success("Rolle aktualisiert.");
  }

  /** Abrechnungsstatus ändern */
  async function handleBillingStatus(billingId: string, status: "approved" | "rejected" | "paid") {
    await updateBilling.mutateAsync({ billingId, status });
    await utils.admin.getBillingRequests.invalidate();
    toast.success("Abrechnungsstatus aktualisiert.");
  }

  /** Coins manuell anpassen */
  async function handleCoinAdjust() {
    if (!coinDialog || !coinAmount || !coinReason) return;
    const amount = parseInt(coinAmount, 10);
    if (isNaN(amount)) return;
    const result = await adjustCoins.mutateAsync({
      supabaseUserId: coinDialog.userId,
      amount,
      reason: coinReason,
    });
    toast.success(`Coins angepasst. Neuer Kontostand: ${result.newBalance}`);
    setCoinDialog(null);
    setCoinAmount("");
    setCoinReason("");
  }

  // ── Dashboard-Tab ──────────────────────────────────────────────────────────
  if (activeTab === "overview") {
    const stats = statsData;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Admin-Dashboard</h1>
          <p className="text-muted-foreground mono text-sm mt-1">admin.getStats()</p>
        </div>

        {/* Statistik-Karten */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users,       label: "Nutzer gesamt",    value: stats?.totalUsers ?? 0,       color: "var(--cyan-dark)" },
            { icon: Coins,       label: "Coins im Umlauf",  value: stats?.totalCoins ?? 0,       color: "#f59e0b" },
            { icon: AlertCircle, label: "Offene Sitzungen", value: stats?.openSessions ?? 0,  color: "#8b5cf6" },
            { icon: CreditCard,  label: "Offene Abrechnungen", value: stats?.pendingBilling ?? 0, color: "var(--pink-dark)" },
          ].map((stat) => (
            <div key={stat.label} className="blueprint-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                <p className="mono text-xs text-muted-foreground">{stat.label.toUpperCase()}</p>
              </div>
              <p className="text-4xl font-black" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Letzte Transaktionen */}
        <div className="blueprint-card blueprint-card-cyan p-6">
          <h2 className="font-bold mb-4">Letzte Coin-Transaktionen</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">NUTZER-ID</th>
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">GRUND</th>
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">DATUM</th>
                  <th className="text-right pb-3 mono text-xs text-muted-foreground font-medium">COINS</th>
                </tr>
              </thead>
              <tbody>
                {txData?.transactions.slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="border-b border-border/30 last:border-0">
                    <td className="py-2 mono text-xs text-muted-foreground">{tx.id}</td>
                    <td className="py-2 text-sm">{tx.reason}</td>
                    <td className="py-2 mono text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString("de-DE")}
                    </td>
                    <td className={`py-2 text-right mono font-bold text-sm ${tx.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Nutzer-Tab ─────────────────────────────────────────────────────────────
  if (activeTab === "users") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Nutzerverwaltung</h1>
            <p className="text-muted-foreground mono text-sm mt-1">admin.getUsers()</p>
          </div>
          <Button
            onClick={() => setCreateUserDialog(true)}
            className="bg-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/90 text-white gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Nutzer anlegen
          </Button>
        </div>

        {/* Nutzer anlegen Dialog */}
        <Dialog open={createUserDialog} onOpenChange={setCreateUserDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Neuen Nutzer anlegen</DialogTitle>
              <DialogDescription>Zugangsdaten für Skool-Import</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input placeholder="Max Mustermann" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>E-Mail</Label>
                <Input type="email" placeholder="max@example.com" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Rolle</Label>
                <Select value={newUserRole} onValueChange={v => setNewUserRole(v as "patient" | "therapeut" | "admin")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient">patient</SelectItem>
                    <SelectItem value="therapeut">therapeut</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Passwort <span className="text-muted-foreground text-xs">(optional, kann später gesetzt werden)</span></Label>
                <Input type="password" placeholder="Mindestens 6 Zeichen" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
              </div>
              <Button
                onClick={handleCreateUser}
                disabled={createUserMutation.isPending || !newUserEmail || !newUserName}
                className="w-full bg-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/90 text-white"
              >
                {createUserMutation.isPending ? "Wird angelegt…" : "Nutzer anlegen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Calendly-Link setzen Dialog */}
        <Dialog open={!!calendlyDialog} onOpenChange={(open) => { if (!open) { setCalendlyDialog(null); setCalendlyInput(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Calendly-Link setzen</DialogTitle>
              <DialogDescription>{calendlyDialog?.name} &mdash; Therapeuten-Buchungslink</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Calendly-URL</Label>
                <Input
                  type="url"
                  placeholder="https://calendly.com/dein-name/therapie"
                  value={calendlyInput}
                  onChange={e => setCalendlyInput(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Leer lassen um den Link zu entfernen.</p>
              </div>
              <Button
                onClick={handleSetCalendlyUrl}
                disabled={setCalendlyMutation.isPending}
                className="w-full bg-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/90 text-white"
              >
                {setCalendlyMutation.isPending ? "Wird gesetzt…" : "Link speichern"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Passwort setzen Dialog */}
        <Dialog open={!!pwDialog} onOpenChange={(open) => { if (!open) { setPwDialog(null); setNewPassword(""); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Passwort setzen</DialogTitle>
              <DialogDescription>{pwDialog?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>Neues Passwort</Label>
                <Input type="password" placeholder="Mindestens 6 Zeichen" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <Button
                onClick={handleSetPassword}
                disabled={setPasswordMutation.isPending || newPassword.length < 6}
                className="w-full bg-[var(--cyan-dark)] hover:bg-[var(--cyan-dark)]/90 text-white"
              >
                {setPasswordMutation.isPending ? "Wird gesetzt…" : "Passwort setzen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="blueprint-card blueprint-card-cyan p-6">
          {usersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">NAME</th>
                    {/* Fix Bug #5: E-Mail-Spalte entfernt, da profiles.email nicht existiert */}
                    <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">ROLLE</th>
                    <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">COINS</th>
                    <th className="text-right pb-3 mono text-xs text-muted-foreground font-medium">AKTION</th>
                  </tr>
                </thead>
                <tbody>
                  {usersData?.users.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-muted-foreground mono text-xs">
                        Keine Nutzer gefunden.
                      </td>
                    </tr>
                  ) : (
                    usersData?.users.map((u) => (
                      <tr key={u.id} className="border-b border-border/30 last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs">{u.name?.charAt(0) ?? "?"}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{u.name ?? "—"}</span>
                          </div>
                        </td>
                        {/* Fix Bug #5: E-Mail-Spalte entfernt */}
                        <td className="py-3"><RoleBadge role={u.role} /></td>
                        <td className="py-3 mono text-xs font-bold" style={{ color: '#f59e0b' }}>
                          {u.coinsBalance ?? 0}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Passwort setzen */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1"
                              onClick={() => setPwDialog({ userId: u.id, name: u.name ?? u.email ?? "Nutzer" })}
                            >
                              <KeyRound className="w-3 h-3" />
                              PW
                            </Button>
                            {/* Calendly-Link setzen (nur für Therapeuten sichtbar) */}
                            {u.role === "therapeut" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs gap-1"
                                title={u.calendlyUrl ? `Aktuell: ${u.calendlyUrl}` : "Kein Calendly-Link gesetzt"}
                                onClick={() => {
                                  setCalendlyDialog({ userId: u.id, name: u.name ?? u.email ?? "Therapeut", currentUrl: u.calendlyUrl ?? null });
                                  setCalendlyInput(u.calendlyUrl ?? "");
                                }}
                              >
                                <LinkIcon className="w-3 h-3" />
                                {u.calendlyUrl ? "Cal ✓" : "Cal"}
                              </Button>
                            )}
                            {/* Rollenauswahl */}
                            <Select
                              value={u.role}
                              onValueChange={(val) => handleRoleChange(u.id, val as "patient" | "therapeut" | "admin")}
                            >
                              <SelectTrigger className="w-32 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="patient">patient</SelectItem>
                                <SelectItem value="therapeut">therapeut</SelectItem>
                                <SelectItem value="admin">admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Abrechnungen-Tab ───────────────────────────────────────────────────────
  if (activeTab === "billing") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Abrechnungen</h1>
          <p className="text-muted-foreground mono text-sm mt-1">admin.getBillingRequests()</p>
        </div>

        <div className="blueprint-card blueprint-card-pink p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">THERAPEUT</th>
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">BETRAG</th>
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">STATUS</th>
                  <th className="text-left pb-3 mono text-xs text-muted-foreground font-medium">DATUM</th>
                  <th className="text-right pb-3 mono text-xs text-muted-foreground font-medium">AKTION</th>
                </tr>
              </thead>
              <tbody>
                {billingData?.billingRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground mono text-xs">
                      Keine Abrechnungen vorhanden.
                    </td>
                  </tr>
                ) : (
                  billingData?.billingRequests.map((bill) => (
                    <tr key={bill.id} className="border-b border-border/30 last:border-0">
                      <td className="py-3 font-medium">{bill.therapeutName}</td>
                      <td className="py-3 mono font-bold text-[var(--cyan-dark)]">€ {bill.amount}</td>
                      <td className="py-3"><StatusBadge status={bill.status} /></td>
                      <td className="py-3 mono text-xs text-muted-foreground">
                        {new Date(bill.createdAt).toLocaleDateString("de-DE")}
                      </td>
                      <td className="py-3 text-right">
                        {bill.status === "pending" && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => handleBillingStatus(bill.id, "approved")}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Genehmigen
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-200 hover:bg-red-50"
                              onClick={() => handleBillingStatus(bill.id, "rejected")}
                            >
                              Ablehnen
                            </Button>
                          </div>
                        )}
                        {bill.status === "approved" && (
                          <Button
                            size="sm"
                            style={{ background: "var(--cyan-dark)", color: "white" }}
                            onClick={() => handleBillingStatus(bill.id, "paid")}
                          >
                            Als bezahlt markieren
                          </Button>
                        )}
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

  // ── Coin-Verwaltung-Tab ────────────────────────────────────────────────────
  if (activeTab === "coins") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Coin-Verwaltung</h1>
          <p className="text-muted-foreground mono text-sm mt-1">admin.adjustCoins()</p>
        </div>

        <div className="blueprint-card blueprint-card-cyan p-6">
          <p className="text-sm text-muted-foreground mb-6">
            Hier können Coins manuell gutgeschrieben oder abgezogen werden.
            Jede Änderung wird als Transaktion gespeichert.
          </p>

          {/* Nutzer-Liste mit Coin-Anpassung */}
          <div className="space-y-3">
            {usersData?.users.filter((u) => u.role === "patient").map((u) => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{u.name?.charAt(0) ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{u.name ?? "—"}</p>
                    <p className="mono text-xs text-muted-foreground">{u.email ?? "—"}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCoinDialog({ userId: u.id, name: u.name ?? "Nutzer" })}
                >
                  <Coins className="w-3 h-3 mr-1" />
                  Coins anpassen
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Coin-Anpassungs-Dialog */}
        <Dialog open={!!coinDialog} onOpenChange={(open) => !open && setCoinDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Coins anpassen</DialogTitle>
              <DialogDescription className="mono text-xs">
                Nutzer: {coinDialog?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label className="mono text-xs text-muted-foreground block mb-1">BETRAG (positiv = Gutschrift, negativ = Abzug)</label>
                <input
                  type="number"
                  className="w-full border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]"
                  placeholder="z.B. 3 oder -2"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mono text-xs text-muted-foreground block mb-1">GRUND (wird in der Transaktionshistorie angezeigt)</label>
                <input
                  type="text"
                  className="w-full border border-border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--cyan)]"
                  placeholder="z.B. Manuelle Korrektur durch Admin"
                  value={coinReason}
                  onChange={(e) => setCoinReason(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!coinAmount || !coinReason || adjustCoins.isPending}
                onClick={handleCoinAdjust}
                style={{ background: "var(--cyan-dark)", color: "white" }}
              >
                Anpassung speichern
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return null;
}

/** Admin-Dashboard mit Sidebar-Navigation */
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <SidebarProvider style={{ "--sidebar-width": "240px" } as CSSProperties}>
      <div className="relative">
        <Sidebar collapsible="icon" className="border-r border-border/50">
          <SidebarHeader className="h-16 justify-center px-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-white" />
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-bold text-sm text-sidebar-foreground">Healing Humans</p>
                <p className="mono text-xs text-sidebar-accent-foreground">Admin</p>
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
                    <AvatarFallback className="text-xs">{user?.name?.charAt(0) ?? "A"}</AvatarFallback>
                  </Avatar>
                  <div className="group-data-[collapsible=icon]:hidden min-w-0">
                    <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name ?? "Admin"}</p>
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
          <span className="font-semibold">Healing Humans – Admin</span>
        </div>
        <main className="flex-1 p-6 max-w-6xl">
          <AdminContent activeTab={activeTab} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
