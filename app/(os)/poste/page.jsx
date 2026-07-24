"use client";

import { useEffect, useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const CRITICITE_DOT = {
  Critique: "bg-[#b91c1c]",
  Majeur: "bg-[#d97706]",
  Modéré: "bg-[#9a7060]",
  Mineur: "bg-[#e5d5c5]",
};

function ZonePicker({ zones, onPick }) {
  return (
    <div className="min-h-dvh px-4 py-6" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">Mon Poste</div>
      <h1 className="text-xl font-black text-[#2c1a10] mb-6">Quelle est ta zone aujourd&apos;hui ?</h1>
      <div className="grid grid-cols-2 gap-3">
        {zones.map((zone) => (
          <button
            key={zone.id}
            type="button"
            onClick={() => onPick(zone)}
            className="rounded-2xl border border-[#e5d5c5] bg-white p-4 text-left shadow-sm hover:bg-[#f0e4d4] active:scale-[0.97] transition-all cursor-pointer"
          >
            <div className="text-2xl mb-1">{zone.emoji || "📍"}</div>
            <div className="font-black text-sm text-[#2c1a10]">{zone.nom}</div>
          </button>
        ))}
        {zones.length === 0 && (
          <div className="col-span-2 text-center text-sm text-[#9a7060] py-6">Chargement des zones…</div>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { key: "taches", label: "📋 Tâches" },
  { key: "recettes", label: "📖 Recettes" },
  { key: "equipements", label: "🔧 Équipements" },
];

export default function PostePage() {
  const { myZone, setMyZone } = useStaffContext();
  const { zonesPhysiques, taches, equipements } = useAppContext();

  const [tab, setTab] = useState("taches");
  const [recettes, setRecettes] = useState([]);
  const [loadingRecettes, setLoadingRecettes] = useState(false);

  useEffect(() => {
    if (tab !== "recettes" || recettes.length > 0) return;
    setLoadingRecettes(true);
    fetch("/api/recipes/sold-products")
      .then((r) => r.json())
      .then((data) => setRecettes(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[PostePage] recipes fetch failed", error))
      .finally(() => setLoadingRecettes(false));
  }, [tab, recettes.length]);

  if (!myZone) {
    return <ZonePicker zones={zonesPhysiques} onPick={setMyZone} />;
  }

  const zoneTaches = taches.filter((t) => t.zoneId === myZone.id);
  const zoneEquipements = equipements.filter((e) => e.zoneId === myZone.id);

  return (
    <div className="min-h-dvh px-4 py-4" style={{ background: "#f7efe4" }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Mon Poste</div>
          <h1 className="text-xl font-black text-[#2c1a10]">{myZone.emoji} {myZone.nom}</h1>
        </div>
        <button
          type="button"
          onClick={() => setMyZone(null)}
          className="text-xs font-bold text-[#9a7060] underline cursor-pointer"
        >
          Changer
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-2xl py-2.5 text-xs font-black cursor-pointer transition-colors ${
              tab === t.key ? "bg-[#2c1a10] text-white" : "bg-white text-[#9a7060] border border-[#e5d5c5]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "taches" && (
        <div className="space-y-2">
          {zoneTaches.length === 0 && (
            <div className="text-center text-sm text-[#9a7060] py-8">Aucune tâche pour cette zone</div>
          )}
          {zoneTaches.map((t) => (
            <div key={t.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
              <div className="font-black text-sm text-[#2c1a10]">{t.nom}</div>
              <div className="text-[10px] text-[#9a7060] font-semibold mt-1">{t.frequence} · {t.moment}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "recettes" && (
        <div className="grid grid-cols-2 gap-3">
          {loadingRecettes && <div className="col-span-2 text-center text-sm text-[#9a7060] py-8">Chargement…</div>}
          {!loadingRecettes && recettes.length === 0 && (
            <div className="col-span-2 text-center text-sm text-[#9a7060] py-8">Aucune recette</div>
          )}
          {recettes.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5">
              <div className="font-black text-sm text-[#2c1a10]">{r.name}</div>
              <div className="text-[10px] text-[#9a7060] font-semibold mt-1">{r.category}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "equipements" && (
        <div className="space-y-2">
          {zoneEquipements.length === 0 && (
            <div className="text-center text-sm text-[#9a7060] py-8">Aucun équipement pour cette zone</div>
          )}
          {zoneEquipements.map((e) => (
            <div key={e.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-3.5 flex items-center justify-between">
              <div>
                <div className="font-black text-sm text-[#2c1a10]">{e.nom}</div>
                <div className="text-[10px] text-[#9a7060] font-semibold mt-1">{e.marque} {e.modele}</div>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${CRITICITE_DOT[e.criticite] || "bg-[#e5d5c5]"}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
