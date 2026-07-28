"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import { hasStaffPin } from "../shared/staffPin";
import PinEntryModal from "../shared/PinEntryModal";

const POSTES = [
  { key: "Bar", nom: "Bar", emoji: "☕" },
  { key: "Cuisine", nom: "Cuisine", emoji: "👨‍🍳" },
  { key: "Salle", nom: "Salle", emoji: "🛋" },
  { key: "Plonge", nom: "Plonge", emoji: "🚿" },
];

// Sprint 12 — mapping exact sur le champ Poste (select) du staff, remplace
// l'ancien mapping texte-libre/fuzzy sur "Rôle" (rich_text) du Sprint 11.
const POSTE_MAPPING = {
  Bar: ["Bar", "Bar Manager", "Manager Général"],
  Cuisine: ["Cuisine", "Manager Général"],
  Salle: ["Salle", "Manager Général"],
  Plonge: ["Plonge", "Manager Général"],
};

function getStaffName(member) {
  return member?.name || member?.prenom || member?.nom || "Staff";
}

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

// Sprint 13 — unlockAdmin(pin) now returns { ok, reason } instead of a plain
// boolean, since a correct PIN can still fail the Access check.
const PIN_ERROR_MESSAGES = {
  wrong_pin: "Code incorrect",
  no_staff: "Sélectionne d'abord un staff",
  no_access: "Accès admin non autorisé pour ce poste",
};

