import { Coffee, Leaf, Milk, CupSoda, UtensilsCrossed, Salad, Cookie, Star } from "lucide-react";
import { MOKA } from "../_lib/theme";

// First matching keyword wins; falls back to initials if nothing matches.
const ICON_RULES = [
  [/matcha|ube/i, Leaf],
  [/coffee|tea/i, Coffee],
  [/milkshake|milk/i, Milk],
  [/smoothie|juice|drink/i, CupSoda],
  [/bowl/i, Salad],
  [/sweet/i, Cookie],
  [/best.?seller/i, Star],
  [/food|bite|side/i, UtensilsCrossed],
];

function pickIcon(nom) {
  const rule = ICON_RULES.find(([re]) => re.test(nom));
  return rule ? rule[1] : null;
}

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
        style={{ ...style, borderColor: MOKA.brownLight }}
        className="rounded-full object-cover border shrink-0"
      />
    );
  }

  const Icon = pickIcon(nom);

  return (
    <div
      style={{ ...style, backgroundColor: MOKA.cream, borderColor: MOKA.brownLight }}
      className="rounded-full flex items-center justify-center border shrink-0"
    >
      {Icon ? (
        <Icon style={{ color: MOKA.brownLight }} className="w-6 h-6" strokeWidth={1.8} />
      ) : (
        <span style={{ color: MOKA.brown }} className="font-bold text-sm tracking-tight">
          {initials(nom)}
        </span>
      )}
    </div>
  );
}
