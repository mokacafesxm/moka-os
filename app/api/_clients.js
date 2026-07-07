import { DB, queryDatabase, createPage, updatePage, getTitle, getText, getSelect, getDate, titleProp, textProp, dateProp } from "./_notion";

function toClient(page) {
  const props = page.properties;
  return {
    id: page.id,
    telephone: getTitle(props, "Téléphone"),
    prenom: getText(props, "Prénom"),
    nom: getText(props, "Nom"),
    email: getText(props, "Email"),
    createdAt: getDate(props, "Créé le"),
    lastLogin: getDate(props, "Dernière connexion"),
    activeReward: getText(props, "Récompense active") || null,
    rewardExpiresAt: getDate(props, "Récompense expire le"),
    activeSpinId: getText(props, "Spin actif ID") || null,
    lastSpin: getDate(props, "Dernier spin"),
    stripeCustomerId: getText(props, "Stripe Customer ID") || null,
  };
}

const emailProp = (v) => ({ email: v ? String(v) : null });

export async function findClientByPhone(phone) {
  if (!phone) return null;
  const pages = await queryDatabase(DB.CLIENTS, { property: "Téléphone", title: { equals: phone } }, null, 1);
  return pages[0] ? toClient(pages[0]) : null;
}

export async function findOrCreateClient(phone, prenom) {
  const existing = await findClientByPhone(phone);
  if (existing) {
    if (prenom && prenom !== existing.prenom) {
      await updatePage(existing.id, { "Prénom": textProp(prenom) });
      return { ...existing, prenom };
    }
    return existing;
  }

  const now = new Date().toISOString();
  const page = await createPage(DB.CLIENTS, {
    "Téléphone": titleProp(phone),
    "Prénom": textProp(prenom || ""),
    "Créé le": dateProp(now),
    "Dernière connexion": dateProp(now),
  });
  return toClient(page);
}

export async function touchLastLogin(clientId) {
  await updatePage(clientId, { "Dernière connexion": dateProp(new Date().toISOString()) });
}

export async function setClientPrenom(clientId, prenom) {
  await updatePage(clientId, { "Prénom": textProp(prenom) });
}

// Email is a Notion "email" property (validated as such), so it goes
// through emailProp rather than textProp; nom is plain rich text.
export async function updateClientProfile(clientId, { prenom, nom, email }) {
  await updatePage(clientId, {
    "Prénom": textProp(prenom),
    "Nom": textProp(nom),
    "Email": emailProp(email),
  });
}

export function clientHasActiveReward(client, now = new Date()) {
  return Boolean(client?.activeReward && client.rewardExpiresAt && new Date(client.rewardExpiresAt) > now);
}

export async function setClientLastSpin(clientId, when) {
  await updatePage(clientId, { "Dernier spin": dateProp(when.toISOString()) });
}

export async function setClientActiveReward(clientId, { spinId, reward, expiresAt }) {
  await updatePage(clientId, {
    "Récompense active": textProp(reward),
    "Récompense expire le": dateProp(expiresAt),
    "Spin actif ID": textProp(spinId),
  });
}

export async function clearClientActiveReward(clientId) {
  await updatePage(clientId, {
    "Récompense active": textProp(""),
    "Récompense expire le": dateProp(null),
    "Spin actif ID": textProp(""),
  });
}

export async function setClientStripeCustomerId(clientId, stripeCustomerId) {
  await updatePage(clientId, { "Stripe Customer ID": textProp(stripeCustomerId) });
}

// Every wheel spin this client has saved, newest first, with a derived
// status: active (still valid), used, or expired. "Used" comes from the
// Notion "Statut" being set to "Utilisée" at checkout; anything past its
// Expire le date that wasn't used is "expired".
export async function listClientRewards(clientId, now = new Date()) {
  const pages = await queryDatabase(DB.ROUE_CHANCE, {
    property: "Fiche client",
    relation: { contains: clientId },
  });

  return pages
    .map((page) => {
      const props = page.properties;
      const reward = getSelect(props, "Récompense");
      const wonAt = getDate(props, "Gagné le");
      const expiresAt = getDate(props, "Expire le");
      const statut = getSelect(props, "Statut");
      const code = getTitle(props, "Code");

      let status;
      if (statut === "Utilisée") status = "used";
      else if (expiresAt && new Date(expiresAt) > now) status = "active";
      else status = "expired";

      return { reward, code, wonAt, expiresAt, status };
    })
    .sort((a, b) => new Date(b.wonAt) - new Date(a.wonAt));
}
