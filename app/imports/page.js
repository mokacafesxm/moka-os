import ImportsClient from "./_components/ImportsClient";

export const metadata = {
  title: "Imports — MÖKA OS",
  description: "Import de relevés bancaires et exports de caisse vers Notion",
  robots: { index: false, follow: false },
};

export default function ImportsPage() {
  return <ImportsClient />;
}
