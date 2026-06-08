import { corsHeaders, updatePage, selectProp, textProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const items = await request.json();

    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "Array of { id, status, staffName } required" }, { status: 400, headers: corsHeaders });
    }

    await Promise.all(items.map(({ id, status, staffName }) => {
      const properties = {
        "Statut": selectProp(status || "Fait"),
      };
      if (staffName) properties["Staff"] = textProp(staffName);
      return updatePage(id, properties);
    }));

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
