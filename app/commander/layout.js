import { Dancing_Script } from "next/font/google";
import { CartProvider } from "./_lib/CartContext";
import { LocationProvider } from "./_lib/LocationContext";
import { CustomerProvider } from "./_lib/CustomerContext";
import MaintenanceOverlay from "./_components/MaintenanceOverlay";

const scriptFont = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["600", "700"],
});

// Toggled purely via this env var (Vercel dashboard, requires a redeploy —
// same mechanism as PAYMENT_UNAVAILABLE_NOTICE in page.js) so it can be
// flipped without a code change. Gated at the layout level, above every
// provider, so /commander AND /commander/checkout both render nothing but
// the overlay — no cart/customer state, no page underneath to click through
// or escape to.
const maintenanceModeEnabled = process.env.MAINTENANCE_MODE === "true";

export default function CommanderLayout({ children }) {
  if (maintenanceModeEnabled) {
    return (
      <div className={scriptFont.variable}>
        <MaintenanceOverlay />
      </div>
    );
  }

  return (
    <div className={scriptFont.variable}>
      <LocationProvider>
        <CustomerProvider>
          <CartProvider>{children}</CartProvider>
        </CustomerProvider>
      </LocationProvider>
    </div>
  );
}
