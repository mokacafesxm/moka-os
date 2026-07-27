import { DB, corsHeaders, createPage, updatePage, queryDatabase, resolveName } from "../../_notion";
import {
  buildNameToIdMap,
  createSupplierOrder,
  groupItemsBySupplier,
  buildOrderPadMessage,
  buildOrderPadDateStr,
} from "../../../../lib/ops/supplier-orders-service";

const UUID_RE = /^[0-9a-f-]{36}$/i;
function resolveFromMap(explicitId, name, map) {
  if (explicitId && UUID_RE.test(String(explicitId))) return explicitId;
  if (!name) return null;
  return map[String(name).trim().toLowerCase()] || null;
}

// Staff-cart bulk supplier-order submission — Architecture cleanup Phase 1.
// Delegates to the same canonical BESOINS writer as /api/supplier-orders.
// Fixes the known bug where "Quantité suggérée" was written as the number of
// distinct cart items in a supplier group instead of the real ordered
// quantity (only meaningful, and only ever set, for a single-item group —
// see lib/ops/supplier-orders-service.js).
const notion = { createPage, updatePage, queryDatabase, resolveName };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const items = await request.json();

    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "Array of order items required" }, { status: 400, headers: corsHeaders });
    }

    const grouped = groupItemsBySupplier(items);
    const dateStr = buildOrderPadDateStr();

    // Resolved once for the whole request (not per supplier group) — matches
    // the original route's single-query-per-database behavior, avoiding an
    // N-groups-times-more-queries regression against Notion's rate limit.
    const [supplierMap, staffMap, productMap] = await Promise.all([
      buildNameToIdMap(DB.FOURNISSEURS, "Fournisseur", notion),
      buildNameToIdMap(DB.STAFF, "Nom", notion),
      buildNameToIdMap(DB.INGREDIENTS, "Ingredient", notion),
    ]);

    const results = await Promise.all(Object.entries(grouped).map(async ([supplierName, { items: groupItems, staffName }]) => {
      const fournisseurId = resolveFromMap(null, supplierName, supplierMap);
      const staffId = resolveFromMap(null, staffName, staffMap);

      const resolvedItems = groupItems.map((p) => ({
        name: p.Produit,
        quantite: p["Quantité"],
        unite: p.Unite,
        resolvedId: resolveFromMap(p.id, p.Produit, productMap),
      }));

      const message = buildOrderPadMessage(supplierName, groupItems, dateStr);

      const { id } = await createSupplierOrder({
        source: "OrderPad",
        staffName,
        staffId,
        fournisseur: supplierName,
        fournisseurId,
        message,
        items: resolvedItems,
        besoinsDbId: DB.BESOINS,
        notion,
      });
      return id;
    }));

    return Response.json({ success: true, ids: results }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
