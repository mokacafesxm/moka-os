"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const STATUS_LABEL = { present: "Présent", pause: "En pause", done: "Terminé", absent: "Absent" };
const STATUS_COLOR = { present: "#5a7828", pause: "#d97706", done: "#9a7060", absent: "#e5d5c5" };

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
  const { zonesPhysiques } = useAppContext();

  const [dashboard, setDashboard] = useState(null);
  const [recettesMappees, setRecettesMappees] = useState(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => { if (!ignore) setDashboard(data); })
      .catch((error) => console.error("[ManagerHomePage] dashboard fetch failed", error));
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
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Tableau de bord</div>
      <h1 className="text-xl font-black text-[#2c1a10] -mt-3">Vue manager</h1>

      <div className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
            <div className="text-2xl font-black" style={{ color: k.color }}>{k.value}</div>
            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mt-1">{k.label}</div>
          </div>
        ))}
      </div>

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
    </div>
  );
}
