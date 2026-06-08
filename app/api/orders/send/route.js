import { DB, corsHeaders, createPage, updatePage, queryDatabase, titleProp, textProp, selectProp, numberProp, dateProp, relationProp, getTitle } from "../../_notion";

async function buildIdMap(dbId, nameProp) {
  const pages = await queryDatabase(dbId, null, null, 200);
  const map = {};
  for (const p of pages) {
    const name = getTitle(p.properties, nameProp, "Nom", "nom", "Name", "name", "Ingredient");
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
      buildIdMap(DB.FOURNISSEURS, "Nom"),
      buildIdMap(DB.STAFF, "Prénom"),
    ]);

    const results = await Promise.all(items.map(async (item) => {
      const {
        id, Produit, "Quantité": Quantite, Unite,
        Fournisseur, StaffName, Source, Date: date,
      } = item;

      const properties = {
        "Produit":    titleProp(Produit || ""),
        "Quantité":   numberProp(Quantite),
        "Unité":      selectProp(Unite),
        "Fournisseur": textProp(Fournisseur || ""),
        "Statut":     selectProp("À commander"),
        "Source":     textProp(Source || "MOKA OS"),
      };

      if (date) properties["Date"] = dateProp(date);

      const page = await createPage(DB.BESOINS, properties);

      // Resolve and patch relations
      const prodId     = id || productMap[(Produit || "").toLowerCase()];
      const foId       = supplierMap[(Fournisseur || "").toLowerCase()];
      const staffId    = staffMap[(StaffName || "").toLowerCase()];

      const relProps = {};
      if (prodId)  relProps["Ingredient"]   = relationProp(prodId);
      if (foId)    relProps["Fournisseur relation"] = relationProp(foId);
      if (staffId) relProps["Staff"]         = relationProp(staffId);

      if (Object.keys(relProps).length) {
        await updatePage(page.id, relProps).catch(() => {});
      }

      return page.id;
    }));

    return Response.json({ success: true, ids: results }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
