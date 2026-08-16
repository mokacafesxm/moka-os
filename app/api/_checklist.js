// Checklists opérationnelles par poste (Bar Manager Operating System v1.0).
// Déclenchement d'ouverture événementiel : voir triggerOuvertureIfNeeded,
// appelé depuis /api/clock (route centrale de pointage) après un "Arrivée" —
// jamais depuis un composant UI, pour que n'importe quel écran qui pointe
// (splash, /poste, QuickPointageButton, ClockBar) déclenche la même logique.

import {
  DB, queryDatabase, createPage, updatePage, getPage,
  getTitle, getText, getSelect, getDate, getCheckbox, getNumber, getRelationIds,
  titleProp, textProp, selectProp, numberProp, dateProp, relationProp, urlProp,
} from "./_notion";

const SXM_TZ = "America/Puerto_Rico";

// Postes physiques suivis par ce module — distinct des valeurs "Bar Manager"
// / "Manager Général" que STAFF.Poste peut aussi contenir (ces rôles ne
// tiennent pas de poste physique, donc pas de checklist/Poste_Status pour eux).
const POSTES_CHECKLIST = ["Bar", "Cuisine", "Salle", "Plonge"];

const WEEKDAY_EN_TO_FR = {
  Monday: "Lundi", Tuesday: "Mardi", Wednesday: "Mercredi", Thursday: "Jeudi",
  Friday: "Vendredi", Saturday: "Samedi", Sunday: "Dimanche",
};

const PRODUCTION_CADENCE_BY_WEEKDAY = {
  Lundi: "PRODUCTION-LUNDI", Mardi: "PRODUCTION-MARDI", Mercredi: "PRODUCTION-MERCREDI",
  Jeudi: "PRODUCTION-JEUDI", Vendredi: "PRODUCTION-VENDREDI", Samedi: "PRODUCTION-SAMEDI",
  Dimanche: "PRODUCTION-DIMANCHE",
};

export function getSXMDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SXM_TZ }).format(date);
}

function getSXMWeekday(todaySXM) {
  // Midi, pas minuit : évite tout risque de bascule de jour lors de la
  // reformattage dans le fuseau SXM (celui-ci n'observe pas le DST, mais
  // reste défensif au cas où le décalage -04:00 codé en dur devenait faux).
  const en = new Intl.DateTimeFormat("en-US", { timeZone: SXM_TZ, weekday: "long" })
    .format(new Date(`${todaySXM}T12:00:00-04:00`));
  return WEEKDAY_EN_TO_FR[en] || en;
}

function normalizeTemplate(page) {
  const p = page.properties;
  return {
    id: page.id,
    tache: getTitle(p, "Tache"),
    poste: getSelect(p, "Poste"),
    cadence: getSelect(p, "Cadence"),
    jourSemaine: getSelect(p, "Jour_Semaine"),
    momentCadence: getSelect(p, "Moment_Cadence"),
    dateReference: getDate(p, "Date_Reference"),
    declencheur: getText(p, "Declencheur"),
    typePreuve: getSelect(p, "Type_Preuve"),
    preuveDetail: getText(p, "Preuve_Detail"),
    escaladeAction: getText(p, "Escalade_Action"),
    categorieIncident: getSelect(p, "Categorie_Incident"),
    criticiteIncident: getSelect(p, "Criticite_Incident"),
    // 0 est une valeur de plage valide (ex. frigo 0-5°C) — getNumber ne peut
    // pas distinguer "0" de "vide" (les deux renvoient 0), donc on lit le
    // champ Notion directement pour savoir si une plage est réellement définie.
    tempMin: p["Temp_Min"]?.number ?? null,
    tempMax: p["Temp_Max"]?.number ?? null,
    actif: getCheckbox(p, "Actif"),
  };
}

