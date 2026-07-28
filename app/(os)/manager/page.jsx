"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import LivraisonsAujourdhuiCard from "../../components/shared/LivraisonsAujourdhuiCard";
import CommandeClientKDSModal from "../../components/shared/CommandeClientKDSModal";

const STATUS_LABEL = { present: "Présent", pause: "En pause", done: "Terminé", absent: "Absent" };
const STATUS_COLOR = { present: "#5a7828", pause: "#d97706", done: "#9a7060", absent: "#e5d5c5" };

const DASHBOARD_CACHE_KEY = "mokaDashboardCache";

function SkeletonBlock({ className }) {
  return <div className={`rounded-2xl bg-[#e9dcc9] animate-pulse ${className || ""}`} />;
}

function DashboardSkeleton() {
  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Tableau de bord</div>
      <h1 className="text-xl font-black text-[#2c1a10] -mt-3">Vue manager</h1>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-20" />)}
      </div>
      <SkeletonBlock className="h-16" />
      <SkeletonBlock className="h-28" />
      <SkeletonBlock className="h-36" />
      <SkeletonBlock className="h-36" />
    </div>
  );
}

function formatEuros(value) {
  return `${(value || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function FinanceButton({ emoji, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-white border border-[#e5d5c5] shadow-sm p-4 flex items-center gap-4 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
    >
      <span className="text-2xl">{emoji}</span>
      <div className="text-left">
        <div className="font-black text-sm text-[#2c1a10]">{title}</div>
        <div className="text-xs text-[#9a7060]">{subtitle}</div>
      </div>
      <span className="ml-auto text-[#9a7060]">→</span>
    </button>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#2c1a10]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] cursor-pointer font-black"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MonthlyReportModal({ onClose }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/reports/monthly-summary")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (ignore) return;
        if (!ok) throw new Error(data.error || "Erreur chargement rapport");
        setSummary(data);
      })
      .catch((err) => { if (!ignore) setError(err.message); });
    return () => { ignore = true; };
  }, []);

  return (
    <ModalShell title="📋 Rapport mensuel" onClose={onClose}>
      {error && <div className="text-xs font-bold text-red-600">{error}</div>}
      {!error && !summary && <div className="text-sm text-[#9a7060] py-6 text-center">Chargement…</div>}
      {summary && (
        <div className="space-y-2.5">
          <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
            <div className="text-2xl font-black text-[#2c1a10]">{formatEuros(summary.caMois)}</div>
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mt-1">CA du mois</div>
          </div>
          <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
            <div className="text-2xl font-black text-[#2c1a10]">{summary.achatsFournisseurs}</div>
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mt-1">Achats fournisseurs du mois</div>
          </div>
          <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
            <div className="text-2xl font-black text-[#2c1a10]">{summary.commandesPassees} / {summary.commandesRecues}</div>
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mt-1">Commandes passées / reçues</div>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function formatHeures(decimal) {
  const h = Math.floor(decimal || 0);
  const m = Math.round(((decimal || 0) - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">{title}</div>
      {children}
    </div>
  );
}

export default function ManagerHomePage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { zonesPhysiques, supplierOrders, refreshSupplierOrders } = useAppContext();

  const [dashboard, setDashboard] = useState(null);
  const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
  const [recettesMappees, setRecettesMappees] = useState(null);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
  const [showCommandeClient, setShowCommandeClient] = useState(false);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  // Sprint 15 — affiche le dernier dashboard connu (localStorage) instantanément
  // pendant que la version fraîche se charge en arrière-plan, plutôt que de
  // montrer un skeleton à chaque visite. Le skeleton ne sert donc plus qu'au
  // tout premier chargement (aucun cache disponible).
  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    let hadCache = false;

    try {
      const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (cached) {
        setDashboard(JSON.parse(cached));
        hadCache = true;
      }
    } catch (error) {
      console.error("[ManagerHomePage] dashboard cache read failed", error);
    }

    setDashboardRefreshing(hadCache);
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        setDashboard(data);
        try {
          localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data));
        } catch (error) {
          console.error("[ManagerHomePage] dashboard cache write failed", error);
        }
      })
      .catch((error) => console.error("[ManagerHomePage] dashboard fetch failed", error))
      .finally(() => { if (!ignore) setDashboardRefreshing(false); });

    return () => { ignore = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    Promise.all([
      fetch("/api/recipes/sold-products").then((r) => r.json()),
      fetch("/api/recipes/lines").then((r) => r.json()),
    ])
      .then(([soldProducts, lines]) => {
        if (ignore) return;
        if (!Array.isArray(soldProducts) || !Array.isArray(lines)) return;
        const mappedIds = new Set(lines.filter((l) => l.active).map((l) => l.soldProductId));
        setRecettesMappees(soldProducts.filter((p) => mappedIds.has(p.id)).length);
      })
      .catch((error) => console.error("[ManagerHomePage] recipes fetch failed", error));
    return () => { ignore = true; };
  }, [isAdmin]);

  if (!isAdmin) return null;
  if (dashboard === null) return <DashboardSkeleton />;

  const critiques = dashboard?.critiques || [];
  const prepasUrgentes = dashboard?.prepas_urgentes || [];
  const staffToday = dashboard?.staff_today || [];
  const incidentsOuverts = dashboard?.incidents_ouverts ?? 0;
  const enService = staffToday.filter((s) => s.statut === "present" || s.statut === "pause").length;

  const kpis = [
    { label: "Critiques", value: critiques.length, color: critiques.length > 0 ? "#b91c1c" : "#2c1a10" },
    { label: "Prépas urgentes", value: prepasUrgentes.length, color: prepasUrgentes.length > 0 ? "#d97706" : "#2c1a10" },
    { label: "Incidents ouverts", value: incidentsOuverts, color: incidentsOuverts > 0 ? "#b91c1c" : "#2c1a10" },
    { label: "Staff en service", value: enService, color: "#5a7828" },
  ];

  const alertes = [
    ...critiques.slice(0, 3).map((c) => ({ icon: "🚨", text: `${c.nom} — critique` })),
    ...prepasUrgentes.slice(0, 2).map((p) => ({ icon: "✅", text: `${p.nom} à terminer` })),
    ...(dashboard?.livraisons_attendues || []).slice(0, 2).map((l) => ({ icon: "📦", text: `Livraison ${l.fournisseur} attendue` })),
  ].slice(0, 5);

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="flex items-center gap-2">
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Tableau de bord</div>
        {dashboardRefreshing && (
          <span className="w-3 h-3 rounded-full border-2 border-[#9a7060] border-t-transparent animate-spin" />
        )}
      </div>
      <h1 className="text-xl font-black text-[#2c1a10] -mt-3">Vue manager</h1>

      <LivraisonsAujourdhuiCard orders={supplierOrders} onReceived={refreshSupplierOrders} />

      <div className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
            <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowCommandeClient(true)}
        className="bg-[#2c1a10] text-white rounded-2xl py-4 w-full font-black cursor-pointer active:scale-[0.98] transition-all"
      >
        🛎 Commande client
      </button>

      <Link
        href="/recettes"
        className="flex items-center justify-between rounded-2xl border border-[#e5d5c5] bg-white p-4 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">📖</span>
          <div>
            <div className="font-black text-sm text-[#2c1a10]">Fiches Recettes</div>
            <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
              {recettesMappees === null ? "Chargement…" : `${recettesMappees} recette${recettesMappees !== 1 ? "s" : ""} mappée${recettesMappees !== 1 ? "s" : ""}`}
            </div>
          </div>
        </div>
        <span className="text-lg text-[#9a7060]">→</span>
      </Link>

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Alertes prioritaires</span>
            {incidentsOuverts > 0 && (
              <span className="text-[10px] font-black text-white px-1.5 py-0.5 rounded-full leading-none" style={{ background: "#b91c1c" }}>
                {incidentsOuverts}
              </span>
            )}
          </div>
          <Link href="/incidents" className="text-[10px] font-bold text-[#9a7060] underline cursor-pointer shrink-0">
            Incidents →
          </Link>
        </div>
        {alertes.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-2">Aucune alerte — tout va bien 🎉</div>
        ) : (
          <div className="space-y-2">
            {alertes.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-[#2c1a10]">
                <span className="text-base">{a.icon}</span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionCard title="📊 Données financières">
        <div className="space-y-3">
          <FinanceButton
            emoji="📈"
            title="Ventes AddicTill"
            subtitle="Importer et analyser les ventes"
            onClick={() => router.push("/imports")}
          />
          <FinanceButton
            emoji="🏦"
            title="Relevés bancaires"
            subtitle="Importer les relevés Crédit Mutuel"
            onClick={() => router.push("/imports?type=bank")}
          />
          <FinanceButton
            emoji="📋"
            title="Rapport mensuel"
            subtitle="CA, achats et commandes du mois"
            onClick={() => setShowMonthlyReport(true)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Zones du restaurant">
        <div className="grid grid-cols-2 gap-3">
          {zonesPhysiques.map((zone) => (
            <div key={zone.id} className="rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-3.5">
              <div className="text-xl mb-1">{zone.emoji || "📍"}</div>
              <div className="font-black text-sm text-[#2c1a10]">{zone.nom}</div>
              {zone.responsablePoste && (
                <div className="text-[10px] text-[#9a7060] font-semibold mt-0.5">{zone.responsablePoste}</div>
              )}
            </div>
          ))}
          {zonesPhysiques.length === 0 && (
            <div className="col-span-2 text-center text-sm text-[#9a7060] py-4">Aucune zone configurée</div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Activité staff du jour">
        {staffToday.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-2">Aucune donnée de pointage</div>
        ) : (
          <div className="space-y-2">
            {staffToday.map((s) => (
              <div key={s.nom} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[s.statut] || "#e5d5c5" }} />
                  <span className="text-sm font-bold text-[#2c1a10]">{s.nom}</span>
                </div>
                <div className="text-xs text-[#9a7060] font-semibold">
                  {STATUS_LABEL[s.statut] || "Absent"}{s.heures > 0 && ` · ${formatHeures(s.heures)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {showMonthlyReport && <MonthlyReportModal onClose={() => setShowMonthlyReport(false)} />}
      {showCommandeClient && <CommandeClientKDSModal onClose={() => setShowCommandeClient(false)} />}
    </div>
  );
}
