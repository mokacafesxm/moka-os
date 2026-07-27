"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

function isLoggable(step, value) {
  switch (step.type) {
    case "checkbox": return value === true;
    case "checklist": return Array.isArray(value) && value.some(Boolean);
    case "temperature": return value !== "" && value !== undefined && !Number.isNaN(Number(value));
    case "photo": return Boolean(value);
    case "text": return Boolean(value && value.trim());
    case "stock-check": return value && Object.keys(value).length > 0;
    default: return false;
  }
}

function canProceed(step, value) {
  switch (step.type) {
    case "checkbox": return value === true;
    case "checklist": return Array.isArray(value) && (step.items || []).every((_, i) => value[i] === true);
    case "temperature": return value !== "" && value !== undefined && !Number.isNaN(Number(value));
    case "stock-check": return (step.items || []).every((_, i) => value?.[i] !== undefined);
    case "photo": return true;
    case "text": return true;
    default: return true;
  }
}

function stepStatut(step, value) {
  switch (step.type) {
    case "checkbox": return value === true ? "Fait" : "Ignoré";
    case "checklist": {
      const checked = (value || []).filter(Boolean).length;
      if (checked === 0) return "Ignoré";
      return checked === (step.items || []).length ? "Fait" : "Partiel";
    }
    case "stock-check": {
      const states = Object.values(value || {});
      if (states.length === 0) return "Ignoré";
      return states.every((s) => s === "ok") ? "Fait" : "Partiel";
    }
    default: return "Fait";
  }
}

function stepNotes(step, value) {
  switch (step.type) {
    case "checklist":
      return (step.items || []).map((label, i) => `${value?.[i] ? "✓" : "✗"} ${label}`).join(" · ");
    case "stock-check":
      return (step.items || []).map((label, i) => `${label}: ${value?.[i] === "manque" ? "MANQUE" : "OK"}`).join(" · ");
    case "text":
      return value || "";
    case "photo":
      return value ? "Photo prise (aperçu local, non hébergée — pas de stockage cloud configuré)" : "";
    case "checkbox":
      return step.description || "";
    default:
      return "";
  }
}

function outOfRange(step, value) {
  if (step.type !== "temperature") return false;
  const n = Number(value);
  if (value === "" || value === undefined || Number.isNaN(n)) return false;
  return n < step.min || n > step.max;
}

