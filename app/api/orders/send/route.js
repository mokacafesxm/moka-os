import { DB, corsHeaders, createPage, queryDatabase, titleProp, selectProp, numberProp, dateProp, relationProp, getTitle } from "../../_notion";

async function buildIdMap(dbId, ...titleKeys) {
  const pages = await queryDatabase(dbId, null, null, 200);
  const map = {};
  for (const p of pages) {
    const name = getTitle(p.properties, ...titleKeys);
    if (name) map[name.toLowerCase()] = p.id;
  }
  return map;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const items = await request.json();

    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "Array of order items required" }, { status: 400, headers: corsHeaders });
    }

    const [productMap, supplierMap, staffMap] = await Promise.all([
      buildIdMap(DB.INGREDIENTS, "Ingredient"),
      buildIdMap(DB.FOURNISSEURS, "Fournisseur"),
      buildIdMap(DB.STAFF, "Prénom", "Nom", "Name"),
    ]);

    const results = await Promise.all(items.map(async (item) => {
      const {
        id, Produit, "Quantité": Quantite, Unite,
        Fournisseur, StaffName, Source, Date: date,
      } = item;

      const prodId     = id || productMap[(Produit || "").toLowerCase()];
      const foId       = supplierMap[(Fournisseur || "").toLowerCase()];
      const staffId    = staffMap[(StaffName || "").toLowerCase()];

      const properties = {
        "Besoin":            titleProp(Produit || ""),
        "Quantité suggérée": numberProp(Quantite),
        "Unité":             selectProp(Unite),
        "Statut":            selectProp("À commander"),
        "Source":            selectProp(Source || "MOKA OS"),
      };

      if (date)    properties["Date envoi"] = dateProp(date);
      if (prodId)  properties["Produit"]    = relationProp(prodId);
      if (foId)    properties["Fournisseur"] = relationProp(foId);
      if (staffId) properties["Staff"]      = relationProp(staffId);

      const page = await createPage(DB.BESOINS, properties);
      return page.id;
    }));

    return Response.json({ success: true, ids: results }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
