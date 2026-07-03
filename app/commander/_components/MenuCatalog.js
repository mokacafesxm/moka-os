"use client";

import { useMemo, useRef, useState } from "react";
import { MOKA } from "../_lib/theme";
import TopBar from "./TopBar";
import Header from "./Header";
import SearchBar from "./SearchBar";
import CategoryNav from "./CategoryNav";
import CategorySection from "./CategorySection";
import PromoBanner from "./PromoBanner";
import ProductBottomSheet from "./ProductBottomSheet";
import BottomNav from "./BottomNav";

function matches(product, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return product.nom.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
}

function filterGroup(produits, query) {
  return produits.filter((p) => matches(p, query));
}

export default function MenuCatalog({ data }) {
  const { categories, sections, popular, autres, promos } = data;
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState("home");
  const searchRef = useRef(null);
  const topRef = useRef(null);

  function toggleFavorite(id) {
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function goHome() {
    setActiveTab("home");
    setQuery("");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function focusSearch() {
    setActiveTab("search");
    searchRef.current?.focus();
  }

  function showFavorites() {
    setActiveTab((t) => (t === "favorites" ? "home" : "favorites"));
  }

  const filteredPopular = useMemo(() => filterGroup(popular, query), [popular, query]);
  const filteredSections = useMemo(
    () => sections.map((s) => ({ ...s, produits: filterGroup(s.produits, query) })),
    [sections, query]
  );
  const filteredAutres = useMemo(() => filterGroup(autres, query), [autres, query]);

  const allProducts = useMemo(
    () => [...popular, ...sections.flatMap((s) => s.produits), ...autres],
    [popular, sections, autres]
  );
  const favoriteProducts = useMemo(
    () => allProducts.filter((p) => favorites.has(p.id)),
    [allProducts, favorites]
  );

  const promo = (index) => promos[index] ?? null;
  const cardProps = { onSelectProduct: setSelectedProduct, favorites, onToggleFavorite: toggleFavorite };

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: MOKA.cream }}>
      <div ref={topRef} />
      <TopBar />
      <Header />
      <SearchBar ref={searchRef} value={query} onChange={setQuery} />
      <CategoryNav categories={categories} />

      <main>
        {activeTab === "favorites" ? (
          <CategorySection nom="Favoris" produits={favoriteProducts} {...cardProps} />
        ) : (
          <>
            {filteredPopular.length > 0 && (
              <CategorySection nom="Popular" produits={filteredPopular} {...cardProps} />
            )}

            <PromoBanner promo={promo(0)} />

            {filteredSections.map((section, i) => (
              <div key={section.id}>
                <CategorySection nom={section.nom} produits={section.produits} {...cardProps} />
                <PromoBanner promo={promo(i + 1)} />
              </div>
            ))}

            {filteredAutres.length > 0 && (
              <CategorySection nom="Autres" produits={filteredAutres} {...cardProps} />
            )}
          </>
        )}
      </main>

      {selectedProduct && (
        <ProductBottomSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}

      <BottomNav
        activeTab={activeTab}
        onHome={goHome}
        onSearch={focusSearch}
        onFavorites={showFavorites}
        onAccount={() => setActiveTab("account")}
      />
    </div>
  );
}
