import Link from "next/link";
import { MOKA } from "../_lib/theme";

export const metadata = {
  title: "Checkout — MÖKA",
};

// Placeholder — le choix du créneau de retrait sera construit ici ensuite.
export default function CheckoutPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6"
      style={{ backgroundColor: MOKA.cream }}
    >
      <h1 className="text-xl font-black" style={{ color: MOKA.brown }}>
        Choix du créneau de retrait
      </h1>
      <p className="text-sm mt-2" style={{ color: MOKA.brownLight }}>
        Bientôt disponible.
      </p>
      <Link
        href="/commander"
        className="mt-6 px-6 py-3 rounded-2xl font-bold text-white"
        style={{ backgroundColor: MOKA.coral }}
      >
        Retour au menu
      </Link>
    </div>
  );
}
