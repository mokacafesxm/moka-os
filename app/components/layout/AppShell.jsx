"use client";

import { RealTimeProvider } from "../../contexts/RealTimeContext";
import { AppProvider } from "../../contexts/AppContext";
import { StaffProvider, useStaffContext } from "../../contexts/StaffContext";
import ClockBar from "./ClockBar";
import NavBottom from "./NavBottom";
import AdminNav from "./AdminNav";

function ShellChrome({ children }) {
  const { isAdmin } = useStaffContext();

  return (
    <div className="min-h-full flex flex-col">
      <ClockBar />
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
