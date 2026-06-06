"use client";

import React, { useMemo, useState } from "react";

const products = [
  { id: 1, name: "Poulet frit", category: "Protéines", supplier: "Paulo Boucher", stock: "14 portions", unit: "kg", suggested: 5 },
  { id: 2, name: "Pulled pork", category: "Protéines", supplier: "Paulo Boucher", stock: "8 portions", unit: "kg", suggested: 4 },
  { id: 3, name: "Avocat", category: "Fruits & Légumes", supplier: "Fruits & Légumes", stock: "3 kg", unit: "kg", suggested: 10 },
  { id: 4, name: "Fruits rouges", category: "Fruits & Légumes", supplier: "Fruits & Légumes", stock: "2 kg", unit: "kg", suggested: 5 },
  { id: 5, name: "Oat milk", category: "Bar", supplier: "Produits laitiers", stock: "2 cartons", unit: "cartons", suggested: 4 },
  { id: 6, name: "Café beans", category: "Bar", supplier: "Coffee Supplier", stock: "2 kg", unit: "kg", suggested: 6 },
];

const categories = ["Tous", "Bar", "Protéines", "Fruits & Légumes", "Packaging", "Dry Goods"];

export default function MokaOrderPad() {
  const [activeCategory, setActiveCategory] = useState("Tous");
  const [cart, setCart] = useState({});

  const filtered = useMemo(() => {
    if (activeCategory === "Tous") return products;
    return products.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const addToCart = (product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: {
        ...product,
        qty: (prev[product.id]?.qty || 0) + product.suggested,
      },
    }));
  };

  const changeQty = (id, amount) => {
    setCart((prev) => {
      const item = prev[id];
      if (!item) return prev;
      const nextQty = Math.max(0, item.qty + amount);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: { ...item, qty: nextQty } };
    });
  };

  const cartItems = Object.values(cart);

  return (
    <main className="min-h-screen bg-[#f4efe7] text-[#171717] p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <div className="text-5xl tracking-[0.25em] font-light">MÖKA</div>
            <div className="text-sm tracking-[0.35em] text-neutral-500 mt-1">ORDER PAD</div>
          </div>

          <div className="bg-white/80 rounded-3xl px-6 py-4 shadow-sm border border-black/5">
            <div className="text-xs text-neutral-500">Commande automatique</div>
            <div className="font-semibold text-lg">17:45 SXM</div>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-6">
          <section className="col-span-8">
            <div className="flex gap-3 mb-6 overflow-x-auto">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-3 rounded-2xl whitespace-nowrap transition ${
                    activeCategory === cat
                      ? "bg-[#61d6d6] text-white shadow"
                      : "bg-white text-neutral-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-5">
              {filtered.map((product) => (
                <div key={product.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-black/5">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm text-[#38bfc0] font-medium">{product.category}</div>
                      <h2 className="text-2xl font-semibold mt-1">{product.name}</h2>
                    </div>
                    <div className="text-right text-xs text-neutral-400">{product.supplier}</div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="bg-[#f7f4ef] rounded-2xl p-4">
                      <div className="text-xs text-neutral-500">Stock</div>
                      <div className="font-semibold">{product.stock}</div>
                    </div>
                    <div className="bg-[#f7f4ef] rounded-2xl p-4">
                      <div className="text-xs text-neutral-500">Suggestion</div>
                      <div className="font-semibold">
                        {product.suggested} {product.unit}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => addToCart(product)}
                    className="mt-5 w-full bg-black text-white py-4 rounded-2xl font-semibold"
                  >
                    Ajouter à la commande
                  </button>
                </div>
              ))}
            </div>
          </section>

          <aside className="col-span-4">
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-black/5 sticky top-6">
              <h2 className="text-2xl font-semibold">🛒 Commande du jour</h2>
              <p className="text-sm text-neutral-500 mt-1">Regroupée par fournisseur à 17:45</p>

              <div className="mt-6 space-y-4">
                {cartItems.length === 0 && (
                  <div className="text-neutral-400 bg-[#f7f4ef] rounded-2xl p-5 text-center">
                    Aucun produit ajouté
                  </div>
                )}

                {cartItems.map((item) => (
                  <div key={item.id} className="border-b pb-4">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-xs text-neutral-500">{item.supplier}</div>
                      </div>
                      <div className="font-semibold">
                        {item.qty} {item.unit}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button onClick={() => changeQty(item.id, -1)} className="bg-[#f1ede6] px-4 py-2 rounded-xl">
                        -
                      </button>
                      <button onClick={() => changeQty(item.id, 1)} className="bg-[#f1ede6] px-4 py-2 rounded-xl">
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button className="w-full mt-6 bg-[#61d6d6] text-white py-4 rounded-2xl font-semibold">
                Envoyer vers MOKA-OS
              </button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}