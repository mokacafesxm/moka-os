"use client";

import { RealTimeProvider } from "../../contexts/RealTimeContext";
import { AppProvider } from "../../contexts/AppContext";
import { StaffProvider, useStaffContext } from "../../contexts/StaffContext";
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

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* Tablette (>= md) : la nav passe de barre basse à sidebar gauche fixe
          (voir NavBottom/AdminNav) — le contenu perd son pb-24 mobile et
          gagne une marge gauche égale à la largeur de la sidebar active.
          ClockBar (avatar + statut pointage + toggle admin) a été retirée de
          tous les onglets staff : chaque page gère désormais son propre
          pointage (Mon Poste) ou son propre accès admin (AdminNav), donc
          `main` fournit toujours son propre safe-area top. */}
      <main
        className={`flex-1 pb-24 md:pb-4 ${isAdmin ? "md:pl-16" : "md:pl-20"}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
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
