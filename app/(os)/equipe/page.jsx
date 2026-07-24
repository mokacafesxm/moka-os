"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";

export default function EquipePage() {
  const router = useRouter();
  const { isAdmin } = useStaffContext();

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-dvh px-4 py-4 flex flex-col items-center justify-center text-center" style={{ background: "#f7efe4" }}>
      <div className="text-4xl mb-3">👥</div>
      <h1 className="text-xl font-black text-[#2c1a10] mb-1">Équipe</h1>
      <p className="text-sm text-[#9a7060] max-w-xs">
        Certifications, planning et heures staff arrivent dans un prochain sprint.
      </p>
    </div>
  );
}
