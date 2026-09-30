"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { Session } from "@/lib/backend";
import { logoutAction } from "@/lib/actions/auth";
import { SisnatProvider, useSisnat } from "@/hooks/use-sisnat";
import { useViewHistory, type View } from "@/hooks/use-view-history";
import { sectionOf } from "@/lib/dashboard/cred";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";
import { PackagesView } from "@/components/dashboard/views/packages-view";
import { PackageChoiceView } from "@/components/dashboard/views/package-choice-view";
import { ModuleChildrenView } from "@/components/dashboard/views/module-children-view";
import { ModulePrestationsView } from "@/components/dashboard/views/module-prestations-view";
import { PrestationChildrenView } from "@/components/dashboard/views/prestation-children-view";
import { ChildView } from "@/components/dashboard/views/child-view";
import { StatsView } from "@/components/dashboard/views/stats-view";
import { DirectoryView } from "@/components/dashboard/views/directory-view";
import { DirectoryChildView } from "@/components/dashboard/views/directory-child-view";
import { PackageConfigView } from "@/components/dashboard/views/package-config-view";
import { ParentsView } from "@/components/dashboard/views/parents-view";
import { PortalChildrenView, PortalClaimsView } from "@/components/dashboard/guardian/portal-views";
import { RolesView } from "@/components/dashboard/admin/roles-view";
import { UsersView } from "@/components/dashboard/admin/users-view";
import { PermissionsView } from "@/components/dashboard/admin/permissions-view";
import { FacilitiesView, RegionsView } from "@/components/dashboard/admin/territory-views";
import { GuardianDetailView, GuardiansView } from "@/components/dashboard/admin/guardian-views";
import { ChildrenView } from "@/components/dashboard/admin/children-view";
import { AuditLogView, DevicesView, SessionsView } from "@/components/dashboard/admin/audit-views";
import { CarePackageDetailView, CarePackagesView, CareServicesView } from "@/components/dashboard/admin/catalog-views";
import { ChildControlsView, ControlsView } from "@/components/dashboard/admin/child-controls-view";
import { AdminClaimDetailView, AdminClaimsView } from "@/components/dashboard/admin/claims-views";
import { AdminDashboardView } from "@/components/dashboard/admin/dashboard-view";
import { TrackingSearchView } from "@/components/dashboard/admin/tracking-view";
import { AlertsView } from "@/components/dashboard/admin/security-views";
import { useBackendQuery } from "@/hooks/use-backend";
import { loadOpenAlertCount } from "@/lib/actions/admin/audit";

export function DashboardClient({ session }: { session: Session }) {
  return (
    <SisnatProvider session={session}>
      <DashboardShell />
    </SisnatProvider>
  );
}

