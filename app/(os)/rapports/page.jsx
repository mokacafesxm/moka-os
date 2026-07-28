"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

function formatEuros(value) {
  return `${(value || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
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

// ── A. KPIs ──────────────────────────────────────────────────────────────

function KpiGrid({ kpis, loading }) {
  const items = [
    { label: "CA du mois", value: kpis ? formatEuros(kpis.caMois) : "—", color: "#2c1a10" },
    { label: "Heures staff ce mois", value: kpis ? formatHeures(kpis.heuresStaffMois) : "—", color: "#2c1a10" },
    { label: "Commandes passées / reçues", value: kpis ? `${kpis.commandesPassees} / ${kpis.commandesRecues}` : "—", color: "#2c1a10" },
    { label: "Incidents résolus", value: kpis ? kpis.incidentsResolus : "—", color: "#5a7828" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((k) => (
        <div key={k.label} className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="text-xl font-black" style={{ color: k.color }}>{loading ? "…" : k.value}</div>
          <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mt-1">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── C. Heures staff ──────────────────────────────────────────────────────

function HeuresStaffSection({ heures }) {
  const [selected, setSelected] = useState(null);

  if (!heures || heures.length === 0) {
    return <SectionCard title="Heures staff (ce mois)"><div className="text-sm text-[#9a7060] py-2">Aucune donnée</div></SectionCard>;
  }

  return (
    <SectionCard title="Heures staff (ce mois)">
      <div className="space-y-2">
        {heures.map((h) => (
          <button
            key={h.nom}
            type="button"
            onClick={() => setSelected(selected?.nom === h.nom ? null : h)}
            className="w-full flex items-center justify-between text-sm cursor-pointer py-1"
          >
            <span className="font-bold text-[#2c1a10]">{h.nom}</span>
            <span className="font-black text-[#2c1a10]">{formatHeures(h.heures)}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-[#e5d5c5] space-y-1.5">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1">{selected.nom} — détail</div>
          {(selected.detail || []).length === 0 ? (
            <div className="text-xs text-[#9a7060]">Aucun détail</div>
          ) : (
            selected.detail.map((d) => (
              <div key={d.date} className="flex items-center justify-between text-xs">
                <span className="text-[#9a7060]">{d.date}{d.incomplete ? " (incomplet)" : ""}</span>
                <span className="font-bold text-[#2c1a10]">{formatHeures(d.heures)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── D. MÖKA AI ───────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "Quels produits sont en rupture ?",
  "Résume l'activité de la semaine",
  "Quelles prépas sont urgentes ?",
];

function TypingDots() {
  return (
    <div className="flex gap-1 px-3 py-2.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#9a7060] animate-bounce"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

function MokaAiSection({ context }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading) return;
    const updated = [...messages, { role: "user", content: trimmed }];
    setMessages(updated);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/reports/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, context }),
      });
      if (!res.ok) throw new Error("Erreur chat");
      const { reply } = await res.json();
      setMessages([...updated, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "Désolé, une erreur s'est produite. Réessaie." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">✨</span>
        <span className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">MOKA AI</span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#f0e8dc] text-[#9a7060]">Claude Haiku</span>
      </div>

      <div className="max-h-80 overflow-y-auto space-y-2 mb-3">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="px-3 py-2 rounded-xl bg-[#faf5ef] border border-[#e5d5c5] text-xs font-bold text-[#6b4a3d] cursor-pointer text-left"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2.5 text-sm ${
                m.role === "user" ? "bg-[#2c1a10] text-white" : "bg-[#faf5ef] text-[#2c1a10] border border-[#e5d5c5]"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-[#faf5ef] border border-[#e5d5c5]"><TypingDots /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Poser une question à MÖKA AI…"
          className="flex-1 h-11 px-4 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] text-sm text-[#2c1a10] outline-none focus:border-[#5a7828]"
        />
        <button
          type="button"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="w-11 h-11 rounded-xl bg-[#5a7828] text-white font-black cursor-pointer disabled:opacity-50 shrink-0"
        >
          →
        </button>
      </div>
    </div>
  );
}

export default function RapportsPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { stockLive, supplierOrders } = useAppContext();

  const [kpis, setKpis] = useState(null);
  const [heuresStaff, setHeuresStaff] = useState([]);
  const [loadingKpis, setLoadingKpis] = useState(true);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    setLoadingKpis(true);
    Promise.all([
      fetch("/api/reports/monthly-summary").then((r) => r.json()),
      fetch("/api/reports?period=month").then((r) => r.json()),
      fetch("/api/incidents").then((r) => r.json()),
    ])
      .then(([monthlySummary, reportsMonth, incidents]) => {
        if (ignore) return;
        const heures = reportsMonth?.staff?.heures || [];
        setHeuresStaff(heures);
        const heuresStaffMois = heures.reduce((sum, h) => sum + (h.heures || 0), 0);
        const monthStart = monthlySummary?.periodeDebut;
        const incidentsResolus = Array.isArray(incidents)
          ? incidents.filter((i) => i.statut === "Résolu" && (!monthStart || (i.dateHeure || "") >= monthStart)).length
          : 0;
        setKpis({
          caMois: monthlySummary?.caMois ?? null,
          heuresStaffMois,
          commandesPassees: monthlySummary?.commandesPassees ?? 0,
          commandesRecues: monthlySummary?.commandesRecues ?? 0,
          incidentsResolus,
        });
      })
      .catch((error) => console.error("[RapportsPage] KPIs fetch failed", error))
      .finally(() => { if (!ignore) setLoadingKpis(false); });
    return () => { ignore = true; };
  }, [isAdmin]);

  const aiContext = useMemo(() => ({
    stock: stockLive.slice(0, 40),
    commandesRecentes: supplierOrders.slice(0, 10),
    heuresStaff,
    kpis,
  }), [stockLive, supplierOrders, heuresStaff, kpis]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">📈 Rapports</h1>
      </div>

      <KpiGrid kpis={kpis} loading={loadingKpis} />

      <Link
        href="/imports"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-2xl bg-white border border-[#e5d5c5] w-full py-4 text-left px-5 font-black text-[#2c1a10] shadow-sm cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between"
      >
        <span>📈 Importer ventes AddicTill</span>
        <span className="text-[#9a7060]">→</span>
      </Link>

      <HeuresStaffSection heures={heuresStaff} />

      <MokaAiSection context={aiContext} />
    </div>
  );
}
