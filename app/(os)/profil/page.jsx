"use client";

import { useEffect, useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { hasStaffPin } from "../../components/shared/staffPin";
import PinSetupModal from "../../components/shared/PinSetupModal";

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

export default function ProfilPage() {
  const { selectedStaff, selectedStaffName, setSplashDone } = useStaffContext();

  const [heures, setHeures] = useState(null);
  const [staffHasPin, setStaffHasPin] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [mesTaches, setMesTaches] = useState([]);

  useEffect(() => {
    setStaffHasPin(hasStaffPin(selectedStaff?.id));
  }, [selectedStaff?.id]);

  useEffect(() => {
    if (!selectedStaff?.id) return;
    let ignore = false;
    fetch(`/api/task-assignments?staffId=${selectedStaff.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!ignore) setMesTaches(Array.isArray(data) ? data : []); })
      .catch((error) => console.error("[ProfilPage] task-assignments fetch failed", error));
    return () => { ignore = true; };
  }, [selectedStaff?.id]);

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

  const handleChangerPoste = () => setSplashDone(false);

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

      {mesTaches.length > 0 && (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="text-xs font-black text-[#9a7060] uppercase tracking-wide mb-3">Mes tâches assignées</div>
          <div className="space-y-2">
            {mesTaches.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#e5d5c5] p-2.5">
                <span className="text-sm font-bold text-[#2c1a10]">{t.nom}</span>
                {t.date && (
                  <span className="text-[11px] text-[#9a7060] font-semibold shrink-0">{t.date.slice(0, 10)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        <div className="text-xs font-black text-[#9a7060] uppercase tracking-wide mb-3">🔐 Sécurité</div>

        {!staffHasPin ? (
          <button
            type="button"
            onClick={() => setShowPinSetup(true)}
            className="w-full py-3 rounded-xl bg-[#2c1a10] text-white font-black text-sm cursor-pointer"
          >
            Créer mon PIN de session
          </button>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-[#5a7828] font-bold">✅ PIN activé</div>
            <button
              type="button"
              onClick={() => setShowPinSetup(true)}
              className="text-xs text-[#9a7060] underline cursor-pointer"
            >
              Modifier mon PIN
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleChangerPoste}
        className="w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
      >
        Changer de poste
      </button>

      {showPinSetup && (
        <PinSetupModal
          staffId={selectedStaff?.id}
          onClose={() => setShowPinSetup(false)}
          onSaved={() => setStaffHasPin(true)}
        />
      )}
    </div>
  );
}