export default function SplashScreen({ onDone }) {
  const router = useRouter();
  const { staff } = useAppContext();
  const { clockStatuses, clockInAs, setStaff, unlockAdmin, unlockAdminAs, setPoste } = useStaffContext();

  const [phase, setPhase] = useState("poste"); // "poste" | "staff"
  const [selectedPoste, setSelectedPoste] = useState(null);
  const [pinGateMember, setPinGateMember] = useState(null); // staff picked but awaiting session PIN
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminStep, setAdminStep] = useState("pin"); // "pin" | "identity"
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  // Sprint 14 — Guillaume/Thibaut n'ont pas de poste opérationnel (exclus de
  // la grille phase 2 ci-dessous) donc jamais de selectedStaff à ce stade :
  // après un PIN correct, on choisit l'identité admin parmi les staff ayant
  // "Admin" dans Access, plutôt que d'exiger un staff déjà sélectionné.
  const adminEligibleStaff = staff.filter((member) => member.access?.includes("Admin"));

  // Sprint 14 — Manager Général/Admin n'ont pas de poste opérationnel : ils
  // passent uniquement par "Mode Admin →" ci-dessous, jamais par cette grille.
  const staffFiltered = selectedPoste
    ? staff.filter(
        (member) =>
          POSTE_MAPPING[selectedPoste]?.includes(member.poste) &&
          !["Manager Général", "Admin"].includes(member.poste)
      )
    : [];

  const handlePickPoste = (posteKey) => {
    setSelectedPoste(posteKey);
    setPhase("staff");
  };

  const handleBack = () => setPhase("poste");

  const proceedWithStaff = async (member) => {
    const staffName = getStaffName(member);
    const alreadyClockedIn = ["present", "pause"].includes(clockStatuses[staffName]);
    setPoste(selectedPoste);
    try {
      if (alreadyClockedIn) {
        // "Reprendre la session" — pick them up as the active session
        // without re-firing Arrivée, since they never clocked out.
        setStaff(member);
      } else {
        await clockInAs(member);
      }
      onDone();
      router.push("/poste");
    } catch (error) {
      console.error("[SplashScreen] clockInAs failed", error);
    }
  };

  // Profil → Sécurité lets a staff member set a local session PIN (per
  // device, localStorage only — see staffPin.js) : re-picking their avatar
  // here gates on that PIN before actually signing them in.
  const handlePickStaff = (member) => {
    if (hasStaffPin(member.id)) {
      setPinGateMember(member);
      return;
    }
    proceedWithStaff(member);
  };

  const closeAdminModal = () => {
    setShowAdminModal(false);
    setAdminStep("pin");
    setPin("");
    setPinError(false);
  };

  const submitPin = () => {
    const result = unlockAdmin(pin);
    if (result.ok) {
      onDone();
      return;
    }
    if ((result.reason === "no_staff" || result.reason === "no_access") && adminEligibleStaff.length > 0) {
      setAdminStep("identity");
      setPinError(false);
      return;
    }
    setPinError(PIN_ERROR_MESSAGES[result.reason] || "Code incorrect");
  };

  const submitIdentity = (member) => {
    const result = unlockAdminAs(pin, member);
    if (result.ok) {
      onDone();
    } else {
      setAdminStep("pin");
      setPinError(PIN_ERROR_MESSAGES[result.reason] || "Code incorrect");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden" style={{ background: "#f7efe4", paddingTop: "env(safe-area-inset-top)" }}>
      <div
        className="flex h-full transition-transform duration-300"
        style={{ width: "200%", transform: phase === "staff" ? "translateX(-50%)" : "translateX(0)" }}
      >
        {/* ── PHASE 1 : Sélection du poste ─────────────── */}
        <div className="w-1/2 h-full flex flex-col px-6 py-10 overflow-y-auto">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-4xl font-black text-[#2c1a10] mb-1">MÖKA</div>
            <div className="text-lg text-[#9a7060] mb-8 text-center">Bonjour 👋 · Quel est ton poste ?</div>

            <div className="w-full max-w-sm md:max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-3">
              {POSTES.map((poste) => (
                <button
                  key={poste.key}
                  type="button"
                  onClick={() => handlePickPoste(poste.key)}
                  className="w-full rounded-2xl bg-white border border-[#e5d5c5] shadow-sm py-5 px-6 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-[#f0e4d4]"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{poste.emoji}</span>
                    <span className="text-xl font-black text-[#2c1a10]">{poste.nom}</span>
                  </div>
                  <span className="text-[#a97862]">→</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="text-[11px] text-[#c8b4a8] text-center cursor-pointer py-2"
          >
            Mode Admin →
          </button>
        </div>

        {/* ── PHASE 2 : Sélection du staff ─────────────── */}
        <div className="w-1/2 h-full flex flex-col px-6 py-10 overflow-y-auto">
          <button
            type="button"
            onClick={handleBack}
            className="w-full rounded-2xl border border-[#e5d5c5] bg-white py-4 px-6 text-left font-black text-[#2c1a10] flex items-center gap-3 mb-6 cursor-pointer active:scale-[0.98] transition-all"
          >
            <span className="text-xl">←</span>
            <span>Changer de poste</span>
          </button>

          <h1 className="text-2xl font-black text-[#2c1a10] mb-6 text-center">Qui es-tu ?</h1>

          {staffFiltered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
              <div className="text-sm text-[#9a7060]">Aucun staff assigné à ce poste</div>
              <a href="/" className="text-xs font-black text-[#5a7828] underline">Voir les Paramètres</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {staffFiltered.map((member) => {
                const staffName = getStaffName(member);
                const alreadyClockedIn = ["present", "pause"].includes(clockStatuses[staffName]);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handlePickStaff(member)}
                    className="relative rounded-2xl bg-white border border-[#e5d5c5] shadow-sm p-4 flex flex-col items-center gap-2 cursor-pointer active:scale-[0.97] transition-all hover:bg-[#f0e4d4]"
                  >
                    {alreadyClockedIn && (
                      <span className="absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#f0f7e5] text-[#5a7828]">
                        En service
                      </span>
                    )}
                    <span
                      className="rounded-full flex items-center justify-center text-xl font-black text-white shrink-0"
                      style={{ width: 72, height: 72, background: "#2c1a10" }}
                    >
                      {initials(staffName)}
                    </span>
                    <span className="text-sm font-black text-[#2c1a10] text-center">{staffName}</span>
                    {member.access?.includes("OrderPad") && (
                      <span className="text-[9px] font-bold text-[#9a7060]">📋 OrderPad</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAdminModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" onClick={closeAdminModal}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-xs rounded-3xl bg-[#f7efe4] border border-[#e5d5c5] shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-1">Mode Admin</div>

            {adminStep === "pin" ? (
              <>
                <h2 className="text-lg font-black text-[#2c1a10] mb-4">Code à 4 chiffres</h2>
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  value={pin}
                  onChange={(e) => { setPin(e.target.value); setPinError(false); }}
                  onKeyDown={(e) => e.key === "Enter" && submitPin()}
                  className={`w-full rounded-xl border bg-white px-3 py-2.5 text-center text-lg tracking-[0.5em] font-black text-[#2c1a10] outline-none mb-1 ${
                    pinError ? "border-red-500" : "border-[#e5d5c5] focus:border-[#5a7828]"
                  }`}
                  placeholder="••••"
                />
                {pinError && <div className="text-xs text-red-600 font-bold mb-3">{pinError}</div>}
                <div className="flex gap-2.5 mt-3">
                  <button
                    type="button"
                    onClick={closeAdminModal}
                    className="flex-1 h-11 rounded-2xl border border-[#e5d5c5] bg-white font-black text-sm text-[#9a7060] cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={submitPin}
                    className="flex-1 h-11 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer"
                  >
                    Déverrouiller
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-black text-[#2c1a10] mb-4">Qui es-tu ?</h2>
                <div className="space-y-2 mb-3">
                  {adminEligibleStaff.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => submitIdentity(member)}
                      className="w-full rounded-2xl bg-white border border-[#e5d5c5] py-3 px-4 text-left font-black text-sm text-[#2c1a10] cursor-pointer active:scale-[0.98] transition-all hover:bg-[#f0e4d4]"
                    >
                      {getStaffName(member)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={closeAdminModal}
                  className="w-full h-11 rounded-2xl border border-[#e5d5c5] bg-white font-black text-sm text-[#9a7060] cursor-pointer"
                >
                  Annuler
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {pinGateMember && (
        <PinEntryModal
          staffId={pinGateMember.id}
          staffName={getStaffName(pinGateMember)}
          onClose={() => setPinGateMember(null)}
          onVerified={() => {
            const member = pinGateMember;
            setPinGateMember(null);
            proceedWithStaff(member);
          }}
        />
      )}
    </div>
  );
}