function normalizeInstance(page) {
  const p = page.properties;
  return {
    id: page.id,
    nom: getTitle(p, "Nom"),
    templateId: getRelationIds(p, "Template")[0] || null,
    poste: getSelect(p, "Poste"),
    date: getDate(p, "Date"),
    statut: getSelect(p, "Statut"),
    assigneAId: getRelationIds(p, "Assigne_A")[0] || null,
    preuveTexte: getText(p, "Preuve_Texte"),
    preuvePhotoUrl: getText(p, "Preuve_Photo_URL"),
    preuveChiffre: getNumber(p, "Preuve_Chiffre"),
    escaladeAId: getRelationIds(p, "Escalade_A")[0] || null,
    incidentLieId: getRelationIds(p, "Incident_Lie")[0] || null,
  };
}

function staffDisplayName(page) {
  const p = page.properties;
  return getText(p, "Prénom") || getTitle(p, "Nom");
}

function isLastDayOfMonthSXM(todaySXM) {
  const [y, m] = todaySXM.slice(0, 7).split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate(); // jour 0 du mois suivant = dernier jour du mois courant
  return Number(todaySXM.slice(8, 10)) === lastDay;
}

function monthsBetween(fromISO, toISO) {
  const [fy, fm] = fromISO.slice(0, 7).split("-").map(Number);
  const [ty, tm] = toISO.slice(0, 7).split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// Due tous les 3 mois, le même jour du mois que Date_Reference. Ne gère pas
// le clamping de fin de mois (ex. référence le 31) — cas limite rare pour
// une cadence trimestrielle, pas géré pour rester simple.
function isQuarterlyDue(dateReference, todaySXM) {
  if (!dateReference) return false;
  if (dateReference.slice(8, 10) !== todaySXM.slice(8, 10)) return false;
  const diff = monthsBetween(dateReference, todaySXM);
  return diff >= 0 && diff % 3 === 0;
}

// Date fixe annuelle (année ignorée) — ex. Date_Reference "2026-09-01" pour
// "avant haute saison" est due chaque 1er septembre.
function isSeasonalDue(dateReference, todaySXM) {
  if (!dateReference) return false;
  return dateReference.slice(5, 10) === todaySXM.slice(5, 10);
}

function isDueToday(template, todaySXM, weekdaySXM) {
  switch (template.cadence) {
    case "QUOTIDIEN-OUVERTURE": return true;
    case "HEBDOMADAIRE": return template.jourSemaine === weekdaySXM;
    case "MENSUEL":
      return template.momentCadence === "Fin"
        ? isLastDayOfMonthSXM(todaySXM)
        : todaySXM.slice(8, 10) === "01"; // "Début" ou non renseigné
    case "TRIMESTRIEL": return isQuarterlyDue(template.dateReference, todaySXM);
    case "SAISONNIER": return isSeasonalDue(template.dateReference, todaySXM);
    // QUOTIDIEN-SERVICE et QUOTIDIEN-FERMETURE : contenu de référence importé,
    // pas encore instancié par ce déclencheur (voir PR2/PR3 — fermeture est
    // une action volontaire distincte du pointage, service n'a pas encore de
    // mécanisme de déclenchement décidé).
    case "QUOTIDIEN-SERVICE":
    case "QUOTIDIEN-FERMETURE":
      return false;
    default: return PRODUCTION_CADENCE_BY_WEEKDAY[weekdaySXM] === template.cadence;
  }
}

export async function getDueTemplates(poste, todaySXM) {
  const pages = await queryDatabase(DB.BAR_CHECKLIST_TEMPLATES, {
    and: [
      { property: "Poste", select: { equals: poste } },
      { property: "Actif", checkbox: { equals: true } },
    ],
  });
  const weekdaySXM = getSXMWeekday(todaySXM);
  return pages.map(normalizeTemplate).filter((t) => isDueToday(t, todaySXM, weekdaySXM));
}

async function findStaffByName(staffName) {
  if (!staffName) return null;
  const pages = await queryDatabase(DB.STAFF, { property: "Nom", title: { equals: staffName } }, null, 1);
  const page = pages[0];
  if (!page) return null;
  return { id: page.id, poste: getSelect(page.properties, "Poste") };
}

// Best-effort : cherche un membre actif du staff dont le prénom apparaît
// textuellement dans l'Escalade_Action du template (ex. "Alerte Thibault" ->
// staff "Thibault"). Pas de correspondance -> pas d'Escalade_A, l'incident
// est quand même créé (voir completeInstance).
async function resolveEscaladeStaffId(escaladeAction) {
  if (!escaladeAction) return null;
  const lower = escaladeAction.toLowerCase();
  const pages = await queryDatabase(DB.STAFF, { property: "Actif", checkbox: { equals: true } });
  for (const page of pages) {
    const name = staffDisplayName(page);
    if (name && lower.includes(name.toLowerCase())) return page.id;
  }
  return null;
}

async function resolveZoneId(poste) {
  const pages = await queryDatabase(DB.ZONES_PHYSIQUES, { property: "Nom", title: { equals: poste } }, null, 1);
  return pages[0]?.id || null;
}

export async function getPosteStatus(poste, todaySXM = getSXMDateString()) {
  const pages = await queryDatabase(DB.POSTE_STATUS, {
    and: [
      { property: "Poste", select: { equals: poste } },
      { property: "Date", date: { equals: todaySXM } },
    ],
  }, null, 1);
  return pages[0] || null;
}

// Déclenché sur pointage "Arrivée". Si personne n'a encore ouvert ce poste
// aujourd'hui : crée Poste_Status ("Ouverture en cours") + instancie
// QUOTIDIEN-OUVERTURE et les cadences planifiées dues aujourd'hui. Si le
// poste est déjà ouvert, ne fait rien — cette personne rejoint le poste
// déjà ouvert (voir spec "Bar Manager Operating System v1.0").
//
// Non protégé contre une double-ouverture en cas de pointages simultanés
// à la seconde près (lecture-puis-écriture non atomique) — accepté pour un
// seul café avec une poignée de staff ; le pire cas est deux Poste_Status
// dupliqués pour le même jour, pas une perte de données.
export async function triggerOuvertureIfNeeded(staffName) {
  const staff = await findStaffByName(staffName);
  if (!staff?.poste || !POSTES_CHECKLIST.includes(staff.poste)) return null;

  const todaySXM = getSXMDateString();
  const existing = await getPosteStatus(staff.poste, todaySXM);
  if (existing) return null;

  const dueTemplates = await getDueTemplates(staff.poste, todaySXM);
  const nowIso = new Date().toISOString();

  const posteStatusPage = await createPage(DB.POSTE_STATUS, {
    Nom: titleProp(`${staff.poste} — ${todaySXM}`),
    Poste: selectProp(staff.poste),
    Date: dateProp(todaySXM),
    Statut: selectProp("Ouverture en cours"),
    Ouvert_Par: relationProp(staff.id),
    Heure_Ouverture: dateProp(nowIso),
  });

  const instanceIds = [];
  for (const template of dueTemplates) {
    const instance = await createPage(DB.BAR_CHECKLIST_INSTANCES, {
      Nom: titleProp(`${staff.poste} — ${template.tache} — ${todaySXM}`),
      Template: relationProp(template.id),
      Poste: selectProp(staff.poste),
      Date: dateProp(todaySXM),
      Statut: selectProp("À faire"),
      Assigne_A: relationProp(staff.id),
    });
    instanceIds.push(instance.id);
  }

  if (instanceIds.length > 0) {
    await updatePage(posteStatusPage.id, { Checklist_Ouverture: relationProp(...instanceIds) });
  } else {
    // Aucune tâche due aujourd'hui pour ce poste (templates pas encore
    // seedées, ex. Plonge) — rien à compléter, donc rien ne ferait jamais
    // passer le statut à "Ouvert" via checkAndFinalizePhase. Ouvre directement.
    await updatePage(posteStatusPage.id, { Statut: selectProp("Ouvert") });
  }

  return { posteStatusId: posteStatusPage.id, instanceCount: instanceIds.length };
}

async function checkAndFinalizePhase(posteStatusPage, phase, staffId) {
  const relKey = phase === "fermeture" ? "Checklist_Fermeture" : "Checklist_Ouverture";
  const ids = getRelationIds(posteStatusPage.properties, relKey);
  if (ids.length === 0) return;
  const pages = await Promise.all(ids.map((id) => getPage(id)));
  const allDone = pages.every((p) => getSelect(p.properties, "Statut") !== "À faire");
  if (!allDone) return;

  if (phase === "fermeture") {
    await updatePage(posteStatusPage.id, {
      Statut: selectProp("Clôturé"),
      Ferme_Par: relationProp(staffId),
      Heure_Fermeture: dateProp(new Date().toISOString()),
    });
  } else if (getSelect(posteStatusPage.properties, "Statut") === "Ouverture en cours") {
    await updatePage(posteStatusPage.id, { Statut: selectProp("Ouvert") });
  }
}

// Déclenché par l'action volontaire "Fermer le [poste]" (jamais par le
// pointage — voir spec, fermeture en deux temps). Idempotent : si une
// checklist de fermeture existe déjà pour aujourd'hui, la renvoie au lieu
// d'en recréer une.
export async function instantiateFermeture(poste, staffId) {
  const todaySXM = getSXMDateString();
  const posteStatusPage = await getPosteStatus(poste, todaySXM);
  if (!posteStatusPage) throw new Error(`Poste ${poste} pas encore ouvert aujourd'hui`);

  const existingIds = getRelationIds(posteStatusPage.properties, "Checklist_Fermeture");
  if (existingIds.length > 0) return { posteStatusId: posteStatusPage.id, instanceIds: existingIds };

  const pages = await queryDatabase(DB.BAR_CHECKLIST_TEMPLATES, {
    and: [
      { property: "Poste", select: { equals: poste } },
      { property: "Cadence", select: { equals: "QUOTIDIEN-FERMETURE" } },
      { property: "Actif", checkbox: { equals: true } },
    ],
  });
  const templates = pages.map(normalizeTemplate);

  const instanceIds = [];
  for (const template of templates) {
    const instance = await createPage(DB.BAR_CHECKLIST_INSTANCES, {
      Nom: titleProp(`${poste} — ${template.tache} — ${todaySXM}`),
      Template: relationProp(template.id),
      Poste: selectProp(poste),
      Date: dateProp(todaySXM),
      Statut: selectProp("À faire"),
      Assigne_A: relationProp(staffId),
    });
    instanceIds.push(instance.id);
  }

  if (instanceIds.length === 0) {
    await updatePage(posteStatusPage.id, {
      Statut: selectProp("Clôturé"),
      Ferme_Par: relationProp(staffId),
      Heure_Fermeture: dateProp(new Date().toISOString()),
    });
    return { posteStatusId: posteStatusPage.id, instanceIds: [] };
  }

  await updatePage(posteStatusPage.id, {
    Statut: selectProp("Fermeture en cours"),
    Checklist_Fermeture: relationProp(...instanceIds),
  });

  return { posteStatusId: posteStatusPage.id, instanceIds };
}

// Complète une tâche : détermine le statut final (Non conforme automatique
// si Type_Preuve=Chiffre et valeur hors Temp_Min/Temp_Max — même règle que
// l'ancien WorkflowRunner pour les relevés de température), écrit la preuve,
// et si Non conforme, déclare un incident (Categorie/Criticite du template),
// même mécanisme que WorkflowRunner.declareIncident.
export async function completeInstance({ instanceId, staffId, preuveTexte, preuvePhotoUrl, preuveChiffre, ignore }) {
  const instancePage = await getPage(instanceId);
  const templateId = getRelationIds(instancePage.properties, "Template")[0];
  const templatePage = templateId ? await getPage(templateId) : null;
  const template = templatePage ? normalizeTemplate(templatePage) : null;

  const hasChiffre = preuveChiffre !== undefined && preuveChiffre !== null && preuveChiffre !== "";
  const outOfRange = Boolean(
    hasChiffre && template && template.tempMin !== null && template.tempMax !== null
    && (Number(preuveChiffre) < template.tempMin || Number(preuveChiffre) > template.tempMax)
  );

  const statut = ignore ? "Ignoré" : (outOfRange ? "Non conforme" : "Fait");

  const properties = {
    Statut: selectProp(statut),
    Horodatee_Completion: dateProp(new Date().toISOString()),
  };
  if (preuveTexte !== undefined) properties.Preuve_Texte = textProp(preuveTexte);
  if (preuvePhotoUrl !== undefined) properties.Preuve_Photo_URL = urlProp(preuvePhotoUrl);
  if (hasChiffre) properties.Preuve_Chiffre = numberProp(preuveChiffre);

  let incidentId = null;
  let escaladeAId = null;
  if (statut === "Non conforme" && template) {
    const zoneId = await resolveZoneId(template.poste);
    const valeurNote = hasChiffre
      ? ` — valeur relevée : ${preuveChiffre}${template.tempMin !== null ? ` (attendu ${template.tempMin} à ${template.tempMax})` : ""}`
      : "";
    const incidentPage = await createPage(DB.INCIDENTS, {
      Titre: titleProp(`${template.tache} — ${template.poste}`),
      Zone: relationProp(zoneId),
      Categorie: selectProp(template.categorieIncident || "Autre"),
      Criticite: selectProp(template.criticiteIncident || "Majeur"),
      Description: textProp(
        `Checklist ${template.poste} — "${template.tache}"${valeurNote}${template.escaladeAction ? ` — ${template.escaladeAction}` : ""}`
      ),
      Statut: selectProp("Ouvert"),
      Declare_Par: relationProp(staffId),
      Date_Heure: dateProp(new Date().toISOString()),
    });
    incidentId = incidentPage.id;
    escaladeAId = await resolveEscaladeStaffId(template.escaladeAction);
    properties.Incident_Lie = relationProp(incidentId);
    if (escaladeAId) properties.Escalade_A = relationProp(escaladeAId);
  }

  await updatePage(instanceId, properties);

  if (template) {
    const poste = getSelect(instancePage.properties, "Poste") || template.poste;
    const dateInstance = (getDate(instancePage.properties, "Date") || getSXMDateString()).slice(0, 10);
    const posteStatusPage = await getPosteStatus(poste, dateInstance);
    if (posteStatusPage) {
      const phase = template.cadence === "QUOTIDIEN-FERMETURE" ? "fermeture" : "ouverture";
      await checkAndFinalizePhase(posteStatusPage, phase, staffId);
    }
  }

  return { id: instanceId, statut, incidentId, escaladeAId };
}

export async function getInstancesForStaff(staffId) {
  const todaySXM = getSXMDateString();
  const pages = await queryDatabase(DB.BAR_CHECKLIST_INSTANCES, {
    and: [
      { property: "Assigne_A", relation: { contains: staffId } },
      { property: "Date", date: { equals: todaySXM } },
      { property: "Statut", select: { equals: "À faire" } },
    ],
  }, null, 200);

  const instances = pages.map(normalizeInstance);
  const templateIds = [...new Set(instances.map((i) => i.templateId).filter(Boolean))];
  const templatePages = await Promise.all(templateIds.map((id) => getPage(id)));
  const templatesById = Object.fromEntries(
    templatePages.map((p) => [p.id, normalizeTemplate(p)])
  );

  return instances.map((instance) => ({
    ...instance,
    template: templatesById[instance.templateId] || null,
  }));
}
