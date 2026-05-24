"use client";

import React, { useEffect, useMemo, useState } from "react";

const PRODUCTS_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-orderpad-products";

const SEND_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook-test/moka-orderpad-send";

const categoryEmojis = {
  Bar: "☕",
  Boissons: "🥤",
  Protéines: "🍗",
  "Produits laitiers": "🥛",
  "Fruits & légumes": "🥑",
  Boulangerie: "🥖",
  "Sec/Episserie": "📦",
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
  "Sec/Episserie",
  "Sec & épicerie",
  "Dry Goods",
  "Prépas cuisine",
  "Prépas",
  "Desserts",
  "Packaging",
  "Nettoyage",
  "Autres",
];

function getSubCategory(product) {
  return product?.subcategory || "Autres";
}

function getSupplier(product) {
  if (Array.isArray(product?.supplier)) {
    return product.supplier.length > 0
      ? product.supplier.join(", ")
      : "À définir";
  }

  return product?.supplier || "À définir";
}

export default function MokaOrderPad() {
  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [activeSubCategory, setActiveSubCategory] = useState("Tous");
  const [cart, setCart] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(PRODUCTS_URL)
      .then((res) => res.json())
      .then((data) => {
        const cleanData = Array.isArray(data)
          ? data
          : Array.isArray(data.products)
          ? data.products
          : data.id
          ? [data]
          : [];

        setProducts(cleanData);
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

  const subCategories = useMemo(() => {
    if (activeCategory === "Tous") return [];

    const found = products
      .filter((p) => (p.category || "Autres") === activeCategory)
      .map((p) => getSubCategory(p))
      .filter((sub) => sub && sub !== "Autres");

    return [...new Set(found)].sort((a, b) => a.localeCompare(b));
  }, [products, activeCategory]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const cat = p.category || "Autres";
      const sub = getSubCategory(p);
      const supplier = getSupplier(p);
      const q = search.trim().toLowerCase();

      const matchesCategory =
        activeCategory === "Tous" || cat === activeCategory;

      const matchesSubCategory =
        activeSubCategory === "Tous" || sub === activeSubCategory;

      const matchesSearch =
        !q ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(supplier || "").toLowerCase().includes(q) ||
        String(p.unit || "").toLowerCase().includes(q) ||
        String(cat || "").toLowerCase().includes(q) ||
        String(sub || "").toLowerCase().includes(q) ||
        String(p.zone || "").toLowerCase().includes(q);

      return matchesCategory && matchesSubCategory && matchesSearch;
    });
  }, [activeCategory, activeSubCategory, products, search]);

  const groupedProducts = useMemo(() => {
    const groups = {};

    filtered.forEach((product) => {
      const sub = getSubCategory(product);

      if (!groups[sub]) {
        groups[sub] = [];
      }

      groups[sub].push(product);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

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
      const payload = cartItems.map((item) => ({
        Produit: item.name,
        Quantité: item.qty,
        Unite: item.unit || "unité",
        Categorie: item.category || "Autres",
        SousCategorie: getSubCategory(item),
        Fournisseur: getSupplier(item),
        Source: "OrderPad",
        Date: new Date().toISOString(),
        URL: item.url || "",
      }));

      const response = await fetch(SEND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Erreur webhook ${response.status}`);
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
    <main className="min-h-screen bg-[#f7efe4] text-[#332019]">
      <div className="max-w-[1600px] mx-auto px-5 py-5">
        <header className="flex items-end justify-between gap-5 mb-5">
          <div>
            <h1 className="text-6xl font-black tracking-tight text-[#3b241b]">
              MÖKA
            </h1>

            <div className="text-sm tracking-[0.42em] text-[#a97862] mt-1">
              SUPPLIER ORDER PAD
            </div>
          </div>

          <div className="hidden md:block bg-white/90 rounded-[1.5rem] px-6 py-4 shadow-sm border border-[#eadfd4] text-right">
            <div className="text-xs text-[#a97862]">Commande automatique</div>

            <div className="font-black text-xl text-[#3b241b]">17:45 SXM</div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-5">
          <section className="col-span-12 xl:col-span-9">
            <div className="bg-white/80 border border-[#eadfd4] rounded-[2rem] p-4 mb-5 shadow-sm">
              <div className="flex items-center gap-3 rounded-full bg-[#fffaf3] border border-[#d6b8a7] px-5 py-4">
                <span className="text-xl">🔍</span>

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un produit, une zone, une sous-catégorie..."
                  className="w-full bg-transparent outline-none text-[#3b241b] placeholder:text-[#b08d7b] font-semibold"
                />
              </div>

              <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setActiveSubCategory("Tous");
                    }}
                    className={`px-5 py-3 rounded-full whitespace-nowrap text-sm font-black transition ${
                      activeCategory === cat
                        ? "bg-[#6f8f32] text-white shadow-md"
                        : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
                    }`}
                  >
                    {cat === "Tous"
                      ? "✨ Tous"
                      : `${categoryEmojis[cat] || "📌"} ${cat}`}
                  </button>
                ))}
              </div>

              {activeCategory !== "Tous" && subCategories.length > 0 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  <button
                    onClick={() => setActiveSubCategory("Tous")}
                    className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-black transition ${
                      activeSubCategory === "Tous"
                        ? "bg-[#3b241b] text-white"
                        : "bg-[#f7efe4] text-[#8b6f61] border border-[#eadfd4]"
                    }`}
                  >
                    Tous
                  </button>

                  {subCategories.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setActiveSubCategory(sub)}
                      className={`px-4 py-2 rounded-full whitespace-nowrap text-xs font-black transition ${
                        activeSubCategory === sub
                          ? "bg-[#3b241b] text-white"
                          : "bg-[#f7efe4] text-[#8b6f61] border border-[#eadfd4]"
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
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
              <div className="space-y-8">
                {groupedProducts.map(([subCategory, productsInGroup]) => (
                  <div key={subCategory}>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-xl font-black text-[#3b241b] whitespace-nowrap">
                        {subCategory}
                      </div>

                      <div className="flex-1 h-[1px] bg-[#dccbbb]" />

                      <div className="text-xs font-bold text-[#a97862]">
                        {productsInGroup.length} produits
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {productsInGroup.map((product) => {
                        const selected = !!cart[product.id];
                        const cat = product.category || "Autres";
                        const sub = getSubCategory(product);
                        const supplier = getSupplier(product);
                        const productUrl = product.url || null;

                        return (
                          <div
                            key={product.id}
                            className={`rounded-[1.75rem] shadow-sm border transition overflow-hidden ${
                              selected
                                ? "bg-[#6f8f32] text-white border-[#6f8f32]"
                                : "bg-white text-[#3b241b] border-[#eadfd4]"
                            }`}
                          >
                            <button
                              onClick={() =>
                                selected
                                  ? removeProduct(product.id)
                                  : addProduct(product)
                              }
                              className={`w-full h-28 flex items-center justify-center overflow-hidden ${
                                selected ? "bg-white/10" : "bg-[#efe4d7]"
                              }`}
                            >
                              {product.photo ? (
                                <img
                                  src={product.photo}
                                  alt={product.name || "Produit"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-5xl">
                                  {categoryEmojis[cat] || "📌"}
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() =>
                                selected
                                  ? removeProduct(product.id)
                                  : addProduct(product)
                              }
                              className="w-full text-left p-5 active:scale-[0.99]"
                            >
                              <div className="flex justify-between gap-4">
                                <div>
                                  <div
                                    className={`text-xs font-black mb-1 ${
                                      selected
                                        ? "text-white/85"
                                        : "text-[#6f8f32]"
                                    }`}
                                  >
                                    {categoryEmojis[cat] || "📌"} {cat}
                                  </div>

                                  <div
                                    className={`inline-flex mb-3 px-3 py-1 rounded-full text-xs font-black ${
                                      selected
                                        ? "bg-white/20 text-white"
                                        : "bg-[#f7efe4] text-[#a97862]"
                                    }`}
                                  >
                                    {sub}
                                  </div>

                                  <h2 className="text-2xl font-black leading-tight">
                                    {product.name}
                                  </h2>
                                </div>

                                <div
                                  className={`text-xs text-right max-w-[120px] ${
                                    selected
                                      ? "text-white/75"
                                      : "text-[#a97862]"
                                  }`}
                                >
                                  {supplier}
                                </div>
                              </div>

                              <div
                                className={`mt-5 rounded-2xl p-4 ${
                                  selected ? "bg-white/20" : "bg-[#f7efe4]"
                                }`}
                              >
                                <div className="text-xs opacity-70">
                                  À commander
                                </div>

                                <div className="text-2xl font-black mt-1">
                                  {product.suggested || 1}{" "}
                                  {product.unit || "unité"}
                                </div>

                                {product.zone && (
                                  <div className="text-xs opacity-70 mt-2">
                                    Zone : {product.zone}
                                  </div>
                                )}
                              </div>

                              <div className="mt-4 flex justify-between items-center">
                                <span
                                  className={`text-sm font-semibold ${
                                    selected
                                      ? "text-white/80"
                                      : "text-[#a97862]"
                                  }`}
                                >
                                  {selected
                                    ? "Ajouté"
                                    : "Toucher pour ajouter"}
                                </span>

                                <span className="text-3xl">
                                  {selected ? "✅" : "＋"}
                                </span>
                              </div>
                            </button>

                            {productUrl && (
                              <a
                                href={productUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`block px-5 pb-5 text-sm font-bold underline ${
                                  selected
                                    ? "text-white/80"
                                    : "text-[#a97862]"
                                }`}
                              >
                                Ouvrir la fiche ↗️
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="col-span-12 xl:col-span-3">
            <div className="bg-white/95 rounded-[2rem] p-6 shadow-sm border border-[#eadfd4] sticky top-5">
              <h2 className="text-2xl font-black text-[#3b241b]">
                🛒 Commande du jour
              </h2>

              <p className="text-sm text-[#a97862] mt-1">
                Sélection staff depuis le pad
              </p>

              <div className="mt-6 space-y-3">
                {cartItems.length === 0 && (
                  <div className="text-[#a97862] bg-[#f7efe4] rounded-2xl p-5 text-center">
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
                        {getSupplier(item)}
                      </div>
                    </div>

                    <div className="font-black whitespace-nowrap text-[#6f8f32]">
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
                    : "bg-[#6f8f32] text-white shadow-md"
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