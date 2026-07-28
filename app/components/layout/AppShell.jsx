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
  const showClockBar = pathname !== "/poste";

  if (!splashDone) {
    return <SplashScreen onDone={() => setSplashDone(true)} />;
  }

  return (
    <div className="min-h-full flex flex-col">
      {showClockBar && <ClockBar />}
      <main className="flex-1 pb-24">{children}</main>
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
