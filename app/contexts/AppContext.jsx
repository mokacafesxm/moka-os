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

const EMPTY_REFERENTIELS = { categories: [], sousCategories: [], zones: [], unites: [] };

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const { subscribe } = useRealTime();

  const [products, setProducts] = useState([]);
  const [stockLive, setStockLive] = useState([]);
  const [productsDb, setProductsDb] = useState([]);
  const [preps, setPreps] = useState([]);
  const [referentiels, setReferentiels] = useState(EMPTY_REFERENTIELS);
  const [suppliers, setSuppliers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);

  // Bases Notion pas encore créées (Sprint 3) — placeholders en attendant les routes API.
  const [zonesPhysiques, setZonesPhysiques] = useState([]);
  const [equipements, setEquipements] = useState([]);
  const [taches, setTaches] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [incidents, setIncidents] = useState([]);

  const refreshProducts = useCallback(async () => {
    const list = await fetchArraySilent(PRODUCTS_URL, "products");
    if (list) setProducts(list);
  }, []);

  const refreshStock = useCallback(async () => {
    const list = await fetchArraySilent(STOCK_URL, "stock");
    if (list) setStockLive(list);
  }, []);

  const refreshStaff = useCallback(async () => {
    const list = await fetchArraySilent(STAFF_URL, "staff");
    if (list?.length) setStaff(list);
  }, []);

  const refreshPreps = useCallback(async () => {
    const list = await fetchArraySilent(PREPS_URL, "preps");
    if (list) setPreps(list);
  }, []);

  const refreshSuppliers = useCallback(async () => {
    const list = await fetchArraySilent(SUPPLIERS_URL, "suppliers");
    if (list) setSuppliers(list);
  }, []);

  const refreshSupplierOrders = useCallback(async () => {
    const list = await fetchArraySilent(SUPPLIER_ORDERS_URL, "orders");
    if (list) setSupplierOrders(list);
  }, []);

  const refreshReferentiels = useCallback(async () => {
    try {
      const res = await fetch(REFERENTIELS_URL);
      if (!res.ok) return;
      const data = await res.json();
      setReferentiels({
        categories: data.categories || [],
        sousCategories: data.sousCategories || [],
        zones: data.zones || [],
        unites: data.unites || [],
      });
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
    ]);
  }, [refreshProducts, refreshStock, refreshStaff, refreshPreps, refreshSuppliers, refreshSupplierOrders, refreshReferentiels]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Polling silencieux 8s (RealTimeContext) — jamais de toast sur erreur réseau ici.
  useEffect(() => {
    const unsubscribe = subscribe(async () => {
      await Promise.all([refreshStock(), refreshProducts(), refreshPreps(), refreshStaff()]);
    });
    return unsubscribe;
  }, [subscribe, refreshStock, refreshProducts, refreshPreps, refreshStaff]);

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
        refreshAll,
        refreshStock,
        refreshProducts,
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
