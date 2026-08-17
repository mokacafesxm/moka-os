"use client";

// Page complète pour /checklist — même contenu que ChecklistModal (voir
// ChecklistRunner.jsx), utilisée quand on arrive ici sans passer par le
// pointage (ex. lien depuis ChecklistBanner sur n'importe quel écran, ou
// depuis /poste). Le flux de pointage "Comptage" (SplashScreen) passe par
// la modale, pas par cette page — voir ChecklistModal.jsx.

import { useRouter, useSearchParams } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import ChecklistRunner from "../../components/shared/ChecklistRunner";

export default function ChecklistPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedStaff } = useStaffContext();
  // ?staffId= explicite (ex. lien direct) — prioritaire sur la session
  // active, pour ne jamais avoir besoin d'en ouvrir une séparée juste pour
  // voir la checklist d'une autre personne.
  const staffId = searchParams.get("staffId") || selectedStaff?.id;

  return (
    <div className="min-h-dvh px-4 py-4" style={{ background: "#f7efe4" }}>
      <ChecklistRunner staffId={staffId} onFinished={() => router.push("/poste")} />
    </div>
  );
}
