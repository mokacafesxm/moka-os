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
  const { categories, promos, popular, matchaLovers, coffeeAddict, allTheFood, refreshers, autres } = data;
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(() => new Set());
  const [cartCount, setCartCount] = useState(0);
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

  function showFavorites() {
    setActiveTab((t) => (t === "favorites" ? "home" : "favorites"));
  }

  function showCart() {
    setActiveTab((t) => (t === "cart" ? "home" : "cart"));
  }

  // All product groups, in the fixed homepage order — used both for rendering
  // and for building the cross-section "Favoris" view.
  const groups = useMemo(
    () => [
      { nom: "Popular", produits: popular },
      { nom: "Matcha Lovers", produits: matchaLovers },
      { nom: "Coffee Addict", produits: coffeeAddict },
      { nom: "All The Food", produits: allTheFood },
      { nom: "Refreshers", produits: refreshers },
      { nom: "Autres", produits: autres },
    ],
    [popular, matchaLovers, coffeeAddict, allTheFood, refreshers, autres]
  );

  const filteredGroups = useMemo(
    () => groups.map((g) => ({ ...g, produits: filterGroup(g.produits, query) })),
    [groups, query]
  );

  const allProducts = useMemo(() => groups.flatMap((g) => g.produits), [groups]);
  const favoriteProducts = useMemo(() => allProducts.filter((p) => favorites.has(p.id)), [allProducts, favorites]);

  const cardProps = { onSelectProduct: setSelectedProduct, favorites, onToggleFavorite: toggleFavorite };

  function addToCart() {
    setCartCount((n) => n + 1);
    setSelectedProduct(null);
  }

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
            {promos.map((promo) => (
              <PromoBanner key={promo.id} promo={promo} />
            ))}

            {filteredGroups.map((group) => (
              <CategorySection key={group.nom} nom={group.nom} produits={group.produits} {...cardProps} />
            ))}
          </>
        )}
      </main>

      {selectedProduct && (
        <ProductBottomSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      )}

      <BottomNav
        activeTab={activeTab}
        cartCount={cartCount}
        onHome={goHome}
        onCart={showCart}
        onFavorites={showFavorites}
        onAccount={() => setActiveTab("account")}
      />
    </div>
  );
}
