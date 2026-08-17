import { corsHeaders, getPage, updatePage, queryDatabase, DB, getTitle } from "../../_notion";
import { normalizeBoissonSpeciale, buildBoissonSpecialeProperties } from "../route";
import { normalizeLigne } from "../lignes/route";

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// GET — fiche complète + lignes ingrédients (avec nom résolu) + noms
// Mois/Evenement résolus, pour l'écran de détail/édition admin.
export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    const page = await getPage(id);
    const item = normalizeBoissonSpeciale(page);

    const lignesPages = await queryDatabase(DB.BOISSON_SPECIALE_LIGNES, {
      property: "Boisson_Speciale",
      relation: { contains: id },
    });
    const lignes = lignesPages.map(normalizeLigne);

    const ingredientIds = [...new Set(lignes.map((l) => l.ingredientId).filter(Boolean))];
    const ingredientPages = await Promise.all(ingredientIds.map((iid) => getPage(iid).catch(() => null)));
    const ingredientNamesById = Object.fromEntries(
      ingredientPages.filter(Boolean).map((p) => [p.id, getTitle(p.properties, "Ingredient")])
    );

    const [moisPage, evenementPage] = await Promise.all([
      item.moisId ? getPage(item.moisId).catch(() => null) : null,
      item.evenementId ? getPage(item.evenementId).catch(() => null) : null,
    ]);

    return Response.json({
      ...item,
      moisNom: moisPage ? getTitle(moisPage.properties, "Mois") : null,
      evenementNom: evenementPage ? getTitle(evenementPage.properties, "Nom_Evenement") : null,
      lignes: lignes.map((l) => ({ ...l, ingredientNom: ingredientNamesById[l.ingredientId] || null })),
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("[GET specials/[id]]", err.message);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const data = await req.json();
    const properties = buildBoissonSpecialeProperties(data);
    await updatePage(id, properties);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[PATCH specials/[id]]", err.message);
    return Response.json({ success: false, error: err.message }, { status: 500, headers: corsHeaders });
  }
}
