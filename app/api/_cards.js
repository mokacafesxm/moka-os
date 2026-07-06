import { DB, queryDatabase, createPage, archivePage, getTitle, getText, getDate, titleProp, textProp, dateProp, relationProp } from "./_notion";

function toCard(page) {
  const props = page.properties;
  return {
    paymentMethodId: getTitle(props, "Payment Method ID"),
    brand: getText(props, "Marque"),
    last4: getText(props, "4 derniers chiffres"),
    expiry: getText(props, "Expiration"),
    addedAt: getDate(props, "Ajoutée le"),
  };
}

// Newest first — checkout treats the most recently added card as the
// one-tap "priority" option (see resolvePrimaryCardForClient).
export async function listClientCards(clientId) {
  const pages = await queryDatabase(DB.CARTES_ENREGISTREES, {
    property: "Fiche client",
    relation: { contains: clientId },
  });
  return pages.map(toCard).sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
}

export async function resolvePrimaryCardForClient(clientId) {
  const cards = await listClientCards(clientId);
  return cards[0] || null;
}

export async function addClientCard(clientId, { paymentMethodId, brand, last4, expiry }) {
  await createPage(DB.CARTES_ENREGISTREES, {
    "Payment Method ID": titleProp(paymentMethodId),
    "Fiche client": relationProp(clientId),
    "Marque": textProp(brand),
    "4 derniers chiffres": textProp(last4),
    "Expiration": textProp(expiry),
    "Ajoutée le": dateProp(new Date().toISOString()),
  });
}

export async function removeClientCard(paymentMethodId) {
  const pages = await queryDatabase(DB.CARTES_ENREGISTREES, { property: "Payment Method ID", title: { equals: paymentMethodId } }, null, 1);
  if (!pages[0]) return;
  await archivePage(pages[0].id);
}
