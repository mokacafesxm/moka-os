"use client";

import React, { useEffect, useMemo, useState } from "react";

const PRODUCTS_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-orderpad-products";

const SEND_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-orderpad-send";

const categoryEmojis = {
  Bar: "☕",
  Boissons: "🥤",
  "Protéines": "🍗",
  "Produits laitiers": "🥛",
  "Fruits & légumes": "🥑",
  Boulangerie: "🥖",
  "Sec & épicerie": "📦",
  "Dry Goods": "📦",
  Prépas: "👨‍🍳",
  "Prépas cuisine": "👨‍🍳",
  Packaging: "🛍️",
  Nettoyage: "🧽",
  Desserts: "🍰",
  Autres: "✨",
};

const categoryOrder = [
  "Tous",
  "Bar",
  "Boissons",
  "Protéines",
  "Produits laitiers",
  "Fruits & légumes",
  "Boulangerie",
  "Sec & épicerie",
  "Dry Goods",
  "Prépas cuisine",
  "Prépas",
  "Desserts",
  "Packaging",
  "Nettoyage",
  "Autres",
];

export default function MokaOrderPad() {
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(PRODUCTS_URL)
      .then((res) => res.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur chargement produits:", err);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const found = [...new Set(products.map((p) => p.category || "Autres"))];

    return [
      "Tous",
      ...found.sort((a, b) => {
        const ia = categoryOrder.indexOf(a);
        const ib = categoryOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      }),
    ];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const cat = p.category || "Autres";
      const matchesCategory = activeCategory === "Tous" || cat === activeCategory;
      const q = search.trim().toLowerCase();

      const matchesSearch =
        !q ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.supplier || "").toLowerCase().includes(q) ||
        String(p.unit || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, search]);

  const addProduct = (product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: {
        ...product,
        qty: Number(product.suggested) || 1,
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

    try {
      const response = await fetch(SEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "OrderPad",
          createdAt: new Date().toISOString(),
          items: cartItems.map((item) => ({
            id: item.id,
            produit: item.name,
            ingredientId: item.id,
            fournisseur: item.supplier,
            quantite: item.qty,
            unite: item.unit,
            categorie: item.category,
            url: item.url || item.link || null,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur webhook");
      }

      setCart({});
      alert("Commande envoyée vers MOKA-OS ✅");
    } catch (error) {
      console.error(error);
      alert("Erreur : la commande n'a pas été envoyée ❌");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f2e8] text-[#3b241b]">
      <div className="max-w-7xl mx-auto px-5 py-5">
        <header className="flex items-center justify-between gap-5 mb-6">
          <div>
            <div className="inline-flex items-center justify-center bg-[#a97862] text-white rounded-full w-24 h-24 shadow-sm mb-3">
              <div className="text-3xl font-black leading-[0.8] text-center">
                MÖ
                <br />
                KA
              </div>
            </div>

            <h1 className="text-5xl font-black tracking-tight text-[#3b241b]">
              MÖKA
            </h1>
            <div className="text-sm tracking-[0.35em] text-[#a97862] mt-1">
              SUPPLIER ORDER PAD
            </div>
          </div>

          <div className="bg-white/80 rounded-[2rem] px-6 py-4 shadow-sm border border-[#eadfd4] text-right">
            <div className="text-xs text-[#a97862]">Commande automatique</div>
            <div className="font-black text-xl text-[#3b241b]">17:45 SXM</div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-8">
            <div className="bg-white/70 border border-[#eadfd4] rounded-[2rem] p-4 mb-5 shadow-sm">
              <div className="flex items-center gap-3 rounded-full bg-[#fffaf2] border border-[#d9b9a6] px-5 py-4">
                <span className="text-xl">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full bg-transparent outline-none text-[#3b241b] placeholder:text-[#b08d7b] font-semibold"
                />
              </div>

              <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-3 rounded-full whitespace-nowrap text-sm font-black transition ${
                      activeCategory === cat
                        ? "bg-[#4a8f05] text-white shadow-md"
                        : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
                    }`}
                  >
                    {cat === "Tous"
                      ? "✨ Tous"
                      : `${categoryEmojis[cat] || "📌"} ${cat}`}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                Chargement des produits…
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                Aucun produit trouvé.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-5">
                {filtered.map((product) => {
                  const selected = !!cart[product.id];
                  const cat = product.category || "Autres";
                  const productUrl = product.url || product.link || null;

                  return (
                    <div
                      key={product.id}
                      className={`rounded-[2rem] shadow-sm border transition overflow-hidden ${
                        selected
                          ? "bg-[#4a8f05] text-white border-[#4a8f05]"
                          : "bg-white text-[#3b241b] border-[#eadfd4]"
                      }`}
                    >
                      {product.photo ? (
                        <button
                          onClick={() =>
                            selected ? removeProduct(product.id) : addProduct(product)
                          }
                          className="block w-full h-44 overflow-hidden bg-[#efe5d9]"
                        >
                          <img
                            src={product.photo}
                            alt={product.name || "Produit"}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            selected ? removeProduct(product.id) : addProduct(product)
                          }
                          className={`w-full h-28 flex items-center justify-center text-5xl ${
                            selected ? "bg-white/10" : "bg-[#f3eadf]"
                          }`}
                        >
                          {categoryEmojis[cat] || "📌"}
                        </button>
                      )}

                      <button
                        onClick={() =>
                          selected ? removeProduct(product.id) : addProduct(product)
                        }
                        className="w-full text-left p-6 active:scale-[0.99]"
                      >
                        <div className="flex justify-between gap-4">
                          <div>
                            <div
                              className={`text-sm font-black mb-2 ${
                                selected ? "text-white/90" : "text-[#4a8f05]"
                              }`}
                            >
                              {categoryEmojis[cat] || "📌"} {cat}
                            </div>

                            <h2 className="text-2xl font-black leading-tight">
                              {product.name}
                            </h2>
                          </div>

                          <div
                            className={`text-xs text-right max-w-[130px] ${
                              selected ? "text-white/80" : "text-[#a97862]"
                            }`}
                          >
                            {product.supplier || "À définir"}
                          </div>
                        </div>

                        <div
                          className={`mt-6 rounded-2xl p-4 ${
                            selected ? "bg-white/20" : "bg-[#f8f2e8]"
                          }`}
                        >
                          <div className="text-xs opacity-70">À commander</div>
                          <div className="text-2xl font-black mt-1">
                            {product.suggested || 1} {product.unit || "unité"}
                          </div>
                        </div>

                        <div className="mt-5 flex justify-between items-center">
                          <span
                            className={`text-sm font-semibold ${
                              selected ? "text-white/80" : "text-[#a97862]"
                            }`}
                          >
                            {selected ? "Ajouté à la commande" : "Toucher pour ajouter"}
                          </span>

                          <span className="text-3xl">{selected ? "✅" : "＋"}</span>
                        </div>
                      </button>

                      {productUrl && (
                        <a
                          href={productUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`block px-6 pb-5 text-sm font-bold underline ${
                            selected ? "text-white/80" : "text-[#a97862]"
                          }`}
                        >
                          Ouvrir la fiche ↗️
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="col-span-4">
            <div className="bg-white/90 rounded-[2rem] p-6 shadow-sm border border-[#eadfd4] sticky top-6">
              <h2 className="text-2xl font-black text-[#3b241b]">
                🛒 Commande du jour
              </h2>
              <p className="text-sm text-[#a97862] mt-1">
                Produits sélectionnés depuis le pad
              </p>

              <div className="mt-6 space-y-3">
                {cartItems.length === 0 && (
                  <div className="text-[#a97862] bg-[#f8f2e8] rounded-2xl p-5 text-center">
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
                      <div className="text-xs text-[#a97862]">
                        {item.supplier || "Fournisseur à définir"}
                      </div>
                    </div>

                    <div className="font-black whitespace-nowrap text-[#4a8f05]">
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
                    ? "bg-[#eadfd4] text-[#a97862]"
                    : "bg-[#4a8f05] text-white shadow-md"
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