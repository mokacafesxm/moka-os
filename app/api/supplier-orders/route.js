import {
  DB, corsHeaders,
  queryDatabase, createPage, updatePage, resolveName,
  getTitle, getText, getSelect, getNumber, getDate, getRelationIds,
} from "../_notion";
import {
  resolveOrderItemIds,
  createSupplierOrder,
  updateSupplierOrderStatus,
} from "../../../lib/ops/supplier-orders-service";

// Canonical writer for BESOINS (Supplier Orders) — Architecture cleanup Phase 1.
// All property mapping/id-resolution now lives in
// lib/ops/supplier-orders-service.js, shared with /api/orders/send. See
// docs/ARCHITECTURE.md "Architecture cleanup — Phase 1".
const notion = { createPage, updatePage, queryDatabase, resolveName };

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function PATCH(req) {
  try {
    const { id, statut, dateEnvoi, dateLivraisonPrevue } = await req.json();
    if (!id) return Response.json({ success: false, error: "ID requis" }, { status: 400, headers: corsHeaders });
    await updateSupplierOrderStatus({ id, statut, dateEnvoi, dateLivraisonPrevue, notion });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH supplier-orders]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function GET() {
  try {
    const [pages, fournisseurPages] = await Promise.all([
      queryDatabase(DB.BESOINS, null, [{ property: "Date création", direction: "descending" }], 200),
      queryDatabase(DB.FOURNISSEURS),
    ]);

    const fournisseurMap = {};
    fournisseurPages.forEach((p) => {
      const nom = getTitle(p.properties, "Fournisseur", "Nom", "nom");
      if (p.id && nom) fournisseurMap[p.id] = nom;
    });

    const orders = pages.map((page) => {
      const p = page.properties;
      const fRelIds = getRelationIds(p, "Fournisseur");
      return {
        id: page.id,
        produit: getTitle(p, "Besoin"),
        quantite: getNumber(p, "Quantité suggérée"),
        unite: getSelect(p, "Unité"),
        statut: getSelect(p, "Statut"),
        source: getSelect(p, "Source"),
        date: getDate(p, "Date création") || page.created_time || "",
        dateLivraisonPrevue: getDate(p, "Date_Livraison_Prevue"),
        fournisseur: fournisseurMap[fRelIds[0]] || getText(p, "Fournisseur") || "Sans fournisseur",
        message: getText(p, "Message envoyé") || "",
        produitId: getRelationIds(p, "Produit")[0] || null,
        fournisseurId: fRelIds[0] || null,
        staffId: getRelationIds(p, "Staff")[0] || null,
      };
    });

    return Response.json(orders, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, produit, quantite, unite, fournisseurId, fournisseur, statut, source, message, produitId, staffId, staffName, produits } = body;

    // Legacy bulk action — never called from the current UI (dead code candidate,
    // kept working rather than silently removed) — now delegates to the same
    // canonical status-update function as PATCH.
    if (action === "updateStatus") {
      const { id, statut: newStatut, dateSent, message: sentMsg } = body;
      await updateSupplierOrderStatus({ id, statut: newStatut, dateEnvoi: dateSent, message: sentMsg, notion });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // Two wire shapes, both still accepted exactly as before: a grouped
    // multi-item order (`produits` array — used by the "Commandes"/"Composer"
    // compose UI) or a single top-level produit/quantite/unite (not currently
    // exercised by any live UI, kept for API-contract compatibility).
    const isGrouped = Array.isArray(produits) && produits.length > 0;
    const rawItems = isGrouped
      ? produits.map((p) => ({ name: p.name, quantite: p.qty, unite: p.unit, id: p.produitId }))
      : [{ name: produit, quantite, unite, id: produitId }];

    const items = await resolveOrderItemIds(rawItems, { ingredientsDbId: DB.INGREDIENTS, notion });

    const { id } = await createSupplierOrder({
      source, staffName, staffId, fournisseur, fournisseurId, statut, message, items,
      besoinsDbId: DB.BESOINS, notion,
    });

    return Response.json({ success: true, id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
