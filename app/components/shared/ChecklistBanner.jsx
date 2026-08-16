"use client";

// Invitation visible (jamais une redirection forcée) à ouvrir la checklist
// en attente — surfacée sur n'importe quel écran via le même polling 8s que
// le reste de l'app (RealTimeContext.subscribe), pas un second mécanisme.
// Voir /checklist pour l'écran de complétion.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useRealTime } from "../../contexts/RealTimeContext";

export default function ChecklistBanner() {
  const { selectedStaff, isAdmin } = useStaffContext();
  const { subscribe } = useRealTime();
  const pathname = usePathname();
  const staffId = selectedStaff?.id;

  const [pendingCount, setPendingCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!staffId) { setPendingCount(0); return; }
    try {
      const res = await fetch(`/api/checklist-status?staffId=${staffId}`);
      const data = await res.json();
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch (error) {
      console.error("[ChecklistBanner] refresh failed", error);
    }
  }, [staffId]);

  useEffect(() => { refresh(); }, [refresh]);
  // Nouvelle session (changement de staff) -> le bandeau redevient visible
  // même s'il avait été ignoré pour la personne précédente.
  useEffect(() => { setDismissed(false); }, [staffId]);
  useEffect(() => subscribe(refresh), [subscribe, refresh]);

  if (isAdmin || !staffId || pendingCount === 0 || dismissed || pathname === "/checklist") return null;

  return (
    <div className="mx-4 mt-3 rounded-2xl p-3 flex items-center gap-3" style={{ background: "#d97706" }}>
      <Link href="/checklist" className="flex-1 text-white text-sm font-black cursor-pointer">
        📋 {pendingCount} tâche{pendingCount > 1 ? "s" : ""} de checklist à faire →
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Ignorer pour l'instant"
        className="text-white/80 text-lg font-black cursor-pointer px-1 leading-none"
      >
        ×
      </button>
    </div>
  );
}
