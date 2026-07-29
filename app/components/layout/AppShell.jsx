"use client";

import { usePathname } from "next/navigation";
import { RealTimeProvider } from "../../contexts/RealTimeContext";
import { AppProvider } from "../../contexts/AppContext";
import { StaffProvider, useStaffContext } from "../../contexts/StaffContext";
import ClockBar from "./ClockBar";
import NavBottom from "./NavBottom";
import AdminNav from "./AdminNav";
import SplashScreen from "./SplashScreen";

function ShellChrome({ children }) {
  // splashDone lives in StaffContext (not local state): never persisted, so
  // a full reload remounts StaffProvider and resets it to false (splash
  // reappears, as intended) — but living in context also lets "Changer de
  // poste" elsewhere (e.g. /poste, /profil) call setSplashDone(false)
  // directly to bring the splash back mid-session, no reload needed.
  const { isAdmin, splashDone, setSplashDone } = useStaffContext();
  const pathname = usePathname();
  // /poste renders its own greeting header + compact clock button (see
  // PostePage), replacing the isolated-name ClockBar pill for that screen.
  // En session admin, ClockBar (avatar staff + statut pointage + toggle
  // admin) n'a plus de sens : ni le staff sélectionné ni son pointage ne
  // sont pertinents pour un manager qui consulte le dashboard — voir
  // "Changer de session" désormais dans AdminNav (ClockBar.jsx).
  const showClockBar = pathname !== "/poste" && !isAdmin;

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  return (
    <div className="min-h-full flex flex-col">
      {showClockBar && <ClockBar />}
      {/* Tablette (>= md) : la nav passe de barre basse à sidebar gauche fixe
          (voir NavBottom/AdminNav) — le contenu perd son pb-24 mobile et
          gagne une marge gauche égale à la largeur de la sidebar active.
          Safe-area (notch/Dynamic Island) : ClockBar gère déjà son propre
          paddingTop quand elle est affichée — /poste, qui la remplace par
          son propre header, ne l'a pas ailleurs, donc `main` la fournit
          uniquement dans ce cas (jamais les deux, sinon double padding). */}
      <main
        className={`flex-1 pb-24 md:pb-4 ${isAdmin ? "md:pl-16" : "md:pl-20"}`}
        style={!showClockBar ? { paddingTop: "env(safe-area-inset-top)" } : undefined}
      >
        {children}
      </main>
      {isAdmin ? <AdminNav /> : <NavBottom />}
    </div>
  );
}

export default function AppShell({ children }) {
  return (
    <RealTimeProvider>
      <AppProvider>
        <StaffProvider>
          <ShellChrome>{children}</ShellChrome>
        </StaffProvider>
      </AppProvider>
    </RealTimeProvider>
  );
}
