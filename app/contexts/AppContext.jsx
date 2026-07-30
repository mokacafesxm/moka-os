"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRealTime } from "./RealTimeContext";

const PRODUCTS_URL = "/api/products";
const STOCK_URL = "/api/stock";
const STAFF_URL = "/api/staff";
const PREPS_URL = "/api/preps";
const REFERENTIELS_URL = "/api/settings/referentiels";
const SUPPLIERS_URL = "/api/settings/suppliers";
const SUPPLIER_ORDERS_URL = "/api/supplier-orders";
const ZONES_URL = "/api/zones";
const EQUIPEMENTS_URL = "/api/equipements";
const TACHES_URL = "/api/taches";

// Poll "lent" (données moins critiques : catalogue produits, prépas,
// staff, référentiels) — distinct du tick RealTimeContext (8s, partagé
// avec d'autres consommateurs comme le pointage) qui reste réservé à
// stockLive/supplierOrders ci-dessous, seules données où un retard de
// quelques secondes coûte réellement (rupture de stock, commande en cours).
const SLOW_POLL_MS = 15000;

function normalizeArray(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (data?.id) return [data];
  return [];
}

async function fetchArraySilent(url, key) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeArray(data, key);
  } catch (error) {
    console.error(`[AppContext] fetch failed: ${url}`, error);
    return null;
  }
}

// Hydratation synchrone depuis localStorage au montage : l'app affiche les
// dernières données connues immédiatement (pas d'état vide visible), puis
// refreshAll() les remplace silencieusement par des données fraîches en
// arrière-plan. Le cache est écrit après chaque refresh réussi (voir
// cacheWrite dans chaque refreshXxx ci-dessous).
function loadCache(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveCache(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota/privé — le cache reste juste un confort, pas une source de vérité */
  }
}

const CACHE_KEYS = {
  products: "mokaProductsCache",
  stockLive: "mokaStockCache",
  staff: "mokaStaffCache",
  preps: "mokaPrepsCache",
  supplierOrders: "mokaSupplierOrdersCache",
  referentiels: "mokaReferentielsCache",
  suppliers: "mokaSuppliersCache",
  zonesPhysiques: "mokaZonesPhysiquesCache",
};

