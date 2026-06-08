import { DB, corsHeaders, queryDatabase, getTitle, getText, getSelect, getNumber, getDate } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const pages = await queryDatabase(DB.PREPS, {
      or: [
        { property: "Statut", select: { equals: "À faire" } },
        { property: "Statut", select: { equals: "En cours" } },
      ],
    });

    const preps = pages.map((page) => {
      const p = page.properties;
      return {
        id: page.id,
        name: getTitle(p, "Action"),
        quantity: getNumber(p, "Quantité suggérée"),
        unit: getSelect(p, "Unité"),
        priority: getSelect(p, "Priorité"),
        status: getSelect(p, "Statut"),
        dueDate: getDate(p, "Date prévue"),
        assignedTo: getText(p, "Staff"),
        type: getSelect(p, "Type"),
        comment: getText(p, "Commentaire"),
      };
    });

    return Response.json(preps, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
