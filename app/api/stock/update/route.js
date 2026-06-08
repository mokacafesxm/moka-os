import { DB, corsHeaders, getPage, updatePage, getNumber, selectProp, numberProp } from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const { id, poidsTotal, Unite, mode } = await request.json();

    if (!id) {
      return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });
    }

    let newQuantity = Number(poidsTotal) || 0;

    if (mode === "add") {
      const page = await getPage(id);
      const p = page.properties;
      const current = getNumber(p, "Quantite_stock", "Quantité stock", "quantiteStock", "Quantite stock");
      newQuantity = current + newQuantity;
    }

    const properties = {
      "Quantite_stock": numberProp(newQuantity),
    };

    if (Unite) {
      properties["Unite_stock"] = selectProp(Unite);
    }

    await updatePage(id, properties);
    return Response.json({ success: true, newQuantity }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
