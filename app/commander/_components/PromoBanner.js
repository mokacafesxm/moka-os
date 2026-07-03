export default function PromoBanner({ promo }) {
  if (!promo?.image) return null;

  const content = (
    <img src={promo.image} alt="Promotion" className="w-full h-28 object-cover rounded-2xl" />
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
