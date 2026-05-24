"use client";

import React, { useEffect, useMemo, useState } from "react";

const PRODUCTS_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-orderpad-products";

const SEND_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook-test/moka-orderpad-send";

const categoryEmojis = {
  Bar: "☕",
  "Protéines": "🍗",
  "Fruits & légumes": "🥑",
  "Produits laitiers": "🥛",
  Boulangerie: "🥖",
  "Dry Goods": "📦",
  Prépas: "👨‍🍳",
  Packaging: "🛍️",
  Nettoyage: "🧽",
  Desserts: "🍰",
  Autres: "✨",
};

export default function MokaOrderPad() {
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(PRODUCTS_URL)
      .then((res) => res.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    return ["Tous", ...new Set(products.map((p) => p.category || "Autres"))];
  }, [products]);

  const filtered = useMemo(() => {
    if (activeCategory === "Tous") return products;
    return products.filter((p) => (p.category || "Autres") === activeCategory);
  }, [activeCategory, products]);

  const addProduct = (product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: {
        ...product,
        qty: product.suggested || 1,
      },
    }));
  };

  const removeProduct = (id) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const cartItems = Object.values(cart);

  const sendToMokaOS = async () => {
    if (cartItems.length === 0) return;

    setSending(true);

    for (const item of cartItems) {
      await fetch(SEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          produit: item.name,
          ingredientId: item.id,
          fournisseur: item.supplier,
          quantite: item.qty,
          unite: item.unit,
          categorie: item.category,
          source: "OrderPad",
        }),
      });
    }

    setCart({});
    setSending(false);
    alert("Commande envoyée vers MOKA-OS ✅");
  };

  return (
    <main className="min-h-screen bg-[#f6efe5] text-[#2b1b15]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <div className="text-5xl font-black tracking-tight">MÖKA</div>
            <div className="text-sm tracking-[0.35em] text-[#8b6f61] mt-1">
              SUPPLIER ORDER PAD
            </div>
          </div>

          <div className="bg-white rounded-[2rem] px-6 py-4 shadow-sm border border-[#eadfd4]">
            <div className="text-xs text-[#8b6f61]">Commande automatique</div>
            <div className="font-black text-xl">17:45 SXM</div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-8">
            <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-3 rounded-full whitespace-nowrap text-sm font-bold transition ${
                    activeCategory === cat
                      ? "bg-[#42d6d2] text-white shadow-md"
                      : "bg-white text-[#4b342b] border border-[#eadfd4]"
                  }`}
                >
                  {cat === "Tous"
                    ? "✨ Tous"
                    : `${categoryEmojis[cat] || "📌"} ${cat}`}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="bg-white rounded-[2rem] p-10 text-center text-[#8b6f61]">
                Chargement des produits…
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-5">
                {filtered.map((product) => {
                  const selected = !!cart[product.id];
                  const cat = product.category || "Autres";

                  return (
                    <button
                      key={product.id}
                      onClick={() =>
                        selected ? removeProduct(product.id) : addProduct(product)
                      }
                      className={`text-left rounded-[2rem] p-6 shadow-sm border transition active:scale-[0.98] ${
                        selected
                          ? "bg-[#42d6d2] text-white border-[#42d6d2]"
                          : "bg-white border-[#eadfd4] text-[#2b1b15]"
                      }`}
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <div
                            className={`text-sm font-bold mb-2 ${
                              selected ? "text-white/90" : "text-[#42bdbc]"
                            }`}
                          >
                            {categoryEmojis[cat] || "📌"} {cat}
                          </div>

                          <h2 className="text-2xl font-black leading-tight">
                            {product.name}
                          </h2>
                        </div>

                        <div
                          className={`text-xs text-right max-w-[120px] ${
                            selected ? "text-white/80" : "text-[#8b6f61]"
                          }`}
                        >
                          {product.supplier || "À définir"}
                        </div>
                      </div>

                      <div
                        className={`mt-6 rounded-2xl p-4 ${
                          selected ? "bg-white/20" : "bg-[#f7f1e9]"
                        }`}
                      >
                        <div className="text-xs opacity-70">À commander</div>
                        <div className="text-2xl font-black mt-1">
                          {product.suggested || 1} {product.unit || "unité"}
                        </div>
                      </div>

                      <div className="mt-5 flex justify-between items-center">
                        <span
                          className={`text-sm ${
                            selected ? "text-white/80" : "text-[#8b6f61]"
                          }`}
                        >
                          {selected ? "Ajouté à la commande" : "Toucher pour ajouter"}
                        </span>

                        <span className="text-3xl">{selected ? "✅" : "＋"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="col-span-4">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#eadfd4] sticky top-6">
              <h2 className="text-2xl font-black">🛒 Commande du jour</h2>
              <p className="text-sm text-[#8b6f61] mt-1">
                Produits sélectionnés depuis le pad
              </p>

              <div className="mt-6 space-y-3">
                {cartItems.length === 0 && (
                  <div className="text-[#8b6f61] bg-[#f7f1e9] rounded-2xl p-5 text-center">
                    Aucun produit sélectionné
                  </div>
                )}

                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-3 border-b border-[#eadfd4] pb-3"
                  >
                    <div>
                      <div className="font-black">{item.name}</div>
                      <div className="text-xs text-[#8b6f61]">
                        {item.supplier || "Fournisseur à définir"}
                      </div>
                    </div>

                    <div className="font-black whitespace-nowrap">
                      {item.qty} {item.unit}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={sendToMokaOS}
                disabled={cartItems.length === 0 || sending}
                className={`w-full mt-6 py-4 rounded-2xl font-black transition ${
                  cartItems.length === 0
                    ? "bg-[#eadfd4] text-[#8b6f61]"
                    : "bg-[#42d6d2] text-white shadow-md"
                }`}
              >
                {sending ? "Envoi en cours…" : "Envoyer vers MOKA-OS"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}