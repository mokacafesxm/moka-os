import { DB, corsHeaders, queryDatabase } from "../../_notion";
import { getSoldProductsDbId, getRecipeLinesDbId } from "../../../../lib/recipes/config";
import { listSoldProducts, normalizeKey } from "../../../../lib/recipes/sold-products-service";
import { listRecipeLines } from "../../../../lib/recipes/recipes-service";
import { calculateBatchConsumption } from "../../../../lib/recipes/consumption-service";

// Theoretical-consumption preview — Recipe Catalogue foundation, target
// architecture domain I. Read-only: queries the Sold Product Catalogue,
// Recipe Lines, and INGREDIENTS (for stock-unit conversion), then runs the
// pure calculateBatchConsumption. Makes ZERO write calls of any kind — no
// Stock quantity, no Stock ledger, no Recipe/Sold Product data is ever
// modified by this route.
export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

function getIngredientTitle(page) {
  const prop = page.properties?.Ingredient;
  return prop?.type === "title" && prop.title?.length ? prop.title[0].plain_text || "" : "";
}
function getIngredientUnit(page) {
  const prop = page.properties?.Unite_stock;
  return prop?.type === "select" && prop.select?.name ? prop.select.name : "";
}

export async function POST(request) {
  try {
    const { items } = await request.json();
    if (!Array.isArray(items) || !items.length) {
      return Response.json({ error: "items (array) requis" }, { status: 400, headers: corsHeaders });
    }

    const soldProductsDbId = getSoldProductsDbId();
    const recipeLinesDbId = getRecipeLinesDbId();

    const [soldProducts, recipeLines, ingredientPages] = await Promise.all([
      listSoldProducts({ soldProductsDbId, notion: { queryDatabase } }),
      listRecipeLines({ recipeLinesDbId, notion: { queryDatabase } }),
      queryDatabase(DB.INGREDIENTS, null, null, 300),
    ]);

    const ingredientsById = {};
    for (const page of ingredientPages) {
      ingredientsById[page.id] = { active: !page.archived, uniteStock: getIngredientUnit(page), name: getIngredientTitle(page) };
    }

    const resolvedItems = items.map((item) => {
      const soldProduct = item.soldProductId
        ? soldProducts.find((p) => p.id === item.soldProductId) || null
        : soldProducts.find((p) => normalizeKey(p.productKey) === normalizeKey(item.productKey)) || null;
      return { soldProduct, quantitySold: item.quantitySold, sourceRef: item.sourceRef };
    });

    const result = calculateBatchConsumption(resolvedItems, { recipeLines, ingredientsById });
    return Response.json(result, { headers: corsHeaders });
  } catch (err) {
    const status = err.code === "CONFIG_MISSING" ? 503 : 500;
    return Response.json({ error: err.message }, { status, headers: corsHeaders });
  }
}
