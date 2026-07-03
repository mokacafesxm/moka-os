import { MOKA } from "../_lib/theme";

export default function PromoBanner({ promo }) {
  if (!promo?.image) return null;

  const content = (
    <div className="rounded-3xl p-2 overflow-hidden" style={{ backgroundColor: MOKA.promoGreen }}>
      <img src={promo.image} alt="Promotion" className="w-full h-24 object-cover rounded-2xl" />
    </div>
  );

  return (
    <div className="px-4 py-2">
      {promo.lien ? (
        <a href={promo.lien} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}
