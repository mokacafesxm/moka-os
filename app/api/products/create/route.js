import { DB, corsHeaders, createPage, queryDatabase, titleProp, selectProp, numberProp, checkboxProp, relationProp } from "../../_notion";

async function resolveSupplier(name) {
  if (!name) return null;
  const pages = await queryDatabase(DB.FOURNISSEURS, {
    property: "Fournisseur",
    title: { equals: name },
  }, null, 1);
  return pages[0]?.id || null;
}

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name, categorie, sousCategorie, visibleOrderPad,
      fournisseurDefaut, zoneStockage, quantiteCommandee,
      uniteStock, uniteCommande, portion, seuilAlerte, seuilCritique,
    } = body;

    const supplierPageId = await resolveSupplier(fournisseurDefaut);

    const properties = {
      "Ingredient":                   titleProp(name),
      "Categorie":                    selectProp(categorie),
      "Sous-categorie":               selectProp(sousCategorie),
      "Visible_OrderPad":             checkboxProp(visibleOrderPad),
      "Zone_stockage":                selectProp(zoneStockage),
      "Quantite_commande_suggeree":   numberProp(quantiteCommandee),
      "Unite_stock":                  selectProp(uniteStock),
      "Unite_commande":               selectProp(uniteCommande),
      "1 Portion (g)":                numberProp(portion),
      "Seuil_alerte":                 numberProp(seuilAlerte),
      "Seuil_critique":               numberProp(seuilCritique),
    };

    if (supplierPageId) {
      properties["Fournisseur par defaut"] = relationProp(supplierPageId);
    }

    const page = await createPage(DB.INGREDIENTS, properties);
    return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
