const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-04";

function storeDomain() {
  const raw = process.env.SHOPIFY_STORE || "";
  return raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function assertConfigured() {
  if (!process.env.SHOPIFY_STORE) throw new Error("SHOPIFY_STORE manquant");
  if (!process.env.SHOPIFY_CLIENT_ID) throw new Error("SHOPIFY_CLIENT_ID manquant");
  if (!process.env.SHOPIFY_CLIENT_SECRET) throw new Error("SHOPIFY_CLIENT_SECRET manquant");
}

// Custom apps created via the Shopify Dev Dashboard no longer expose a static
// Admin API token — access tokens are obtained via the client credentials
// grant and expire after 24h, so we cache one in memory and refresh it
// slightly before it actually expires.
let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAt) return cachedToken;

  const res = await fetch(`https://${storeDomain()}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Shopify token exchange error: ${res.status} ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  // Refresh 60s early to avoid racing the real expiry.
  cachedTokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function shopifyGraphQL(query, variables = {}) {
  assertConfigured();
  const token = await getAccessToken();
  const url = `https://${storeDomain()}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (!res.ok || data.errors) {
    throw new Error(`Shopify GraphQL error: ${res.status} ${JSON.stringify(data.errors || data)}`);
  }
  return data.data;
}

const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 25, after: $cursor, query: "status:active") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          title
          description
          status
          totalInventory
          featuredImage { url altText }
          collections(first: 10) { edges { node { title } } }
          options { name values }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
                availableForSale
                selectedOptions { name value }
              }
            }
          }
          metafields(first: 50) {
            edges { node { namespace key value type } }
          }
        }
      }
    }
  }
`;

function normalizeProduct(node) {
  const collections = node.collections.edges.map((e) => e.node.title);
  const variants = node.variants.edges.map((e) => ({
    id: e.node.id,
    title: e.node.title,
    sku: e.node.sku,
    price: e.node.price,
    availableForSale: e.node.availableForSale,
    options: e.node.selectedOptions,
  }));
  const metafields = node.metafields.edges.map((e) => ({
    namespace: e.node.namespace,
    key: e.node.key,
    value: e.node.value,
    type: e.node.type,
  }));

  return {
    shopifyId: node.id,
    handle: node.handle,
    title: node.title,
    description: node.description || "",
    status: node.status,
    price: node.priceRangeV2?.minVariantPrice?.amount ?? null,
    currency: node.priceRangeV2?.minVariantPrice?.currencyCode ?? null,
    available: node.totalInventory > 0 || variants.some((v) => v.availableForSale),
    imageUrl: node.featuredImage?.url ?? null,
    imageAlt: node.featuredImage?.altText ?? null,
    category: collections[0] ?? null,
    collections,
    options: node.options,
    variants,
    metafields,
  };
}

async function fetchAllActiveProducts({ onPage } = {}) {
  const products = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(PRODUCTS_QUERY, { cursor });
    const conn = data.products;
    const pageProducts = conn.edges.map((e) => normalizeProduct(e.node));
    products.push(...pageProducts);
    if (onPage) onPage(pageProducts, products.length);
    hasNextPage = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }

  return products;
}

const COLLECTIONS_QUERY = `
  query Collections($cursor: String) {
    collections(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          title
          image { url altText }
          productsCount { count }
        }
      }
    }
  }
`;

// Shopify has no cross-collection "position" field on the Collection object
// (ordering in navigation lives in the Online Store menu, not on the
// collection itself), so callers fall back to fetch order for "Ordre".
function normalizeCollection(node, index) {
  return {
    shopifyId: node.id,
    handle: node.handle,
    title: node.title,
    imageUrl: node.image?.url ?? null,
    imageAlt: node.image?.altText ?? null,
    productsCount: node.productsCount?.count ?? 0,
    order: index,
  };
}

async function fetchAllCollections({ onPage } = {}) {
  const collections = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(COLLECTIONS_QUERY, { cursor });
    const conn = data.collections;
    const pageCollections = conn.edges.map((e, i) => normalizeCollection(e.node, collections.length + i + 1));
    collections.push(...pageCollections);
    if (onPage) onPage(pageCollections, collections.length);
    hasNextPage = conn.pageInfo.hasNextPage;
    cursor = conn.pageInfo.endCursor;
  }

  return collections;
}

module.exports = {
  shopifyGraphQL,
  fetchAllActiveProducts,
  fetchAllCollections,
  storeDomain,
  SHOPIFY_API_VERSION,
};
