import { DB, corsHeaders, queryDatabase, getText, getSelect, getDate } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const todayStart = new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Puerto_Rico" })
    );
    todayStart.setHours(0, 0, 0, 0);

    const pages = await queryDatabase(DB.POINTAGES, {
      property: "Date et heure",
      date: { on_or_after: todayStart.toISOString() },
    });

    const statusMap = {};

    pages
      .map((p) => ({
        staff: getText(p.properties, "Staff") || "",
        action: getSelect(p.properties, "Action") || "",
        date: getDate(p.properties, "Date et heure") || p.created_time || "",
      }))
      .filter((p) => p.staff && p.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .forEach(({ staff, action }) => {
        const a = action.toLowerCase();
        if (a === "arrivée") statusMap[staff] = "present";
        else if (a === "départ pause") statusMap[staff] = "pause";
        else if (a === "retour pause") statusMap[staff] = "present";
        else if (a === "départ") statusMap[staff] = "done";
      });

    return Response.json(statusMap, { headers: corsHeaders });
  } catch (err) {
    return Response.json({}, { status: 500, headers: corsHeaders });
  }
}
