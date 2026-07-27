"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

export default function ProfilPage() {
  const router = useRouter();
  const { selectedStaff, selectedStaffName, resetPoste } = useStaffContext();

  const [heures, setHeures] = useState(null);

  useEffect(() => {
    if (!selectedStaffName) return;
    let ignore = false;
    fetch("/api/reports?period=month")
      .then((r) => r.json())
      .then((data) => {
        if (ignore) return;
        const entry = (data?.staff?.heures || []).find((s) => s.nom === selectedStaffName);
        setHeures(entry?.heures ?? 0);
      })
      .catch((error) => console.error("[ProfilPage] reports fetch failed", error));
    return () => { ignore = true; };
  }, [selectedStaffName]);

  const handleChangerPoste = () => {
    resetPoste();
    router.push("/poste");
  };

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Profil</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">Mon compte</h1>
      </div>

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4 flex items-center gap-4">
        <span
          className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-black text-white shrink-0"
          style={{ background: "#2c1a10" }}
        >
          {initials(selectedStaffName)}
        </span>
        <div>
          <div className="text-lg font-black text-[#2c1a10]">{selectedStaffName || "—"}</div>
          <div className="text-xs text-[#9a7060] font-semibold">{selectedStaff?.role || "Rôle non renseigné"}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">Heures ce mois</div>
        <div className="text-2xl font-black text-[#2c1a10]">
          {heures === null ? "…" : `${heures}h`}
        </div>
      </div>

      <button
        type="button"
        onClick={handleChangerPoste}
        className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
      >
        Changer de poste
      </button>
    </div>
  );
}
