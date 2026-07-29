"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import { simpleHash } from "../../contexts/StaffContext";

const TABS = [
  { key: "suppliers", label: "Fournisseurs" },
  { key: "staff", label: "Staff" },
  { key: "categories", label: "Catégories" },
  { key: "sousCategories", label: "Sous-catégories" },
  { key: "unites", label: "Unités" },
  { key: "zones", label: "Zones stockage" },
  { key: "securite", label: "Sécurité" },
];

const inputClass = "w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]";

function PillsNav({ tab, setTab }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setTab(t.key)}
          className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap cursor-pointer transition-colors ${
            tab === t.key ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
      <div
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-[#2c1a10]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] cursor-pointer font-black"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl text-sm font-bold text-white shadow-lg"
      style={{ background: toast.type === "error" ? "#b91c1c" : "#5a7828" }}
    >
      {toast.text}
    </div>
  );
}

// ── A. Fournisseurs ────────────────────────────────────────────────────────

const EMPTY_SUPPLIER = { nom: "", categorie: "", telephone: "", email: "", methodeContact: "" };

function FournisseursSection({ suppliers, refresh, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // supplier object being edited, or null for create
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const openCreate = () => { setEditing(null); setForm(EMPTY_SUPPLIER); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ nom: s.name, categorie: s.categorie || "", telephone: s.telephone || s.whatsapp || "", email: s.email || "", methodeContact: s.methodeContact || "" });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.nom.trim()) { showToast("Nom requis", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/suppliers", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || `Erreur ${res.status}`);
      showToast(editing ? "Fournisseur mis à jour" : "Fournisseur ajouté");
      setShowModal(false);
      await refresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (pendingDelete !== s.id) {
      setPendingDelete(s.id);
      showToast("Cliquez à nouveau pour confirmer");
      setTimeout(() => setPendingDelete((cur) => (cur === s.id ? null : cur)), 3000);
      return;
    }
    setPendingDelete(null);
    try {
      const res = await fetch("/api/settings/suppliers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || `Erreur ${res.status}`);
      showToast("Fournisseur supprimé");
      await refresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  };

  return (
    <div className="space-y-3">
      {suppliers.map((s) => (
        <div key={s.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-black text-sm text-[#2c1a10]">{s.name}</div>
              <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
                {[s.categorie, s.telephone || s.whatsapp, s.email].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" onClick={() => openEdit(s)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] cursor-pointer">✏️</button>
              <button
                type="button"
                onClick={() => remove(s)}
                className={`w-8 h-8 rounded-lg cursor-pointer ${pendingDelete === s.id ? "bg-red-500 text-white" : "bg-[#f0e8dc]"}`}
              >
                🗑
              </button>
            </div>
          </div>
        </div>
      ))}
      {suppliers.length === 0 && <div className="text-center text-sm text-[#9a7060] py-6">Aucun fournisseur</div>}

      <button type="button" onClick={openCreate} className="w-full h-11 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer">
        + Nouveau
      </button>

      {showModal && (
        <ModalShell title={editing ? "Modifier le fournisseur" : "Nouveau fournisseur"} onClose={() => setShowModal(false)}>
          <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Nom" className={inputClass} />
          <input value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} placeholder="Catégorie" className={inputClass} />
          <input value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} placeholder="WhatsApp / Téléphone" className={inputClass} />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={inputClass} />
          <select value={form.methodeContact} onChange={(e) => setForm((f) => ({ ...f, methodeContact: e.target.value }))} className={inputClass}>
            <option value="">Méthode de contact…</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Email">Email</option>
          </select>
          <button type="button" onClick={save} disabled={saving} className="w-full h-11 rounded-xl bg-[#5a7828] text-white text-sm font-black cursor-pointer disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </ModalShell>
      )}
    </div>
  );
}

// ── B. Staff ────────────────────────────────────────────────────────────────

const POSTE_OPTIONS = ["Bar", "Bar Manager", "Cuisine", "Salle", "Plonge", "Manager Général"];
const ACCESS_OPTIONS = ["OrderPad", "Commandes", "Livraisons", "Admin"];
const EMPTY_STAFF = { nom: "", categorie: "", poste: "", access: [], telephone: "", email: "", actif: true };

function StaffSection({ staff, refresh, showToast }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_STAFF);
  const [saving, setSaving] = useState(false);
  const [pendingDeactivate, setPendingDeactivate] = useState(null);

  const openCreate = () => { setEditing(null); setForm(EMPTY_STAFF); setShowModal(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ nom: s.name, categorie: s.categorie || s.role || "", poste: s.poste || "", access: s.access || [], telephone: s.telephone || "", email: s.email || "", actif: s.actif !== false });
    setShowModal(true);
  };

  const toggleAccess = (a) => setForm((f) => ({ ...f, access: f.access.includes(a) ? f.access.filter((x) => x !== a) : [...f.access, a] }));

  const save = async () => {
    if (!form.nom.trim()) { showToast("Nom requis", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/staff", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || `Erreur ${res.status}`);
      showToast(editing ? "Staff mis à jour" : "Staff ajouté");
      setShowModal(false);
      await refresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (s) => {
    if (pendingDeactivate !== s.id) {
      setPendingDeactivate(s.id);
      showToast("Cliquez à nouveau pour confirmer");
      setTimeout(() => setPendingDeactivate((cur) => (cur === s.id ? null : cur)), 3000);
      return;
    }
    setPendingDeactivate(null);
    try {
      const res = await fetch("/api/settings/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: s.id, nom: s.name, actif: false }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || `Erreur ${res.status}`);
      showToast("Staff désactivé");
      await refresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  };

  return (
    <div className="space-y-3">
      {staff.map((s) => (
        <div key={s.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-4 flex items-start gap-3">
          <span className="rounded-full flex items-center justify-center text-sm font-black text-white shrink-0" style={{ width: 40, height: 40, background: "#2c1a10" }}>
            {initials(s.name)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-sm text-[#2c1a10]">{s.name}</span>
              <span
                className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{ color: s.actif ? "#5a7828" : "#9a7060", background: s.actif ? "#f0f7e5" : "#f0e8dc" }}
              >
                {s.actif ? "Actif" : "Inactif"}
              </span>
            </div>
            <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
              {[s.poste, (s.access || []).join(", ")].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button type="button" onClick={() => openEdit(s)} className="w-8 h-8 rounded-lg bg-[#f0e8dc] cursor-pointer">✏️</button>
            <button
              type="button"
              onClick={() => deactivate(s)}
              className={`w-8 h-8 rounded-lg cursor-pointer ${pendingDeactivate === s.id ? "bg-red-500 text-white" : "bg-[#f0e8dc]"}`}
            >
              🗑
            </button>
          </div>
        </div>
      ))}
      {staff.length === 0 && <div className="text-center text-sm text-[#9a7060] py-6">Aucun membre</div>}

      <button type="button" onClick={openCreate} className="w-full h-11 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer">
        + Nouveau
      </button>

      {showModal && (
        <ModalShell title={editing ? "Modifier le staff" : "Nouveau membre"} onClose={() => setShowModal(false)}>
          <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Nom" className={inputClass} />
          <select value={form.poste} onChange={(e) => setForm((f) => ({ ...f, poste: e.target.value }))} className={inputClass}>
            <option value="">Poste…</option>
            {POSTE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <div>
            <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Accès</label>
            <div className="flex flex-wrap gap-2">
              {ACCESS_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAccess(a)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                    form.access.includes(a) ? "bg-[#5a7828] text-white" : "bg-white border border-[#e5d5c5] text-[#9a7060]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <input value={form.telephone} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} placeholder="Téléphone" className={inputClass} />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={inputClass} />
          <label className="flex items-center gap-2.5 cursor-pointer py-1">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm font-bold text-[#2c1a10]">Actif</span>
          </label>
          <button type="button" onClick={save} disabled={saving} className="w-full h-11 rounded-xl bg-[#5a7828] text-white text-sm font-black cursor-pointer disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </ModalShell>
      )}
    </div>
  );
}

// ── C-F. Référentiels (catégories / sous-catégories / unités / zones) ──────

const REF_CONFIG = {
  categories: { label: "catégorie", fields: ["nom", "emoji", "ordre"] },
  sousCategories: { label: "sous-catégorie", fields: ["nom", "categorie", "ordre"] },
  unites: { label: "unité", fields: ["nom", "abreviation", "uniteType"] },
  zones: { label: "zone", fields: ["nom", "emoji", "temperature"] },
};

function ReferentielSection({ type, items, categories, refresh, showToast }) {
  const config = REF_CONFIG[type];
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nom: "", emoji: "", ordre: "", categorie: "", abreviation: "", uniteType: "", temperature: "" });
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState(false);

  const save = async () => {
    if (!form.nom.trim()) { showToast("Nom requis", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/referentiels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...form }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || `Erreur ${res.status}`);
      showToast(`${config.label} ajoutée`);
      setShowModal(false);
      setForm({ nom: "", emoji: "", ordre: "", categorie: "", abreviation: "", uniteType: "", temperature: "" });
      await refresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (pendingDelete !== item.id) {
      setPendingDelete(item.id);
      showToast("Cliquez à nouveau pour confirmer");
      setTimeout(() => setPendingDelete((cur) => (cur === item.id ? null : cur)), 3000);
      return;
    }
    setPendingDelete(null);
    try {
      const res = await fetch("/api/settings/referentiels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error("Erreur suppression");
      showToast("Supprimé");
      await refresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    }
  };

  const importFromIngredients = async () => {
    if (!pendingImport) {
      setPendingImport(true);
      showToast("Cliquez à nouveau pour confirmer l'import");
      setTimeout(() => setPendingImport(false), 3000);
      return;
    }
    setPendingImport(false);
    setImporting(true);
    try {
      const res = await fetch("/api/settings/referentiels/import", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
      showToast(`Import terminé — +${data.imported?.categories ?? 0} cat. · +${data.imported?.sousCategories ?? 0} sous-cat. · +${data.imported?.zones ?? 0} zones · +${data.imported?.unites ?? 0} unités`);
      await refresh();
    } catch (err) {
      showToast("Erreur : " + err.message, "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-3">
      {type === "categories" && (
        <button
          type="button"
          onClick={importFromIngredients}
          disabled={importing}
          className={`w-full h-11 rounded-xl text-xs font-black cursor-pointer disabled:opacity-50 ${pendingImport ? "bg-red-500 text-white" : "bg-[#f0e8dc] text-[#2c1a10]"}`}
        >
          {importing ? "Import…" : pendingImport ? "Cliquez à nouveau pour confirmer" : "⬇ Importer depuis Matières premières"}
        </button>
      )}

      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-[#e5d5c5] bg-white p-4 flex items-center justify-between gap-2">
          <div>
            <div className="font-black text-sm text-[#2c1a10]">
              {item.emoji ? `${item.emoji} ` : ""}{item.nom}
            </div>
            <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5">
              {type === "sousCategories" && (item.categorie || "—")}
              {type === "unites" && [item.abreviation, item.uniteType].filter(Boolean).join(" · ")}
              {type === "zones" && (item.temperature || "—")}
              {type === "categories" && `Ordre ${item.ordre ?? "—"}`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => remove(item)}
            className={`w-8 h-8 rounded-lg shrink-0 cursor-pointer ${pendingDelete === item.id ? "bg-red-500 text-white" : "bg-[#f0e8dc]"}`}
          >
            🗑
          </button>
        </div>
      ))}
      {items.length === 0 && <div className="text-center text-sm text-[#9a7060] py-6">Aucune entrée</div>}

      <button type="button" onClick={() => setShowModal(true)} className="w-full h-11 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer">
        + Nouveau
      </button>

      {showModal && (
        <ModalShell title={`Nouvelle ${config.label}`} onClose={() => setShowModal(false)}>
          <input value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} placeholder="Nom" className={inputClass} />
          {config.fields.includes("emoji") && (
            <input value={form.emoji} onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))} placeholder="Emoji" className={inputClass} />
          )}
          {config.fields.includes("ordre") && (
            <input type="number" value={form.ordre} onChange={(e) => setForm((f) => ({ ...f, ordre: e.target.value }))} placeholder="Ordre" className={inputClass} />
          )}
          {config.fields.includes("categorie") && (
            <select value={form.categorie} onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))} className={inputClass}>
              <option value="">Catégorie parente…</option>
              {categories.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
            </select>
          )}
          {config.fields.includes("abreviation") && (
            <input value={form.abreviation} onChange={(e) => setForm((f) => ({ ...f, abreviation: e.target.value }))} placeholder="Abréviation" className={inputClass} />
          )}
          {config.fields.includes("uniteType") && (
            <input value={form.uniteType} onChange={(e) => setForm((f) => ({ ...f, uniteType: e.target.value }))} placeholder="Type (ex: stock, commande)" className={inputClass} />
          )}
          {config.fields.includes("temperature") && (
            <input value={form.temperature} onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))} placeholder="Température (ex: Frigo, Sec)" className={inputClass} />
          )}
          <button type="button" onClick={save} disabled={saving} className="w-full h-11 rounded-xl bg-[#5a7828] text-white text-sm font-black cursor-pointer disabled:opacity-50">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </ModalShell>
      )}
    </div>
  );
}

// ── G. Sécurité ─────────────────────────────────────────────────────────────

function SecuriteSection({ showToast }) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const savePin = () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast("Le code doit faire 4 chiffres", "error");
      return;
    }
    if (newPin !== confirmPin) {
      showToast("Les codes ne correspondent pas", "error");
      return;
    }
    localStorage.setItem("mokaPinCode", simpleHash(newPin));
    showToast("Code admin mis à jour ✅");
    setNewPin("");
    setConfirmPin("");
  };

  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4 space-y-3">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Modifier le PIN admin</div>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={newPin}
        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
        placeholder="Nouveau code (4 chiffres)"
        className={`${inputClass} text-center tracking-[0.5em]`}
      />
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={confirmPin}
        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
        placeholder="Confirmer le code"
        className={`${inputClass} text-center tracking-[0.5em]`}
      />
      <button type="button" onClick={savePin} className="w-full h-11 rounded-xl bg-[#5a7828] text-white text-sm font-black cursor-pointer">
        Enregistrer le nouveau code
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ParametresPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useStaffContext();
  const { suppliers, staff, referentiels, refreshAll } = useAppContext();
  // Permet un lien direct depuis une autre page (ex: /parametres?section=categories
  // depuis Stock "+ Ajouter une catégorie") sans passer par le menu Fournisseurs par défaut.
  const [tab, setTab] = useState(() => {
    const section = searchParams.get("section");
    return TABS.some((t) => t.key === section) ? section : "suppliers";
  });
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!isAdmin) router.replace("/home");
  }, [isAdmin, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!isAdmin) return null;

  const showToast = (text, type = "success") => setToast({ text, type });

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4 md:max-w-2xl md:mx-auto" style={{ background: "#f7efe4" }}>
      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Admin</div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">⚙️ Paramètres</h1>
      </div>

      <PillsNav tab={tab} setTab={setTab} />

      {tab === "suppliers" && <FournisseursSection suppliers={suppliers} refresh={refreshAll} showToast={showToast} />}
      {tab === "staff" && <StaffSection staff={staff} refresh={refreshAll} showToast={showToast} />}
      {tab === "categories" && <ReferentielSection type="categories" items={referentiels.categories} categories={referentiels.categories} refresh={refreshAll} showToast={showToast} />}
      {tab === "sousCategories" && <ReferentielSection type="sousCategories" items={referentiels.sousCategories} categories={referentiels.categories} refresh={refreshAll} showToast={showToast} />}
      {tab === "unites" && <ReferentielSection type="unites" items={referentiels.unites} categories={referentiels.categories} refresh={refreshAll} showToast={showToast} />}
      {tab === "zones" && <ReferentielSection type="zones" items={referentiels.zones} categories={referentiels.categories} refresh={refreshAll} showToast={showToast} />}
      {tab === "securite" && <SecuriteSection showToast={showToast} />}

      <Toast toast={toast} />
    </div>
  );
}
