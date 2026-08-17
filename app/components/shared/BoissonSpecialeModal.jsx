"use client";

// Fiche de création "spécial du mois" — vue admin (pipeline complet). Voir
// /specials pour la liste. Un seul formulaire long plutôt que des onglets :
// le nombre de champs reste raisonnable et rien ne justifie de complexité
// de navigation supplémentaire pour un usage occasionnel (admin only).

import { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";

const POSTES = ["Bar", "Cuisine", "Salle", "Plonge"];
const STATUTS_PIPELINE = ["Piste", "Test 1", "Test 2", "Décision", "Lancé", "Terminé"];
const DECISIONS = ["", "KEEP", "ADJUST", "STOP"];
const LAIT_VEGETAL = ["", "Oui", "Non", "Partiel"];
const ALLERGENES = ["Gluten", "Crustacés", "Œufs", "Poissons", "Arachides", "Soja", "Lait", "Fruits à coque", "Céleri", "Moutarde", "Sésame", "Sulfites", "Lupin", "Mollusques"];
const UNITES = ["g", "kg", "ml", "l", "pièce", "unité"];

const inputClass = "w-full h-10 px-3 rounded-xl border border-[#e5d5c5] bg-white text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828]";
const textareaClass = "w-full rounded-xl border border-[#e5d5c5] bg-white px-3 py-2 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] resize-none";
const labelClass = "block text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4 space-y-3">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">{title}</div>
      {children}
    </div>
  );
}

