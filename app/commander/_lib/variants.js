// Parses the "Variantes" rich_text property written by migration-shopify/04-migrate-to-notion.js.
// That script chunks long JSON across multiple rich_text segments (Notion's 2000
// char-per-block limit), so segments must be concatenated before JSON.parse.
export function parseVariants(prop) {
  const raw = (prop?.rich_text || []).map((rt) => rt.plain_text ?? "").join("");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Shopify gives every variant-less product a single placeholder variant
// ({ options: [{ name: "Title", value: "Default Title" }] }) — that's not a
// real choice for the customer, so only >1 variant counts as customizable.
export function hasRealOptions(variants) {
  return variants.length > 1;
}

export function priceFrom(variants, fallbackPrice) {
  if (!hasRealOptions(variants)) return fallbackPrice ?? 0;
  const prices = variants.map((v) => parseFloat(v.price)).filter((n) => Number.isFinite(n));
  return prices.length ? Math.min(...prices) : fallbackPrice ?? 0;
}

// Matches mokacafe.co's price format: "€X,00" (comma decimal, always 2 digits).
export function formatPrice(amount) {
  const n = Number(amount) || 0;
  return `€${n.toFixed(2).replace(".", ",")}`;
}

// Builds [{ name: "Taille", values: ["S", "M", "L"] }, ...] preserving first-seen order.
export function groupOptionValues(variants) {
  const order = [];
  const map = new Map();
  for (const variant of variants) {
    for (const { name, value } of variant.options || []) {
      if (!map.has(name)) {
        map.set(name, []);
        order.push(name);
      }
      const values = map.get(name);
      if (!values.includes(value)) values.push(value);
    }
  }
  return order.map((name) => ({ name, values: map.get(name) }));
}

export function findMatchingVariant(variants, selection) {
  return (
    variants.find((variant) =>
      (variant.options || []).every(({ name, value }) => selection[name] === value)
    ) || null
  );
}
