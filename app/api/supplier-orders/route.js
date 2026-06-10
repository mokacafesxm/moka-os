import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage,
  getTitle, getText, getSelect, getNumber, getDate, getRelationIds,
  titleProp, textProp, selectProp, numberProp, dateProp, relationProp,
} from "../_notion";

async function resolveProductId(productName, productId) {
  if (productId && /^[0-9a-f-]{36}$/i.test(String(productId))) return productId;
  if (!productName) return null;
  try {
    const pages = await queryDatabase(DB.INGREDIENTS);
    const clean = String(productName).trim().toLowerCase();
    const found = pages.find((p) => {
      const nom = String(getTitle(p.properties, "Ingredient", "Nom", "nom") || "").trim().toLowerCase();
      return nom === clean;
    });
    return found?.id || null;
  } catch { return null; }
}

const buildBesoinTitle = (source, staffName, fournisseur, produit) => {
  if (source === "Commandes" || source === "Composer") {
    return `Order composée — ${fournisseur || "Fournisseur"}`;
  }
  if (source === "Prépas") {
    return `Prépa : ${produit || "Préparation"}`;
  }
  return `NEW ORDER : ${staffName || "Staff"}`;
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const [pages, fournisseurPages] = await Promise.all([
      queryDatabase(DB.BESOINS, null, [{ property: "Date création", direction: "descending" }], 200),
      queryDatabase(DB.FOURNISSEURS),
    ]);

    const fournisseurMap = {};
    fournisseurPages.forEach((p) => {
      const nom = getTitle(p.properties, "Fournisseur", "Nom", "nom");
      if (p.id && nom) fournisseurMap[p.id] = nom;
    });

    const orders = pages.map((page) => {
      const p = page.properties;
      const fRelIds = getRelationIds(p, "Fournisseur");
      return {
        id: page.id,
        produit: getTitle(p, "Besoin"),
        quantite: getNumber(p, "Quantité suggérée"),
        unite: getSelect(p, "Unité"),
        statut: getSelect(p, "Statut"),
        source: getSelect(p, "Source"),
        date: getDate(p, "Date création") || page.created_time || "",
        fournisseur: fournisseurMap[fRelIds[0]] || getText(p, "Fournisseur") || "Sans fournisseur",
        produitId: getRelationIds(p, "Produit")[0] || null,
        fournisseurId: fRelIds[0] || null,
        staffId: getRelationIds(p, "Staff")[0] || null,
      };
    });

    return Response.json(orders, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, produit, quantite, unite, fournisseurId, fournisseur, statut, source, message, produitId, staffId, staffName } = body;

    if (action === "updateStatus") {
      const { id, statut: newStatut, dateSent, message: sentMsg } = body;
      const properties = { "Statut": selectProp(newStatut) };
      if (dateSent) properties["Date envoi"] = dateProp(dateSent);
      if (sentMsg)  properties["Message envoyé"] = textProp(sentMsg);
      await updatePage(id, properties);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    const title = buildBesoinTitle(source, staffName, fournisseur, produit);
    const resolvedProduitId = await resolveProductId(produit, produitId);

    const properties = {
      "Besoin":            titleProp(title),
      "Quantité suggérée": numberProp(quantite),
      "Statut":            selectProp(statut || "À commander"),
      "Source":            selectProp(source || "Commandes"),
      "Date création":     dateProp(new Date().toISOString()),
    };
    if (unite)         properties["Unité"]          = selectProp(unite);
    if (statut === "Envoyé") properties["Date envoi"] = dateProp(new Date().toISOString());
    if (message)       properties["Message envoyé"] = textProp(message);

    if (resolvedProduitId) properties["Produit"]    = relationProp(resolvedProduitId);
    if (fournisseurId)     properties["Fournisseur"] = relationProp(fournisseurId);
    if (staffId)           properties["Staff"]       = relationProp(staffId);

    const page = await createPage(DB.BESOINS, properties);
    return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