export default function WorkflowRunner({ workflow }) {
  const router = useRouter();
  const { selectedStaff } = useStaffContext();
  const { zonesPhysiques } = useAppContext();

  const steps = workflow.steps;
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState(null);
  const [incidentDeclared, setIncidentDeclared] = useState({});
  const [incidentDeclaring, setIncidentDeclaring] = useState(false);

  const zoneId = useMemo(
    () => (workflow.zone ? zonesPhysiques.find((z) => z.nom === workflow.zone)?.id || null : null),
    [zonesPhysiques, workflow.zone]
  );

  const step = steps[stepIndex];
  const value = answers[step.key];
  const isLast = stepIndex === steps.length - 1;

  const setValue = (v) => setAnswers((prev) => ({ ...prev, [step.key]: v }));

  const goBack = () => {
    if (stepIndex === 0) router.back();
    else setStepIndex((i) => i - 1);
  };

  const goNext = () => {
    if (isLast) finishWorkflow();
    else setStepIndex((i) => i + 1);
  };

  async function logStep(s, v) {
    const body = {
      nom: `${workflow.nom} — ${s.label}`,
      staffId: selectedStaff?.id || null,
      dateHeure: new Date().toISOString(),
      statut: stepStatut(s, v),
      notes: stepNotes(s, v),
    };
    if (s.type === "temperature") body.valeurTemperature = Number(v);
    const res = await fetch("/api/executions-taches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
  }

  const finishWorkflow = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const loggable = steps.filter((s) => isLoggable(s, answers[s.key]));
      await Promise.all(loggable.map((s) => logStep(s, answers[s.key])));
      setCompleted(true);
    } catch (err) {
      setError("Erreur d'enregistrement : " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const declareIncident = async (details) => {
    setIncidentDeclaring(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: `${workflow.nom} — ${step.label}`,
          categorie: step.incidentCategorie || "Autre",
          criticite: step.incidentCriticite || "Majeur",
          description: details,
          zoneId,
          declareParId: selectedStaff?.id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || `Erreur ${res.status}`);
      setIncidentDeclared((prev) => ({ ...prev, [step.key]: true }));
    } catch (err) {
      setError("Erreur déclaration incident : " + err.message);
    } finally {
      setIncidentDeclaring(false);
    }
  };

  if (completed) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center text-center px-4" style={{ background: "#f7efe4" }}>
        <div className="text-5xl mb-3">✅</div>
        <h1 className="text-xl font-black text-[#2c1a10] mb-1">{workflow.nom} terminé</h1>
        <p className="text-sm text-[#9a7060] mb-6">Toutes les étapes ont été enregistrées.</p>
        <button
          type="button"
          onClick={() => router.push("/poste")}
          className="h-12 px-6 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
        >
          Retour à Mon Poste
        </button>
      </div>
    );
  }

  const proceedOk = canProceed(step, value);
  const showTempWarning = outOfRange(step, value);
  const stockManqueItems = step.type === "stock-check"
    ? (step.items || []).filter((_, i) => value?.[i] === "manque")
    : [];

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="flex gap-1.5 justify-center">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === stepIndex ? "24px" : "8px",
              background: i < stepIndex ? "#5a7828" : i === stepIndex ? "#2c1a10" : "#e5d5c5",
            }}
          />
        ))}
      </div>

      <div>
        <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">
          {workflow.nom} · Étape {stepIndex + 1}/{steps.length}
        </div>
        <h1 className="text-xl font-black text-[#2c1a10] -mt-0.5">{step.label}</h1>
        {step.description && <p className="text-sm text-[#9a7060] mt-1">{step.description}</p>}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs font-bold text-red-500">{error}</div>
      )}

      <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
        {step.type === "checkbox" && (
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => setValue(e.target.checked)}
              className="w-5 h-5 accent-[#5a7828]"
            />
            <span className="text-sm font-bold text-[#2c1a10]">Confirmé</span>
          </label>
        )}

        {step.type === "checklist" && (
          <div className="space-y-2.5">
            {(step.items || []).map((item, i) => (
              <label key={item} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(value?.[i])}
                  onChange={(e) => {
                    const next = [...(value || Array((step.items || []).length).fill(false))];
                    next[i] = e.target.checked;
                    setValue(next);
                  }}
                  className="w-5 h-5 accent-[#5a7828] shrink-0"
                />
                <span className="text-sm font-semibold text-[#2c1a10]">{item}</span>
              </label>
            ))}
          </div>
        )}

        {step.type === "stock-check" && (
          <div className="space-y-2.5">
            {(step.items || []).map((item, i) => (
              <div key={item} className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#2c1a10]">{item}</span>
                <div className="flex gap-1.5 shrink-0">
                  {["ok", "manque"].map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setValue({ ...(value || {}), [i]: choice })}
                      className="h-11 px-3 rounded-xl text-xs font-black cursor-pointer transition-colors"
                      style={{
                        background: value?.[i] === choice ? (choice === "ok" ? "#5a7828" : "#b91c1c") : "#f0e8dc",
                        color: value?.[i] === choice ? "#fff" : "#9a7060",
                      }}
                    >
                      {choice === "ok" ? "OK" : "Manque"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {stockManqueItems.length > 0 && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 mt-2 space-y-2">
                <div className="text-xs font-bold text-red-500">
                  Manquant : {stockManqueItems.join(", ")}
                </div>
                <button
                  type="button"
                  onClick={() => declareIncident(`Articles manquants lors de "${step.label}" : ${stockManqueItems.join(", ")}`)}
                  disabled={incidentDeclaring || incidentDeclared[step.key]}
                  className="h-11 px-3 rounded-xl bg-red-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {incidentDeclared[step.key] ? "Incident déclaré ✓" : incidentDeclaring ? "Envoi…" : "🚨 Déclarer un incident"}
                </button>
              </div>
            )}
          </div>
        )}

        {step.type === "temperature" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={value ?? ""}
                onChange={(e) => setValue(e.target.value)}
                placeholder={`Ex : ${step.min}`}
                className="h-11 px-4 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] text-sm font-bold text-[#2c1a10] outline-none focus:border-[#5a7828] w-32"
              />
              <span className="text-sm font-bold text-[#9a7060]">{step.unit}</span>
              <span className="text-xs text-[#9a7060]">(plage attendue : {step.min} à {step.max}{step.unit})</span>
            </div>
            {showTempWarning && (
              <div className="rounded-xl bg-red-50 border border-red-100 p-3 space-y-2">
                <div className="text-xs font-bold text-red-500">
                  Valeur hors plage ({step.min} à {step.max}{step.unit}).
                </div>
                <button
                  type="button"
                  onClick={() => declareIncident(`Température relevée : ${value}${step.unit} (attendu ${step.min} à ${step.max}${step.unit}) — ${step.label}`)}
                  disabled={incidentDeclaring || incidentDeclared[step.key]}
                  className="h-11 px-3 rounded-xl bg-red-500 text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {incidentDeclared[step.key] ? "Incident déclaré ✓" : incidentDeclaring ? "Envoi…" : "🚨 Déclarer un incident"}
                </button>
              </div>
            )}
          </div>
        )}

        {step.type === "photo" && (
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setValue(file ? URL.createObjectURL(file) : null);
              }}
              className="text-sm text-[#2c1a10]"
            />
            {value && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Aperçu" className="rounded-xl max-h-48 object-cover" />
            )}
            <p className="text-[11px] text-[#9a7060]">
              Aperçu local uniquement — aucun hébergement cloud configuré pour l'instant.
            </p>
          </div>
        )}

        {step.type === "text" && (
          <textarea
            value={value || ""}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] resize-none"
            placeholder="…"
          />
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={goBack}
          className="flex-1 h-12 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer border border-[#e5d5c5] bg-white"
        >
          ← Retour
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!proceedOk || submitting}
          className="flex-1 h-12 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50"
        >
          {submitting ? "Enregistrement…" : isLast ? "Terminer" : "Valider →"}
        </button>
      </div>
    </div>
  );
}
