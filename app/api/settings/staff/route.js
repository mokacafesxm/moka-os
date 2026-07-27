import { DB, corsHeaders, getPage, updatePage, createPage, queryDatabase, resolveName, archivePage } from "../../_notion";
import { listStaff, createStaff, updateStaff, archiveStaff } from "../../../../lib/ops/staff-service";

// Canonical writer for STAFF — Architecture cleanup Phase 1. This is the
// route actually used by the live Settings UI. Schema mapping now lives in
// lib/ops/staff-service.js, shared with the resource=staff branch of
// app/api/settings. See docs/ARCHITECTURE.md "Architecture cleanup — Phase 1".
const notion = { getPage, updatePage, createPage, queryDatabase, resolveName, archivePage };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const list = await listStaff({ staffDbId: DB.STAFF, notion });
    return Response.json(list, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET staff]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const data = await req.json();
    const { id, item } = await createStaff(data, { staffDbId: DB.STAFF, notion });
    return Response.json({ success: true, id, item }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST staff] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await updateStaff(id, data, { notion });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH staff] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    await archiveStaff(id, { notion });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE staff] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
