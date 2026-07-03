#!/usr/bin/env node
const { shopifyGraphQL } = require("./lib/shopify");

const QUERY = `
  query CollectionsWithMetafields($cursor: String) {
    collections(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          title
          image { url altText }
          metafields(first: 20) {
            edges {
              node { namespace key type value }
            }
          }
        }
      }
    }
  }
`;

async function fetchAllWithMetafields() {
  const collections = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(QUERY, { cursor });
    collections.push(...data.collections.edges.map((e) => e.node));
    hasNextPage = data.collections.pageInfo.hasNextPage;
    cursor = data.collections.pageInfo.endCursor;
  }

  return collections;
}

async function main() {
  const target = process.argv[2] || "Iced Coffees";
  console.log(`🔍 Recherche de la collection "${target}"...\n`);

  const collections = await fetchAllWithMetafields();
  const match = collections.find((c) => c.title.toLowerCase().includes(target.toLowerCase()));

  if (!match) {
    console.log(`❌ Aucune collection trouvée pour "${target}"\n`);
    console.log("Collections disponibles :");
    collections.forEach((c) => console.log(`  - ${c.title}`));
    process.exit(1);
  }

  console.log(`✅ Collection trouvée : "${match.title}" (handle: ${match.handle})`);
  console.log(`   id: ${match.id}`);
  console.log(`   image (champ standard "image"): ${match.image?.url || "(aucune)"}`);

  const metafields = match.metafields.edges.map((e) => e.node);
  console.log(`\n📋 ${metafields.length} metafield(s) trouvé(s) :\n`);

  if (metafields.length === 0) {
    console.log("   (aucun metafield sur cette collection — la photo n'est peut-être pas via metafield)");
  }

  for (const mf of metafields) {
    console.log(`  • ${mf.namespace}.${mf.key}  [${mf.type}]`);
    console.log(`    ${mf.value}\n`);
  }
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