function LigneIngredient({ ligne, ingredients, onChange, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <select
        value={ligne.ingredientId || ""}
        onChange={(e) => onChange({ ingredientId: e.target.value })}
        className={`${inputClass} flex-1`}
      >
        <option value="">Ingrédient…</option>
        {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <input
        type="number"
        step="0.01"
        value={ligne.quantite ?? ""}
        onChange={(e) => onChange({ quantite: e.target.value === "" ? null : Number(e.target.value) })}
        placeholder="Qté"
        className={`${inputClass} w-20`}
      />
      <select
        value={ligne.unite || ""}
        onChange={(e) => onChange({ unite: e.target.value })}
        className={`${inputClass} w-24`}
      >
        <option value="">—</option>
        {UNITES.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
      <button type="button" onClick={onRemove} className="w-8 h-8 shrink-0 rounded-lg bg-red-50 text-red-600 font-black text-sm cursor-pointer">×</button>
    </div>
  );
}

export default function BoissonSpecialeModal({ id, onClose, onSaved }) {
  const { products } = useAppContext();
  const [reference, setReference] = useState({ mois: [], evenements: [] });
  const [fiche, setFiche] = useState(null); // null = chargement (ou création)
  const [lignes, setLignes] = useState([]);
  const [currentId, setCurrentId] = useState(id);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState(null);

  const ingredientOptions = useMemo(
    () => (products || []).filter((p) => p.id && p.name).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [products]
  );

  useEffect(() => {
    fetch("/api/specials/reference").then((r) => r.json()).then(setReference).catch(() => {});
  }, []);

  const loadFiche = (ficheId) => {
    fetch(`/api/specials/${ficheId}`)
      .then((r) => r.json())
      .then((data) => {
        setFiche(data);
        setLignes(data.lignes || []);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    if (currentId) loadFiche(currentId);
    else setFiche({ nomProvisoire: "", posteConcerne: "", moisId: "", evenementId: "", statutPipeline: "Piste" });
  }, [currentId]);

  const set = (key) => (e) => setFiche((f) => ({ ...f, [key]: e.target.value }));
  const setChecklist = (key, value) => setFiche((f) => ({ ...f, [key]: value }));

  const createFiche = async () => {
    if (!String(fiche.nomProvisoire || "").trim()) { setError("Nom provisoire requis"); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/specials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fiche),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setCurrentId(data.id);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveFiche = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/specials/${currentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fiche),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const recalculateCost = async () => {
    setRecalculating(true);
    setError(null);
    try {
      const res = await fetch(`/api/specials/${currentId}/recalculate-cost`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setFiche((f) => ({ ...f, coutMatiereEstime: data.coutMatiereEstime }));
    } catch (err) {
      setError(err.message);
    } finally {
      setRecalculating(false);
    }
  };

  const addLigne = async () => {
    const res = await fetch("/api/specials/lignes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boissonSpecialeId: currentId, ingredientId: null, ingredientNom: "Ligne", quantite: null, unite: "" }),
    });
    const data = await res.json();
    if (data.success) setLignes((ls) => [...ls, data.item]);
  };

  const updateLigne = async (ligneId, patch) => {
    setLignes((ls) => ls.map((l) => (l.id === ligneId ? { ...l, ...patch } : l)));
    await fetch("/api/specials/lignes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ligneId, ...patch }),
    }).catch(() => {});
  };

  const removeLigne = async (ligneId) => {
    setLignes((ls) => ls.filter((l) => l.id !== ligneId));
    await fetch("/api/specials/lignes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: ligneId, actif: false }),
    }).catch(() => {});
  };

  if (!fiche) return null;
  const isNew = !currentId;

  return (
    <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#f7efe4] rounded-3xl shadow-2xl p-5 space-y-4 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#2c1a10]">{isNew ? "Nouvelle fiche" : fiche.nomProvisoire}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] cursor-pointer font-black">×</button>
        </div>

        {error && <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-500">{error}</div>}

        <Section title="Identité">
          <Field label="Nom provisoire">
            <input value={fiche.nomProvisoire || ""} onChange={set("nomProvisoire")} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Poste concerné">
              <select value={fiche.posteConcerne || ""} onChange={set("posteConcerne")} className={inputClass}>
                <option value="">—</option>
                {POSTES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Statut pipeline">
              <select value={fiche.statutPipeline || "Piste"} onChange={set("statutPipeline")} className={inputClass}>
                {STATUTS_PIPELINE.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Mois">
              <select value={fiche.moisId || ""} onChange={set("moisId")} className={inputClass}>
                <option value="">—</option>
                {reference.mois.map((m) => <option key={m.id} value={m.id}>{m.mois}</option>)}
              </select>
            </Field>
            <Field label="Événement">
              <select value={fiche.evenementId || ""} onChange={set("evenementId")} className={inputClass}>
                <option value="">—</option>
                {reference.evenements.map((ev) => <option key={ev.id} value={ev.id}>{ev.nom}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        {isNew ? (
          <button type="button" onClick={createFiche} disabled={saving} className="w-full h-12 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
            {saving ? "Création…" : "Créer la fiche →"}
          </button>
        ) : (
          <>
            <Section title="Concept">
              <Field label="Objectif client">
                <textarea value={fiche.objectifClient || ""} onChange={set("objectifClient")} rows={2} className={textareaClass} />
              </Field>
              <Field label="Inspiration / tendance">
                <textarea value={fiche.inspirationTendance || ""} onChange={set("inspirationTendance")} rows={2} className={textareaClass} />
              </Field>
              <Field label="Visuel / couleur / dressage">
                <textarea value={fiche.visuelDescription || ""} onChange={set("visuelDescription")} rows={2} className={textareaClass} />
              </Field>
            </Section>

            <Section title="Ingrédients & coût">
              <div className="space-y-2">
                {lignes.map((l) => (
                  <LigneIngredient
                    key={l.id}
                    ligne={l}
                    ingredients={ingredientOptions}
                    onChange={(patch) => updateLigne(l.id, patch)}
                    onRemove={() => removeLigne(l.id)}
                  />
                ))}
              </div>
              <button type="button" onClick={addLigne} className="text-xs font-black text-[#5a7828] cursor-pointer">+ Ajouter un ingrédient</button>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#f0e8dc]">
                <div>
                  <span className={labelClass}>Coût matière</span>
                  <div className="text-sm font-black text-[#2c1a10] h-10 flex items-center">
                    {fiche.coutMatiereEstime != null ? `${fiche.coutMatiereEstime} €` : "—"}
                  </div>
                </div>
                <Field label="Prix cible (€)">
                  <input type="number" step="0.01" value={fiche.prixCible ?? ""} onChange={set("prixCible")} className={inputClass} />
                </Field>
                <div>
                  <span className={labelClass}>Marge estimée</span>
                  <div className="text-sm font-black text-[#5a7828] h-10 flex items-center">
                    {fiche.margeEstimee != null ? `${fiche.margeEstimee} €` : "—"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={recalculateCost}
                disabled={recalculating}
                className="w-full h-10 rounded-xl border border-dashed border-[#c8b4a8] text-[#9a7060] text-xs font-black cursor-pointer disabled:opacity-50"
              >
                {recalculating ? "Calcul…" : "🔄 Recalculer le coût matière"}
              </button>
            </Section>

            <Section title="Production">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Temps cible (min)">
                  <input type="number" value={fiche.tempsCibleProduction ?? ""} onChange={set("tempsCibleProduction")} className={inputClass} />
                </Field>
                <Field label="Nombre de gestes">
                  <input type="number" value={fiche.nombreGestes ?? ""} onChange={set("nombreGestes")} className={inputClass} />
                </Field>
              </div>
              <Field label="Matériel nécessaire">
                <textarea value={fiche.materielNecessaire || ""} onChange={set("materielNecessaire")} rows={2} className={textareaClass} />
              </Field>
              <Field label="Compatibilité lait végétal">
                <select value={fiche.compatibiliteLaitVegetal || ""} onChange={set("compatibiliteLaitVegetal")} className={inputClass}>
                  {LAIT_VEGETAL.map((v) => <option key={v} value={v}>{v || "—"}</option>)}
                </select>
              </Field>
              <div>
                <span className={labelClass}>Allergènes / HACCP</span>
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENES.map((a) => {
                    const active = (fiche.allergenesHaccp || []).includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setChecklist("allergenesHaccp", active
                          ? (fiche.allergenesHaccp || []).filter((x) => x !== a)
                          : [...(fiche.allergenesHaccp || []), a])}
                        className={`px-2.5 py-1.5 rounded-full text-[10px] font-black cursor-pointer ${active ? "bg-[#2c1a10] text-white" : "bg-[#f0e8dc] text-[#9a7060]"}`}
                      >
                        {a}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section title="Tests & avis">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Test 1 — résultat">
                  <textarea value={fiche.test1Resultat || ""} onChange={set("test1Resultat")} rows={2} className={textareaClass} />
                </Field>
                <Field label="Test 2 — résultat">
                  <textarea value={fiche.test2Resultat || ""} onChange={set("test2Resultat")} rows={2} className={textareaClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Avis Manon (image/storytelling)">
                  <textarea value={fiche.avisManon || ""} onChange={set("avisManon")} rows={2} className={textareaClass} />
                </Field>
                <Field label="Avis Thibault (opérabilité)">
                  <textarea value={fiche.avisThibault || ""} onChange={set("avisThibault")} rows={2} className={textareaClass} />
                </Field>
              </div>
            </Section>

            <Section title="Décision & lancement">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Décision">
                  <select value={fiche.decision || ""} onChange={set("decision")} className={inputClass}>
                    {DECISIONS.map((d) => <option key={d} value={d}>{d || "—"}</option>)}
                  </select>
                </Field>
                <Field label="Date de lancement">
                  <input type="date" value={fiche.dateLancement || ""} onChange={set("dateLancement")} className={inputClass} />
                </Field>
              </div>
            </Section>

            <Section title="Bilan après 30 jours">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Ventes"><textarea value={fiche.bilanVentes30j || ""} onChange={set("bilanVentes30j")} rows={2} className={textareaClass} /></Field>
                <Field label="Marge"><textarea value={fiche.bilanMarge30j || ""} onChange={set("bilanMarge30j")} rows={2} className={textareaClass} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Retours"><textarea value={fiche.bilanRetours30j || ""} onChange={set("bilanRetours30j")} rows={2} className={textareaClass} /></Field>
                <Field label="Décision finale"><textarea value={fiche.bilanDecisionFinale || ""} onChange={set("bilanDecisionFinale")} rows={2} className={textareaClass} /></Field>
              </div>
            </Section>

            <button type="button" onClick={saveFiche} disabled={saving} className="w-full h-12 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
