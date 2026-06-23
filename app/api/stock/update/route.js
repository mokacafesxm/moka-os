import { DB, corsHeaders, getPage, updatePage, createPage, resolveName, getNumber, selectProp, numberProp, titleProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { id, poidsTotal, Unite, mode, name, notionProductId } = await request.json();

    let targetId = id || null;

    // Lookup by name if no id provided
    if (!targetId && name) {
      targetId = await resolveName(DB.STOCK, "Produit", String(name).trim());
    }

    const quantity = Number(poidsTotal) || 0;

    if (targetId) {
      // UPDATE existing stock entry
      let finalQuantity = quantity;
      if (mode === "add") {
        const page = await getPage(targetId);
        const current = getNumber(page.properties, "Quantite_stock", "Quantité stock", "quantiteStock", "Quantite stock");
        finalQuantity = (current || 0) + quantity;
      }
      const properties = { "Quantite_stock": numberProp(finalQuantity) };
      if (Unite) properties["Unite_stock"] = selectProp(Unite);
      await updatePage(targetId, properties);
      return Response.json({ success: true, newQuantity: finalQuantity, action: "update" }, { headers: corsHeaders });
    }

    // CREATE new stock entry (upsert fallback)
    if (!name) {
      return Response.json({ error: "id or name required" }, { status: 400, headers: corsHeaders });
    }
    const properties = {
      "Produit": titleProp(String(name).trim()),
      "Quantite_stock": numberProp(quantity),
    };
    if (Unite) properties["Unite_stock"] = selectProp(Unite);
    // Link to MOKA_Ingredients_Master if catalog page ID provided
    if (notionProductId) properties["MOKA_Ingredients_Master"] = { relation: [{ id: notionProductId }] };

    const page = await createPage(DB.STOCK, properties);
    return Response.json({ success: true, newQuantity: quantity, action: "create", id: page.id }, { headers: corsHeaders });
  } catch (err) {
    console.error("[stock/update]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
