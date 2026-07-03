import { MOKA } from "../_lib/theme";

export default function Header() {
  return (
    <div className="text-center pt-5 pb-3">
      <div className="text-4xl font-black tracking-wide" style={{ color: MOKA.brown }}>
        MÖKA
      </div>
      <div
        className="-mt-1 text-2xl font-semibold"
        style={{ color: MOKA.brown, fontFamily: "var(--font-script)" }}
      >
        commander
      </div>
    </div>
  );
}
