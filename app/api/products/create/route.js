import { DB, corsHeaders, createPage, queryDatabase, titleProp, selectProp, numberProp, checkboxProp, relationProp, getTitle } from "../../_notion";

async function resolveSupplier(name) {
  if (!name) return null;
  const pages = await queryDatabase(DB.FOURNISSEURS, {
    property: "Nom",
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
      "Ingredient":                 titleProp(name),
      "Catégorie":                  selectProp(categorie),
      "Sous-catégorie":             selectProp(sousCategorie),
      "Visible OrderPad":           checkboxProp(visibleOrderPad),
      "Zone de stockage":           selectProp(zoneStockage),
      "Quantité commandée suggérée": numberProp(quantiteCommandee),
      "Unité stock":                selectProp(uniteStock),
      "Unité commande":             selectProp(uniteCommande),
      "Portion (g)":                numberProp(portion),
      "Seuil alerte":               numberProp(seuilAlerte),
      "Seuil critique":             numberProp(seuilCritique),
    };

    if (supplierPageId) {
      properties["Fournisseur par défaut"] = relationProp(supplierPageId);
    }

    const page = await createPage(DB.INGREDIENTS, properties);
    return Response.json({ success: true, id: page.id }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}
