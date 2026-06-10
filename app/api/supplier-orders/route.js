import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage,
  getTitle, getText, getSelect, getNumber, getDate, getRelationIds,
  titleProp, textProp, selectProp, numberProp, dateProp, relationProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.BESOINS, null, [
      { property: "Date envoi", direction: "descending" },
    ], 200);

    const orders = pages.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        produit: getTitle(p, "Besoin"),
        quantite: getNumber(p, "Quantité suggérée"),
        unite: getSelect(p, "Unité"),
        statut: getSelect(p, "Statut"),
        source: getSelect(p, "Source"),
        date: getDate(p, "Date envoi", "Date création"),
        produitId: getRelationIds(p, "Produit")[0] || null,
        fournisseurId: getRelationIds(p, "Fournisseur")[0] || null,
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
    const { action, produit, quantite, unite, fournisseurId, statut, source, message, produitId, staffId } = body;

    if (action === "updateStatus") {
      const { id, statut: newStatut, dateSent, message: sentMsg } = body;
      const properties = {
        "Statut": selectProp(newStatut),
      };
      if (dateSent) properties["Date envoi"] = dateProp(dateSent);
      if (sentMsg)  properties["Message envoyé"] = textProp(sentMsg);
      await updatePage(id, properties);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    const properties = {
      "Besoin":            titleProp(produit || ""),
      "Quantité suggérée": numberProp(quantite),
      "Unité":             selectProp(unite),
      "Statut":            selectProp(statut || "À commander"),
      "Source":            selectProp(source || "Commandes"),
      "Date création":     dateProp(new Date().toISOString()),
    };
    if (statut === "Envoyé") properties["Date envoi"] = dateProp(new Date().toISOString());
    if (message)       properties["Message envoyé"] = textProp(message);

    if (produitId)     properties["Produit"]     = relationProp(produitId);
    if (fournisseurId) properties["Fournisseur"] = relationProp(fournisseurId);
    if (staffId)       properties["Staff"]       = relationProp(staffId);

    const page = await createPage(DB.BESOINS, properties);
    return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
