import {
  corsHeaders, queryDatabase, createPage, notionFetch,
  getTitle, getText, getSelect, getNumber, getCheckbox,
  titleProp, textProp, selectProp, numberProp, checkboxProp,
} from "../../_notion";

const CATEGORIES_DB    = () => process.env.NOTION_CATEGORIES_DB_ID;
const SOUSCATEGORIES_DB = () => process.env.NOTION_SOUSCATEGORIES_DB_ID;
const UNITES_DB        = () => process.env.NOTION_UNITES_DB_ID;
const ZONES_DB         = () => process.env.NOTION_ZONES_DB_ID;

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET() {
  try {
    const [cats, sousCats, unites, zones] = await Promise.all([
      queryDatabase(CATEGORIES_DB(), null, [{ property: "Ordre", direction: "ascending" }], 200),
      queryDatabase(SOUSCATEGORIES_DB(), null, [{ property: "Ordre", direction: "ascending" }], 200),
      queryDatabase(UNITES_DB(), null, null, 200),
      queryDatabase(ZONES_DB(), null, null, 200),
    ]);

    return Response.json({
      categories: cats
        .filter((p) => getCheckbox(p.properties, "Actif") !== false)
        .map((p) => ({
          id: p.id,
          nom: getTitle(p.properties, "Nom"),
          emoji: getText(p.properties, "Emoji") || "📦",
          ordre: getNumber(p.properties, "Ordre") ?? 99,
        })),
      sousCategories: sousCats
        .filter((p) => getCheckbox(p.properties, "Actif") !== false)
        .map((p) => ({
          id: p.id,
          nom: getTitle(p.properties, "Nom"),
          categorie: getText(p.properties, "Categorie") || "",
          ordre: getNumber(p.properties, "Ordre") ?? 99,
        })),
      unites: unites
        .filter((p) => getCheckbox(p.properties, "Actif") !== false)
        .map((p) => ({
          id: p.id,
          nom: getTitle(p.properties, "Nom"),
          abreviation: getText(p.properties, "Abreviation") || "",
          type: getSelect(p.properties, "Type") || "",
        })),
      zones: zones
        .filter((p) => getCheckbox(p.properties, "Actif") !== false)
        .map((p) => ({
          id: p.id,
          nom: getTitle(p.properties, "Nom"),
          emoji: getText(p.properties, "Emoji") || "🗄️",
          temperature: getSelect(p.properties, "Temperature") || "",
        })),
    }, { headers: corsHeaders });
  } catch (err) {
    console.error("Erreur GET referentiels:", err);
    return Response.json({ categories: [], sousCategories: [], unites: [], zones: [] }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req) {
  try {
    const { type, nom, emoji, abreviation, categorie, temperature, uniteType, ordre } = await req.json();

    const dbMap = {
      categories:     CATEGORIES_DB(),
      sousCategories: SOUSCATEGORIES_DB(),
      unites:         UNITES_DB(),
      zones:          ZONES_DB(),
    };

    const propsMap = {
      categories: {
        Nom:   titleProp(nom),
        Emoji: textProp(emoji || ""),
        Actif: checkboxProp(true),
        Ordre: numberProp(ordre !== "" && ordre !== undefined ? Number(ordre) : 99),
      },
      sousCategories: {
        Nom:       titleProp(nom),
        Categorie: textProp(categorie || ""),
        Actif:     checkboxProp(true),
        Ordre:     numberProp(ordre !== "" && ordre !== undefined ? Number(ordre) : 99),
      },
      unites: {
        Nom:         titleProp(nom),
        Abreviation: textProp(abreviation || ""),
        Actif:       checkboxProp(true),
        ...(uniteType ? { Type: selectProp(uniteType) } : {}),
      },
      zones: {
        Nom:   titleProp(nom),
        Emoji: textProp(emoji || ""),
        Actif: checkboxProp(true),
        ...(temperature ? { Temperature: selectProp(temperature) } : {}),
      },
    };

    if (!dbMap[type] || !propsMap[type]) {
      return Response.json({ success: false, error: "Type inconnu" }, { status: 400, headers: corsHeaders });
    }

    await createPage(dbMap[type], propsMap[type]);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("Erreur POST referentiel:", err);
    return Response.json({ success: false }, { status: 500, headers: corsHeaders });
  }
}

export async function DELETE(req) {
  try {
    const { id } = await req.json();
    await notionFetch(`/pages/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ archived: true }),
    });
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("Erreur DELETE referentiel:", err);
    return Response.json({ success: false }, { status: 500, headers: corsHeaders });
  }
}
