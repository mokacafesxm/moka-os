"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "moka-commander-cart";

const INITIAL_STATE = { items: [], comment: "", hydrated: false };

// Extras are a plain string list (see ProductPopup) — sorted+joined so two
// identical selections in a different click order still collapse into one
// cart line, while any different selection gets its own line.
function extrasKey(extras) {
  return [...(extras || [])].sort().join("|");
}

function lineKey(id, variant, extras) {
  return `${id}::${variant || ""}::${extrasKey(extras)}`;
}

// State carries a `hydrated` flag alongside the items: hydration from
// sessionStorage runs in an effect (after first render), so consumers that
// must not act on the initial empty cart — e.g. the checkout's empty-cart
// redirect — can wait for it. It lives in the reducer (not a separate
// useState) so it's set via dispatch, not a setState-in-effect.
function reducer(state, action) {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items, comment: action.comment || "", hydrated: true };

    case "MARK_HYDRATED":
      return { ...state, hydrated: true };

    case "ADD_ITEM": {
      const { product, variant, qty, extras } = action;
      const key = lineKey(product.id, variant, extras);
      const existing = state.items.find((i) => lineKey(i.id, i.variant, i.extras) === key);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) => (lineKey(i.id, i.variant, i.extras) === key ? { ...i, qty: i.qty + qty } : i)),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            id: product.id,
            name: product.name,
            photo: product.photo,
            price: product.price,
            qty,
            variant: variant || null,
            extras: extras && extras.length ? extras : null,
          },
        ],
      };
    }

    case "REMOVE_ITEM": {
      const key = lineKey(action.id, action.variant, action.extras);
      return { ...state, items: state.items.filter((i) => lineKey(i.id, i.variant, i.extras) !== key) };
    }

    case "UPDATE_QTY": {
      const key = lineKey(action.id, action.variant, action.extras);
      if (action.qty <= 0) return { ...state, items: state.items.filter((i) => lineKey(i.id, i.variant, i.extras) !== key) };
      return {
        ...state,
        items: state.items.map((i) => (lineKey(i.id, i.variant, i.extras) === key ? { ...i, qty: action.qty } : i)),
      };
    }

    case "SET_COMMENT":
      return { ...state, comment: action.comment };

    case "CLEAR":
      return { ...state, items: [], comment: "" };

    default:
      return state;
  }
}

// sessionStorage only — cart resets when the tab closes, by design.
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { items, comment, hydrated } = state;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Older sessions stored a bare items array; new ones store
        // { items, comment }. Either way this is just ephemeral
        // sessionStorage, so no real migration is needed beyond not crashing.
        const parsedItems = Array.isArray(parsed) ? parsed : parsed.items || [];
        const parsedComment = Array.isArray(parsed) ? "" : parsed.comment || "";
        dispatch({ type: "HYDRATE", items: parsedItems, comment: parsedComment });
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
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items, comment }));
    } catch {}
  }, [items, comment, hydrated]);

  const api = useMemo(() => {
    const count = items.reduce((sum, i) => sum + i.qty, 0);
    const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
    return {
      items,
      count,
      subtotal,
      comment,
      hydrated,
      addItem: (product, variant, qty = 1, extras) => dispatch({ type: "ADD_ITEM", product, variant, qty, extras }),
      removeItem: (id, variant, extras) => dispatch({ type: "REMOVE_ITEM", id, variant, extras }),
      updateQty: (id, variant, qty, extras) => dispatch({ type: "UPDATE_QTY", id, variant, qty, extras }),
      setComment: (comment) => dispatch({ type: "SET_COMMENT", comment }),
      clearCart: () => dispatch({ type: "CLEAR" }),
    };
  }, [items, comment, hydrated]);

  return <CartContext value={api}>{children}</CartContext>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
