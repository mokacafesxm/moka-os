import { DB, corsHeaders, queryDatabase, getTitle, getText, getSelect, getNumber, getDate, getRelationIds } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.PREPS, {
      property: "Statut",
      select: { equals: "À faire" },
    });

    const preps = pages.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        name: getTitle(p, "Préparation", "Produit", "produit", "Nom", "nom", "Name"),
        quantity: getNumber(p, "Quantité", "quantite", "Quantite"),
        unit: getSelect(p, "Unité", "unite", "Unite", "Unit"),
        priority: getSelect(p, "Priorité", "priorite", "Priorite", "Priority"),
        status: getSelect(p, "Statut", "statut", "Status"),
        dueDate: getDate(p, "Date limite", "Date", "date"),
        assignedTo: getText(p, "Assigné à", "Assigne", "assignedTo", "Staff"),
      };
    });

    return Response.json(preps, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
