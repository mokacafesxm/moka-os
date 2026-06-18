import { DB, corsHeaders, createPage, textProp, selectProp, dateProp } from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { staffName, action } = await request.json();

    if (!staffName || !action) {
      return Response.json({ error: "staffName and action required" }, { status: 400, headers: corsHeaders });
    }

    const nowSXM = new Date().toLocaleString("sv-SE", {
      timeZone: "America/Puerto_Rico",
    }).replace(" ", "T") + "-04:00";

    await createPage(DB.POINTAGES, {
      "Staff":          textProp(staffName),
      "Action":         selectProp(action),
      "Date et heure":  dateProp(nowSXM),
    });

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
