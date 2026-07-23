import AppShell from "../components/layout/AppShell";

// Route group — applies only to routes inside app/(os)/ (currently just "/").
// The customer-facing /commander, /roue and staff /imports routes live
// outside this group and are untouched by AppShell's ClockBar/NavBottom.
export default function OSLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
