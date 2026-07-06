import { DB, queryDatabase, createPage, updatePage, getTitle, getText, getDate, titleProp, textProp, dateProp } from "./_notion";

function toClient(page) {
  const props = page.properties;
  return {
    id: page.id,
    telephone: getTitle(props, "Téléphone"),
    prenom: getText(props, "Prénom"),
    createdAt: getDate(props, "Créé le"),
    lastLogin: getDate(props, "Dernière connexion"),
    activeReward: getText(props, "Récompense active") || null,
    rewardExpiresAt: getDate(props, "Récompense expire le"),
    activeSpinId: getText(props, "Spin actif ID") || null,
    lastSpin: getDate(props, "Dernier spin"),
  };
}

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
