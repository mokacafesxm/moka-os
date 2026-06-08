import { DB, corsHeaders, createPage, titleProp, textProp, selectProp, numberProp, dateProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { produit, quantite, unite, priorite, statut, staffName, dueDate } = await request.json();

    const properties = {
      "Action":               titleProp(produit),
      "Quantité suggérée":    numberProp(quantite),
      "Unité":                selectProp(unite),
      "Priorité":             selectProp(priorite || "Normal"),
      "Statut":               selectProp(statut || "À faire"),
    };

    if (staffName) properties["Staff"] = textProp(staffName);
    if (dueDate)   properties["Date prévue"] = dateProp(dueDate);

    const page = await createPage(DB.PREPS, properties);
    return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
