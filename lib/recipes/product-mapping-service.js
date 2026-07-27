'use strict';

// Read-only mapping layer connecting PRODUCT_SALES (importer-owned,
// analytical) to the Sold Product Catalogue and its recipes — Recipe
// Catalogue foundation, target architecture domain D. Never writes to
// PRODUCT_SALES, Stock, or anywhere else; never invents a mapping for an
// unmapped row — an unmapped sale is always reported as such, exactly like
// the importer's own `mapping_status` philosophy
// (lib/importer/parsers/recipe-mapping.js).
//
// The join key is exclusively PRODUCT_SALES.moka_product_key (a plain
// string, set by the importer's local product-mapping.json) matched against
// the Sold Product Catalogue's product_key — the only identifier that
// reliably connects the two domains today (see docs/ARCHITECTURE.md
// "Recipe Catalogue foundation" inspection report).

const { normalizeKey, computeRecipeStatus } = require('./sold-products-service');
const { isRecipeLineValid } = require('./validation');

/**
 * @param {{moka_product_key?: string|null}} productSalesRow
 * @param {Array<{id:string, productKey:string}>} soldProducts
 * @returns {object|null}
 */
function resolveSoldProductForSale(productSalesRow, soldProducts) {
  const key = normalizeKey(productSalesRow?.moka_product_key);
  if (!key) return null;
  return soldProducts.find((p) => normalizeKey(p.productKey) === key) || null;
}

/** Annotates each recipe line for a sold product with a computed `valid` flag. */
function annotateLineValidity(lines, ingredientsById) {
  return (lines || []).map((line) => ({
    ...line,
    valid: isRecipeLineValid(line, ingredientsById?.[line.ingredientId] || null),
  }));
}

/**
 * @param {Array<object>} productSalesRows
 * @param {Array<object>} soldProducts
 * @param {Array<object>} recipeLines - all recipe lines (any sold product)
 * @param {Record<string, {active:boolean, uniteStock?:string, name?:string}>} ingredientsById
 * @returns {{
 *   rows: Array<{productSalesRow:object, soldProduct:object|null, mapped:boolean, recipeStatus:string|null}>,
 *   unmappedRows: object[],
 * }}
 */
function buildProductMappingReport(productSalesRows, soldProducts, recipeLines, ingredientsById = {}) {
  const rows = (productSalesRows || []).map((row) => {
    const soldProduct = resolveSoldProductForSale(row, soldProducts);
    if (!soldProduct) {
      return { productSalesRow: row, soldProduct: null, mapped: false, recipeStatus: null };
    }
    const linesForProduct = annotateLineValidity(
      (recipeLines || []).filter((l) => l.soldProductId === soldProduct.id),
      ingredientsById
    );
    const recipeStatus = computeRecipeStatus(soldProduct, linesForProduct);
    return { productSalesRow: row, soldProduct, mapped: true, recipeStatus };
  });

  const unmappedRows = rows.filter((r) => !r.mapped).map((r) => r.productSalesRow);

  return { rows, unmappedRows };
}

module.exports = { resolveSoldProductForSale, buildProductMappingReport, annotateLineValidity };
