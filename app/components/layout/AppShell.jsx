"use client";

import { useState } from "react";
import { RealTimeProvider } from "../../contexts/RealTimeContext";
import { AppProvider } from "../../contexts/AppContext";
import { StaffProvider, useStaffContext } from "../../contexts/StaffContext";
import ClockBar from "./ClockBar";
import NavBottom from "./NavBottom";

function ShellChrome({ children, active, onNavigate }) {
  const { isAdmin } = useStaffContext();

  return (
    <div className="min-h-full flex flex-col">
      <ClockBar />
      <main className="flex-1 pb-24">{children}</main>
      {!isAdmin && <NavBottom active={active} onNavigate={onNavigate} />}
    </div>
  );
}

export default function AppShell({ children }) {
  const [active, setActive] = useState("home");

  return (
    <RealTimeProvider>
      <AppProvider>
        <StaffProvider>
          <ShellChrome active={active} onNavigate={setActive}>
            {children}
          </ShellChrome>
        </StaffProvider>
      </AppProvider>
    </RealTimeProvider>
  );
}
