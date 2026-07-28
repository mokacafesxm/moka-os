import { Suspense } from "react";
import ImportsTabs from "./_components/ImportsTabs";

export const metadata = {
  title: "Imports — MÖKA OS",
  description: "Import de relevés bancaires et exports de caisse vers Notion",
  robots: { index: false, follow: false },
};

export default function ImportsPage() {
  return (
    <Suspense fallback={null}>
      <ImportsTabs />
    </Suspense>
  );
}
