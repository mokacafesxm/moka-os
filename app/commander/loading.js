import Image from "next/image";
import { MOKA } from "./_lib/theme";

// Next's loading.js boundary — shown only while the async server component in
// page.js (getMenuData, Notion-backed) hasn't resolved yet: an empty ISR
// cache on first-ever load, or a cold cache revalidation. A calm, branded
// splash (logo + slow pulse) replaces the previous rail/grid skeleton, so a
// first visit never flashes generic gray placeholders before the real menu,
// banner and categories appear.
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: MOKA.cream }}>
      <Image
        src="/logo-moka.png"
        alt="MÖKA Drive"
        width={1930}
        height={461}
        priority
        className="h-12 w-auto animate-pulse-slow"
      />
    </div>
  );
}
