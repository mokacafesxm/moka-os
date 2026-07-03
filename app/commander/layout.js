import { Dancing_Script } from "next/font/google";
import { CartProvider } from "./_lib/CartContext";

const scriptFont = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export default function CommanderLayout({ children }) {
  return (
    <div className={scriptFont.variable}>
      <CartProvider>{children}</CartProvider>
    </div>
  );
}
