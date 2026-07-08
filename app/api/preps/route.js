import { DB, corsHeaders, queryDatabase, withNotionCache, getTitle, getText, getSelect, getNumber, getDate } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const preps = await withNotionCache("preps", 30000, async () => {
    const pages = await queryDatabase(DB.PREPS, null, null, 200);

    return pages
      .map((page) => {
        const p = page.properties;
        return {
          id: page.id,
          name: getTitle(p, "Action"),
          quantity: getNumber(p, "Quantité suggérée"),
          unit: getSelect(p, "Unité"),
          priority: getSelect(p, "Priorité"),
          status: getSelect(p, "Statut"),
          dueDate: getDate(p, "Date prévue"),
          assignedTo: getText(p, "Staff") || getSelect(p, "Staff") || "",
          type: getSelect(p, "Type"),
          station: getSelect(p, "Station") || getSelect(p, "Type") || "Cuisine",
          comment: getText(p, "Commentaire"),
        };
      })
      .filter((p) => {
        const name = String(p.name || "").trim();
        return name && name !== "Préparation" && name.length > 3;
      });
    });

    return Response.json(preps, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
