import {
  DB, corsHeaders,
  getPage, updatePage, createPage, queryDatabase, resolveName, archivePage,
  getSelect,
} from "../_notion";
import { listSuppliers, createSupplier, updateSupplier, archiveSupplier } from "../../../lib/ops/suppliers-service";
import { listStaff, createStaff, updateStaff, archiveStaff } from "../../../lib/ops/staff-service";
import { createIngredient, updateIngredient } from "../../../lib/ops/ingredients-service";

// Generic action-based settings router. The resource=suppliers/staff/products
// branches below are NOT reachable from the current UI — every live caller
// uses the dedicated /api/settings/{suppliers,staff} routes or
// /api/settings/products instead (see app/page.js loadSettingsPanel /
// fetchSettingsResource, which special-case "suppliers"/"staff" and never
// offer "products" as a generic-settings resource). They previously assumed
// a WRONG schema for staff (Rôle as select, Téléphone as rich_text) and
// would have failed with a Notion 400 if ever invoked; they now delegate to
// the same canonical services as the dedicated routes, so if this generic
// path is ever wired up in the future it is correct AND consistent from day
// one. Only the referentiels "list" branches below (categories/
// subcategories/units/zones) are genuinely live today — left untouched.
// See docs/ARCHITECTURE.md "Architecture cleanup — Phase 1".
const notion = { getPage, updatePage, createPage, queryDatabase, resolveName, archivePage };

async function listFromIngredients(prop) {
  const pages = await queryDatabase(DB.INGREDIENTS, null, null, 200);
  const values = new Set();
  for (const page of pages) {
    const v = getSelect(page.properties, prop);
    if (v) values.add(v);
  }
  return [...values].sort().map((v) => ({ id: v, name: v }));
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  let resource, action, id, data;
  try {
    ({ resource, action, id, data } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  try {
    // ── LIST ─────────────────────────────────────────────────────────────────
    if (action === "list") {
      if (resource === "suppliers") return Response.json(await listSuppliers({ fournisseursDbId: DB.FOURNISSEURS, notion }), { headers: corsHeaders });
      if (resource === "staff") return Response.json(await listStaff({ staffDbId: DB.STAFF, notion }), { headers: corsHeaders });
      if (resource === "categories") return Response.json(await listFromIngredients("Categorie"), { headers: corsHeaders });
      if (resource === "subcategories") return Response.json(await listFromIngredients("Sous-categorie"), { headers: corsHeaders });
      if (resource === "units") return Response.json(await listFromIngredients("Unite_stock"), { headers: corsHeaders });
      if (resource === "zones") return Response.json(await listFromIngredients("Zone_stockage"), { headers: corsHeaders });
      return Response.json({ error: `Unknown resource: ${resource}` }, { status: 400, headers: corsHeaders });
    }

    // ── CREATE ───────────────────────────────────────────────────────────────
    if (action === "create") {
      if (resource === "suppliers") {
        const { id: newId } = await createSupplier(data, { fournisseursDbId: DB.FOURNISSEURS, notion });
        return Response.json({ success: true, id: newId }, { headers: corsHeaders });
      }
      if (resource === "staff") {
        const { id: newId } = await createStaff(data, { staffDbId: DB.STAFF, notion });
        return Response.json({ success: true, id: newId }, { headers: corsHeaders });
      }
      if (resource === "products") {
        const { id: newId } = await createIngredient(data, {
          ingredientsDbId: DB.INGREDIENTS, fournisseursDbId: DB.FOURNISSEURS, notion, mode: "full", bootstrapStockRow: false,
        });
        return Response.json({ success: true, id: newId }, { headers: corsHeaders });
      }
      return Response.json({ error: `create not supported for ${resource}` }, { status: 400, headers: corsHeaders });
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────
    if (action === "update") {
      if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

      if (resource === "suppliers") {
        await updateSupplier(id, data, { notion });
      } else if (resource === "staff") {
        await updateStaff(id, data, { notion });
      } else if (resource === "products") {
        await updateIngredient(id, data, { fournisseursDbId: DB.FOURNISSEURS, notion, mode: "full" });
      } else {
        return Response.json({ error: `update not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ── ARCHIVE ──────────────────────────────────────────────────────────────
    if (action === "archive") {
      if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

      if (resource === "suppliers") {
        await archiveSupplier(id, { notion });
      } else if (resource === "staff") {
        await archiveStaff(id, { notion });
      } else {
        return Response.json({ error: `archive not supported for ${resource}` }, { status: 400, headers: corsHeaders });
      }

      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });

  } catch (err) {
    console.error("[api/settings] error:", action, resource, err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
