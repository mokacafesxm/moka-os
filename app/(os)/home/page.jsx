"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const SXM_TIMEZONE = "America/Puerto_Rico";

// Sprint 15 — stocks critiques / commandes à passer ne concernent que les
// postes qui gèrent effectivement le stock (Bar, Cuisine) ; Salle et Plonge
// ne doivent jamais voir cette alerte.
const POSTES_WITH_STOCK_ALERTS = ["Bar", "Cuisine"];

function getStaffName(member) {
  return member?.name || member?.prenom || member?.nom || "Staff";
}

function isCritiqueStatus(statut) {
  return String(statut || "").toLowerCase().includes("critique");
}

function StaffPicker({ staff, onPick }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-10" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">MÖKA OS</div>
      <h1 className="text-2xl font-black text-[#2c1a10] mb-8 text-center">Qui es-tu aujourd&apos;hui ?</h1>
      <div className="w-full max-w-sm space-y-2.5">
        {staff.map((member) => (
          <button
            key={member.id || getStaffName(member)}
            type="button"
            onClick={() => onPick(member)}
            className="w-full min-h-14 rounded-2xl border border-[#e5d5c5] bg-white px-5 py-3.5 text-left font-black text-lg text-[#2c1a10] shadow-sm hover:bg-[#f0e4d4] active:scale-[0.98] transition-all cursor-pointer"
          >
            {getStaffName(member)}
          </button>
        ))}
        {staff.length === 0 && (
          <div className="text-center text-sm text-[#9a7060] py-6">Chargement de l&apos;équipe…</div>
        )}
      </div>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">{title}</div>
      {children}
    </div>
  );
}

const PRIORITY_DOT = {
  Critique: "bg-[#b91c1c]",
  Urgent: "bg-[#b91c1c]",
  Haute: "bg-[#d97706]",
  Normal: "bg-[#5a7828]",
  Normale: "bg-[#5a7828]",
  Basse: "bg-[#9a7060]",
};

export default function HomePage() {
  const router = useRouter();
  const { selectedStaff, selectedStaffName, setStaff, canLivraisons, poste, splashDone } = useStaffContext();
  const { staff, stockLive, preps } = useAppContext();

  const showStockAlerts = POSTES_WITH_STOCK_ALERTS.includes(poste);

  // Sprint 16 a retiré l'onglet Accueil : /home ne doit plus jamais
  // s'afficher une fois qu'un staff a choisi son poste au splash — que /home
  // soit atteinte via un vieux bookmark, l'écran d'accueil PWA en cache, ou
  // un des `router.replace("/home")` de garde admin ailleurs dans l'app.
  // On rebondit immédiatement vers /poste, qui a repris son rôle de landing.
  useEffect(() => {
    if (splashDone && poste) {
      router.replace("/poste");
    }
  }, [splashDone, poste, router]);

  const [dashboard, setDashboard] = useState(null);
  // Démarre à null (identique au rendu SSR) — new Date() dans l'initializer
  // ferait diverger le premier rendu client du HTML serveur (erreur
  // d'hydratation React, même cause que le fix StaffContext ci-dessus).
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => { if (!ignore) setDashboard(data); })
      .catch((error) => console.error("[HomePage] dashboard fetch failed", error));
    return () => { ignore = true; };
  }, []);

  if (splashDone && poste) {
    return null;
  }

  if (!selectedStaff) {
    return <StaffPicker staff={staff} onPick={setStaff} />;
  }

  const critiquesCount = stockLive.filter((item) => isCritiqueStatus(item.statut || item.status)).length;
  const prepasUrgentesCount = (dashboard?.prepas_urgentes || preps.filter((p) => {
    const s = String(p.status || "").toLowerCase();
    return !s.includes("fait") && !s.includes("terminé");
  })).length;
  const livraison = dashboard?.livraisons_attendues?.[0];

  const alertes = [
    showStockAlerts && critiquesCount > 0 && { icon: "🚨", text: `${critiquesCount} produit${critiquesCount > 1 ? "s" : ""} critique${critiquesCount > 1 ? "s" : ""} à commander` },
    prepasUrgentesCount > 0 && { icon: "✅", text: `${prepasUrgentesCount} prépa${prepasUrgentesCount > 1 ? "s" : ""} à terminer` },
    livraison && { icon: "📦", text: `Livraison ${livraison.fournisseur} attendue` },
  ].filter(Boolean).slice(0, 3);

  const mesTaches = preps
    .filter((p) => {
      const s = String(p.status || "").toLowerCase();
      return !s.includes("fait") && !s.includes("terminé");
    })
    .slice(0, 5);

  const dateLabel = now ? now.toLocaleDateString("fr-FR", { timeZone: SXM_TIMEZONE, weekday: "long", day: "numeric", month: "long" }) : "";
  const timeLabel = now ? now.toLocaleTimeString("fr-FR", { timeZone: SXM_TIMEZONE, hour: "2-digit", minute: "2-digit" }) : "--:--";

  const livraisonsAujourdhui = dashboard?.livraisons_aujourd_hui || [];

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      {canLivraisons && livraisonsAujourdhui.length > 0 && (
        <Link
          href="/poste#livraisons"
          className="flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold"
          style={{ background: "#dbeafe", color: "#1e40af", border: "1px solid #93c5fd" }}
        >
          <span>
            🚚 {livraisonsAujourdhui.length} livraison{livraisonsAujourdhui.length > 1 ? "s" : ""} prévue{livraisonsAujourdhui.length > 1 ? "s" : ""} aujourd&apos;hui
          </span>
          <span>Tap pour réceptionner →</span>
        </Link>
      )}

      <SectionCard title="Briefing du jour">
        <div className="text-lg font-black text-[#2c1a10]">Bonjour {selectedStaffName} 👋</div>
        <div className="text-xs text-[#9a7060] mt-0.5">Il est {timeLabel} · {dateLabel}</div>
      </SectionCard>

      {alertes.length > 0 && (
        <SectionCard title="Alertes">
          <div className="space-y-2">
            {alertes.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm font-bold text-[#2c1a10]">
                <span className="text-base">{a.icon}</span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Mes tâches urgentes">
        {mesTaches.length === 0 ? (
          <div className="text-sm text-[#9a7060] py-2">Rien d&apos;urgent — bien joué 🎉</div>
        ) : (
          <div className="space-y-2">
            {mesTaches.map((prep) => (
              <div key={prep.id} className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[prep.priority] || "bg-[#9a7060]"}`} />
                <span className="text-sm font-bold text-[#2c1a10] flex-1">{prep.name}</span>
                {prep.dueDate && <span className="text-[10px] text-[#9a7060] font-semibold">{prep.dueDate.slice(5)}</span>}
              </div>
            ))}
          </div>
        )}
        <Link
          href="/taches"
          className="block text-center mt-3 text-xs font-black text-[#5a7828] uppercase tracking-wide"
        >
          Voir tout →
        </Link>
      </SectionCard>

      <Link
        href="/poste"
        className="flex items-center justify-between rounded-2xl px-4 py-4 font-black text-white shadow-sm active:scale-[0.98] transition-all"
        style={{ background: "#2c1a10" }}
      >
        <span>🍽 Mon Poste aujourd&apos;hui</span>
        <span>→ Ouvrir</span>
      </Link>
    </div>
  );
}
