import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Seiten-Imports
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import PatientDashboard from "./pages/patient/PatientDashboard";
import TherapeutDashboard from "./pages/therapeut/TherapeutDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

/**
 * Geschützte Route: Leitet zur /login-Seite weiter wenn nicht eingeloggt.
 * Zeigt einen Ladeindikator während der Auth-Status geprüft wird.
 */
function ProtectedRoute({
  component: Component,
  allowedRoles,
}: {
  component: React.ComponentType;
  allowedRoles?: Array<"patient" | "therapeut" | "admin">;
}) {
  const { user, loading } = useAuth();

  // Ladeindikator während Auth-Check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--cyan-dark)]" />
          <p className="mono text-muted-foreground">Authentifizierung wird geprüft...</p>
        </div>
      </div>
    );
  }

  // Nicht eingeloggt → Login-Seite
  if (!user) {
    return <Redirect to="/login" />;
  }

  // Falsche Rolle → zum passenden Dashboard weiterleiten
  if (allowedRoles && !allowedRoles.includes(user.role as "patient" | "therapeut" | "admin")) {
    const roleRedirects: Record<string, string> = {
      patient: "/patient",
      therapeut: "/therapeut",
      admin: "/admin",
    };
    return <Redirect to={roleRedirects[user.role] ?? "/login"} />;
  }

  return <Component />;
}

/**
 * Haupt-Router
 */
function Router() {
  const { user, loading } = useAuth();

  return (
    <Switch>
      {/* Startseite: Weiterleitung je nach Rolle oder zur Login-Seite */}
      <Route path="/">
        {loading ? (
          <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--cyan-dark)]" />
          </div>
        ) : user ? (
          <Redirect to={
            user.role === "admin" ? "/admin" :
            user.role === "therapeut" ? "/therapeut" :
            "/patient"
          } />
        ) : (
          <Redirect to="/login" />
        )}
      </Route>

      {/* Login-Seite */}
      <Route path="/login">
        {user && !loading ? (
          <Redirect to={
            user.role === "admin" ? "/admin" :
            user.role === "therapeut" ? "/therapeut" :
            "/patient"
          } />
        ) : (
          <Login />
        )}
      </Route>

      {/* Patient-Bereich */}
      <Route path="/patient*">
        <ProtectedRoute component={PatientDashboard} allowedRoles={["patient"]} />
      </Route>

      {/* Therapeuten-Bereich */}
      <Route path="/therapeut*">
        <ProtectedRoute component={TherapeutDashboard} allowedRoles={["therapeut"]} />
      </Route>

      {/* Admin-Bereich */}
      <Route path="/admin*">
        <ProtectedRoute component={AdminDashboard} allowedRoles={["admin"]} />
      </Route>

      {/* 404 Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
