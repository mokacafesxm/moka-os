"use client";

import { useMemo, useRef, useState } from "react";
import { MOKA } from "../_lib/theme";
import { useCart } from "../_lib/CartContext";
import { useCustomer } from "../_lib/CustomerContext";
import { useWheelEligibility } from "../_lib/useWheelEligibility";
import { productsForCategory } from "../_lib/categoryMatch";
import Header from "./Header";
import SearchBar from "./SearchBar";
import CategoryRail from "./CategoryRail";
import ProductGrid from "./ProductGrid";
import CategorySection from "./CategorySection";
import PromoCarousel from "./PromoCarousel";
import ProductPopup from "./ProductPopup";
import BottomNav from "./BottomNav";
import CartView from "./CartView";
import LocationSheet from "./LocationSheet";
import Toast from "./Toast";
import AccountView from "./AccountView";
import EmptyState from "./EmptyState";
import WheelFab from "./WheelFab";
import WheelModal from "./WheelModal";
import { Heart } from "lucide-react";

function matches(product, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return product.nom.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
}

export default function MenuCatalog({ data }) {
  const { categories, promos, products } = data;
  const cart = useCart();
  const { customer } = useCustomer();
  const wheelEligibility = useWheelEligibility();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState(() => categories[0] || null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState("home");
  const [toast, setToast] = useState(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const searchRef = useRef(null);
  const topRef = useRef(null);
  const toastTimer = useRef(null);

  function goToAccount() {
    setActiveTab("account");
  }

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

  // Searching spans every category at once; browsing shows only the active one.
  const displayedProducts = useMemo(() => {
    if (query) return products.filter((p) => matches(p, query));
    return productsForCategory(products, activeCategory);
  }, [products, activeCategory, query]);

  const favoriteProducts = useMemo(() => products.filter((p) => favorites.has(p.id)), [products, favorites]);

  const cardProps = { onSelectProduct: setSelectedProduct, favorites, onToggleFavorite: toggleFavorite };

  function addToCart({ variantLabel, unitPrice, quantity }) {
    cart.addItem(
      { id: selectedProduct.id, name: selectedProduct.nom, photo: selectedProduct.photo, price: unitPrice },
      variantLabel,
      quantity
    );
    setToast(`Ajouté au panier · ${selectedProduct.nom}`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
    setSelectedProduct(null);
  }

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: MOKA.cream }}>
      <div ref={topRef} />
      <Header onGoToAccount={goToAccount} />

      <main key={activeTab} className="animate-fade-in">
        {activeTab === "account" ? (
          <AccountView />
        ) : activeTab === "cart" ? (
          <CartView onGoHome={goHome} />
        ) : activeTab === "favorites" ? (
          favoriteProducts.length > 0 ? (
            <CategorySection nom="Favoris" produits={favoriteProducts} {...cardProps} />
          ) : (
            <EmptyState icon={Heart} message="Aucun favori pour l'instant" actionLabel="Voir le menu" onAction={goHome} />
          )
        ) : (
          <>
            <PromoCarousel promos={promos} />
            <SearchBar ref={searchRef} value={query} onChange={setQuery} />

            <div className="flex items-start">
              <CategoryRail categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />
              <ProductGrid
                products={displayedProducts}
                emptyMessage={
                  query ? "Aucun produit ne correspond à ta recherche." : "Aucun produit dans cette catégorie pour l'instant."
                }
                {...cardProps}
              />
            </div>
          </>
        )}
      </main>

      {selectedProduct && (
        <ProductPopup product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      )}

      <LocationSheet />
      <Toast message={toast} />

      <WheelFab canSpin={wheelEligibility.canSpin} onClick={() => setWheelOpen(true)} />
      {wheelOpen && (
        <WheelModal
          onClose={() => setWheelOpen(false)}
          eligibility={wheelEligibility}
          onSpun={wheelEligibility.refresh}
          customer={customer}
          onGoToAccount={goToAccount}
        />
      )}

      <BottomNav
        activeTab={activeTab}
        cartCount={cart.count}
        onHome={goHome}
        onCart={showCart}
        onFavorites={showFavorites}
        onAccount={() => setActiveTab("account")}
      />
    </div>
  );
}
