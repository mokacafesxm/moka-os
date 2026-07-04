"use client";

import { useRef, useState } from "react";
import { MOKA } from "../_lib/theme";

function PromoSlide({ promo }) {
  // These images are fully composed by Shopify (text + photo + background
  // baked in) — just show them as-is, no frame/overlay/extra crop. Both
  // known banners are natively 16:9, so aspect-[16/9] + object-cover renders
  // them with zero cropping.
  const content = <img src={promo.image} alt="Promotion" className="w-full aspect-[16/9] object-cover rounded-3xl" />;

  return promo.lien ? (
    <a href={promo.lien} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    content
  );
}

export default function PromoCarousel({ promos }) {
  const valid = promos.filter((p) => p.image);
  const [active, setActive] = useState(0);
  const scrollRef = useRef(null);

  if (valid.length === 0) return null;

  function handleScroll(e) {
    const el = e.currentTarget;
    if (!el.clientWidth) return;
    setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(index) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="py-2">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
      >
        {valid.map((promo) => (
          <div key={promo.id} className="w-full shrink-0 snap-center px-4">
            <PromoSlide promo={promo} />
          </div>
        ))}
      </div>

      {valid.length > 1 && (
        <div className="flex items-center justify-center">
          {valid.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Promo ${i + 1}`}
              className="w-11 h-11 flex items-center justify-center cursor-pointer shrink-0"
            >
              <span
                className="block rounded-full transition-all duration-300"
                style={{
                  width: i === active ? 18 : 6,
                  height: 6,
                  backgroundColor: i === active ? MOKA.coral : MOKA.brownLight,
                  opacity: i === active ? 1 : 0.4,
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
