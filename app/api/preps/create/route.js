import { DB, corsHeaders, createPage, titleProp, textProp, selectProp, numberProp, dateProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const items = Array.isArray(body) ? body : [body];

    const results = await Promise.all(items.map(async (item) => {
      const { produit, quantite, unite, priorite, statut, staffName, staffId, source, dueDate } = item;

      const properties = {
        "Action":            titleProp(`Préparer ${produit || "Préparation"}`),
        "Quantité suggérée": numberProp(Number(quantite) || 1),
        "Unité":             selectProp(unite || "kg"),
        "Priorité":          selectProp(priorite || "Normale"),
        "Statut":            selectProp(statut || "À faire"),
        "Source alerte":     selectProp(source || "Stock Live"),
        "Staff":             textProp(staffName || ""),
        "Commentaire":       textProp("Créé depuis Stock Live MOKA OS"),
      };

      if (dueDate) properties["Date prévue"] = dateProp(dueDate);

      Object.keys(properties).forEach((k) => {
        if (properties[k] === undefined) delete properties[k];
      });

      const page = await createPage(DB.PREPS, properties);
      return { success: true, id: page.id };
    }));

    return Response.json(results.length === 1 ? results[0] : results, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
