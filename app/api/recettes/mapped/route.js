import {
  DB, corsHeaders, queryDatabase, createPage, updatePage, getPage, archivePage,
  getTitle, getText, getNumber, getSelect, getCheckbox,
  titleProp, textProp, numberProp, selectProp, checkboxProp,
} from "../../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// Recettes mappées (Tab 2 de /recettes) — deux usages dans la même base
// (MOKA_Recettes_Batch), distingués par `type` :
//   "menu"  : produit vendu (Sold_Product_Id) -> ingrédients bruts ET/OU
//             prépas/batch (voir `lignes[].kind`)
//   "batch" : prépa (ex: Guacamole) -> ingrédients bruts uniquement,
//             avec la quantité produite pour un lot
// `lignes` est stocké en JSON dans une seule propriété rich_text (même
// pattern que MOKA_Planning.Horaires) : évite une base de jonction séparée
// et permet à une ligne de référencer soit un ingrédient brut (relation
// Notion normale, MOKA_Ingredients_Master) soit une autre recette batch
// (pas de type de relation Notion stable pour ce cas) sans avoir deux
// schémas de propriétés différents.
function safeParseLignes(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalize(page) {
  const p = page.properties;
  return {
    id: page.id,
    type: getSelect(p, "Type") || "batch",
    nom: getTitle(p, "Nom"),
    soldProductId: getText(p, "Sold_Product_Id"),
    lignes: safeParseLignes(getText(p, "Lignes")),
    quantiteProduite: getNumber(p, "Quantite_Produite"),
    uniteProduite: getSelect(p, "Unite_Produite"),
    actif: getCheckbox(p, "Actif"),
  };
}

// GET [?type=menu|batch] [?soldProductId=]
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const soldProductId = searchParams.get("soldProductId");

    const filters = [{ property: "Actif", checkbox: { equals: true } }];
    if (type) filters.push({ property: "Type", select: { equals: type } });
    if (soldProductId) filters.push({ property: "Sold_Product_Id", rich_text: { equals: soldProductId } });

    const pages = await queryDatabase(DB.RECETTES_BATCH, filters.length > 1 ? { and: filters } : filters[0]);
    return Response.json(pages.map(normalize), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET recettes/mapped]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST { type: "menu"|"batch", nom, soldProductId?, lignes: [{kind, id, name, qty, unit}], quantiteProduite?, uniteProduite? }
export async function POST(req) {
  try {
    const data = await req.json();
    if (!String(data.nom || "").trim()) {
      return Response.json({ success: false, error: "Nom requis" }, { status: 400, headers: corsHeaders });
    }
    const page = await createPage(DB.RECETTES_BATCH, {
      Nom: titleProp(data.nom),
      Type: selectProp(data.type === "menu" ? "menu" : "batch"),
      Sold_Product_Id: textProp(data.soldProductId || ""),
      Lignes: textProp(JSON.stringify(Array.isArray(data.lignes) ? data.lignes : [])),
      Quantite_Produite: numberProp(data.quantiteProduite),
      Unite_Produite: selectProp(data.uniteProduite),
      Actif: checkboxProp(true),
    });
    return Response.json({ success: true, id: page.id, item: normalize(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST recettes/mapped]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// PATCH { id, nom?, lignes?, quantiteProduite?, uniteProduite? } — utilisé
// pour ajouter/retirer une ligne d'une recette existante (le client envoie
// le tableau `lignes` complet déjà modifié, pas un diff).
export async function PATCH(req) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return Response.json({ success: false, error: "id requis" }, { status: 400, headers: corsHeaders });

    const properties = {};
    if ("nom" in data) properties.Nom = titleProp(data.nom);
    if ("lignes" in data) properties.Lignes = textProp(JSON.stringify(data.lignes));
    if ("quantiteProduite" in data) properties.Quantite_Produite = numberProp(data.quantiteProduite);
    if ("uniteProduite" in data) properties.Unite_Produite = selectProp(data.uniteProduite);

    await updatePage(id, properties);
    const page = await getPage(id);
    return Response.json({ success: true, item: normalize(page) }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH recettes/mapped]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE ?id= — archive plutôt que suppression réelle.
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ success: false, error: "id requis" }, { status: 400, headers: corsHeaders });
    await archivePage(id);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[DELETE recettes/mapped]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
