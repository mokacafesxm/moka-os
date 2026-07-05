import { Dancing_Script } from "next/font/google";
import { CartProvider } from "./_lib/CartContext";
import { LocationProvider } from "./_lib/LocationContext";
import { CustomerProvider } from "./_lib/CustomerContext";

const scriptFont = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function CommanderLayout({ children }) {
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
