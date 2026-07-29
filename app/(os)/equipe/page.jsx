"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";

const POSTE_OPTIONS = ["Bar", "Bar Manager", "Cuisine", "Salle", "Plonge", "Manager Général"];
const ACCESS_OPTIONS = ["OrderPad", "Commandes", "Livraisons", "Admin"];

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function formatHeures(decimal) {
  const h = Math.floor(decimal || 0);
  const m = Math.round(((decimal || 0) - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function EditMemberModal({ member, onClose, onSaved }) {
  const [nom, setNom] = useState(member.name);
  const [poste, setPoste] = useState(member.poste || "");
  const [access, setAccess] = useState(member.access || []);
  const [actif, setActif] = useState(member.actif);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleAccess = (a) => {
    setAccess((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  };

  const submit = async () => {
    if (!nom.trim()) {
      setError("Nom requis");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, nom, poste, access, actif }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved({ ...member, name: nom, poste, access, actif });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">Modifier {member.name}</h2>

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nom</label>
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Poste</label>
          <select
            value={poste}
            onChange={(e) => setPoste(e.target.value)}
            className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828]"
          >
            <option value="">Sélectionner…</option>
            {POSTE_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Accès</label>
          <div className="flex flex-wrap gap-2">
            {ACCESS_OPTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAccess(a)}
                className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  access.includes(a) ? "bg-[#5a7828] text-white" : "bg-white border border-[#e5d5c5] text-[#9a7060]"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer py-1">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} className="w-4 h-4" />
          <span className="text-sm font-bold text-[#2c1a10]">Actif</span>
        </label>

        {error && <div className="text-xs font-bold text-red-600">{error}</div>}

        <div className="flex gap-3 pt-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !nom.trim()}
            className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50 hover:bg-[#4e6a22] transition-colors"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// UX audit (28 jul 2026) — chaque carte staff avait le même poids visuel,
// qu'elle soit en service ou non ; la vraie question d'un manager ("qui est
// là maintenant ?") demandait de tout scanner. Extrait en composant pour
// afficher "En service" comme groupe Niveau 2 en haut, le reste en Niveau 3.
function MemberCard({ member, enService, heures, onEdit }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          className="rounded-full flex items-center justify-center text-base font-black text-white shrink-0"
          style={{ width: 48, height: 48, background: "#2c1a10" }}
        >
          {initials(member.name)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm text-[#2c1a10]">{member.name}</span>
            {enService && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-[#f0f7e5] text-[#5a7828]">
                En service
              </span>
            )}
            <span
              className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{
                color: member.actif ? "#5a7828" : "#9a7060",
                background: member.actif ? "#f0f7e5" : "#f0e8dc",
              }}
            >
              {member.actif ? "Actif" : "Inactif"}
            </span>
          </div>
          <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
            {member.poste || "Poste non défini"}
          </div>
          <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
            {heures > 0 ? `${formatHeures(heures)} ce mois-ci` : "Aucune heure ce mois-ci"}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 h-9 px-3.5 rounded-xl bg-[#f0e8dc] text-[#2c1a10] text-xs font-black cursor-pointer hover:bg-[#e5d5c5] transition-colors"
        >
          Modifier
        </button>
      </div>
    </div>
  );
}

export default function EquipePage() {
  const router = useRouter();
  const { isAdmin, clockStatuses } = useStaffContext();

  const [staff, setStaff] = useState([]);
  const [heuresParStaff, setHeuresParStaff] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;
    setLoading(true);
    Promise.all([
      fetch("/api/staff?includeInactive=true").then((r) => r.json()),
      fetch("/api/reports?period=month").then((r) => r.json()),
    ])
      .then(([staffData, reportsData]) => {
        if (ignore) return;
        setStaff(Array.isArray(staffData) ? staffData : []);
        const heures = {};
        (reportsData?.staff?.heures || []).forEach((h) => { heures[h.nom] = h.heures; });
        setHeuresParStaff(heures);
      })
      .catch((err) => { if (!ignore) setError(err.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [isAdmin]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const sortedStaff = useMemo(
    () => [...staff].sort((a, b) => (b.actif ? 1 : 0) - (a.actif ? 1 : 0) || a.name.localeCompare(b.name, "fr")),
    [staff]
  );
  const enServiceStaff = useMemo(
    () => sortedStaff.filter((m) => ["present", "pause"].includes(clockStatuses[m.name])),
    [sortedStaff, clockStatuses]
  );
  const otherStaff = useMemo(
    () => sortedStaff.filter((m) => !["present", "pause"].includes(clockStatuses[m.name])),
    [sortedStaff, clockStatuses]
  );

  if (!isAdmin) return null;

  const handleSaved = (updated) => {
    setStaff((cur) => cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    setEditingMember(null);
    setToast({ text: `${updated.name} mis à jour`, type: "success" });
  };

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Ressources humaines</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">Équipe</h1>
      </div>

      {loading && <div className="text-center text-sm text-[#9a7060] py-10">Chargement…</div>}

      {!loading && error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-500">{error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-5">
          {sortedStaff.length === 0 && (
            <div className="text-center text-sm text-[#9a7060] py-10">Aucun membre d&apos;équipe</div>
          )}

          {enServiceStaff.length > 0 && (
            <div>
              <div className="text-[10px] font-black text-[#5a7828] uppercase tracking-[0.3em] mb-2">
                En service ({enServiceStaff.length})
              </div>
              <div className="space-y-3">
                {enServiceStaff.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    enService
                    heures={heuresParStaff[member.name] || 0}
                    onEdit={() => setEditingMember(member)}
                  />
                ))}
              </div>
            </div>
          )}

          {otherStaff.length > 0 && (
            <div>
              <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-2">
                Reste de l&apos;équipe ({otherStaff.length})
              </div>
              <div className="space-y-3">
                {otherStaff.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    enService={false}
                    heures={heuresParStaff[member.name] || 0}
                    onEdit={() => setEditingMember(member)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {editingMember && (
        <EditMemberModal member={editingMember} onClose={() => setEditingMember(null)} onSaved={handleSaved} />
      )}

      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg"
          style={{ background: toast.type === "error" ? "#b91c1c" : "#5a7828" }}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
