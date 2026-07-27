"use client";

import MokaPrizeWheel from "../commander/_components/MokaPrizeWheel";

// Standalone preview surface for MokaPrizeWheel — lets the wheel be viewed and
// screenshotted in isolation on the MÖKA page background.
export default function RouePreviewPage() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12"
      style={{ backgroundColor: "#F5EDE0" }}
    >
      <header className="text-center">
        <h1 className="text-2xl font-black" style={{ color: "#8C4F2F" }}>
          Roue des cadeaux
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#976146" }}>
          Tournez la roue et tentez votre chance.
        </p>
      </header>

      <MokaPrizeWheel size={380} />
    </main>
  );
}
