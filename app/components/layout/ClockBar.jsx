"use client";

import { useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

function formatHeures(decimal) {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function getStaffName(member) {
  return member?.name || member?.prenom || member?.nom || "Staff";
}

const glassStyle = {
  background: "rgba(247, 239, 228, 0.45)",
  backdropFilter: "blur(32px) saturate(180%)",
  WebkitBackdropFilter: "blur(32px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.5)",
  boxShadow: "0 8px 32px rgba(44,26,16,0.15), inset 0 1px 0 rgba(255,255,255,0.7)",
};

export default function ClockBar() {
  const { staff } = useAppContext();
  const {
    selectedStaff,
    selectedStaffName,
    status,
    isClockedIn,
    clockSending,
    hoursWorked,
    setStaff,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
  } = useStaffContext();

  const [showPicker, setShowPicker] = useState(false);

  const handleToggle = () => {
    if (!selectedStaff) {
      setShowPicker(true);
      return;
    }
    if (status === "absent" || status === "done") clockIn();
    else if (status === "present") clockOut();
    else if (status === "pause") endBreak();
  };

  const notClockedIn = !selectedStaff || status === "absent" || status === "done";

  return (
    <div
      className="sticky top-0 z-40 px-3"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div
        className={`flex items-center justify-between gap-3 rounded-2xl px-4 my-2 ${notClockedIn ? "animate-pulse" : ""}`}
        style={{
          ...glassStyle,
          minHeight: 44,
          background: notClockedIn ? "rgba(217, 119, 6, 0.18)" : "rgba(90, 120, 40, 0.12)",
          border: notClockedIn ? "1px solid rgba(217,119,6,0.4)" : "1px solid rgba(90,120,40,0.3)",
        }}
      >
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-2 py-2 min-h-11 text-left cursor-pointer"
        >
          <span className="text-lg leading-none">👤</span>
          <div>
            <div className="text-sm font-black text-[#2c1a10] leading-tight">
              {selectedStaffName || "Sélectionner un staff"}
            </div>
            <div className={`text-[10px] font-bold uppercase tracking-wide ${notClockedIn ? "text-[#d97706]" : "text-[#5a7828]"}`}>
              {notClockedIn
                ? "Non pointé — Toucher pour pointer"
                : status === "pause"
                ? "● En pause"
                : `● En service ${formatHeures(hoursWorked)}`}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleToggle}
          disabled={clockSending}
          aria-label={isClockedIn ? "Pointer le départ" : "Pointer l'arrivée"}
          className="w-11 h-11 shrink-0 rounded-full bg-white/80 border border-[#e5d5c5] flex items-center justify-center text-lg disabled:opacity-50 cursor-pointer active:scale-95 transition-transform"
        >
          ↔️
        </button>
      </div>

      {showPicker && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-4"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 64px)" }}
          onClick={() => setShowPicker(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm rounded-3xl bg-[#f7efe4] border border-[#e5d5c5] shadow-xl p-4 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">
              Qui êtes-vous ?
            </div>
            <div className="space-y-2">
              {staff.map((member) => (
                <button
                  key={member.id || getStaffName(member)}
                  type="button"
                  onClick={() => {
                    setStaff(member);
                    setShowPicker(false);
                  }}
                  className="w-full text-left rounded-2xl border border-[#e5d5c5] bg-white px-4 py-3 font-bold text-[#2c1a10] hover:bg-[#f0e4d4] cursor-pointer transition-colors min-h-11"
                >
                  {getStaffName(member)}
                </button>
              ))}
              {staff.length === 0 && (
                <div className="text-sm text-[#9a7060] text-center py-4">Chargement de l&apos;équipe…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