const EMPTY_REFERENTIELS = { categories: [], sousCategories: [], zones: [], unites: [] };

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { subscribe } = useRealTime();

  const [products, setProducts] = useState(() => loadCache(CACHE_KEYS.products, []));
  const [stockLive, setStockLive] = useState(() => loadCache(CACHE_KEYS.stockLive, []));
  const [productsDb, setProductsDb] = useState([]);
  const [preps, setPreps] = useState(() => loadCache(CACHE_KEYS.preps, []));
  const [referentiels, setReferentiels] = useState(() => loadCache(CACHE_KEYS.referentiels, EMPTY_REFERENTIELS));
  const [suppliers, setSuppliers] = useState(() => loadCache(CACHE_KEYS.suppliers, []));
  const [staff, setStaff] = useState(() => loadCache(CACHE_KEYS.staff, []));
  const [supplierOrders, setSupplierOrders] = useState(() => loadCache(CACHE_KEYS.supplierOrders, []));

  const [zonesPhysiques, setZonesPhysiques] = useState(() => loadCache(CACHE_KEYS.zonesPhysiques, []));
  const [equipements, setEquipements] = useState([]);
  const [taches, setTaches] = useState([]);

  // true jusqu'à ce que le tout premier refreshAll() se termine — permet aux
  // pages consommatrices de n'afficher un skeleton que lorsqu'il n'y a
  // vraiment rien à montrer (ni cache ni données fraîches), pas à chaque
  // visite : if (list.length === 0 && loading) → skeleton ; sinon afficher
  // la liste (cache ou fraîche) même si un refresh est encore en vol.
  const [loading, setLoading] = useState(() => products.length === 0 && staff.length === 0);

  // Recettes: la page Poste lit directement /api/recipes/sold-products (système
  // existant, voir docs/MOKA_OS_V2_BLUEPRINT.md) — pas dupliqué ici.
  // Incidents: route /api/incidents pas encore construite (hors scope Sprint 4).
  const [recettes, setRecettes] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const refreshProducts = useCallback(async () => {
    const list = await fetchArraySilent(PRODUCTS_URL, "products");
    if (list) { setProducts(list); saveCache(CACHE_KEYS.products, list); }
  }, []);

  const refreshStock = useCallback(async () => {
    const list = await fetchArraySilent(STOCK_URL, "stock");
    if (list) { setStockLive(list); saveCache(CACHE_KEYS.stockLive, list); }
  }, []);

  const refreshStaff = useCallback(async () => {
    const list = await fetchArraySilent(STAFF_URL, "staff");
    if (list?.length) { setStaff(list); saveCache(CACHE_KEYS.staff, list); }
  }, []);

  const refreshPreps = useCallback(async () => {
    const list = await fetchArraySilent(PREPS_URL, "preps");
    if (list) { setPreps(list); saveCache(CACHE_KEYS.preps, list); }
  }, []);

  const refreshSuppliers = useCallback(async () => {
    const list = await fetchArraySilent(SUPPLIERS_URL, "suppliers");
    if (list) { setSuppliers(list); saveCache(CACHE_KEYS.suppliers, list); }
  }, []);

  const refreshSupplierOrders = useCallback(async () => {
    const list = await fetchArraySilent(SUPPLIER_ORDERS_URL, "orders");
    if (list) { setSupplierOrders(list); saveCache(CACHE_KEYS.supplierOrders, list); }
  }, []);

  const refreshZones = useCallback(async () => {
    const list = await fetchArraySilent(ZONES_URL, "zones");
    if (list) { setZonesPhysiques(list); saveCache(CACHE_KEYS.zonesPhysiques, list); }
  }, []);

  const refreshEquipements = useCallback(async () => {
    const list = await fetchArraySilent(EQUIPEMENTS_URL, "equipements");
    if (list) setEquipements(list);
  }, []);

  const refreshTaches = useCallback(async () => {
    const list = await fetchArraySilent(TACHES_URL, "taches");
    if (list) setTaches(list);
  }, []);

  const refreshReferentiels = useCallback(async () => {
    try {
      const res = await fetch(REFERENTIELS_URL);
      if (!res.ok) return;
      const data = await res.json();
      const next = {
        categories: data.categories || [],
        sousCategories: data.sousCategories || [],
        zones: data.zones || [],
        unites: data.unites || [],
      };
      setReferentiels(next);
      saveCache(CACHE_KEYS.referentiels, next);
    } catch (error) {
      console.error("[AppContext] refreshReferentiels failed", error);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshProducts(),
      refreshStock(),
      refreshStaff(),
      refreshPreps(),
      refreshSuppliers(),
      refreshSupplierOrders(),
      refreshReferentiels(),
      refreshZones(),
      refreshEquipements(),
      refreshTaches(),
    ]);
  }, [
    refreshProducts, refreshStock, refreshStaff, refreshPreps, refreshSuppliers,
    refreshSupplierOrders, refreshReferentiels, refreshZones, refreshEquipements, refreshTaches,
  ]);

  useEffect(() => {
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  // Poll rapide (8s, tick partagé RealTimeContext) — réservé aux données où
  // un retard coûte réellement : niveaux de stock et commandes fournisseur
  // en cours. products/preps/staff descendus au poll lent ci-dessous.
  useEffect(() => {
    const unsubscribe = subscribe(async () => {
      await Promise.all([refreshStock(), refreshSupplierOrders()]);
    });
    return unsubscribe;
  }, [subscribe, refreshStock, refreshSupplierOrders]);

  // Poll lent (15s, indépendant de RealTimeContext) — catalogue produits,
  // prépas, staff, référentiels : rafraîchissement silencieux, jamais
  // bloquant puisque déjà hydraté depuis le cache localStorage au montage.
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([refreshProducts(), refreshPreps(), refreshStaff(), refreshReferentiels()]).catch(() => {});
    }, SLOW_POLL_MS);
    return () => clearInterval(interval);
  }, [refreshProducts, refreshPreps, refreshStaff, refreshReferentiels]);

  return (
    <AppContext.Provider
      value={{
        products,
        stockLive,
        productsDb,
        preps,
        referentiels,
        suppliers,
        staff,
        supplierOrders,
        zonesPhysiques,
        equipements,
        taches,
        recettes,
        incidents,
        loading,
        refreshAll,
        refreshStock,
        refreshProducts,
        refreshSupplierOrders,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within an AppProvider");
  return ctx;
}
