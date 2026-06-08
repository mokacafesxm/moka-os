import {
  DB, corsHeaders,
  queryDatabase, createPage,
  getTitle, getText, getSelect, getNumber, getDate,
  titleProp, textProp, selectProp, numberProp, dateProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.BESOINS, null, [
      { property: "Date", direction: "descending" },
    ], 200);

    const orders = pages.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        produit: getTitle(p, "Produit", "produit", "Nom", "Ingredient"),
        quantite: getNumber(p, "Quantité", "quantite", "Quantite"),
        unite: getSelect(p, "Unité", "unite", "Unite"),
        fournisseur: getText(p, "Fournisseur", "fournisseur"),
        statut: getSelect(p, "Statut", "statut", "Status"),
        notes: getText(p, "Notes", "notes"),
        date: getDate(p, "Date", "date", "Date création"),
        staff: getText(p, "Staff", "staff"),
        source: getText(p, "Source", "source"),
      };
    });

    return Response.json(orders, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request) {
  try {
    const { produit, quantite, unite, fournisseur, statut, notes } = await request.json();

    const properties = {
      "Produit":    titleProp(produit || ""),
      "Quantité":   numberProp(quantite),
      "Unité":      selectProp(unite),
      "Fournisseur": textProp(fournisseur || ""),
      "Statut":     selectProp(statut || "À commander"),
      "Date":       dateProp(new Date().toISOString()),
    };

    if (notes) properties["Notes"] = textProp(notes);

    const page = await createPage(DB.BESOINS, properties);
    return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
