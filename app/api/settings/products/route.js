const NOTION_KEY = () => process.env.NOTION_API_KEY;
const NOTION_VER = "2022-06-28";
const DB = "3699512cf66a808fb9fdf39666926abb";
const DB_SUPPLIERS = "3689512cf66a805e8330fe73f781d1a5";
const STOCK_DB = "3689512cf66a80aa8c43eb4f85347f8e";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const nHeaders = () => ({
  "Authorization": `Bearer ${NOTION_KEY()}`,
  "Notion-Version": NOTION_VER,
  "Content-Type": "application/json",
});

// Schema MOKA_Ingredients_Master :
//   Ingredient (title), Visible_OrderPad (checkbox),
//   Categorie (select), Sous-categorie (select), Zone_stockage (select),
//   Methode_suivi (select), Unite_stock (select), Unite_commande (select),
//   Seuil_alerte (number), Seuil_critique (number),
//   Quantite_commande_suggeree (number), "1 Portion (g)" (number),
//   Notes (rich_text), Fournisseur par defaut (relation)

async function resolveSupplierByName(name) {
  if (!name) return null;
  const res = await fetch(`https://api.notion.com/v1/databases/${DB_SUPPLIERS}/query`, {
    method: "POST",
    headers: nHeaders(),
    body: JSON.stringify({ page_size: 200 }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const clean = name.trim().toLowerCase();
  const found = (data.results || []).find((p) => {
    const t = (p.properties?.Fournisseur?.title?.[0]?.plain_text || "").trim().toLowerCase();
    return t === clean;
  });
  return found?.id || null;
}

function buildProps(body) {
  const {
    ingredient, fournisseurDefaut, visibleOrderPad,
    categorie, sousCategorie, zoneStockage, methodeSuivi,
    quantiteCommandeSuggeree, uniteStock, uniteCommande,
    seuilAlerte, seuilCritique, portionGrammes, notes,
  } = body;

  const props = {
    "Ingredient":      { title: [{ text: { content: (ingredient || "").trim() } }] },
    "Visible_OrderPad":{ checkbox: visibleOrderPad ?? true },
  };
  if (categorie)      props["Categorie"]                   = { select: { name: categorie } };
  if (sousCategorie)  props["Sous-categorie"]              = { select: { name: sousCategorie } };
  if (zoneStockage)   props["Zone_stockage"]               = { select: { name: zoneStockage } };
  if (methodeSuivi)   props["Methode_suivi"]               = { select: { name: methodeSuivi } };
  if (uniteStock)     props["Unite_stock"]                 = { select: { name: uniteStock } };
  if (uniteCommande)  props["Unite_commande"]              = { select: { name: uniteCommande } };
  if (seuilAlerte   != null) props["Seuil_alerte"]                = { number: Number(seuilAlerte) };
  if (seuilCritique != null) props["Seuil_critique"]               = { number: Number(seuilCritique) };
  if (quantiteCommandeSuggeree != null) props["Quantite_commande_suggeree"] = { number: Number(quantiteCommandeSuggeree) };
  if (portionGrammes != null) props["1 Portion (g)"]              = { number: Number(portionGrammes) };
  if (notes)          props["Notes"]                       = { rich_text: [{ text: { content: notes } }] };
  return props;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (!String(body.ingredient || body.name || "").trim()) {
      return Response.json({ success: false, error: "Nom ingrédient requis" }, { status: 400, headers: corsHeaders });
    }

    // Normalise ingredient field (saveSettings sends "name", saveProductDbCreate sends "ingredient")
    if (!body.ingredient && body.name) body.ingredient = body.name;

    const properties = buildProps(body);

    // Résolution du fournisseur par ID direct ou par nom
    const supplierPageId = body.fournisseurId || await resolveSupplierByName(body.fournisseurDefaut || "");
    if (supplierPageId) {
      properties["Fournisseur par defaut"] = { relation: [{ id: supplierPageId }] };
    }

    console.log("[POST products] properties:", JSON.stringify(properties));

    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: nHeaders(),
      body: JSON.stringify({ parent: { database_id: DB }, properties }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[POST products] Notion error:", JSON.stringify(data));
      return Response.json({ success: false, error: data.message }, { status: 500, headers: corsHeaders });
    }

    // Create matching stock entry immediately, same server request
    const ingredientId = data.id;
    const ingredientName = (body.ingredient || body.name || "").trim();
    try {
      const stockProps = {
        Produit: { title: [{ text: { content: ingredientName } }] },
        Quantite_stock: { number: 0 },
        MOKA_Ingredients_Master: { relation: [{ id: ingredientId }] },
      };
      if (body.uniteStock) stockProps.Unite_stock = { select: { name: body.uniteStock } };
      await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: nHeaders(),
        body: JSON.stringify({ parent: { database_id: STOCK_DB }, properties: stockProps }),
      });
      console.log("[POST products] Entrée stock créée pour :", ingredientName);
    } catch (stockErr) {
      console.error("[POST products] Erreur création entrée stock (non bloquant):", stockErr.message);
    }

    return Response.json({ success: true, id: ingredientId, item: { id: ingredientId, ...body } }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST products] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...rest } = body;

    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

    // Normalise ingredient field
    if (!rest.ingredient && rest.name) rest.ingredient = rest.name;

    const properties = buildProps(rest);

    const supplierPageId = rest.fournisseurId || await resolveSupplierByName(rest.fournisseurDefaut || "");
    if (supplierPageId) {
      properties["Fournisseur par defaut"] = { relation: [{ id: supplierPageId }] };
    }

    console.log("[PATCH products] id:", id, "properties:", JSON.stringify(properties));

    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: nHeaders(),
      body: JSON.stringify({ properties }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[PATCH products] Notion error:", JSON.stringify(data));
      return Response.json({ success: false, error: data.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH products] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    if (!id) return Response.json({ error: "id required" }, { status: 400, headers: corsHeaders });

    const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: "PATCH",
      headers: nHeaders(),
      body: JSON.stringify({ archived: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[DELETE products] Notion error:", JSON.stringify(data));
      return Response.json({ success: false, error: data.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE products] Exception:", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
