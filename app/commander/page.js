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
  // Temporary payment-unavailable notice (Stripe Live activation in progress)
  // — toggled purely via this env var so it can be turned off from Vercel's
  // dashboard alone once Stripe confirms, no code change needed. Requires a
  // redeploy to take effect (this page is ISR-cached), not instant — but no
  // recoding either way.
  const paymentNoticeEnabled = process.env.PAYMENT_UNAVAILABLE_NOTICE === "true";
  return <MenuCatalog data={data} paymentNoticeEnabled={paymentNoticeEnabled} />;
}
