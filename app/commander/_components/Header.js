import Image from "next/image";
import { MOKA } from "../_lib/theme";

export default function Header() {
  return (
    <div className="text-center pt-5 pb-3">
      <Image
        src="/logo-moka-mark.png"
        alt="MÖKA"
        width={1306}
        height={428}
        priority
        className="h-12 w-auto mx-auto"
      />
      <div
        className="-mt-1 text-2xl font-semibold"
        style={{ color: MOKA.brown, fontFamily: "var(--font-script)" }}
      >
        commander
      </div>
    </div>
  );
}
