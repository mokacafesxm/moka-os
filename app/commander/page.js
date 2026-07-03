import { getMenuData } from "./_lib/getMenuData";
import MenuCatalog from "./_components/MenuCatalog";

export const metadata = {
  title: "Commander — MÖKA",
  description: "Le menu MÖKA Café Saint-Martin",
};

export default async function CommanderPage() {
  const data = await getMenuData();
  return <MenuCatalog data={data} />;
}
