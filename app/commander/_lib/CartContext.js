"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "moka-commander-cart";

const INITIAL_STATE = { items: [], hydrated: false };

function lineKey(id, variant) {
  return `${id}::${variant || ""}`;
}

// State carries a `hydrated` flag alongside the items: hydration from
// sessionStorage runs in an effect (after first render), so consumers that
// must not act on the initial empty cart — e.g. the checkout's empty-cart
// redirect — can wait for it. It lives in the reducer (not a separate
// useState) so it's set via dispatch, not a setState-in-effect.
function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items, hydrated: true };

    case "MARK_HYDRATED":
      return { ...state, hydrated: true };

    case "ADD_ITEM": {
      const { product, variant, qty } = action;
      const key = lineKey(product.id, variant);
      const existing = state.items.find((i) => lineKey(i.id, i.variant) === key);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) => (lineKey(i.id, i.variant) === key ? { ...i, qty: i.qty + qty } : i)),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          { id: product.id, name: product.name, photo: product.photo, price: product.price, qty, variant: variant || null },
        ],
      };
    }

    case "REMOVE_ITEM": {
      const key = lineKey(action.id, action.variant);
      return { ...state, items: state.items.filter((i) => lineKey(i.id, i.variant) !== key) };
    }

    case "UPDATE_QTY": {
      const key = lineKey(action.id, action.variant);
      if (action.qty <= 0) return { ...state, items: state.items.filter((i) => lineKey(i.id, i.variant) !== key) };
      return {
        ...state,
        items: state.items.map((i) => (lineKey(i.id, i.variant) === key ? { ...i, qty: action.qty } : i)),
      };
    }

    case "CLEAR":
      return { ...state, items: [] };

    default:
      return state;
  }
}

// sessionStorage only — cart resets when the tab closes, by design.
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { items, hydrated } = state;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        dispatch({ type: "HYDRATE", items: JSON.parse(raw) });
        return;
      }
    } catch {}
    dispatch({ type: "MARK_HYDRATED" });
  }, []);

  useEffect(() => {
    // Don't persist until the initial read has run, otherwise this effect's
    // first pass would overwrite the saved cart with the empty initial state.
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items, hydrated]);

  const api = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    return {
      items,
      count,
      subtotal,
      hydrated,
      addItem: (product, variant, qty = 1) => dispatch({ type: "ADD_ITEM", product, variant, qty }),
      removeItem: (id, variant) => dispatch({ type: "REMOVE_ITEM", id, variant }),
      updateQty: (id, variant, qty) => dispatch({ type: "UPDATE_QTY", id, variant, qty }),
      clearCart: () => dispatch({ type: "CLEAR" }),
    };
  }, [items, hydrated]);

  return <CartContext value={api}>{children}</CartContext>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
