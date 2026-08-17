"use client";

// Vue admin du pipeline "spécial du mois" (Bar Manager Operating System
// v1.0, sections 5-6) — toutes les fiches, tous statuts. Gate isAdmin +
// redirect identique à /rapports, même mécanisme réutilisé pour distinguer
// admin (ici) et bar (/special-du-mois, PR2), pas de nouveau système.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import BoissonSpecialeModal from "../../components/shared/BoissonSpecialeModal";

const STATUT_COLOR = {
  Piste: "bg-[#f0e8dc] text-[#9a7060]",
  "Test 1": "bg-blue-50 text-blue-700",
  "Test 2": "bg-blue-50 text-blue-700",
  Décision: "bg-orange-50 text-orange-700",
  Lancé: "bg-green-50 text-green-700",
  Terminé: "bg-[#f0e8dc] text-[#9a7060]",
};
const DECISION_COLOR = { KEEP: "bg-green-50 text-green-700", ADJUST: "bg-orange-50 text-orange-700", STOP: "bg-red-50 text-red-700" };

function FicheCard({ fiche, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-[#e5d5c5] bg-white p-4 flex items-center justify-between gap-2 text-left cursor-pointer active:scale-[0.99] transition-all"
    >
      <div className="min-w-0">
        <div className="text-sm font-black text-[#2c1a10] truncate">{fiche.nomProvisoire || "(sans nom)"}</div>
        <div className="text-[11px] text-[#9a7060] font-semibold">
          {fiche.posteConcerne || "—"}{fiche.dateLancement ? ` · lancement ${fiche.dateLancement}` : ""}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {fiche.decision && (
          <span className={`text-[9px] font-black px-2 py-1 rounded-full ${DECISION_COLOR[fiche.decision] || ""}`}>{fiche.decision}</span>
        )}
        <span className={`text-[9px] font-black px-2 py-1 rounded-full ${STATUT_COLOR[fiche.statutPipeline] || "bg-[#f0e8dc] text-[#9a7060]"}`}>
          {fiche.statutPipeline || "Piste"}
        </span>
      </div>
    </button>
  );
}

export default function SpecialsPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const [fiches, setFiches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(undefined); // undefined = fermé, null = création, id = édition

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  const refresh = () => {
    setLoading(true);
    fetch("/api/specials")
      .then((r) => r.json())
      .then((data) => setFiches(Array.isArray(data) ? data : []))
      .catch(() => setFiches([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4 md:max-w-2xl md:mx-auto" style={{ background: "#f7efe4" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
          <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">🍹 Spécial du mois</h1>
        </div>
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="h-10 px-4 rounded-xl bg-[#2c1a10] text-white text-xs font-black cursor-pointer"
        >
          + Nouvelle fiche
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[#9a7060] text-center py-10">…</div>
      ) : fiches.length === 0 ? (
        <div className="text-sm text-[#9a7060] text-center py-10">Aucune fiche pour l&apos;instant</div>
      ) : (
        <div className="space-y-2">
          {fiches.map((f) => (
            <FicheCard key={f.id} fiche={f} onOpen={() => setOpenId(f.id)} />
          ))}
        </div>
      )}

      {openId !== undefined && (
        <BoissonSpecialeModal
          id={openId}
          onClose={() => { setOpenId(undefined); refresh(); }}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
