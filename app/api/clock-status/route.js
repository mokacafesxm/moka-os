import { DB, corsHeaders, queryDatabase, withNotionCache, getText, getSelect, getDate } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const statusMap = await withNotionCache("clock-status", 15000, async () => {
    const todaySXM = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Puerto_Rico",
    });
    const startOfDaySXM = new Date(todaySXM + "T00:00:00-04:00").toISOString();

    const pages = await queryDatabase(DB.POINTAGES, {
      property: "Date et heure",
      date: { on_or_after: startOfDaySXM },
    }, [{ property: "Date et heure", direction: "ascending" }], 500);

    const statusMap = {};
    const timesMap = {}; // horodatage de l'action qui a produit le statut courant

    pages
      .map((p) => ({
        staff: getText(p.properties, "Staff") || "",
        action: getSelect(p.properties, "Action") || "",
        date: getDate(p.properties, "Date et heure") || p.created_time || "",
      }))
      .filter((p) => p.staff && p.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(({ staff, action, date }) => {
        const a = action.toLowerCase();
        if (a === "arrivée") { statusMap[staff] = "present"; timesMap[staff] = date; }
        else if (a === "départ pause") { statusMap[staff] = "pause"; timesMap[staff] = date; }
        else if (a === "retour pause") { statusMap[staff] = "present"; timesMap[staff] = date; }
        else if (a === "départ") { statusMap[staff] = "done"; timesMap[staff] = date; }
      });

      // "__times" est une clé technique ajoutée à la fin, jamais un nom de
      // staff réel — les consommateurs existants (StaffContext, page.js
      // legacy) indexent ce map uniquement par nom de staff et n'itèrent
      // jamais toutes ses clés, donc l'ajout reste rétrocompatible.
      statusMap.__times = timesMap;
      return statusMap;
    });

    return Response.json(statusMap, { headers: corsHeaders });
  } catch (err) {
    return Response.json({}, { status: 500, headers: corsHeaders });
  }
}
