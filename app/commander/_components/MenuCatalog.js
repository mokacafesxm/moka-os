"use client";

import { useMemo, useRef, useState } from "react";
import { MOKA } from "../_lib/theme";
import { useCart } from "../_lib/CartContext";
import TopBar from "./TopBar";
import Header from "./Header";
import SearchBar from "./SearchBar";
import CategoryNav from "./CategoryNav";
import CategoryPanel from "./CategoryPanel";
import CategorySection from "./CategorySection";
import PromoBanner from "./PromoBanner";
import ProductPopup from "./ProductPopup";
import BottomNav from "./BottomNav";
import CartView from "./CartView";

function matches(product, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return product.nom.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
}

function filterGroup(produits, query) {
  return produits.filter((p) => matches(p, query));
}

export default function MenuCatalog({ data }) {
  const { categories, promos, popular, matchaLovers, coffeeAddict, allTheFood, refreshers, autres, products } = data;
  const cart = useCart();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
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

  function selectCategory(nom) {
    setActiveCategory((current) => (current === nom ? null : nom));
  }

  function goHome() {
    setActiveTab("home");
    setActiveCategory(null);
    setQuery("");
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function showFavorites() {
    setActiveCategory(null);
    setActiveTab((t) => (t === "favorites" ? "home" : "favorites"));
  }

  function showCart() {
    setActiveCategory(null);
    setActiveTab((t) => (t === "cart" ? "home" : "cart"));
  }

  // All product groups, in the fixed homepage order.
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

  const favoriteProducts = useMemo(() => products.filter((p) => favorites.has(p.id)), [products, favorites]);

  const cardProps = { onSelectProduct: setSelectedProduct, favorites, onToggleFavorite: toggleFavorite };

  function addToCart({ variantLabel, unitPrice, quantity }) {
    cart.addItem(
      { id: selectedProduct.id, name: selectedProduct.nom, photo: selectedProduct.photo, price: unitPrice },
      variantLabel,
      quantity
    );
    setSelectedProduct(null);
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: MOKA.cream }}>
      <div ref={topRef} />
      <TopBar />
      <Header />
      <SearchBar ref={searchRef} value={query} onChange={setQuery} />
      <CategoryNav categories={categories} activeCategory={activeCategory} onSelect={selectCategory} />
      <CategoryPanel categoryName={activeCategory} products={products} onSelectProduct={setSelectedProduct} />

      <main>
        {activeTab === "cart" ? (
          <CartView onGoHome={goHome} />
        ) : activeTab === "favorites" ? (
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
        <ProductPopup product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      )}

      <BottomNav
        activeTab={activeTab}
        cartCount={cart.count}
        onHome={goHome}
        onCart={showCart}
        onFavorites={showFavorites}
        onAccount={() => {
          setActiveCategory(null);
          setActiveTab("account");
        }}
      />
    </div>
  );
}
