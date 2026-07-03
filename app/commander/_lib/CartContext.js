"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "moka-commander-cart";

function lineKey(id, variant) {
  return `${id}::${variant || ""}`;
}

function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return action.items;

    case "ADD_ITEM": {
      const { product, variant, qty } = action;
      const key = lineKey(product.id, variant);
      const existing = state.find((i) => lineKey(i.id, i.variant) === key);
      if (existing) {
        return state.map((i) => (lineKey(i.id, i.variant) === key ? { ...i, qty: i.qty + qty } : i));
      }
      return [
        ...state,
        { id: product.id, name: product.name, photo: product.photo, price: product.price, qty, variant: variant || null },
      ];
    }

    case "REMOVE_ITEM": {
      const key = lineKey(action.id, action.variant);
      return state.filter((i) => lineKey(i.id, i.variant) !== key);
    }

    case "UPDATE_QTY": {
      const key = lineKey(action.id, action.variant);
      if (action.qty <= 0) return state.filter((i) => lineKey(i.id, i.variant) !== key);
      return state.map((i) => (lineKey(i.id, i.variant) === key ? { ...i, qty: action.qty } : i));
    }

    case "CLEAR":
      return [];

    default:
      return state;
  }
}

// sessionStorage only — cart resets when the tab closes, by design.
export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "HYDRATE", items: JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const api = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    return {
      items,
      count,
      subtotal,
      addItem: (product, variant, qty = 1) => dispatch({ type: "ADD_ITEM", product, variant, qty }),
      removeItem: (id, variant) => dispatch({ type: "REMOVE_ITEM", id, variant }),
      updateQty: (id, variant, qty) => dispatch({ type: "UPDATE_QTY", id, variant, qty }),
      clearCart: () => dispatch({ type: "CLEAR" }),
    };
  }, [items]);

  return <CartContext value={api}>{children}</CartContext>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
