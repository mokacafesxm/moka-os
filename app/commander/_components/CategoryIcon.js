import { MOKA } from "../_lib/theme";

function initials(name) {
  return String(name || "?").trim().slice(0, 2).toUpperCase();
}

export default function CategoryIcon({ nom, photo, size = 56 }) {
  const style = { width: size, height: size };

  if (photo) {
    return (
      <img
        src={photo}
        alt={nom}
        style={{ ...style, borderColor: MOKA.border }}
        className="rounded-full object-cover border-2 shrink-0"
      />
    );
  }

  return (
    <div
      style={{ ...style, backgroundColor: MOKA.brown, borderColor: MOKA.border }}
      className="rounded-full flex items-center justify-center border-2 shrink-0"
    >
      <span className="text-white font-bold text-sm tracking-tight">{initials(nom)}</span>
    </div>
  );
}
