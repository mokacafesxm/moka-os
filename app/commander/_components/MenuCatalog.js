"use client";

import { useMemo, useRef, useState } from "react";
import { MOKA } from "../_lib/theme";
import { useCart } from "../_lib/CartContext";
import { useCustomer } from "../_lib/CustomerContext";
import { useWheelEligibility } from "../_lib/useWheelEligibility";
import { useScrollBackResistance } from "../_lib/useScrollBackResistance";
import { useScrollDownCommit } from "../_lib/useScrollDownCommit";
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
import PaymentNoticeModal from "./PaymentNoticeModal";
import { Heart } from "lucide-react";

function matches(product, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return product.nom.toLowerCase().includes(q) || product.description?.toLowerCase().includes(q);
}

export default function MenuCatalog({ data, paymentNoticeEnabled = false }) {
  const { categories, promos, products } = data;
  const cart = useCart();
  const { customer, setPendingWheelReward } = useCustomer();
  const wheelEligibility = useWheelEligibility();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState(() => categories[0] || null);
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(() => new Set());
  const [activeTab, setActiveTab] = useState("home");
  const [toast, setToast] = useState(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const searchRef = useRef(null);
  const toastTimer = useRef(null);
  // Home tab's two-zone scroll-snap: outerRef is the snap container (Zone 1
  // header/promo, Zone 2 order screen). Zone 2 itself is a fixed 100dvh
  // frame that never scrolls as a whole — only its two children do, each
  // independently: the category rail (own overflow) and the product grid
  // (gridScrollRef). See useScrollBackResistance for why going back up
  // needs a harder pull once the grid is scrolled to its own top.
  const outerRef = useRef(null);
  const zone1Ref = useRef(null);
  const gridScrollRef = useRef(null);
  useScrollDownCommit(outerRef, zone1Ref, activeTab === "home");
  useScrollBackResistance(gridScrollRef, outerRef, activeTab === "home");

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
    // Already-mounted case (e.g. tapping "Accueil" while mid-browse) — jump
    // straight back to Zone 1. A fresh mount (coming from another tab) starts
    // at scrollTop 0 on its own, so this is a no-op then.
    outerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
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

  function addToCart({ variantLabel, unitPrice, quantity, extras }) {
    cart.addItem(
      { id: selectedProduct.id, name: selectedProduct.nom, photo: selectedProduct.photo, price: unitPrice },
      variantLabel,
      quantity,
      extras
    );
    setToast(`Ajouté au panier · ${selectedProduct.nom}`);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
    setSelectedProduct(null);
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: MOKA.cream }}>
      {activeTab === "home" ? (
        // Two-zone scroll-snap: Zone 1 (header + promo) is short, so any
        // downward scroll intent immediately resolves to the only other snap
        // point — Zone 2's start — via mandatory snap, giving the "one swipe
        // jumps straight past the header" behavior with no free scroll
        // between them. Zone 2 itself is a fixed 100dvh frame (never scrolls
        // as a whole, so its landing position — search bar clean below the
        // status bar — never shifts); only its two children scroll, each on
        // their own: the category rail and the product grid. See
        // useScrollBackResistance for the up direction.
        <div ref={outerRef} className="snap-y snap-mandatory overflow-y-auto" style={{ height: "100dvh", WebkitOverflowScrolling: "touch" }}>
          <div ref={zone1Ref} className="snap-start">
            <Header onGoToAccount={goToAccount} />
            <PromoCarousel promos={promos} />
          </div>

          <div className="snap-start flex flex-col" style={{ height: "100dvh" }}>
            <SearchBar ref={searchRef} value={query} onChange={setQuery} />
            <div className="flex items-stretch flex-1 min-h-0">
              <CategoryRail categories={categories} activeCategory={activeCategory} onSelect={setActiveCategory} />
              <div
                ref={gridScrollRef}
                className="flex-1 min-w-0 overflow-y-auto overscroll-y-contain pb-28"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <ProductGrid
                  products={displayedProducts}
                  emptyMessage={
                    query ? "Aucun produit ne correspond à ta recherche." : "Aucun produit dans cette catégorie pour l'instant."
                  }
                  {...cardProps}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Header onGoToAccount={goToAccount} />
          <main key={activeTab} className="animate-fade-in pb-28">
            {activeTab === "account" ? (
              <AccountView onOpenWheel={() => setWheelOpen(true)} />
            ) : activeTab === "cart" ? (
              <CartView onGoHome={goHome} />
            ) : favoriteProducts.length > 0 ? (
              <CategorySection nom="Favoris" produits={favoriteProducts} {...cardProps} />
            ) : (
              <EmptyState icon={Heart} message="Aucun favori pour l'instant" actionLabel="Voir le menu" onAction={goHome} />
            )}
          </main>
        </>
      )}

      {selectedProduct && (
        <ProductPopup product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
      )}

      <LocationSheet />
      <Toast message={toast} />
      <PaymentNoticeModal enabled={paymentNoticeEnabled} />

      <WheelFab canSpin={wheelEligibility.canSpin} onClick={() => setWheelOpen(true)} />
      {wheelOpen && (
        <WheelModal
          onClose={() => setWheelOpen(false)}
          eligibility={wheelEligibility}
          onSpun={wheelEligibility.refresh}
          customer={customer}
          onGoToAccount={goToAccount}
          onWinPendingVerification={setPendingWheelReward}
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
