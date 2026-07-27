"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const POSTES = [
  { key: "Bar", nom: "Bar", emoji: "☕" },
  { key: "Cuisine", nom: "Cuisine", emoji: "👨‍🍳" },
  { key: "Salle", nom: "Salle", emoji: "🛋" },
  { key: "Plonge", nom: "Plonge", emoji: "🚿" },
];

// Mapping poste -> mots-clés de rôle (comparaison insensible à la casse,
// includes()) — le champ Rôle du staff est du texte libre (rich_text dans
// Notion), jamais une liste fermée, donc pas d'égalité stricte possible.
const POSTE_ROLES = {
  Bar: ["barista", "bar", "manager"],
  Cuisine: ["cuisine", "chef", "manager"],
  Salle: ["serveur", "runner", "manager"],
  Plonge: ["plonge", "manager"],
};

const OUVERTURE_WORKFLOW_BY_POSTE = { Bar: "ouverture-bar", Cuisine: "ouverture-cuisine" };
const FERMETURE_WORKFLOW_BY_POSTE = { Bar: "fermeture-bar" };

const SXM_TZ = "America/Puerto_Rico";
const CLOSE_HOUR = 15;
const OPEN_HOUR = 6;

function getStaffName(member) {
  return member?.name || member?.prenom || member?.nom || "Staff";
}

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

function staffMatchesPoste(member, posteKey) {
  const role = String(member.role || "").trim().toLowerCase();
  if (!role) return true; // rôle non renseigné dans Notion -> visible partout (fail-open, jamais bloquant)
  const keywords = POSTE_ROLES[posteKey] || [];
  return keywords.some((kw) => role.includes(kw));
}

function loadStaffForPoste(posteKey) {
  if (!posteKey || typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(`mokaSelectedStaff_${posteKey}`) || "null"); } catch { return null; }
}
function saveStaffForPoste(posteKey, member) {
  if (!posteKey || typeof window === "undefined") return;
  localStorage.setItem(`mokaSelectedStaff_${posteKey}`, JSON.stringify(member));
}

function getSXMParts(date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: SXM_TZ, hour: "numeric", hour12: false }).format(date));
  const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: SXM_TZ, minute: "numeric" }).format(date));
  return { hour, minute };
}

function momentForHour(hour) {
  if (hour < 10) return "Ouverture";
  if (hour < 14.5) return "Pendant service";
  return "Fermeture";
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">{title}</div>
      {children}
    </div>
  );
}

function PostePicker({ onPick }) {
  return (
    <div className="min-h-dvh px-4 py-6 space-y-3" style={{ background: "#f7efe4" }}>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-1">Mon Poste</div>
      <h1 className="text-xl font-black text-[#2c1a10] mb-4">Quel est ton poste aujourd&apos;hui ?</h1>
      {POSTES.map((poste) => (
        <button
          key={poste.key}
          type="button"
          onClick={() => onPick(poste.key)}
          className="w-full rounded-3xl bg-white border border-[#e5d5c5] shadow-sm py-6 px-8 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-[#f0e4d4]"
        >
          <div className="flex items-center gap-4">
            <span className="text-4xl">{poste.emoji}</span>
            <span className="text-2xl font-black text-[#2c1a10]">{poste.nom.toUpperCase()}</span>
          </div>
          <span className="text-xl text-[#9a7060]">→</span>
        </button>
      ))}
    </div>
  );
}

function StaffGridPicker({ posteKey, staffList, onPick, onBack }) {
  const filtered = staffList.filter((m) => staffMatchesPoste(m, posteKey));
  const poste = POSTES.find((p) => p.key === posteKey);

  return (
    <div className="min-h-dvh px-4 py-6" style={{ background: "#f7efe4" }}>
      <button type="button" onClick={onBack} className="text-xs font-bold text-[#9a7060] underline cursor-pointer mb-2">
        ← Changer de poste
      </button>
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-1">
        {poste?.emoji} {poste?.nom}
      </div>
      <h1 className="text-xl font-black text-[#2c1a10] mb-6">Qui pointe ?</h1>
      <div className="grid grid-cols-2 gap-3">
        {filtered.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => onPick(member)}
            className="rounded-3xl bg-white border border-[#e5d5c5] shadow-sm p-4 flex flex-col items-center gap-2 cursor-pointer active:scale-[0.97] transition-all hover:bg-[#f0e4d4]"
          >
            <span
              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-black text-white shrink-0"
              style={{ background: "#2c1a10" }}
            >
              {initials(getStaffName(member))}
            </span>
            <span className="font-black text-sm text-[#2c1a10] text-center">{getStaffName(member)}</span>
            {member.role && <span className="text-[10px] text-[#9a7060]">{member.role}</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-2 text-center text-sm text-[#9a7060] py-8">Aucun staff trouvé pour ce poste</div>
        )}
      </div>
    </div>
  );
}

