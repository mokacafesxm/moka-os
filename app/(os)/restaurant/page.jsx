"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

export default function RestaurantPage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();
  const { zonesPhysiques, equipements, taches } = useAppContext();

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Restaurant</div>
      <h1 className="text-xl font-black text-[#2c1a10] -mt-3">Zones physiques</h1>

      <div className="space-y-3">
        {zonesPhysiques.map((zone) => {
          const zoneTaches = taches.filter((t) => t.zoneId === zone.id).length;
          const zoneEquipements = equipements.filter((e) => e.zoneId === zone.id).length;
          return (
            <div key={zone.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{zone.emoji || "📍"}</span>
                <div>
                  <div className="font-black text-base text-[#2c1a10]">{zone.nom}</div>
                  {zone.description && <div className="text-xs text-[#9a7060]">{zone.description}</div>}
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-xs font-bold text-[#9a7060]">
                <span>{zoneTaches} tâche{zoneTaches !== 1 ? "s" : ""}</span>
                <span>{zoneEquipements} équipement{zoneEquipements !== 1 ? "s" : ""}</span>
                {zone.responsablePoste && <span>Responsable : {zone.responsablePoste}</span>}
              </div>
            </div>
          );
        })}
        {zonesPhysiques.length === 0 && (
          <div className="text-center text-sm text-[#9a7060] py-10">Aucune zone configurée</div>
        )}
      </div>
    </div>
  );
}