function DashboardShell() {
  const router = useRouter();
  const { session, toast, dismissToast } = useSisnat();
  const nav = useViewHistory(
    session.role === "guardian" ? { name: "myChildren" } : session.role === "admin" ? { name: "dashboard" } : { name: "search" },
  );
  const [mobile, setMobile] = useState(false);
  // Aviso de alertas de riesgo abiertas en el menú del admin; se vuelve a consultar al cambiar de pantalla.
  const alerts = useBackendQuery(`alert-count-${nav.view.name}`, () =>
    session.role === "admin" ? loadOpenAlertCount() : Promise.resolve({ ok: true as const, data: 0, msg: "" }),
  );

  async function handleLogout() {
    await logoutAction();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        session={session}
        activeSection={sectionOf(nav.view, session.role)}
        onSelect={(view) => {
          nav.go(view);
          setMobile(false);
        }}
        mobile={mobile}
        onCloseMobile={() => setMobile(false)}
        onLogout={handleLogout}
        badges={{ alerts: alerts.data ?? 0 }}
      />
      {mobile && (
        <button
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="lg:pl-64">
        <Header onOpenMobile={() => setMobile(true)} />
        <main className="mx-auto max-w-7xl p-5 pt-20 md:p-8 md:pt-20 lg:pt-8">
          <CurrentView view={nav.view} nav={nav} />
        </main>
      </div>
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-[60] flex max-w-sm items-center gap-2 rounded-lg border p-3 text-sm shadow-lg ${toast.tone === "good" ? "border-success/30 bg-card text-success" : "border-destructive/30 bg-card text-destructive"}`}
        >
          {toast.tone === "good" ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
          <span className="flex-1">{toast.text}</span>
          <button onClick={dismissToast} aria-label="Cerrar aviso" className="text-muted-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function CurrentView({ view, nav }: { view: View; nav: ReturnType<typeof useViewHistory> }) {
  const { session } = useSisnat();
  const staff = session.role !== "guardian";
  const admin = session.role === "admin";
  // Admin y coordinador comparten las pantallas de padres, niños, controles y reclamos.
  const manager = admin || session.role === "health_staff";
  const key = JSON.stringify(view);

  switch (view.name) {
    case "search":
      return manager ? <TrackingSearchView nav={nav} /> : null;
    case "alerts":
      return admin ? <AlertsView /> : null;
    case "dashboard":
      return admin ? <AdminDashboardView nav={nav} /> : null;
    case "roles":
      return admin ? <RolesView /> : null;
    case "users":
      return admin ? <UsersView /> : null;
    case "permissions":
      return admin ? <PermissionsView /> : null;
    case "regions":
      return admin ? <RegionsView nav={nav} /> : null;
    case "facilities":
      return admin ? <FacilitiesView nav={nav} /> : null;
    case "guardians":
      return manager ? <GuardiansView nav={nav} /> : null;
    case "guardianDetail":
      return manager ? <GuardianDetailView key={key} nav={nav} guardianId={view.guardianId} /> : null;
    case "children":
      return manager ? <ChildrenView nav={nav} /> : null;
    case "controls":
      return manager ? <ControlsView nav={nav} /> : null;
    case "childControls":
      return manager ? <ChildControlsView key={key} nav={nav} childId={view.childId} /> : null;
    case "packages":
      if (admin) return <CarePackagesView nav={nav} />;
      return staff ? <PackagesView nav={nav} /> : null;
    case "services":
      return admin ? <CareServicesView nav={nav} /> : null;
    case "carePackage":
      return admin ? <CarePackageDetailView key={key} nav={nav} packageId={view.packageId} /> : null;
    case "packageChoice":
      return staff ? <PackageChoiceView key={key} nav={nav} code={view.code} /> : null;
    case "packageConfig":
      return session.role === "admin" ? <PackageConfigView key={key} code={view.code} /> : null;
    case "parents":
      return staff ? <ParentsView nav={nav} /> : null;
    case "moduleChildren":
      return staff ? <ModuleChildrenView key={key} nav={nav} code={view.code} /> : null;
    case "modulePrestations":
      return staff ? <ModulePrestationsView key={key} nav={nav} code={view.code} /> : null;
    case "prestationChildren":
      return staff ? (
        <PrestationChildrenView key={key} nav={nav} code={view.code} prestacionId={view.prestacionId} />
      ) : null;
    case "child":
      return <ChildView key={key} childId={view.childId} code={view.code} />;
    case "stats":
      return staff ? <StatsView /> : null;
    case "directory":
      return staff ? <DirectoryView nav={nav} /> : null;
    case "directoryChild":
      return staff ? <DirectoryChildView key={key} nav={nav} childId={view.childId} /> : null;
    case "claims":
      if (manager) return <AdminClaimsView nav={nav} />;
      return !staff ? <PortalClaimsView /> : null;
    case "adminClaim":
      return manager ? <AdminClaimDetailView key={key} nav={nav} claimId={view.claimId} /> : null;
    case "claimDetail":
      return null;
    case "audit":
      return admin ? <AuditLogView /> : null;
    case "sessions":
      return admin ? <SessionsView /> : null;
    case "devices":
      return admin ? <DevicesView /> : null;
    case "myChildren":
      return !staff ? <PortalChildrenView nav={nav} /> : null;
    case "guardianChild":
    case "tracking":
      return null;
  }
}
