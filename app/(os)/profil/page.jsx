"use client";

import { useEffect, useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { hasStaffPin } from "../../components/shared/staffPin";
import PinSetupModal from "../../components/shared/PinSetupModal";

const CERT_STATUT_COLOR = { "Validé": "#5a7828", "En cours": "#d97706", "Expiré": "#9a7060" };

const JOURS = [
  { key: "lundi", label: "Lun" },
  { key: "mardi", label: "Mar" },
  { key: "mercredi", label: "Mer" },
  { key: "jeudi", label: "Jeu" },
  { key: "vendredi", label: "Ven" },
  { key: "samedi", label: "Sam" },
  { key: "dimanche", label: "Dim" },
];

function todaySXM() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
}
// Semaine = lundi de la semaine (YYYY-MM-DD) — même convention que /equipe.
function mondayOf(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function ProfilPage() {
  const { selectedStaff, selectedStaffName, setSplashDone } = useStaffContext();

  const [heures, setHeures] = useState(null);
  const [staffHasPin, setStaffHasPin] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [mesTaches, setMesTaches] = useState([]);
  const [monPlanning, setMonPlanning] = useState(null);
  const [planningConfigured, setPlanningConfigured] = useState(true);
  const [certifications, setCertifications] = useState([]);

  useEffect(() => {
    if (!selectedStaff?.id) { setStaffHasPin(false); return; }
    let ignore = false;
    hasStaffPin(selectedStaff.id).then((has) => { if (!ignore) setStaffHasPin(has); });
    return () => { ignore = true; };
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
    if (!selectedStaff?.id) return;
    let ignore = false;
    const semaine = mondayOf(todaySXM());
    fetch(`/api/planning?semaine=${semaine}&staffId=${selectedStaff.id}`)
      .then((r) => {
        if (r.status === 503) { if (!ignore) setPlanningConfigured(false); return []; }
        return r.ok ? r.json() : [];
      })
      .then((data) => { if (!ignore) setMonPlanning((Array.isArray(data) && data[0]) || null); })
      .catch((error) => console.error("[ProfilPage] planning fetch failed", error));
    return () => { ignore = true; };
  }, [selectedStaff?.id]);

  useEffect(() => {
    if (!selectedStaff?.id) return;
    let ignore = false;
    fetch(`/api/certifications?staffId=${selectedStaff.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!ignore) setCertifications(Array.isArray(data) ? data.filter((c) => c.statut === "Validé") : []); })
      .catch((error) => console.error("[ProfilPage] certifications fetch failed", error));
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
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">{selectedStaffName || "Mon compte"}</h1>
      </div>

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">Heures ce mois</div>
        <div className="text-2xl font-black text-[#2c1a10]">
          {heures === null ? "…" : `${heures}h`}
        </div>
      </div>

      {certifications.length > 0 && (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="text-xs font-black text-[#9a7060] uppercase tracking-wide mb-3">🎓 Certifications obtenues</div>
          <div className="space-y-2">
            {certifications.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-[#e5d5c5] p-2.5">
                <span className="text-sm font-bold text-[#2c1a10]">{c.competence || c.nom}</span>
                <span
                  className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                  style={{ color: CERT_STATUT_COLOR[c.statut], background: `${CERT_STATUT_COLOR[c.statut]}1a` }}
                >
                  {c.statut}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {planningConfigured && (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="text-xs font-black text-[#9a7060] uppercase tracking-wide mb-3">📅 Mon planning cette semaine</div>
          <div className="grid grid-cols-7 gap-1.5">
            {JOURS.map((j) => {
              const valeur = monPlanning?.[j.key] || "";
              const repos = valeur === "Repos" || valeur === "Congé";
              return (
                <div key={j.key} className="text-center">
                  <div className="text-[9px] font-bold text-[#9a7060] uppercase mb-1">{j.label}</div>
                  <div
                    className="rounded-lg py-2 text-[9px] font-black leading-tight"
                    style={{
                      background: valeur ? (repos ? "#f0e8dc" : "#f0f7e5") : "#f7efe4",
                      color: valeur ? (repos ? "#9a7060" : "#5a7828") : "#c8b4a8",
                    }}
                  >
                    {valeur || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
