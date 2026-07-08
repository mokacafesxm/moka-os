import { getMenuData } from "./_lib/getMenuData";
import MenuCatalog from "./_components/MenuCatalog";

export const metadata = {
  title: "Commander — MÖKA",
  description: "Le menu MÖKA Café Saint-Martin",
};

// Statically prerendered at build, then revalidated every 2 minutes (ISR) so the
// menu stays fresh without hitting Notion on every request. Pairs with the
// process-level cache in getMenuData().
export const revalidate = 120;

export default async function CommanderPage() {
  const data = await getMenuData();
  return <MenuCatalog data={data} />;
}
