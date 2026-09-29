import Image from "next/image";
import { MOKA } from "../_lib/theme";

// Full-screen, non-dismissible maintenance state — no close handler, no
// backdrop click, no Escape listener, because there is nothing to dismiss
// to: layout.js renders ONLY this when MAINTENANCE_MODE is on, instead of
// mounting the providers/children underneath. So "impossible to bypass" is
// structural (nothing else is ever mounted), not enforced by JS guarding a
// modal that could in theory be clicked through or escaped.
export default function MaintenanceOverlay() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: MOKA.cream }}
    >
      <Image
        src="/logo-moka.png"
        alt="MÖKA Drive"
        width={1930}
        height={461}
        priority
        className="h-12 w-auto mb-8"
      />

      <h1 className="text-2xl font-black mb-3 max-w-sm" style={{ color: MOKA.brown }}>
        Mise à jour du menu en cours
      </h1>

      <p className="text-base leading-relaxed max-w-sm" style={{ color: MOKA.brownLight }}>
        Nous mettons actuellement à jour notre carte pour vous proposer encore mieux. Le site sera
        de retour très prochainement. Merci de votre patience !
      </p>
    </div>
  );
}
