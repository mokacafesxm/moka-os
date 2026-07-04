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

// Sized in CSS (not JS) so it can grow at the md breakpoint without a
// runtime media-query check — mobile 56px, desktop 64px.
const SIZE_CLASSES = "w-14 h-14 md:w-16 md:h-16";

export default function CategoryIcon({ nom, photo }) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={nom}
        style={{ borderColor: MOKA.brownLight }}
        className={`${SIZE_CLASSES} rounded-full object-cover border shrink-0`}
      />
    );
  }

  const Icon = pickIcon(nom);

  return (
    <div
      style={{ backgroundColor: MOKA.cream, borderColor: MOKA.brownLight }}
      className={`${SIZE_CLASSES} rounded-full flex items-center justify-center border shrink-0`}
    >
      {Icon ? (
        <Icon style={{ color: MOKA.brownLight }} className="w-6 h-6 md:w-7 md:h-7" strokeWidth={1.8} />
      ) : (
        <span style={{ color: MOKA.brown }} className="font-bold text-sm md:text-base tracking-tight">
          {initials(nom)}
        </span>
      )}
    </div>
  );
}
