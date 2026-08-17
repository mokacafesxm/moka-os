"use client";

// Contenu de complétion des checklists opérationnelles (Bar Manager
// Operating System v1.0) — une tâche à la fois, même pattern visuel que
// WorkflowRunner (barre de progression, une carte, Retour/Valider), mais
// piloté par les données Notion (Bar_Checklist_Templates/Instances) plutôt
// que des étapes codées en dur. La décision "Non conforme" (ex. température
// hors plage) et la déclaration d'incident qui en découle sont calculées
// côté serveur — voir /api/checklist-instances.
//
// Composant de contenu pur (pas de wrapper plein écran) : partagé entre
// /checklist (page complète) et ChecklistModal (overlay sans navigation,
// voir SplashScreen) — le style d'enrobage est décidé par l'appelant.

import { useEffect, useMemo, useState } from "react";

function CenteredMessage({ emoji, title, subtitle, children }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-10">
      {emoji && <div className="text-5xl mb-3">{emoji}</div>}
      <h1 className="text-xl font-black text-[#2c1a10] mb-1">{title}</h1>
      {subtitle && <p className="text-sm text-[#9a7060] mb-6">{subtitle}</p>}
      {children}
    </div>
  );
}

export default function ChecklistRunner({ staffId, onFinished, finishedLabel = "Retour à Mon Poste" }) {
  const [items, setItems] = useState(null); // null = chargement
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!staffId) { setItems([]); return; }
    fetch(`/api/checklist-status?staffId=${staffId}`)
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("[ChecklistRunner] fetch failed", err);
        setItems([]);
      });
  }, [staffId]);

  const item = items?.[index];
  const template = item?.template;

  useEffect(() => {
    setValue("");
    setPhotoPreview(null);
    setError(null);
  }, [index]);

  const outOfRange = useMemo(() => {
    if (template?.typePreuve !== "Chiffre" || value === "" || template.tempMin === null || template.tempMax === null) return false;
    const n = Number(value);
    return !Number.isNaN(n) && (n < template.tempMin || n > template.tempMax);
  }, [template, value]);

  async function submit(ignore) {
    if (!item) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = { instanceId: item.id, staffId, ignore };
      if (!ignore && template?.typePreuve === "Texte") body.preuveTexte = value;
      if (!ignore && template?.typePreuve === "Chiffre") body.preuveChiffre = value === "" ? null : Number(value);
      if (!ignore && template?.typePreuve === "Photo") {
        body.preuveTexte = photoPreview ? "Photo prise (aperçu local, non hébergée)" : "";
      }

      const res = await fetch("/api/checklist-instances", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

      setIndex((i) => i + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!staffId) {
    return <CenteredMessage title="Aucune session active." />;
  }
  if (items === null) {
    return <CenteredMessage title="Chargement…" />;
  }
  if (items.length === 0) {
    return (
      <CenteredMessage emoji="✅" title="Aucune tâche en attente">
        <button
          type="button"
          onClick={onFinished}
          className="h-12 px-6 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
        >
          {finishedLabel}
        </button>
      </CenteredMessage>
    );
  }
  if (index >= items.length) {
    return (
      <CenteredMessage emoji="✅" title="Checklist terminée" subtitle="Toutes les tâches ont été enregistrées.">
        <button
          type="button"
          onClick={onFinished}
          className="h-12 px-6 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
        >
          {finishedLabel}
        </button>
      </CenteredMessage>
    );
  }

  const canSubmit = template?.typePreuve !== "Chiffre" || value !== "";

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 justify-center">
        {items.map((it, i) => (
          <span
            key={it.id}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === index ? "24px" : "8px",
              background: i < index ? "#5a7828" : i === index ? "#2c1a10" : "#e5d5c5",
            }}
          />
        ))}
      </div>

      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">
          Checklist {item.poste} · Étape {index + 1}/{items.length}
        </div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">{template?.tache || item.nom}</h1>
        {template?.declencheur && <p className="text-sm text-[#9a7060] mt-1">{template.declencheur}</p>}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-500">{error}</div>
      )}

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        {template?.typePreuve === "Aucune" && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value === "ok"}
              onChange={(e) => setValue(e.target.checked ? "ok" : "")}
              className="w-5 h-5 accent-[#5a7828]"
            />
            <span className="text-sm font-bold text-[#2c1a10]">Confirmé</span>
          </label>
        )}

        {template?.typePreuve === "Texte" && (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] resize-none"
            placeholder={template.preuveDetail || "…"}
          />
        )}

        {template?.typePreuve === "Chiffre" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={template.tempMin !== null ? `Ex : ${template.tempMin}` : ""}
                className="h-11 px-4 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] text-sm font-bold text-[#2c1a10] outline-none focus:border-[#5a7828] w-32"
              />
              {template.tempMin !== null && template.tempMax !== null && (
                <span className="text-xs text-[#9a7060]">(plage attendue : {template.tempMin} à {template.tempMax})</span>
              )}
            </div>
            {outOfRange && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-500">
                Valeur hors plage — un incident sera déclaré automatiquement à la validation.
              </div>
            )}
          </div>
        )}

        {template?.typePreuve === "Photo" && (
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPhotoPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm text-[#2c1a10]"
            />
            {photoPreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Aperçu" className="rounded-xl max-h-48 object-cover" />
            )}
            <p className="text-[11px] text-[#9a7060]">
              Aperçu local uniquement — aucun hébergement cloud configuré pour l&apos;instant.
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={() => submit(true)}
          disabled={submitting}
          className="flex-1 h-12 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer border border-[#e5d5c5] bg-white disabled:opacity-50"
        >
          Ignorer
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          disabled={!canSubmit || submitting}
          className="flex-1 h-12 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50"
        >
          {submitting ? "Enregistrement…" : "Valider →"}
        </button>
      </div>
    </div>
  );
}
