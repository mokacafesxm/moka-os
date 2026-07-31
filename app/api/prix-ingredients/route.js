import {
  DB, corsHeaders, queryDatabase, createPage,
  getTitle, getText, getNumber, getSelect, getDate,
  titleProp, textProp, numberProp, selectProp, dateProp,
} from "../_notion";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function normalize(page) {
  const p = page.properties;
  return {
    id: page.id,
    ingredient: getTitle(p, "Ingredient"),
    fournisseur: getText(p, "Fournisseur"),
    prixUnitaire: getNumber(p, "Prix_Unitaire"),
    unite: getSelect(p, "Unite"),
    date: getDate(p, "Date"),
    source: getSelect(p, "Source"),
    notes: getText(p, "Notes"),
  };
}

// GET [?ingredient=nom] — liste triée par date décroissante. Sans filtre,
// renvoie tout (base de taille modeste, comme /api/products) : le sélecteur
// d'ingrédient du dashboard "Évolution des prix" (/rapports) dérive sa
// propre liste d'ingrédients distincts de ce même résultat plutôt que
// d'appeler une route dédiée.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const ingredient = searchParams.get("ingredient");

    const filter = ingredient ? { property: "Ingredient", title: { equals: ingredient } } : undefined;
    const pages = await queryDatabase(DB.PRIX_INGREDIENTS, filter, [{ property: "Date", direction: "descending" }], 500);

    return Response.json(pages.map(normalize), { headers: corsHeaders });
  } catch (err) {
    console.error("[GET prix-ingredients]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// POST { produits: [{ nom, fournisseur, prix_unitaire, unite, date, source, notes }] }
// Persiste les lignes de prix (édition/vérification côté client déjà faite
// avant l'appel — voir /api/scan-facture pour l'extraction). N'écrit jamais
// dans le Stock.
export async function POST(req) {
  try {
    const { produits } = await req.json();
    if (!Array.isArray(produits) || produits.length === 0) {
      return Response.json({ success: false, error: "produits (array) requis" }, { status: 400, headers: corsHeaders });
    }

    const created = [];
    for (const item of produits) {
      const nom = String(item.nom || "").trim();
      if (!nom) continue;
      const page = await createPage(DB.PRIX_INGREDIENTS, {
        Ingredient: titleProp(nom),
        Fournisseur: textProp(item.fournisseur || ""),
        Prix_Unitaire: numberProp(item.prix_unitaire),
        Unite: selectProp(item.unite || ""),
        Date: dateProp(item.date || new Date().toISOString().slice(0, 10)),
        Source: selectProp(item.source || "facture"),
        Notes: textProp(item.notes || ""),
      });
      created.push(page.id);
    }

    return Response.json({ success: true, count: created.length }, { headers: corsHeaders });
  } catch (err) {
    console.error("[POST prix-ingredients]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
