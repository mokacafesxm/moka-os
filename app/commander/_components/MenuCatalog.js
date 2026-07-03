"use client";

import { useState } from "react";
import { MOKA } from "../_lib/theme";
import CategoryNav from "./CategoryNav";
import CategorySection from "./CategorySection";
import PromoBanner from "./PromoBanner";
import ProductBottomSheet from "./ProductBottomSheet";

export default function MenuCatalog({ data }) {
  const { categories, sections, popular, autres, promos } = data;
  const [selectedProduct, setSelectedProduct] = useState(null);

  const promo = (index) => promos[index] ?? null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: MOKA.cream }}>
      <CategoryNav categories={categories} />

      <main className="pb-12">
        {popular.length > 0 && (
          <CategorySection nom="Popular" produits={popular} onSelectProduct={setSelectedProduct} />
        )}

        <PromoBanner promo={promo(0)} />

        {sections.map((section, i) => (
          <div key={section.id}>
            <CategorySection
              nom={section.nom}
              produits={section.produits}
              onSelectProduct={setSelectedProduct}
            />
            <PromoBanner promo={promo(i + 1)} />
          </div>
        ))}

        {autres.length > 0 && (
          <CategorySection nom="Autres" produits={autres} onSelectProduct={setSelectedProduct} />
        )}
      </main>

      {selectedProduct && (
        <ProductBottomSheet product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </div>
  );
}
