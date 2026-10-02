import { corsHeaders, getPage, updatePage, archivePage } from "../../../_notion";
import { normalizePromo, buildPromoProperties } from "../route";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const page = await getPage(id);
    return Response.json(normalizePromo(page), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET admin/promos/:id]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const data = await request.json();
    await updatePage(id, buildPromoProperties(data));
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH admin/promos/:id]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    await archivePage(id);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE admin/promos/:id]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
