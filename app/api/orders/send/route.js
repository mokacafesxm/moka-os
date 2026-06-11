import { DB, corsHeaders, createPage, queryDatabase, titleProp, textProp, selectProp, numberProp, relationProp, getTitle } from "../../_notion";

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

    const [supplierMap, staffMap, productMap] = await Promise.all([
      buildIdMap(DB.FOURNISSEURS, "Fournisseur"),
      buildIdMap(DB.STAFF, "Prénom", "Nom", "Name"),
      buildIdMap(DB.INGREDIENTS, "Ingredient"),
    ]);

    const grouped = {};
    items.forEach((item) => {
      const sup = item.Fournisseur || "Sans fournisseur";
      if (!grouped[sup]) grouped[sup] = { items: [], staffName: item.StaffName || "Staff" };
      grouped[sup].items.push(item);
    });

    const nowSXM = new Date().toLocaleString("sv-SE", { timeZone: "America/Puerto_Rico" }).replace(" ", "T") + "-04:00";
    const dateStr = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "America/Puerto_Rico",
    });

    const results = await Promise.all(Object.entries(grouped).map(async ([supName, { items: groupItems, staffName }]) => {
      const foId    = supplierMap[supName.toLowerCase()];
      const staffId = staffMap[staffName.toLowerCase()];

      const lines   = groupItems.map((p) => `- ${p.Produit} — ${p["Quantité"]} ${p.Unite || ""}`.trim()).join("\n");
      const message = `Bonjour ${supName} 👋\n\nCommande du ${dateStr} :\n\n${lines}\n\nMerci 🙏\n— Équipe MÖKA`;

      const properties = {
        "Besoin":            titleProp(`NEW ORDER : ${staffName}`),
        "Quantité suggérée": numberProp(groupItems.length),
        "Statut":            selectProp("À commander"),
        "Source":            selectProp("OrderPad"),
        "Message envoyé":    textProp(message),
        "ID Produit":        textProp(groupItems.map((p) => p.Produit).join(", ")),
        "Date création":     { date: { start: nowSXM } },
      };

      const produitIds = groupItems
        .map((p) => (/^[0-9a-f-]{36}$/i.test(String(p.id || "")) ? p.id : null) || productMap[(p.Produit || "").toLowerCase()])
        .filter(Boolean);
      if (produitIds.length) properties["Produit"] = { relation: produitIds.map((id) => ({ id })) };
      if (foId)    properties["Fournisseur"] = relationProp(foId);
      if (staffId) properties["Staff"]       = relationProp(staffId);

      const page = await createPage(DB.BESOINS, properties);
      return page.id;
    }));

    return Response.json({ success: true, ids: results }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
