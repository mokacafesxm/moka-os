"use client";

// Same isAdmin gate + redirect as every other admin page (/specials,
// /incidents, /rapports…) — see StaffContext.jsx. That gate is client-side
// only and cosmetic; the AdminAuthProvider below it is what actually
// protects the Notion reads/writes, via the Basic Auth check in
// middleware.js on every /api/admin/* call.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { AdminAuthProvider, useAdminAuth } from "./_lib/AdminAuthProvider";
import AdminUnlockForm from "./_components/AdminUnlockForm";

function Gate({ children }) {
  const { unlocked } = useAdminAuth();
  if (!unlocked) return <AdminUnlockForm />;
  return <div style={{ background: "#f7efe4" }}>{children}</div>;
}

export default function AdminLayout({ children }) {
  const router = useRouter();
  const { isAdmin } = useStaffContext();

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <AdminAuthProvider>
      <Gate>{children}</Gate>
    </AdminAuthProvider>
  );
}
