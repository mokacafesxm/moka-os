import { Dancing_Script } from "next/font/google";
import { CartProvider } from "./_lib/CartContext";
import { LocationProvider } from "./_lib/LocationContext";

const scriptFont = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function CommanderLayout({ children }) {
  return (
    <div className={scriptFont.variable}>
      <LocationProvider>
        <CartProvider>{children}</CartProvider>
      </LocationProvider>
    </div>
  );
}