function ClosingBanner({ hour, minute }) {
  if (hour < 14 || hour >= 16) return null;
  const minutesToClose = CLOSE_HOUR * 60 - (hour * 60 + minute);
  const timeLabel = `${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
  return (
    <div
      className="rounded-2xl p-3.5 text-sm font-bold flex items-center justify-between gap-2"
      style={{ background: "#fef3c7", color: "#854f0b", border: "1px solid #fcd34d" }}
    >
      <span>
        ⏰ {timeLabel} — {minutesToClose > 0 ? `Fermeture dans ${minutesToClose} min` : `Fermeture dépassée de ${-minutesToClose} min`}
      </span>
    </div>
  );
}

function TempsList({ executions, posteNom }) {
  // Ne pas filtrer sur "valeurTemperature != null" : getNumber() (_notion.js,
  // partagé par toute l'app) retourne 0 par défaut quand la propriété Notion
  // est vide, pas null — indiscernable d'une vraie lecture à 0°C. On filtre
  // plutôt sur le nom de l'étape, qui encode déjà son type ("... — Température ...").
  const releves = executions.filter(
    (e) => String(e.nom || "").includes(posteNom) && /température/i.test(e.nom || "")
  );
  if (releves.length === 0) return <div className="text-sm text-[#9a7060] py-2">Pas de relevé aujourd&apos;hui</div>;
  return (
    <div className="space-y-2">
      {releves.map((e) => (
        <div key={e.id} className="flex items-center justify-between text-sm">
          <span className="font-semibold text-[#2c1a10]">{e.nom.split("—").pop().trim()}</span>
          <span className="font-black text-[#2c1a10]">{e.valeurTemperature}°C</span>
        </div>
      ))}
    </div>
  );
}

function TachesList({ taches }) {
  if (taches.length === 0) return <div className="text-sm text-[#9a7060] py-2">Aucune tâche pour le moment</div>;
  return (
    <div className="space-y-2">
      {taches.map((t) => (
        <div key={t.id} className="flex items-center justify-between">
          <span className="text-sm font-bold text-[#2c1a10]">{t.nom}</span>
          <span className="text-[10px] text-[#9a7060] font-semibold">{t.frequence}</span>
        </div>
      ))}
    </div>
  );
}

function WorkflowButton({ posteKey, hourFrac }) {
  const ouvertureId = OUVERTURE_WORKFLOW_BY_POSTE[posteKey];
  const fermetureId = FERMETURE_WORKFLOW_BY_POSTE[posteKey];
  const workflowId = hourFrac < 10 ? ouvertureId : hourFrac >= 14.5 ? fermetureId : null;
  if (!workflowId) return null;
  const label = hourFrac < 10 ? "Ouverture" : "Fermeture";
  return (
    <a
      href={`/workflows/${workflowId}`}
      className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
    >
      ▶ {label} {posteKey}
    </a>
  );
}

export default function PostePage() {
  const { poste, setPoste, resetPoste, selectedStaff, isClockedIn, clockInAs } = useStaffContext();
  const { staff, taches, zonesPhysiques, preps } = useAppContext();

  const [forceStaffStep, setForceStaffStep] = useState(false);
  const [now, setNow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [toast, setToast] = useState(null);
  const closeToastFiredRef = useRef(null); // date (YYYY-MM-DD) où le toast 15h a déjà été montré

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { hour, minute } = now ? getSXMParts(now) : { hour: 12, minute: 0 };
  const todaySXM = now ? new Intl.DateTimeFormat("en-CA", { timeZone: SXM_TZ }).format(now) : null;

  useEffect(() => {
    if (hour !== 15 || minute !== 0) return;
    if (closeToastFiredRef.current === todaySXM) return;
    closeToastFiredRef.current = todaySXM;
    setToast({ text: "⏰ 15h — Pensez à fermer le poste", type: "warning" });
  }, [hour, minute, todaySXM]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const step = !poste ? "poste" : (!forceStaffStep && selectedStaff && isClockedIn) ? "dashboard" : "staff";

  useEffect(() => {
    if (step !== "dashboard") return;
    fetch("/api/executions-taches")
      .then((r) => r.json())
      .then((data) => setExecutions(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[PostePage] executions fetch failed", error));
  }, [step]);

  useEffect(() => {
    if (step !== "dashboard" || poste !== "Bar" || recettes.length > 0) return;
    fetch("/api/recipes/sold-products")
      .then((r) => r.json())
      .then((data) => setRecettes(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[PostePage] recipes fetch failed", error));
  }, [step, poste, recettes.length]);

  const zoneId = useMemo(() => zonesPhysiques.find((z) => z.nom === poste)?.id || null, [zonesPhysiques, poste]);
  const hourFrac = hour + minute / 60;
  const currentMoment = momentForHour(hourFrac);
  const zoneTaches = useMemo(
    () => taches.filter((t) => t.zoneId === zoneId && (t.moment === currentMoment || !t.moment)),
    [taches, zoneId, currentMoment]
  );

  const prepasUrgentes = useMemo(
    () => preps.filter((p) => {
      const s = String(p.status || "").toLowerCase();
      return !s.includes("fait") && !s.includes("terminé");
    }),
    [preps]
  );

  const recettesPoste = useMemo(
    () => recettes.filter((r) => String(r.category || "").toLowerCase() === "bar"),
    [recettes]
  );

  const isOuvert = hour >= OPEN_HOUR && hour < CLOSE_HOUR;

  const handlePickPoste = (posteKey) => {
    setPoste(posteKey);
    setForceStaffStep(true);
  };

  const handlePickStaff = async (member) => {
    try {
      await clockInAs(member);
      saveStaffForPoste(poste, member);
      setForceStaffStep(false);
    } catch (error) {
      console.error("[PostePage] clockInAs failed", error);
    }
  };

  const handleBackToPoste = () => resetPoste();

  if (step === "poste") return <PostePicker onPick={handlePickPoste} />;
  if (step === "staff") return <StaffGridPicker posteKey={poste} staffList={staff} onPick={handlePickStaff} onBack={handleBackToPoste} />;

  const posteInfo = POSTES.find((p) => p.key === poste);

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Mon Poste</div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#2c1a10]">{posteInfo?.emoji} {posteInfo?.nom}</h1>
            <span
              className="text-[10px] font-black px-2 py-1 rounded-lg"
              style={{ color: isOuvert ? "#5a7828" : "#9a7060", background: isOuvert ? "#f0f7e5" : "#f0e8dc" }}
            >
              {isOuvert ? "Ouvert" : "Fermé"}
            </span>
          </div>
        </div>
        <button type="button" onClick={handleBackToPoste} className="text-xs font-bold text-[#9a7060] underline cursor-pointer shrink-0">
          Changer de poste
        </button>
      </div>

      <ClosingBanner hour={hour} minute={minute} />

      {toast && (
        <div className="rounded-2xl p-3 text-sm font-bold text-white text-center" style={{ background: "#d97706" }}>
          {toast.text}
        </div>
      )}

      {poste === "Bar" && (
        <>
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Recettes Bar">
            {recettesPoste.length === 0 ? (
              <div className="text-sm text-[#9a7060] py-2">Aucune recette classée « Bar » pour l&apos;instant</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recettesPoste.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-3">
                    <div className="font-black text-sm text-[#2c1a10]">{r.name}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Bar" /></SectionCard>
          <WorkflowButton posteKey="Bar" hourFrac={hourFrac} />
        </>
      )}

      {poste === "Cuisine" && (
        <>
          <SectionCard title="Prépas urgentes">
            {prepasUrgentes.length === 0 ? (
              <div className="text-sm text-[#9a7060] py-2">Aucune prépa urgente</div>
            ) : (
              <div className="space-y-2">
                {prepasUrgentes.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-[#2c1a10]">{p.name}</span>
                    <span className="text-[10px] text-[#9a7060] font-semibold">{p.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Cuisine" /></SectionCard>
          <WorkflowButton posteKey="Cuisine" hourFrac={hourFrac} />
        </>
      )}

      {poste === "Salle" && (
        <>
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Tables">
            <div className="text-sm text-[#9a7060] py-2">Statut de service non configuré pour l&apos;instant</div>
          </SectionCard>
          <SectionCard title="Ménage & mise en place">
            <TachesList taches={zoneTaches.filter((t) => /ménage|nettoy|mise en place/i.test(t.nom))} />
          </SectionCard>
        </>
      )}

      {poste === "Plonge" && (
        <>
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Checklist nettoyage">
            <TachesList taches={zoneTaches.filter((t) => /nettoy|plonge|vaisselle/i.test(t.nom))} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
