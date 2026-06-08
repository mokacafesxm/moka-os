"use client";

import React, { useEffect, useMemo, useState } from "react";

const PRODUCTS_URL = "/api/products";

const SEND_URL = "/api/orders/send";

const PREPS_URL = "/api/preps";

const STAFF_URL = "/api/staff";

const STOCK_URL = "/api/stock";

const STOCK_UPDATE_URL = "/api/stock/update";

const PRODUCT_UPDATE_URL = "/api/products/update";

const PRODUCT_CREATE_URL = "/api/products/create";

const COMPLETE_PREP_URL = "/api/preps/complete";

const CREATE_PREP_URL = "/api/preps/create";

const CLOCK_URL = "/api/clock";

const SETTINGS_URL = "/api/settings";

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

function normalizeArray(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (data?.id) return [data];
  return [];
}

function getSubCategory(product) {
  return product?.subcategory || "Autres";
}

function getSupplier(product) {
  const raw =
    product?.fournisseurDefautName ??
    product?.fournisseurName ??
    product?.supplierName ??
    product?.fournisseurDefaut ??
    product?.fournisseur ??
    product?.supplier ??
    product?.["Fournisseur par défaut"] ??
    product?.["Fournisseur"] ??
    "";

  if (Array.isArray(raw)) {
    return raw
      .map((value) => {
        if (typeof value === "string") return value;
        return value?.name || value?.nom || value?.title || value?.id || "";
      })
      .filter(Boolean)
      .join(", ") || "À définir";
  }

  if (typeof raw === "object" && raw) {
    return raw.name || raw.nom || raw.title || raw.id || "À définir";
  }

  return raw || "À définir";
}

function getSupplierIdFromName(name, suppliers = []) {
  const clean = String(name || "").trim().toLowerCase();
  if (!clean) return "";

  const found = suppliers.find((supplier) => {
    const supplierName = String(
      supplier?.nom || supplier?.name || supplier?.fournisseur || supplier?.title || ""
    ).trim().toLowerCase();

    return supplierName === clean;
  });

  return found?.id || found?.pageId || found?.notionId || "";
}

function getStockName(item) {
  return item?.name || item?.produit || item?.Produit || item?.ingredient || "Produit";
}

function getStockStatus(item) {
  return (
    item?.status ||
    item?.statut ||
    item?.Statut ||
    item?.property_statut ||
    item?.["Statut"] ||
    "À configurer"
  );
}

function getStockPortions(item) {
  return item?.portionsRestantes || item?.portions || item?.["Portions restantes"] || 0;
}

function getStockQty(item) {
  return item?.quantiteStock ?? item?.quantite ?? item?.poidsTotal ??
         item?.PoidsTotal ?? item?.poids_live ?? item?.poidsLive ??
         item?.portionsRestantes ?? 0;
}

function getStockDisplayUnit(item) {
  return item?.uniteStock || item?.unite || item?.unit ||
         item?.Unite || item?.uniteCommande || "";
}

function getStockZone(item) {
  return item?.zone || item?.emplacement || item?.zoneStockage || "";
}

function getStockCategory(item) {
  return (
    item?.category ||
    item?.categorie ||
    item?.Categorie ||
    item?.catégorie ||
    item?.Catégorie ||
    item?.["Catégorie"] ||
    item?.["Categorie"] ||
    "Autres"
  );
}

function isPrepStock(item) {
  const cat = String(getStockCategory(item))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

  return cat.includes("PREPA");
}


function formatLocalDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

function getPrepDueDate(prep) {
  const raw =
    prep?.dueDate ||
    prep?.datePrevue ||
    prep?.["Date prévue"] ||
    prep?.property_date_pr_vue ||
    prep?.property_date_prevue ||
    "";

  if (!raw) return "";
  if (typeof raw === "object" && raw.start) return raw.start.slice(0, 10);
  return String(raw).slice(0, 10);
}

function getPrepDateLabel(dateStr) {
  if (!dateStr) return "🕒 Sans date prévue";

  const today = formatLocalDate(new Date());
  const tomorrow = addDays(1);

  if (dateStr === today) return "🔥 À faire aujourd’hui";
  if (dateStr === tomorrow) return "📅 À faire demain";

  return `🗓 À faire le ${dateStr.split("-").reverse().join("/")}`;
}

function getStaffName(member) {
  return (
    member?.prenom ||
    member?.firstName ||
    member?.name ||
    member?.nom ||
    member?.Prénom ||
    member?.staff ||
    member?.email ||
    "Staff"
  );
}

function getPrepName(prep) {
  return (
    prep?.name ||
    prep?.prep ||
    prep?.preparation ||
    prep?.Préparation ||
    prep?.Besoin ||
    "Préparation"
  );
}

function getPrepQuantity(prep) {
  return prep?.quantity || prep?.quantite || prep?.Quantité || prep?.qty || 1;
}

function getPrepUnit(prep) {
  return prep?.unit || prep?.unite || prep?.Unite || prep?.Unité || "unité";
}

function getPrepStatus(prep) {
  return prep?.status || prep?.Statut || "À faire";
}

function getPrepPriority(prep) {
  return prep?.priority || prep?.Priorité || prep?.priorite || "Normal";
}

function getEditableId(item) {
  return item?.ingredientId || item?.matierePremiereId || item?.productId || item?.id;
}

// ── Orders section helpers ─────────────────────────────────────────
function ordFirstValue(obj, keys, fallback = "") {
  for (const key of keys) {
    const value = obj?.[key];
    if (Array.isArray(value)) {
      if (!value.length) continue;
      return value.map((v) => typeof v === "string" || typeof v === "number" ? v : v?.name || v?.nom || v?.title || v?.plain_text || v?.id || "").filter(Boolean).join(", ");
    }
    if (value && typeof value === "object") {
      if (value.start) return value.start;
      if (value.name || value.nom || value.title || value.id) return value.name || value.nom || value.title || value.id;
    }
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return fallback;
}
function ordGetSupplierName(s) { return ordFirstValue(s, ["nom","name","fournisseur","supplier","title","Nom","Fournisseur"], "Sans nom"); }
function ordGetSupplierPhone(s) { return ordFirstValue(s, ["telephone","téléphone","phone","whatsapp","WhatsApp","Téléphone"], ""); }
function ordGetSupplierWhatsapp(s) { return ordFirstValue(s, ["whatsapp","WhatsApp","telephone","téléphone","phone","Téléphone"], ""); }
function ordGetSupplierEmail(s) { return ordFirstValue(s, ["email","Email","mail","Mail"], ""); }
function ordGetStockSupplier(item) { return ordFirstValue(item, ["fournisseur","fournisseurDefaut","fournisseurDefautName","supplier","supplierName","Fournisseur","Fournisseur par défaut"], "Sans fournisseur"); }
function ordGetStockUnit(item) { return ordFirstValue(item, ["unit","unite","Unité","uniteCommande","uniteStock"], "kg"); }
function ordGetStockSuggested(item) { return Number(ordFirstValue(item, ["suggested","quantiteCommandee","quantiteCommandeSuggeree","quantiteSuggeree","Quantité suggérée"], 1)) || 1; }
function ordGetStockCriticalLimit(item) { return Number(ordFirstValue(item, ["seuilCritique","seuilCritiquePortion","Seuil critique","Seuil critique (portion)"], 0)) || 0; }
function ordNormalizeStock(item) {
  return {
    id: item?.id || item?.ingredientId || getStockName(item),
    name: getStockName(item),
    status: String(getStockStatus(item)),
    portionsRestantes: getStockPortions(item),
    fournisseur: ordGetStockSupplier(item),
    unit: ordGetStockUnit(item),
    suggested: ordGetStockSuggested(item),
    seuilCritique: ordGetStockCriticalLimit(item),
    categorie: item?.categorie || item?.category || item?.cat || "",
    category: item?.categorie || item?.category || item?.cat || "",
  };
}
function isPrepaCategory(item) {
  const cat = String(item?.categorie || item?.category || item?.cat || "").trim().toLowerCase();
  return cat.includes("prepa") || cat.includes("prépa") || cat.includes("preparation") || cat.includes("préparation");
}
function isUrgentStock(item) {
  const s = String(item.status || item.statut || "").toLowerCase();
  return s.includes("critique") || s.includes("stock bas") || s.includes("alerte") || s.includes("commander");
}

export default function MokaOrderPad() {
  const [activeTab, setActiveTab] = useState("orderpad");

  const [products, setProducts] = useState(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("mokaProductsCache") || "[]"); }
    catch { return []; }
  });
  const [preps, setPreps] = useState(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("mokaPrepsCache") || "[]"); }
    catch { return []; }
  });
  const [staff, setStaff] = useState([]);
  const [stockLive, setStockLive] = useState(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("mokaStockCache") || "[]"); }
    catch { return []; }
  });

  const [activeCategory, setActiveCategory] = useState("");
  const [activeSubCategory, setActiveSubCategory] = useState("");

  const [cart, setCart] = useState({});
  const [selectedStaff, setSelectedStaff] = useState("");

  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return JSON.parse(localStorage.getItem("mokaProductsCache") || "[]").length === 0; }
    catch { return true; }
  });
  const [loadingPreps, setLoadingPreps] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return JSON.parse(localStorage.getItem("mokaPrepsCache") || "[]").length === 0; }
    catch { return true; }
  });
  const [loadingStock, setLoadingStock] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return JSON.parse(localStorage.getItem("mokaStockCache") || "[]").length === 0; }
    catch { return true; }
  });
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [inventoryItem, setInventoryItem] = useState(null);
  const [inventoryWeight, setInventoryWeight] = useState("");
  const [inventoryUnit, setInventoryUnit] = useState("kg");
  const [stockReceiveItem, setStockReceiveItem] = useState(null);
  const [stockReceiveWeight, setStockReceiveWeight] = useState("");
  const [stockReceiveUnit, setStockReceiveUnit] = useState("kg");
  const [stockReceiveMode, setStockReceiveMode] = useState("add");
  const [savingStockReceive, setSavingStockReceive] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceImage, setInvoiceImage] = useState(null);
  const [invoiceImageUrl, setInvoiceImageUrl] = useState("");
  const [invoiceAnalyzing, setInvoiceAnalyzing] = useState(false);
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [inventoryCategory, setInventoryCategory] = useState("Tous");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("Tous");
  const [inventoryView, setInventoryView] = useState("stock");
  const [savingInventory, setSavingInventory] = useState(false);
  const [stockView, setStockView] = useState("prepa");
  const [activeStockCategory, setActiveStockCategory] = useState("");
  const [dueDateMode, setDueDateMode] = useState("1");
  const [customDueDate, setCustomDueDate] = useState("");

  const [settingsItem, setSettingsItem] = useState(null);
  const [settingsForm, setSettingsForm] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSection, setAdminSection] = useState("dashboard");
  const [settingsPanel, setSettingsPanel] = useState("");
  const [settingsData, setSettingsData] = useState([]);
  const [supplierOrders, setSupplierOrders] = useState([]);
  const [loadingSupplierOrders, setLoadingSupplierOrders] = useState(false);
  const [supplierOrdersFilter, setSupplierOrdersFilter] = useState("À commander");
  const [selectedSupplierOrder, setSelectedSupplierOrder] = useState("");

  const [settingsCache, setSettingsCache] = useState(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("mokaSettingsCache") || "{}"); }
    catch { return {}; }
  });
  const [loadingSettingsPanel, setLoadingSettingsPanel] = useState(false);
  const [editingSettingsItem, setEditingSettingsItem] = useState(null);
  const [editingSettingsForm, setEditingSettingsForm] = useState({});
  const [savingSettingsPanel, setSavingSettingsPanel] = useState(false);

  const [productsDb, setProductsDb] = useState(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("mokaProductsDbCache") || "[]"); }
    catch { return []; }
  });
  const [loadingProductsDb, setLoadingProductsDb] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return JSON.parse(localStorage.getItem("mokaProductsDbCache") || "[]").length === 0; }
    catch { return false; }
  });
  const [editingProductDb, setEditingProductDb] = useState(null);
  const [editingProductDbForm, setEditingProductDbForm] = useState({});
  const [savingProductDb, setSavingProductDb] = useState(false);
  const [creatingProductDb, setCreatingProductDb] = useState(false);
  const [creatingProductDbForm, setCreatingProductDbForm] = useState({});
  const [creatingProductPhotoFile, setCreatingProductPhotoFile] = useState("");
  const [productsDbSearch, setProductsDbSearch] = useState("");
  const [productsDbCategory, setProductsDbCategory] = useState("Tous");
  const [creatingSettingsItem, setCreatingSettingsItem] = useState(false);
  const [creatingSettingsForm, setCreatingSettingsForm] = useState({});
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState("");

  const [showClockModal, setShowClockModal] = useState(false);
  const [clockNow, setClockNow] = useState(new Date());
  const [loadingClockStaff, setLoadingClockStaff] = useState(false);
  const [clockStatuses, setClockStatuses] = useState(() => {
    if (typeof window === "undefined") return {};

    const today = new Date().toISOString().slice(0, 10);
    const saved = JSON.parse(localStorage.getItem("mokaClockStatuses") || "{}");

    if (saved.date !== today) return {};

    const now = new Date();
    const afterReset = now.getHours() >= 18;

    if (afterReset && !saved.resetDone) {
      localStorage.setItem("mokaClockStatuses", JSON.stringify({
        date: today,
        resetDone: true,
        statuses: {},
      }));
      return {};
    }

    return saved.statuses || {};
  });
  const [clockSending, setClockSending] = useState(false);

  const [orderView, setOrderView] = useState("urgent");
  const [orderCart, setOrderCart] = useState({});
  const [ordSelectedSupplier, setOrdSelectedSupplier] = useState("");
  const [orderDetail, setOrderDetail] = useState(null);
  const [showOrderPreview, setShowOrderPreview] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [ordStatusFilter, setOrdStatusFilter] = useState("Tous");
  const [composeCart, setComposeCart] = useState({});

  const loadPreps = () => {
    setLoadingPreps(true);

    fetch(PREPS_URL)
      .then((res) => res.json())
      .then((data) => {
        const freshPreps = normalizeArray(data, "preps");
        setPreps(freshPreps);
        if (typeof window !== "undefined") localStorage.setItem("mokaPrepsCache", JSON.stringify(freshPreps));
        setLoadingPreps(false);
      })
      .catch((err) => {
        console.error("Erreur chargement prépas:", err);
        setLoadingPreps(false);
      });
  };

  useEffect(() => {
    fetch(PRODUCTS_URL)
      .then((res) => res.json())
      .then((data) => {
        const list = normalizeArray(data, "products");
        setProducts(list);
        if (typeof window !== "undefined") localStorage.setItem("mokaProductsCache", JSON.stringify(list));

        const firstCategory = list.find((p) => p.category)?.category;
        if (firstCategory) setActiveCategory(firstCategory);

        setLoading(false);
      })
      .catch((err) => {
        console.error("Erreur chargement produits:", err);
        setLoading(false);
      });

    loadPreps();

    fetch(STOCK_URL)
      .then((res) => res.json())
      .then((data) => {
        const freshStock = normalizeArray(data, "stock");
        setStockLive(freshStock);
        if (typeof window !== "undefined") localStorage.setItem("mokaStockCache", JSON.stringify(freshStock));
        setLoadingStock(false);
      })
      .catch((err) => {
        console.error("Erreur chargement stock live:", err);
        setLoadingStock(false);
      });

    fetch(STAFF_URL)
      .then((res) => res.json())
      .then((data) => {
        setStaff(normalizeArray(data, "staff"));
      })
      .catch((err) => {
        console.error("Erreur chargement staff:", err);
      });
  }, []);

  useEffect(() => {
    setCart({});
    setSelectedStaff("");
  }, [activeTab, stockView]);

  const selectedDueDate = useMemo(() => {
    if (dueDateMode === "custom") return customDueDate || addDays(0);
    if (dueDateMode === "1") return addDays(1);
    if (dueDateMode === "3") return addDays(3);
    if (dueDateMode === "5") return addDays(5);
    return addDays(1);
  }, [dueDateMode, customDueDate]);

  const selectedStaffName = useMemo(() => {
    const found = staff.find(
      (member) => String(member.id || getStaffName(member)) === selectedStaff
    );

    return found ? getStaffName(found) : "";
  }, [staff, selectedStaff]);

  const categories = useMemo(() => {
    const found = [...new Set(products.map((p) => p.category || "Autres"))]
      .filter((cat) => {
        const clean = String(cat || "").trim().toLowerCase();
        return clean !== "tous" && clean !== "tout" && clean !== "all";
      });

    return [
      ...found.sort((a, b) => {
        const ia = categoryOrder.indexOf(a);
        const ib = categoryOrder.indexOf(b);

        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      }),
    ];
  }, [products]);

  useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [activeCategory, categories]);

  const subCategories = useMemo(() => {
    if (!activeCategory) return [];

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
        cat === activeCategory;

      const matchesSubCategory =
        !activeSubCategory || sub === activeSubCategory;

      const matchesSearch =
        !q ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(supplier || "").toLowerCase().includes(q) ||
        String(p.unit || "").toLowerCase().includes(q) ||
        String(cat || "").toLowerCase().includes(q) ||
        String(sub || "").toLowerCase().includes(q) ||
        String(p.zone || "").toLowerCase().includes(q);

      return q ? matchesSearch : matchesCategory && matchesSubCategory && matchesSearch;
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

  const groupedPreps = useMemo(() => {
    const groups = {};

    preps.forEach((prep) => {
      const dueDate = getPrepDueDate(prep);
      const label = getPrepDateLabel(dueDate);

      if (!groups[label]) groups[label] = [];
      groups[label].push(prep);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      const getDate = (label) => {
        const item = groups[label]?.[0];
        return getPrepDueDate(item) || "9999-99-99";
      };

      return getDate(a).localeCompare(getDate(b));
    });
  }, [preps]);

  const addProduct = (product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: {
        ...product,
        type: "order",
        qty: Number(product.suggested) || 1,
      },
    }));
  };

  const addPrep = (prep) => {
    const id = prep.id || getPrepName(prep);

    setCart((prev) => ({
      ...prev,
      [id]: {
        ...prep,
        id,
        name: getPrepName(prep),
        type: "prep",
        qty: Number(getPrepQuantity(prep)) || 1,
        unit: getPrepUnit(prep),
        category: prep?.category || prep?.Categorie || "Prépas cuisine",
        subcategory: prep?.subcategory || prep?.SousCategorie || "Préparation",
        supplier: "Préparation interne",
      },
    }));
  };

  const addStockPrep = (item) => {
    const id = item.id || getStockName(item);

    setCart((prev) => ({
      ...prev,
      [id]: {
        ...item,
        id,
        name: getStockName(item),
        type: "stock-prep",
        qty: Number(item.quantitePrep || item.quantity || item.suggested || 1),
        unit: item.unit || item.unite || "kg",
        category: "Prépas cuisine",
        subcategory: "Stock Live",
        supplier: "Préparation interne",
      },
    }));
  };

  const removeItem = (id) => {
    setCart((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const cartItems = Object.values(cart);

  const uniqueValues = (values) => {
    return [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))].sort();
  };

  const supplierNameFromRow = (supplier) =>
    supplier?.nom || supplier?.name || supplier?.fournisseur || supplier?.title || "";

  const isUuidLikeSupplier = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());

  const fournisseurOptions = uniqueValues([
    ...(settingsCache.suppliers || []).map(supplierNameFromRow),
  ])
    .filter((name) => name && name !== "À définir" && name !== "—")
    .filter((name) => !isUuidLikeSupplier(name));
  const categoryOptions = uniqueValues([
    ...categoryOrder,
    ...products.map((p) => p.category || p.categorie),
  ]);

  const subCategoryOptions = uniqueValues(products.map((p) => getSubCategory(p)));

  const zoneOptions = uniqueValues(products.map((p) => p.zone || p.zoneStockage || p.emplacement));
  const uniteOptions = uniqueValues([
    ...products.map((p) => p.unit || p.uniteStock || p.uniteCommande),
    "kg",
    "g",
    "L",
    "ml",
    "pièce",
    "sceau",
    "carton",
    "boîte",
    "sachet",
  ]);


  const filteredStockLive = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();

    return stockLive.filter((item) => {
      const name = getStockName(item);
      const cat = getStockCategory(item);
      const zone = getStockZone(item);

      return (
        !q ||
        String(name).toLowerCase().includes(q) ||
        String(cat).toLowerCase().includes(q) ||
        String(zone).toLowerCase().includes(q)
      );
    });
  }, [stockLive, stockSearch, inventoryCategory, inventoryStatusFilter]);

  const stockPreps = useMemo(() => {
    return filteredStockLive.filter((item) => isPrepStock(item));
  }, [filteredStockLive]);

  const stockProducts = useMemo(() => {
    return filteredStockLive.filter((item) => !isPrepStock(item));
  }, [filteredStockLive]);

  const stockCategories = useMemo(() => {
    const found = [...new Set(stockProducts.map((item) => getStockCategory(item) || "Autres"))]
      .filter((cat) => {
        const clean = String(cat || "").trim().toLowerCase();
        return clean !== "tous" && clean !== "tout" && clean !== "all";
      });

    return [
      ...found.sort((a, b) => {
        const ia = categoryOrder.indexOf(a);
        const ib = categoryOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      }),
    ];
  }, [stockProducts]);

  const stockVisibleItems = useMemo(() => {
    if (stockView === "prepa") return stockPreps;

    const q = stockSearch.trim().toLowerCase();
    if (q) return stockProducts;

    return stockProducts.filter((item) => {
      const cat = getStockCategory(item);
      return !activeStockCategory || cat === activeStockCategory;
    });
  }, [stockView, stockPreps, stockProducts, activeStockCategory, stockSearch]);

  const groupedStockItems = useMemo(() => {
    const groups = {};

    stockVisibleItems.forEach((item) => {
      const category = stockView === "prepa" ? "Prépas" : getStockCategory(item);

      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [stockVisibleItems, stockView]);

  const prepCount = preps.filter(
    (prep) => getPrepStatus(prep) !== "Terminé" && getPrepStatus(prep) !== "Fait"
  ).length;


  const stockKpis = useMemo(() => {
    const total = stockLive.length;

    const critical = stockLive.filter((item) =>
      String(getStockStatus(item)).toLowerCase().includes("critique")
    ).length;

    const alert = stockLive.filter((item) => {
      const s = String(getStockStatus(item)).toLowerCase();
      return s.includes("alerte") || s.includes("stock bas") || s.includes("à commander");
    }).length;

    const ok = Math.max(total - critical - alert, 0);
    const health = total > 0 ? Math.round((ok / total) * 100) : 0;

    return { total, critical, alert, ok, health };
  }, [stockLive]);

  // ── Orders section computed ──────────────────────────────────────
  const ordNormalizedStock = useMemo(
    () => isAdmin && adminSection === "orders"
      ? stockLive.map(ordNormalizeStock).filter((item) => !isPrepaCategory(item))
      : [],
    [stockLive, isAdmin, adminSection]
  );
  const ordUrgentItems = useMemo(() => ordNormalizedStock.filter(isUrgentStock), [ordNormalizedStock]);
  const ordUrgentBySupplier = useMemo(() => {
    const map = {};
    ordUrgentItems.forEach((item) => {
      const sup = item.fournisseur || "Sans fournisseur";
      if (!map[sup]) map[sup] = [];
      map[sup].push(item);
    });
    return Object.entries(map);
  }, [ordUrgentItems]);
  const ordSupplierProducts = useMemo(() => {
    const selLower = String(ordSelectedSupplier || "").trim().toLowerCase();
    if (!selLower) return [];

    const supplierNameMap = {};
    (settingsCache.suppliers || []).forEach((s) => {
      const name = String(s.nom || s.name || "").trim();
      if (s.id) supplierNameMap[s.id] = name;
      if (s.id) supplierNameMap[s.id.replaceAll("-", "")] = name;
    });

    const matched = productsDb.filter((p) => {
      let sup = String(p.fournisseurDefaut || p.fournisseurDefautName || p.supplier || "").trim();
      if (/^[0-9a-f-]{36}$/i.test(sup)) {
        sup = supplierNameMap[sup] || supplierNameMap[sup.replaceAll("-", "")] || sup;
      }
      return sup.toLowerCase() === selLower && !isPrepaCategory(p);
    });

    const stockById = {};
    const stockByName = {};
    stockLive.forEach((item) => {
      if (item.ingredientId) stockById[item.ingredientId] = item;
      if (item.id) stockById[item.id] = item;
      const n = String(getStockName(item)).trim().toLowerCase();
      if (n) stockByName[n] = item;
    });

    const enriched = matched.map((p) => {
      const name = p.ingredient || p.name || "";
      const stockItem = stockById[p.id] || stockById[p.ingredientId] || stockByName[String(name).trim().toLowerCase()];
      return {
        id: p.id,
        name,
        categorie: p.categorie || p.category || "Autres",
        sousCategorie: p.sousCategorie || p.subcategory || "Autres",
        unit: p.uniteCommande || p.uniteStock || "kg",
        suggested: Number(p.quantiteCommandeSuggeree) || 1,
        stockQty: stockItem?.quantiteStock ?? 0,
        stockUnit: stockItem?.uniteStock || p.uniteStock || "kg",
        status: stockItem ? getStockStatus(stockItem) : "—",
        fournisseur: p.fournisseurDefaut || p.fournisseurDefautName || "",
      };
    });

    return enriched.sort((a, b) => {
      const ia = categoryOrder.indexOf(a.categorie);
      const ib = categoryOrder.indexOf(b.categorie);
      const catDiff = (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      if (catDiff !== 0) return catDiff;
      const subCmp = String(a.sousCategorie).localeCompare(String(b.sousCategorie));
      if (subCmp !== 0) return subCmp;
      return String(a.name).localeCompare(String(b.name));
    });
  }, [productsDb, stockLive, ordSelectedSupplier, settingsCache]);
  const ordFilteredOrders = useMemo(() => {
    const list = ordStatusFilter === "Tous" ? supplierOrders : supplierOrders.filter((o) => o.statut === ordStatusFilter);
    return [...list].sort((a, b) => String(b.dateCreation || "").localeCompare(String(a.dateCreation || "")));
  }, [supplierOrders, ordStatusFilter]);
  const ordCriticalCount = ordNormalizedStock.filter((i) => String(i.status).toLowerCase().includes("critique")).length;
  const ordAlertCount = ordNormalizedStock.filter((i) => { const s = String(i.status).toLowerCase(); return s.includes("stock bas") || s.includes("alerte") || s.includes("commander"); }).length;
  const ordSupplierContact = (settingsCache.suppliers || []).find((s) => ordGetSupplierName(s) === ordSelectedSupplier);
  const ordIncludedItems = ordSupplierProducts.filter((p) => composeCart[p.id]?.included);
  const ordCartItems = Object.values(orderCart);
  const addToOrderCart = (item) => {
    setOrderCart((prev) => ({ ...prev, [item.id]: { ...item, qty: item.suggested || 1 } }));
    setOrdSelectedSupplier(item.fournisseur || ordSelectedSupplier);
  };
  const updateOrderCartQty = (id, qty) => setOrderCart((prev) => ({ ...prev, [id]: { ...prev[id], qty } }));
  const removeFromOrderCart = (id) => setOrderCart((prev) => { const n = { ...prev }; delete n[id]; return n; });
  const buildOrderMessage = () => {
    const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const lines = ordIncludedItems.map((p) => `- ${p.name} — ${composeCart[p.id]?.qty || p.suggested} ${p.unit}`).join("\n");
    return `Bonjour ${ordSelectedSupplier} 👋\n\nCommande du ${date} :\n\n${lines}${orderNotes ? `\n\nNotes : ${orderNotes}` : ""}\n\nMerci 🙏\n— Équipe MÖKA`;
  };

  const sendClockAction = async (member, action) => {
    const staffId = member.id || getStaffName(member);
    const staffName = getStaffName(member);

    setClockSending(true);

    try {
      const response = await fetch(CLOCK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId,
          staffName,
          action,
          timestamp: new Date().toISOString(),
          source: "MOKA OS",
        }),
      });

      if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);

      setClockStatuses((prev) => {
        const next = {
          ...prev,
          [staffId]:
            action === "Arrivée"
              ? "present"
              : action === "Départ pause"
              ? "pause"
              : action === "Retour pause"
              ? "present"
              : action === "Départ"
              ? "done"
              : prev[staffId],
        };

        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem("mokaClockStatuses", JSON.stringify({
          date: today,
          resetDone: false,
          statuses: next,
        }));

        return next;
      });
    } catch (error) {
      console.error(error);
      alert("Erreur pointage ❌");
    } finally {
      setClockSending(false);
    }
  };

  const loadSettingsPanel = async (resource) => {
    setSettingsPanel(resource);

    const cached = settingsCache[resource];

    if (cached && cached.length) {
      setSettingsData(cached);
      setLoadingSettingsPanel(false);
    } else {
      setLoadingSettingsPanel(true);
    }

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource, action: "list" }),
      });

      if (!response.ok) throw new Error(`Erreur settings ${response.status}`);

      const data = await response.json();
      const list = Array.isArray(data) ? data : normalizeArray(data, resource);

      setSettingsData(list);
      setSettingsCache((prev) => {
        const next = { ...prev, [resource]: list };
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
        }
        return next;
      });
    } catch (error) {
      console.error(error);
      if (!cached || !cached.length) alert("Erreur chargement paramètres ❌");
    } finally {
      setLoadingSettingsPanel(false);
    }
  };

  useEffect(() => {
    if (isAdmin && !settingsCache.suppliers?.length) {
      fetchSettingsResource("suppliers")
        .then((list) => {
          setSettingsCache((prev) => {
            const next = { ...prev, suppliers: list };
            if (typeof window !== "undefined") {
              localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
            }
            return next;
          });
        })
        .catch((error) => console.error("Préchargement fournisseurs global:", error));
    }

    if (!isAdmin || adminSection !== "settings") return;

    const handler = (event) => {
      const card = event.target.closest("button, div");
      if (!card) return;

      const text = String(card.textContent || "").toLowerCase();

      if (text.includes("fournisseurs")) loadSettingsPanel("suppliers");
      else if (text.includes("staff")) loadSettingsPanel("staff");
      else if (text.includes("catégories") && !text.includes("sous")) loadSettingsPanel("categories");
      else if (text.includes("sous-catégories")) loadSettingsPanel("subcategories");
      else if (text.includes("unités")) loadSettingsPanel("units");
      else if (text.includes("zones")) loadSettingsPanel("zones");
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [isAdmin, adminSection]);

  const fetchSettingsResource = async (resource) => {
    const response = await fetch(SETTINGS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource, action: "list" }),
    });

    if (!response.ok) throw new Error(`Erreur settings ${response.status}`);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn("fetchSettingsResource: réponse non-JSON pour", resource);
      return [];
    }
    return Array.isArray(data) ? data : normalizeArray(data, resource);
  };
  useEffect(() => {
    if (!isAdmin || adminSection !== "settings") return;

    ["suppliers", "staff", "categories", "subcategories", "units", "zones"].forEach(async (resource) => {
      if (settingsCache[resource]) return;

      try {
        const list = await fetchSettingsResource(resource);
        setSettingsCache((prev) => {
          const next = { ...prev, [resource]: list };
          if (typeof window !== "undefined") {
            localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
          }
          return next;
        });
      } catch (error) {
        console.warn("Préchargement paramètres:", resource, error.message);
      }
    });
  }, [isAdmin, adminSection]);

  const openSettingsCreate = () => {
    setCreatingSettingsItem(true);
    setCreatingSettingsForm({
      nom: "",
      categorie: "",
      contact: "",
      methodeContact: "WhatsApp",
      telephone: "",
      email: "",
      actif: true,
    });
  };

  const saveSettingsDatabaseCreate = async () => {
    if (!settingsPanel) return;

    if (!String(creatingSettingsForm.nom || "").trim()) {
      alert("Nom obligatoire ❌");
      return;
    }

    setSavingSettingsPanel(true);

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: settingsPanel,
          action: "create",
          data: creatingSettingsForm,
        }),
      });

      if (!response.ok) throw new Error(`Erreur create ${response.status}`);

      const result = await response.json().catch(() => ({}));
      const created = result?.item || result?.[0] || {
        ...creatingSettingsForm,
        id: `temp-${Date.now()}`,
      };

      const updated = [created, ...settingsData];

      setSettingsData(updated);
      setSettingsCache((prev) => {
        const next = { ...prev, [settingsPanel]: updated };
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
        }
        return next;
      });

      setCreatingSettingsItem(false);
      alert("Élément créé ✅");
    } catch (error) {
      console.error(error);
      alert("Erreur création database ❌");
    } finally {
      setSavingSettingsPanel(false);
    }
  };

  const openSettingsEdit = (item) => {
    setEditingSettingsItem(item);
    setEditingSettingsForm({
      id: item.id || "",
      nom: item.nom || item.name || "",
      categorie: item.categorie || item.category || item.role || "",
      contact: item.contact || "",
      methodeContact: item.methodeContact || "",
      telephone: item.telephone || item.whatsapp || item.phone || "",
      email: item.email || "",
      actif: item.actif !== false,
    });
  };

  const saveSettingsDatabaseItem = async () => {
    if (!settingsPanel || !editingSettingsForm.id) return;

    setSavingSettingsPanel(true);

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: settingsPanel,
          action: "update",
          id: editingSettingsForm.id,
          data: editingSettingsForm,
        }),
      });

      if (!response.ok) throw new Error(`Erreur update ${response.status}`);

      const updated = settingsData.map((item) =>
        item.id === editingSettingsForm.id
          ? { ...item, ...editingSettingsForm }
          : item
      );

      setSettingsData(updated);
      setSettingsCache((prev) => {
        const next = { ...prev, [settingsPanel]: updated };
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
        }
        return next;
      });
      setEditingSettingsItem(null);
      alert("Modification enregistrée ✅");
    } catch (error) {
      console.error(error);
      alert("Erreur modification database ❌");
    } finally {
      setSavingSettingsPanel(false);
    }
  };

  const archiveSettingsDatabaseItem = async (item) => {
    if (!settingsPanel || !item?.id) return;

    if (!confirm("Désactiver cet élément ?")) return;

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: settingsPanel,
          action: "archive",
          id: item.id,
        }),
      });

      if (!response.ok) throw new Error(`Erreur archive ${response.status}`);

      const updated = settingsData.map((row) =>
        row.id === item.id ? { ...row, actif: false } : row
      );

      setSettingsData(updated);
      setSettingsCache((prev) => {
        const next = { ...prev, [settingsPanel]: updated };
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
        }
        return next;
      });
      alert("Élément désactivé ✅");
    } catch (error) {
      console.error(error);
      alert("Erreur désactivation ❌");
    }
  };

  const orderValue = (order, keys, fallback = "—") => {
    for (const key of keys) {
      const value = order?.[key];
      if (Array.isArray(value)) {
        if (value.length) return value.map((v) => v?.name || v?.title || v?.plain_text || v?.id || v).join(", ");
      } else if (value && typeof value === "object") {
        if (value.start) return value.start;
        if (value.name || value.title || value.id) return value.name || value.title || value.id;
      } else if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
    return fallback;
  };

  const normalizeSupplierOrder = (order) => {
    const UUID_RE = /^[0-9a-f-]{36}$/i;
    const resolveProduit = (val) => {
      if (!UUID_RE.test(String(val))) return val;
      const found = productsDb.find((p) => p.id === val);
      return found ? (found.ingredient || found.name || val) : val;
    };
    const resolveFournisseur = (val) => {
      if (!UUID_RE.test(String(val))) return val;
      const found = (settingsCache?.suppliers || []).find((s) => s.id === val);
      return found ? (found.nom || found.name || val) : val;
    };
    return {
      id: orderValue(order, ["id"], `order-${Math.random()}`),
      produit: resolveProduit(orderValue(order, ["produit", "Produit", "property_produit", "name", "ingredient"], "Produit")),
      fournisseur: resolveFournisseur(orderValue(order, ["fournisseur", "Fournisseur", "property_fournisseur", "supplier"], "Sans fournisseur")),
      quantite: orderValue(order, ["quantite", "quantité", "Quantité", "quantiteCommandee", "property_quantit_sugg_r_e", "property_quantite_suggeree"], 0),
      unite: orderValue(order, ["unite", "Unité", "unit", "property_unit"], ""),
      statut: orderValue(order, ["statut", "Statut", "property_statut"], "À commander"),
      source: orderValue(order, ["source", "Source", "property_source"], "OrderPad"),
      staff: orderValue(order, ["staff", "Staff", "property_staff"], "—"),
      dateCreation: orderValue(order, ["dateCreation", "Date création", "property_date_cr_ation", "property_date_creation"], ""),
      dateEnvoi: orderValue(order, ["dateEnvoi", "Envoyé le", "property_date_envoi", "property_envoy_le"], ""),
      message: orderValue(order, ["message", "Message envoyé", "property_message_envoy", "property_message_envoye", "commentaire"], ""),
    };
  };

  const loadSupplierOrders = async () => {
    setLoadingSupplierOrders(true);
    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "supplierOrders", action: "list" }),
      });

      if (!response.ok) throw new Error(`Erreur supplierOrders ${response.status}`);

      const data = await response.json();
      const raw = Array.isArray(data) ? data : normalizeArray(data, "orders");
      const list = raw.map(normalizeSupplierOrder);

      setSupplierOrders(list);

      const firstSupplier = list.find((o) => o.fournisseur)?.fournisseur || "";
      if (firstSupplier && !selectedSupplierOrder) setSelectedSupplierOrder(firstSupplier);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaSupplierOrdersCache", JSON.stringify(list));
      }
    } catch (error) {
      console.error("Erreur commandes fournisseurs:", error);
      if (typeof window !== "undefined") {
        try {
          const cached = JSON.parse(localStorage.getItem("mokaSupplierOrdersCache") || "[]");
          if (cached.length) setSupplierOrders(cached);
        } catch {}
      }
    } finally {
      setLoadingSupplierOrders(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || adminSection !== "orders") return;
    loadSupplierOrders();
  }, [isAdmin, adminSection]);

  useEffect(() => {
    if (!isAdmin || adminSection !== "orders") return;
    setComposeCart({});
  }, [isAdmin, adminSection]);

  useEffect(() => {
    if (!isAdmin || adminSection !== "orders" || ordSelectedSupplier) return;
    const suppliers = settingsCache.suppliers || [];
    if (suppliers.length) setOrdSelectedSupplier(ordGetSupplierName(suppliers[0]));
  }, [isAdmin, adminSection, settingsCache.suppliers]);

  const supplierOrdersVisible = supplierOrders.filter((order) => {
    if (supplierOrdersFilter === "Tous") return true;
    return String(order.statut || "À commander") === supplierOrdersFilter;
  });

  const supplierOrdersGrouped = supplierOrdersVisible.reduce((acc, order) => {
    const supplier = order.fournisseur || "Sans fournisseur";
    if (!acc[supplier]) acc[supplier] = [];
    acc[supplier].push(order);
    return acc;
  }, {});

  const selectedSupplierLines =
    supplierOrdersGrouped[selectedSupplierOrder] ||
    Object.values(supplierOrdersGrouped)[0] ||
    [];

  const selectedSupplierName =
    selectedSupplierOrder ||
    Object.keys(supplierOrdersGrouped)[0] ||
    "";

  const loadProductsDatabase = async (silent = true) => {
    const cached = typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("mokaProductsDbCache") || "[]")
      : [];

    if (cached.length && productsDb.length === 0) {
      setProductsDb(cached);
    }

    if (!silent && !cached.length) {
      setLoadingProductsDb(true);
    }

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "products", action: "list" }),
      });

      if (!response.ok) throw new Error(`Erreur products ${response.status}`);

      const data = await response.json();
      const list = Array.isArray(data) ? data : normalizeArray(data, "products");

      setProductsDb(list);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaProductsDbCache", JSON.stringify(list));
        localStorage.setItem("mokaProductsDbCacheUpdatedAt", String(Date.now()));
      }
    } catch (error) {
      console.error(error);
      if (!cached.length && !silent) alert("Erreur chargement base produits ❌");
    } finally {
      setLoadingProductsDb(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || adminSection !== "products") return;

    if (productsDb.length === 0 && typeof window !== "undefined") {
      try {
        const cached = JSON.parse(localStorage.getItem("mokaProductsDbCache") || "[]");
        if (cached.length) setProductsDb(cached);
      } catch {}
    }

    loadProductsDatabase(true);

    if (!settingsCache.suppliers?.length) {
      fetchSettingsResource("suppliers")
        .then((list) => {
          setSettingsCache((prev) => {
            const next = { ...prev, suppliers: list };
            if (typeof window !== "undefined") {
              localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
              localStorage.setItem("mokaSettingsCacheUpdatedAt", String(Date.now()));
            }
            return next;
          });
        })
        .catch((error) => console.error("Préchargement fournisseurs produits:", error));
    }
  }, [isAdmin, adminSection]);

  useEffect(() => {
    if (!showClockModal) return;
    const interval = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [showClockModal]);

  const refreshOrderPadProducts = async () => {
    console.log("[refreshOrderPadProducts] Début refresh…");
    try {
      const productsResponse = await fetch(PRODUCTS_URL);
      const productsData = await productsResponse.json();
      const freshProducts = normalizeArray(productsData, "products");

      console.log("[refreshOrderPadProducts] Produits chargés:", freshProducts.length, "produits");
      freshProducts.slice(0, 3).forEach((p) => {
        console.log("[refreshOrderPadProducts] Produit exemple:", {
          id: p.id,
          name: p.name || p.ingredient,
          portion: p.portion,
          portionGrammes: p.portionGrammes,
          seuilAlerte: p.seuilAlerte,
          seuilCritique: p.seuilCritique,
        });
      });

      setProducts(freshProducts);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaProductsCache", JSON.stringify(freshProducts));
      }

      const firstCategory = freshProducts.find((p) => p.category)?.category;
      if (firstCategory) {
        setActiveCategory(firstCategory);
        setActiveSubCategory("");
      }

      const stockResponse = await fetch(STOCK_URL);
      const stockData = await stockResponse.json();
      const freshStock = normalizeArray(stockData, "stock");

      console.log("[refreshOrderPadProducts] Stock live chargé:", freshStock.length, "éléments");

      setStockLive(freshStock);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaStockCache", JSON.stringify(freshStock));
      }

      console.log("[refreshOrderPadProducts] Terminé ✅");
    } catch (error) {
      console.error("[refreshOrderPadProducts] Erreur:", error);
    }
  };

  const openProductDbCreate = () => {
    ["suppliers", "categories", "subcategories", "units", "zones"].forEach((resource) => {
      if (settingsCache[resource]?.length) return;
      fetchSettingsResource(resource)
        .then((list) => {
          setSettingsCache((prev) => {
            const next = { ...prev, [resource]: list };
            if (typeof window !== "undefined") {
              localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
            }
            return next;
          });
        })
        .catch((error) => console.error("Préchargement option produit:", resource, error));
    });

    setCreatingProductDb(true);
    setCreatingProductDbForm({
      ingredient: "",
      visibleOrderPad: true,
      photo: "",
      categorie: "",
      sousCategorie: "",
      fournisseurDefaut: "",
      zoneStockage: "",
      methodeSuivi: "Manuel",
      quantiteCommandeSuggeree: "",
      uniteStock: "",
      uniteCommande: "",
      seuilAlerte: "",
      seuilCritique: "",
      utiliseDans: "",
      notes: "",
      portionGrammes: "",
    });
  };

  const saveProductDbCreate = async () => {
    if (!String(creatingProductDbForm.ingredient || "").trim()) {
      alert("Nom ingrédient obligatoire ❌");
      return;
    }

    setSavingProductDb(true);

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "products",
          action: "create",
          data: {
            ingredient: creatingProductDbForm.ingredient,
            visibleOrderPad: creatingProductDbForm.visibleOrderPad ?? true,
            categorie: creatingProductDbForm.categorie || "",
            sousCategorie: creatingProductDbForm.sousCategorie || "",
            zoneStockage: creatingProductDbForm.zoneStockage || "",
            methodeSuivi: creatingProductDbForm.methodeSuivi || "",
            quantiteCommandeSuggeree: Number(creatingProductDbForm.quantiteCommandeSuggeree) || null,
            uniteStock: creatingProductDbForm.uniteStock || "",
            uniteCommande: creatingProductDbForm.uniteCommande || "",
            seuilAlerte: Number(creatingProductDbForm.seuilAlerte) || null,
            seuilCritique: Number(creatingProductDbForm.seuilCritique) || null,
            portionGrammes: Number(creatingProductDbForm.portionGrammes) || null,
            notes: creatingProductDbForm.notes || "",
          },
        }),
      });

      if (!response.ok) throw new Error(`Erreur create ${response.status}`);

      const result = await response.json().catch(() => ({}));
      const created = result?.item || result?.product || result?.[0] || {
        ...creatingProductDbForm,
        id: `temp-${Date.now()}`,
      };

      const updated = [created, ...productsDb];
      setProductsDb(updated);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaProductsDbCache", JSON.stringify(updated));
        localStorage.setItem("mokaProductsDbCacheUpdatedAt", String(Date.now()));
      }

      setCreatingProductDb(false);
      await loadProductsDatabase(true);
      await refreshOrderPadProducts();
      setActiveTab("orderpad");
      alert("Produit ajouté ✅");
    } catch (error) {
      console.error(error);
      alert("Erreur création produit ❌");
    } finally {
      setSavingProductDb(false);
    }
  };

  const openProductDbEdit = (item) => {
    ["suppliers", "categories", "subcategories", "units", "zones"].forEach((resource) => {
      if (settingsCache[resource]?.length) return;

      fetchSettingsResource(resource)
        .then((list) => {
          setSettingsCache((prev) => {
            const next = { ...prev, [resource]: list };
            if (typeof window !== "undefined") {
              localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
            }
            return next;
          });
        })
        .catch((error) => console.error("Préchargement option produit edit:", resource, error));
    });

    setEditingProductDb(null);
    openSettings({
      ...item,
      name: item.ingredient || item.name || "",
      category: item.categorie || item.category || "",
      subcategory: item.sousCategorie || item.subcategory || "",
      supplier: item.fournisseurDefaut || item.supplier || "",
      zone: item.zoneStockage || item.zone || "",
      unit: item.uniteStock || item.unit || "",
      portion: item.portionGrammes ?? item.portion ?? "",
      suggested: item.quantiteCommandeSuggeree || item.suggested || "",
      photo: item.photo || "",
      utiliseDans: item.utiliseDans || "",
      notes: item.notes || "",
      sourceFromProductsDb: true,
    });
  };


  const saveProductDbEdit = async () => {
    if (!editingProductDbForm.id) return;

    setSavingProductDb(true);

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "products",
          action: "update",
          id: editingProductDbForm.id,
          data: {
            ingredient: editingProductDbForm.ingredient,
            visibleOrderPad: editingProductDbForm.visibleOrderPad ?? true,
            categorie: editingProductDbForm.categorie || "",
            sousCategorie: editingProductDbForm.sousCategorie || "",
            zoneStockage: editingProductDbForm.zoneStockage || "",
            methodeSuivi: editingProductDbForm.methodeSuivi || "",
            quantiteCommandeSuggeree: Number(editingProductDbForm.quantiteCommandeSuggeree) || null,
            uniteStock: editingProductDbForm.uniteStock || "",
            uniteCommande: editingProductDbForm.uniteCommande || "",
            seuilAlerte: Number(editingProductDbForm.seuilAlerte) || null,
            seuilCritique: Number(editingProductDbForm.seuilCritique) || null,
            portionGrammes: Number(editingProductDbForm.portionGrammes) || null,
            notes: editingProductDbForm.notes || "",
          },
        }),
      });

      if (!response.ok) throw new Error(`Erreur update ${response.status}`);

      const updated = productsDb.map((item) =>
        item.id === editingProductDbForm.id
          ? { ...item, ...editingProductDbForm }
          : item
      );

      setProductsDb(updated);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaProductsDbCache", JSON.stringify(updated));
      }

      setEditingProductDb(null);
      await loadProductsDatabase(true);
      await refreshOrderPadProducts();
      alert("Produit modifié ✅");
    } catch (error) {
      console.error(error);
      alert("Erreur modification produit ❌");
    } finally {
      setSavingProductDb(false);
    }
  };

  const deleteProductDb = async (item) => {
    if (!item?.id) return;
    if (!confirm("Supprimer ce produit de la base ?")) return;

    try {
      const response = await fetch(SETTINGS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resource: "products",
          action: "delete",
          id: item.id,
        }),
      });

      if (!response.ok) throw new Error(`Erreur delete ${response.status}`);

      const updated = productsDb.filter((row) => row.id !== item.id);
      setProductsDb(updated);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaProductsDbCache", JSON.stringify(updated));
      }

      alert("Produit supprimé ✅");
    } catch (error) {
      console.error(error);
      alert("Erreur suppression produit ❌");
    }
  };

  const unlockAdmin = () => {
    if (adminPin === "3578") {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPin("");
      alert("Mode admin activé ✅");
    } else {
      alert("Code admin incorrect ❌");
    }
  };

  const openSettings = (item) => {
    if (!isAdmin) {
      setShowAdminModal(true);
      return;
    }

    console.log("[openSettings] Item reçu:", {
      id: getEditableId(item),
      name: item?.name,
      portion: item?.portion,
      portionGrammes: item?.portionGrammes,
      seuilAlerte: item?.seuilAlerte,
      seuilCritique: item?.seuilCritique,
      quantiteCommandee: item?.quantiteCommandee,
    });

    setSettingsItem(item);
    setSettingsForm({
      id: getEditableId(item),
      name: item?.name || getPrepName(item),
      categorie: item?.category || item?.categorie || "Autres",
      sousCategorie: item?.subcategory || item?.sousCategorie || getSubCategory(item),
      visibleOrderPad: item?.visible ?? item?.visibleOrderPad ?? true,
      fournisseurDefaut: (() => {
        const raw = String(getSupplier(item) || "").trim();
        if (!raw || raw === "À définir" || raw === "—") return "";

        const compact = raw.replaceAll("-", "");
        const found = (settingsCache.suppliers || []).find((supplier) => {
          const name = String(supplier.nom || supplier.name || supplier.fournisseur || supplier.title || "").trim();
          const ids = [
            supplier.id,
            supplier.pageId,
            supplier.notionId,
            supplier.notionPageId,
          ].filter(Boolean).map((value) => String(value).trim());

          return (
            name === raw ||
            ids.includes(raw) ||
            ids.map((id) => id.replaceAll("-", "")).includes(compact)
          );
        });

        if (found) return found.nom || found.name || found.fournisseur || found.title || "";
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return "";
        return raw;
      })(),
      zoneStockage: item?.zone || item?.zoneStockage || item?.emplacement || "",
      quantiteCommandee: item?.quantiteCommandee ?? item?.suggested ?? item?.quantity ?? "",
      uniteStock: item?.unit || item?.uniteStock || "kg",
      uniteCommande: item?.uniteCommande || item?.unit || "kg",
      portion:
        item?.portion ??
        item?.portionGrammes ??
        item?.portionGramme ??
        item?.["Portion (g)"] ??
        item?.["Portion g"] ??
        item?.["portion g"] ??
        "",
      seuilAlerte:
        item?.seuilAlerte ??
        item?.seuilAlertePortion ??
        item?.alerte ??
        item?.alert ??
        item?.["Seuil alerte"] ??
        item?.["Seuil alerte (portion)"] ??
        item?.["seuil alerte"] ??
        "",
      seuilCritique:
        item?.seuilCritique ??
        item?.seuilCritiquePortion ??
        item?.critique ??
        item?.critical ??
        item?.["Seuil critique"] ??
        item?.["Seuil critique (portion)"] ??
        item?.["seuil critique"] ??
        "",
      photo: item?.photo || "",
      utiliseDans: item?.utiliseDans || "",
      notes: item?.notes || "",
    });

    console.log("[openSettings] Form initialisé:", {
      portion: item?.portion ?? item?.portionGrammes ?? item?.portionGramme ?? "",
      seuilAlerte: item?.seuilAlerte ?? item?.seuilAlertePortion ?? "",
      seuilCritique: item?.seuilCritique ?? item?.seuilCritiquePortion ?? "",
      quantiteCommandee: item?.quantiteCommandee ?? item?.suggested ?? "",
    });
  };

  const openNewProduct = () => {
    if (!isAdmin) {
      setShowAdminModal(true);
      return;
    }

    setSettingsItem({ isNew: true });
    setSettingsForm({
      id: "",
      name: "",
      categorie: "Autres",
      sousCategorie: "Autres",
      visibleOrderPad: true,
      fournisseurDefaut: "",
      zoneStockage: "",
      quantiteCommandee: "",
      uniteStock: "kg",
      uniteCommande: "kg",
      portion: "",
      seuilAlerte: "",
      seuilCritique: "",
    });
  };

  const saveSettings = async () => {
    const isNewProduct = !!settingsItem?.isNew;

    if (!isNewProduct && !settingsForm.id) {
      alert("ID produit introuvable ❌");
      return;
    }

    if (isNewProduct && !String(settingsForm.name || "").trim()) {
      alert("Nom produit obligatoire ❌");
      return;
    }

    const payload = {
      id: settingsForm.id || "",
      name: settingsForm.name,
      categorie: settingsForm.categorie || "Autres",
      sousCategorie: settingsForm.sousCategorie || "Autres",
      visibleOrderPad: settingsForm.visibleOrderPad ?? true,
      fournisseurDefaut: settingsForm.fournisseurDefaut,
      fournisseurDefautName: settingsForm.fournisseurDefaut,
      fournisseurDefautId: getSupplierIdFromName(settingsForm.fournisseurDefaut, settingsCache.suppliers || []),
      zoneStockage: settingsForm.zoneStockage,
      quantiteCommandee: Number(settingsForm.quantiteCommandee) || 0,
      uniteStock: settingsForm.uniteStock,
      uniteCommande: settingsForm.uniteCommande,
      portion: Number(settingsForm.portion) || 0,
      seuilAlerte: Number(settingsForm.seuilAlerte) || 0,
      seuilCritique: Number(settingsForm.seuilCritique) || 0,
      photo: settingsForm.photo || "",
      utiliseDans: settingsForm.utiliseDans || "",
      notes: settingsForm.notes || "",
      portionGrammes: Number(settingsForm.portion) || 0,
    };

    console.log("[saveSettings] Payload AVANT envoi:", {
      id: payload.id,
      name: payload.name,
      portion: payload.portion,
      portionGrammes: payload.portionGrammes,
      seuilAlerte: payload.seuilAlerte,
      seuilCritique: payload.seuilCritique,
      quantiteCommandee: payload.quantiteCommandee,
      isNewProduct,
    });

    const applyLocalUpdate = () => {
      const editedId = String(payload.id || getEditableId(settingsItem) || settingsItem?.id || "");

      const updatedProduct = {
        ...settingsItem,
        id: settingsItem?.id || editedId,
        ingredientId: settingsItem?.ingredientId || editedId,
        matierePremiereId: settingsItem?.matierePremiereId || editedId,
        productId: settingsItem?.productId || editedId,

        name: payload.name,

        category: payload.categorie,
        categorie: payload.categorie,

        subcategory: payload.sousCategorie,
        sousCategorie: payload.sousCategorie,

        visible: payload.visibleOrderPad,
        visibleOrderPad: payload.visibleOrderPad,

        supplier: payload.fournisseurDefaut,
        fournisseurDefaut: payload.fournisseurDefaut,

        zone: payload.zoneStockage,
        zoneStockage: payload.zoneStockage,

        suggested: payload.quantiteCommandee,
        quantiteCommandee: payload.quantiteCommandee,

        unit: payload.uniteStock,
        uniteStock: payload.uniteStock,
        uniteCommande: payload.uniteCommande,

        portion: payload.portion,
        seuilAlerte: payload.seuilAlerte,
        seuilCritique: payload.seuilCritique,
      };

      const sameProduct = (p) => {
        const ids = [
          p?.id,
          p?.ingredientId,
          p?.matierePremiereId,
          p?.productId,
          getEditableId(p),
        ].filter(Boolean).map(String);

        return ids.includes(editedId);
      };

      setProducts((prev) => {
        const next = prev.map((p) => sameProduct(p) ? { ...p, ...updatedProduct } : p);
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaProductsCache", JSON.stringify(next));
        }
        return next;
      });

      setStockLive((prev) => {
        const next = prev.map((p) => sameProduct(p) ? { ...p, ...updatedProduct } : p);
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaStockCache", JSON.stringify(next));
        }
        return next;
      });

      if (payload.categorie) {
        setActiveCategory(payload.categorie);
        setActiveSubCategory(payload.sousCategorie || "");
      }
    };

    setSavingSettings(true);

    try {
      if (!isNewProduct) {
        try {
          applyLocalUpdate();
        } catch (localErr) {
          console.error("[saveSettings] Erreur applyLocalUpdate:", localErr);
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      let response;
      try {
        response = await fetch(SETTINGS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: "products",
            action: isNewProduct ? "create" : "update",
            id: payload.id,
            data: {
              ingredient: payload.name,
              visibleOrderPad: payload.visibleOrderPad,
              categorie: payload.categorie,
              sousCategorie: payload.sousCategorie,
              zoneStockage: payload.zoneStockage,
              methodeSuivi: settingsForm.methodeSuivi || "",
              quantiteCommandeSuggeree: Number(payload.quantiteCommandee) || null,
              uniteStock: payload.uniteStock,
              uniteCommande: payload.uniteCommande,
              seuilAlerte: Number(payload.seuilAlerte) || null,
              seuilCritique: Number(payload.seuilCritique) || null,
              portionGrammes: Number(payload.portionGrammes) || null,
              notes: payload.notes,
            },
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);

      // Lire la réponse JSON de façon défensive (webhook peut renvoyer vide)
      const responseText = await response.text().catch(() => "");
      let responseData = {};
      if (responseText) {
        try { responseData = JSON.parse(responseText); } catch {}
      }
      console.log("[saveSettings] Webhook réponse:", responseData);

      alert(isNewProduct ? "Produit créé ✅" : "Réglages produit mis à jour ✅");
      setSettingsItem(null);

      console.log("[saveSettings] Sync post-sauvegarde: mise à jour productsDb + OrderPad + stockLive…");

      setProductsDb((prev) => {
        const updated = prev.map((item) => {
          const sameId = String(item.id || "") === String(payload.id || "");
          if (!sameId) return item;

          return {
            ...item,
            ingredient: payload.name,
            name: payload.name,
            categorie: payload.categorie,
            category: payload.categorie,
            sousCategorie: payload.sousCategorie,
            subcategory: payload.sousCategorie,
            visibleOrderPad: payload.visibleOrderPad,
            fournisseurDefaut: payload.fournisseurDefaut,
            supplier: payload.fournisseurDefaut,
            zoneStockage: payload.zoneStockage,
            zone: payload.zoneStockage,
            quantiteCommandeSuggeree: payload.quantiteCommandee,
            suggested: payload.quantiteCommandee,
            uniteStock: payload.uniteStock,
            unit: payload.uniteStock,
            uniteCommande: payload.uniteCommande,
            seuilAlerte: payload.seuilAlerte,
            seuilCritique: payload.seuilCritique,
            portionGrammes: payload.portionGrammes,
            portion: payload.portionGrammes,
            photo: payload.photo,
            utiliseDans: payload.utiliseDans,
            notes: payload.notes,
          };
        });

        if (typeof window !== "undefined") {
          localStorage.setItem("mokaProductsDbCache", JSON.stringify(updated));
        }

        return updated;
      });

      await loadProductsDatabase(true);
      await refreshOrderPadProducts();

      if (isNewProduct) {
        setActiveTab("orderpad");
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      alert(!isNewProduct ? "Affichage mis à jour, mais webhook lent/erreur ⚠️" : "Erreur : produit non créé ❌");
      if (!isNewProduct) setSettingsItem(null);
    } finally {
      setSavingSettings(false);
    }
  };

  const productsDbCategories = useMemo(() => {
    const found = [...new Set(productsDb.map((p) => p.categorie || p.category || "Autres"))]
      .filter(Boolean);

    return ["Tous", ...found.sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })];
  }, [productsDb]);

  const filteredProductsDb = useMemo(() => {
    const q = productsDbSearch.trim().toLowerCase();

    return productsDb
      .filter((p) => {
        const cat = p.categorie || p.category || "Autres";

        const matchesCategory =
          productsDbCategory === "Tous" || cat === productsDbCategory;

        const haystack = [
          p.ingredient,
          p.name,
          p.categorie,
          p.category,
          p.sousCategorie,
          p.subcategory,
          p.fournisseurDefaut,
          p.supplier,
          p.zoneStockage,
          p.zone,
          p.uniteStock,
          p.uniteCommande,
          p.notes,
        ].join(" ").toLowerCase();

        return q ? haystack.includes(q) : matchesCategory;
      })
      .sort((a, b) => {
        const ca = a.categorie || a.category || "Autres";
        const cb = b.categorie || b.category || "Autres";
        const na = a.ingredient || a.name || "";
        const nb = b.ingredient || b.name || "";

        if (ca !== cb) {
          const ia = categoryOrder.indexOf(ca);
          const ib = categoryOrder.indexOf(cb);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        }

        return na.localeCompare(nb);
      });
  }, [productsDb, productsDbSearch, productsDbCategory]);

  const groupedProductsDb = useMemo(() => {
    const groups = {};

    filteredProductsDb.forEach((item) => {
      const cat = item.categorie || item.category || "Autres";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    return Object.entries(groups).sort(([a], [b]) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [filteredProductsDb]);


  const isNotionId = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());

  const cleanSupplierOption = (value) => {
    const clean = String(value || "").trim();
    if (!clean || clean === "À définir" || clean === "—") return "";
    if (isNotionId(clean)) return "";
    return clean;
  };

  const productsDbSupplierChoices = useMemo(() => {
    const suppliers = settingsCache.suppliers || [];

    return uniqueValues(
      suppliers
        .map((s) => s.nom || s.name || s.fournisseur || s.title || "")
        .map(cleanSupplierOption)
        .filter(Boolean)
    );
  }, [settingsCache]);

  const productsDbZoneChoices = useMemo(() => {
    const zones = settingsCache.zones || [];
    const fromSettings = zones.map((z) => z.nom || z.name || z.zone || "").filter(Boolean);
    const fromProducts = productsDb.map((p) => p.zoneStockage || p.zone || "").filter(Boolean);
    return [...new Set([...fromSettings, ...fromProducts])].sort();
  }, [settingsCache, productsDb]);

  const productsDbUnitChoices = useMemo(() => {
    const units = settingsCache.units || [];
    const fromSettings = units.map((u) => u.nom || u.name || u.unite || "").filter(Boolean);
    const fromProducts = productsDb.flatMap((p) => [p.uniteStock, p.uniteCommande, p.unit]).filter(Boolean);
    return [...new Set([...fromSettings, ...fromProducts, "kg", "g", "L", "ml", "pièce", "carton", "sachet", "bouteille"])].sort();
  }, [settingsCache, productsDb]);

  const productsDbSubCategoryChoices = useMemo(() => {
    const fromSettings = (settingsCache.subcategories || []).map((s) => s.nom || s.name || "").filter(Boolean);
    const fromProducts = productsDb.map((p) => p.sousCategorie || p.subcategory || "").filter(Boolean);
    return [...new Set([...fromSettings, ...fromProducts])].sort();
  }, [settingsCache, productsDb]);

  const productsDbSupplierMap = useMemo(() => {
    const suppliers = settingsCache.suppliers || [];
    const map = {};

    suppliers.forEach((supplier) => {
      const name = supplier.nom || supplier.name || supplier.fournisseur || "";
      const ids = [
        supplier.id,
        supplier.pageId,
        supplier.notionId,
        name,
      ].filter(Boolean);

      ids.forEach((id) => {
        map[String(id).trim()] = name;
        map[String(id).replaceAll("-", "").trim()] = name;
      });
    });

    return map;
  }, [settingsCache]);

  const getProductsDbSupplierName = (item) => {
    const raw =
      item.fournisseurDefaut ||
      item.supplier ||
      item.fournisseur ||
      "";

    if (!raw) return "—";

    if (Array.isArray(raw)) {
      return raw
        .map((value) => {
          const clean = String(value).trim();
          return productsDbSupplierMap[clean] || productsDbSupplierMap[clean.replaceAll("-", "")] || clean;
        })
        .join(", ");
    }

    const clean = String(raw).trim();

    return (
      productsDbSupplierMap[clean] ||
      productsDbSupplierMap[clean.replaceAll("-", "")] ||
      clean
    );
  };

  const openInventoryAdjust = (item) => {
    setInventoryItem(item);
    setInventoryWeight("");
    setInventoryUnit(item?.uniteStock || item?.unit || item?.unite || "kg");
  };

  const openStockReceive = (item, mode = "add") => {
    setStockReceiveItem(item);
    setStockReceiveWeight("");
    setStockReceiveUnit(item?.uniteStock || item?.unit || item?.unite || "kg");
    setStockReceiveMode(mode);
  };

  const saveStockReceive = async () => {
    if (!stockReceiveItem) return;

    if (!stockReceiveWeight) {
      alert("Entre la quantité ❌");
      return;
    }

    setSavingStockReceive(true);

    try {
      const response = await fetch(STOCK_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: stockReceiveItem.id,
          ingredientId: stockReceiveItem.ingredientId || "",
          Produit: getStockName(stockReceiveItem),
          PoidsTotal: Number(stockReceiveWeight),
          mode: stockReceiveMode,
          Unite: stockReceiveUnit || stockReceiveItem.unit || "kg",
          Utilisateur: selectedStaffName || "MOKA OS",
          Source: stockReceiveMode === "replace" ? "Correction inventaire" : "Réception fournisseur",
        }),
      });

      if (!response.ok) throw new Error(`Erreur réception stock ${response.status}`);

      setStockReceiveItem(null);
      setStockReceiveWeight("");
      alert(stockReceiveMode === "replace" ? "Stock corrigé ✅" : "Stock reçu ajouté ✅");

      fetch(STOCK_URL)
        .then((res) => res.json())
        .then((data) => {
          const freshStock = normalizeArray(data, "stock");
          setStockLive(freshStock);
          if (typeof window !== "undefined") {
            localStorage.setItem("mokaStockCache", JSON.stringify(freshStock));
          }
        });
    } catch (error) {
      console.error(error);
      alert("Erreur ajout réception stock ❌");
    } finally {
      setSavingStockReceive(false);
    }
  };

  const saveInventoryAdjust = async () => {
    if (!inventoryItem) return;

    if (!inventoryWeight) {
      alert("Entre un poids total mesuré ❌");
      return;
    }

    setSavingInventory(true);

    try {
      const response = await fetch(STOCK_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inventoryItem.id,
          ingredientId: inventoryItem.ingredientId || "",
          Produit: getStockName(inventoryItem),
          PoidsTotal: Number(inventoryWeight),
          mode: "replace",
          Unite: inventoryUnit,
          Utilisateur: selectedStaffName || "MOKA OS",
          Source: "Inventaire admin",
        }),
      });

      if (!response.ok) throw new Error(`Erreur stock update ${response.status}`);

      setInventoryItem(null);
      setInventoryWeight("");
      alert("Stock mis à jour ✅");

      fetch(STOCK_URL)
        .then((res) => res.json())
        .then((data) => {
          const freshStock = normalizeArray(data, "stock");
          setStockLive(freshStock);
          if (typeof window !== "undefined") {
            localStorage.setItem("mokaStockCache", JSON.stringify(freshStock));
          }
        });
    } catch (error) {
      console.error(error);
      alert("Erreur mise à jour stock ❌");
    } finally {
      setSavingInventory(false);
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result.split(",")[1]);
          reader.readAsDataURL(blob);
        }, "image/jpeg", 0.85);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    });
  };

  const handleInvoicePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setInvoiceImageUrl(url);
    const base64 = await compressImage(file);
    setInvoiceImage(base64);
    analyzeInvoice(base64, "image/jpeg");
  };

  const analyzeInvoice = async (base64, mediaType) => {
    setInvoiceAnalyzing(true);
    setInvoiceResults([]);
    try {
      console.log("🔵 Envoi analyse, taille base64:", base64?.length);

      const response = await fetch("/api/analyze-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base64,
          mediaType,
          stockNames: [], // vide pour tester sans la liste
        }),
      });

      console.log("🟢 Status réponse:", response.status, response.statusText);

      const text = await response.text();
      console.log("🟢 Réponse brute:", text.slice(0, 200));

      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error);

      const parsed = data.results || [];
      const results = parsed.map((item) => {
        const nameLower = String(item.name_stock || item.name || "").toLowerCase();
        const matched = productsDb.find((p) => {
          const pName = String(p.ingredient || p.name || "").toLowerCase();
          return pName === nameLower || pName.includes(nameLower) || nameLower.includes(pName);
        }) || null;
        return { ...item, name: item.name_facture || item.name, matched, include: !!matched };
      });
      setInvoiceResults(results);
    } catch (err) {
      console.error("❌ Erreur analyse:", err);
      alert("Erreur : " + err.message);
    } finally {
      setInvoiceAnalyzing(false);
    }
  };

  const saveInvoiceToStock = async () => {
    const toSave = invoiceResults.filter((r) => r.include && r.matched);
    if (!toSave.length) return;
    setInvoiceSaving(true);
    try {
      await Promise.all(toSave.map((item) =>
        fetch(STOCK_UPDATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.matched.id, poidsTotal: item.quantite, Unite: item.unite, mode: "add" })
        })
      ));
      alert(`✅ ${toSave.length} produit(s) ajouté(s) au stock !`);
      setInvoiceModal(false);
      setInvoiceResults([]);
      setInvoiceImage(null);
      setInvoiceImageUrl("");
      fetch(STOCK_URL)
        .then((res) => res.json())
        .then((data) => {
          const freshStock = normalizeArray(data, "stock");
          setStockLive(freshStock);
          if (typeof window !== "undefined") localStorage.setItem("mokaStockCache", JSON.stringify(freshStock));
        });
    } catch (err) {
      alert("Erreur enregistrement stock ❌");
    } finally {
      setInvoiceSaving(false);
    }
  };

  const inventoryBaseItems = useMemo(() => {
    return stockLive.filter((item) =>
      inventoryView === "prepa" ? isPrepStock(item) : !isPrepStock(item)
    );
  }, [stockLive, inventoryView]);

  const inventoryCategories = useMemo(() => {
    const found = [...new Set(inventoryBaseItems.map((item) => getStockCategory(item) || "Autres"))]
      .filter(Boolean);

    return ["Tous", ...found.sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })];
  }, [inventoryBaseItems]);

  const inventoryFilteredStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();

    return inventoryBaseItems
      .filter((item) => {
        const status = String(getStockStatus(item)).toLowerCase();
        const category = getStockCategory(item);

        const matchesCategory =
          inventoryCategory === "Tous" || category === inventoryCategory;

        const matchesStatus =
          inventoryStatusFilter === "Tous" ||
          (
            inventoryStatusFilter === "OK" &&
            !status.includes("critique") &&
            !status.includes("stock bas") &&
            !status.includes("alerte") &&
            !status.includes("à commander")
          ) ||
          (
            inventoryStatusFilter === "Stock bas" &&
            (
              status.includes("stock bas") ||
              status.includes("alerte") ||
              status.includes("à commander")
            )
          ) ||
          (
            inventoryStatusFilter === "Critiques" &&
            status.includes("critique")
          );

        const haystack = [
          getStockName(item),
          category,
          getStockZone(item),
          getStockStatus(item),
        ].join(" ").toLowerCase();

        return (q ? haystack.includes(q) : matchesCategory) && matchesStatus;
      })
      .sort((a, b) => {
        const ca = getStockCategory(a);
        const cb = getStockCategory(b);
        const na = getStockName(a);
        const nb = getStockName(b);

        if (ca !== cb) {
          const ia = categoryOrder.indexOf(ca);
          const ib = categoryOrder.indexOf(cb);
          return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        }

        return na.localeCompare(nb);
      });
  }, [inventoryBaseItems, stockSearch, inventoryCategory, inventoryStatusFilter]);

  const sendToMokaOS = async () => {
    if (cartItems.length === 0) return;

    if (!selectedStaff) {
      alert("Sélectionne un membre du staff avant d’envoyer ❌");
      return;
    }

    setSending(true);

    try {
      if (activeTab === "stock") {
        const payload = cartItems
          .filter((item) => item.type === "stock-prep")
          .map((item) => ({
            id: item.id,
            produit: item.name,
            quantite: item.qty,
            unite: item.unit || "kg",
            priorite: "Haute",
            statut: "À faire",
            staffId: selectedStaff,
            staffName: selectedStaffName,
            source: "Stock Live",
            date: new Date().toISOString(),
            dueDate: selectedDueDate,
            datePrevue: selectedDueDate,
          }));

        const response = await fetch(CREATE_PREP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);

        setCart({});
        loadPreps();
        alert("Préparation ajoutée ✅");
        return;
      }

      if (activeTab === "preps") {
        const payload = cartItems
          .filter((item) => item.type === "prep")
          .map((item) => ({
            id: item.id,
            status: "Fait",
            Staff: selectedStaff,
            StaffName: selectedStaffName,
            Date: new Date().toISOString(),
          }));

        const response = await fetch(COMPLETE_PREP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);

        setCart({});
        loadPreps();
        alert("Préparation confirmée comme faite ✅");
        return;
      }

      const payload = cartItems.map((item) => ({
        id: item.id,
        Produit: item.name,
        Quantité: item.qty,
        Unite: item.unit || "unité",
        Categorie: item.category || "Autres",
        SousCategorie: getSubCategory(item),
        Fournisseur: getSupplier(item),
        Source: "OrderPad",
        Type: item.type || "order",
        Staff: selectedStaff,
        StaffName: selectedStaffName,
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
    <main className="min-h-screen bg-[#f5ede0] text-[#1a1008]" style={{fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"}}>

      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#f5ede0]/96 backdrop-blur-md border-b border-[#ddc9b5] px-4 py-2.5 shadow-sm">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3">

          {/* Brand gauche */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-[#2c1a10] flex items-center justify-center shadow-md">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#f5ede0]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                <line x1="6" x2="6" y1="2" y2="4"/>
                <line x1="10" x2="10" y1="2" y2="4"/>
                <line x1="14" x2="14" y1="2" y2="4"/>
              </svg>
            </div>
            <div>
              <div className="font-black text-[#2c1a10] text-base leading-none tracking-tight">MÖKA</div>
              <div className="text-[10px] text-[#9a7060] tracking-[0.25em] uppercase mt-0.5">Order Pad</div>
            </div>
          </div>

          {/* Centre : Pointage */}
          <button
            onClick={() => {
              setShowClockModal(true);
              if (!staff.length && settingsCache.staff?.length) {
                setStaff(settingsCache.staff);
                setLoadingClockStaff(false);
                return;
              }
              if (!staff.length) {
                setLoadingClockStaff(true);
                fetch(SETTINGS_URL, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ resource: "staff", action: "list" }),
                })
                  .then((r) => r.text())
                  .then((text) => {
                    try {
                      const data = JSON.parse(text);
                      const list = Array.isArray(data)
                        ? data
                        : normalizeArray(data, "staff");
                      if (list.length) setStaff(list);
                    } catch {}
                  })
                  .catch(() => {})
                  .finally(() => setLoadingClockStaff(false));
              }
            }}
            className="relative h-10 px-4 rounded-xl bg-white border-2 border-[#e85d8a] text-[#e85d8a] font-black text-sm shadow-sm ring-2 ring-[#e85d8a]/25 hover:bg-[#fff0f5] transition-all cursor-pointer flex items-center gap-2"
          >
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#e85d8a] animate-ping opacity-75" />
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M9.5 2.5h5"/><path d="M12 2v2.5"/>
            </svg>
            Pointage
          </button>

          {/* Admin droite */}
          <button
            onClick={() => {
              if (isAdmin) {
                setIsAdmin(false);
                setAdminSection("dashboard");
                alert("Mode admin désactivé");
              } else {
                setShowAdminModal(true);
              }
            }}
            className={`h-10 px-3.5 rounded-xl font-bold text-xs border shadow-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer ${
              isAdmin
                ? "bg-[#5a7828] text-white border-[#5a7828] hover:bg-[#4e6a22]"
                : "bg-white text-[#2c1a10] border-[#e5d5c5] hover:bg-[#f0e4d4]"
            }`}
          >
            {isAdmin ? (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            )}
            <span>{isAdmin ? "Admin ON" : "Admin"}</span>
          </button>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-3 py-3">

        {/* ── TABS ────────────────────────────────────── */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide bg-white/60 rounded-2xl p-1.5 border border-[#e5d5c5] shadow-sm w-fit">
          <button
            onClick={() => {
              setActiveTab("orderpad");
              if (!activeCategory && categories[0]) setActiveCategory(categories[0]);
            }}
            className={`h-10 px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "orderpad"
                ? "bg-[#2c1a10] text-white shadow-md"
                : "text-[#6b4a3d] hover:bg-[#f0e4d4]"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            OrderPad
          </button>

          <button
            onClick={() => setActiveTab("stock")}
            className={`h-10 px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "stock"
                ? "bg-[#2c1a10] text-white shadow-md"
                : "text-[#6b4a3d] hover:bg-[#f0e4d4]"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            Stock Live
            {(() => { const critCount = stockLive.filter(i => String(getStockStatus(i)).toLowerCase().includes("critique")).length; return critCount > 0 ? <span className="bg-red-500 text-white text-[10px] font-black rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{critCount}</span> : null; })()}
          </button>

          <button
            onClick={() => setActiveTab("preps")}
            className={`h-10 px-4 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "preps"
                ? "bg-[#2c1a10] text-white shadow-md"
                : "text-[#6b4a3d] hover:bg-[#f0e4d4]"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/></svg>
            Prépas
            {prepCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-black rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                {prepCount}
              </span>
            )}
          </button>
        </div>

        {/* ── ADMIN KPI CARDS ──────────────────────────── */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              {
                label: "Critiques", value: stockKpis.critical, color: "text-red-600", bg: "bg-red-50 border-red-200", onClick: () => setActiveTab("stock"),
                icon: <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
              },
              {
                label: "Alertes stock", value: stockKpis.alert, color: "text-orange-600", bg: "bg-orange-50 border-orange-200", onClick: () => setActiveTab("stock"),
                icon: <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              },
              {
                label: "Prépas à faire", value: prepCount, color: "text-[#4a6620]", bg: "bg-[#f0f7e5] border-[#c8dfa0]", onClick: () => setActiveTab("preps"),
                icon: <svg className="w-4 h-4 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/></svg>
              },
              {
                label: "Produits suivis", value: stockKpis.total, color: "text-[#2c1a10]", bg: "bg-white border-[#e5d5c5]", onClick: null,
                icon: <svg className="w-4 h-4 text-[#9a7060]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
              },
            ].map(({ label, value, color, bg, onClick, icon }) => (
              <button
                key={label}
                onClick={onClick || undefined}
                className={`rounded-2xl p-4 border text-left shadow-sm transition-all ${bg} ${onClick ? "cursor-pointer hover:shadow-md active:scale-[0.98]" : "cursor-default"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">{label}</span>
                  {icon}
                </div>
                <div className={`text-3xl font-black ${color}`}>{value}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── MAIN GRID ────────────────────────────────── */}
        <div className="grid grid-cols-12 gap-3 items-start">

          {/* ── MAIN SECTION ─────────────────────────── */}
          <section className={
            isAdmin && adminSection !== "dashboard" && ["products", "inventory", "settings", "orders", "reports"].includes(adminSection)
              ? "col-span-12"
              : "col-span-12 sm:col-span-8 xl:col-span-9"
          }>

            {/* ── STOCK TAB ──── */}
            {activeTab === "stock" && (
              <>
                {loadingStock ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-[#9a7060] border border-[#e5d5c5] shadow-sm">
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-[#c8a882] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    </div>
                    <div className="font-semibold text-sm">Chargement du stock live…</div>
                  </div>
                ) : stockLive.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-[#9a7060] border border-[#e5d5c5] shadow-sm">
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-[#c8a882]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
                    </div>
                    <div className="font-semibold text-sm">Aucun stock trouvé.</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Search + filters bar */}
                    <div className="bg-white rounded-2xl p-3 border border-[#e5d5c5] shadow-sm space-y-3">
                      {/* Search input */}
                      <div className="flex items-center gap-2 bg-[#faf5ef] border border-[#d8c8b8] rounded-xl px-3 py-2">
                        <svg className="w-4 h-4 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                        <input
                          value={stockSearch}
                          onChange={(e) => setStockSearch(e.target.value)}
                          placeholder={stockView === "prepa" ? "Rechercher une prépa..." : "Rechercher un produit stock..."}
                          className="w-full bg-transparent outline-none text-[#2c1a10] placeholder:text-[#b09080] text-sm font-medium"
                        />
                        {stockSearch && (
                          <button onClick={() => setStockSearch("")} className="text-[#9a7060] hover:text-[#2c1a10] transition-colors cursor-pointer">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>

                      {/* View toggle */}
                      <div className="flex gap-2">
                        {[
                          { key: "prepa", label: "Prépas", onSelect: () => setStockView("prepa") },
                          { key: "stock", label: "Stock", onSelect: () => { setStockView("stock"); if (stockCategories[0]) setActiveStockCategory(stockCategories[0]); } },
                        ].map(({ key, label, onSelect }) => (
                          <button
                            key={key}
                            onClick={onSelect}
                            className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              stockView === key
                                ? "bg-[#2c1a10] text-white"
                                : "bg-[#faf5ef] text-[#6b4a3d] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Category pills for stock view */}
                      {stockView === "stock" && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {stockCategories.filter((cat) => String(cat).trim().toLowerCase() !== "tous").map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setActiveStockCategory(cat)}
                              className={`h-7 px-3 rounded-lg whitespace-nowrap text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                activeStockCategory === cat
                                  ? "bg-[#5a7828] text-white"
                                  : "bg-[#faf5ef] text-[#6b4a3d] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                              }`}
                            >
                              {categoryEmojis[cat] || "📌"} {cat}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Stock cards */}
                    <div className="space-y-6">
                      {groupedStockItems.map(([category, items]) => (
                        <div key={category}>
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-sm font-black text-[#2c1a10]">
                              {stockView === "prepa" ? "👨‍🍳 Prépas" : `${categoryEmojis[category] || "📌"} ${category}`}
                            </span>
                            <div className="flex-1 h-px bg-[#e0d0c0]" />
                            <span className="text-[11px] font-semibold text-[#9a7060]">{items.length}</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                            {items.map((item) => {
                              const stockId = item.id || getStockName(item);
                              const selected = stockView === "prepa" && !!cart[stockId];
                              const status = getStockStatus(item);
                              const isCritical = String(status).toLowerCase().includes("critique");
                              const isLow = String(status).toLowerCase().includes("stock bas");

                              return (
                                <div
                                  key={stockId}
                                  onClick={() => {
                                    if (stockView === "stock") { openStockReceive(item, "add"); return; }
                                    selected ? removeItem(stockId) : addStockPrep(item);
                                  }}
                                  className={`rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.98] ${
                                    selected
                                      ? "bg-[#4a6620] text-white border-[#4a6620] shadow-xl ring-2 ring-[#5a7828]/40"
                                      : "bg-white text-[#2c1a10] border-[#e5d5c5] hover:shadow-lg hover:border-[#c8b8a8]"
                                  }`}
                                >
                                  {/* Status bar */}
                                  <div className={`h-1.5 ${isCritical ? "bg-gradient-to-r from-red-600 to-red-400" : isLow ? "bg-gradient-to-r from-orange-500 to-amber-400" : selected ? "bg-white/30" : "bg-gradient-to-r from-[#5a7828] to-[#7aa830]"}`} />

                                  <div className="p-4">
                                    {/* Status badge */}
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold mb-2.5 ${
                                      isCritical
                                        ? selected ? "bg-white/20 text-white" : "bg-red-50 text-red-700 border border-red-200"
                                        : isLow
                                        ? selected ? "bg-white/20 text-white" : "bg-orange-50 text-orange-700 border border-orange-200"
                                        : selected ? "bg-white/20 text-white" : "bg-[#f0f7e5] text-[#4a6620] border border-[#c8dfa0]"
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCritical ? "bg-red-500" : isLow ? "bg-orange-500" : selected ? "bg-white" : "bg-[#5a7828]"}`}></span>
                                      {status}
                                    </div>

                                    <h3 className="text-sm font-black leading-tight mb-3">{getStockName(item)}</h3>

                                    {/* Stock info */}
                                    <div className={`rounded-xl p-3 mb-3 ${selected ? "bg-white/10 border border-white/20" : "bg-[#faf5ef] border border-[#ede0d0]"}`}>
                                      <div className={`text-[10px] font-semibold mb-1 uppercase tracking-wide ${selected ? "text-white/60" : "text-[#9a7060]"}`}>{isPrepStock(item) ? "Portions restantes" : "En stock"}</div>
                                      <div className="text-xl font-black">{isPrepStock(item) ? getStockPortions(item) : `${getStockQty(item)}${getStockDisplayUnit(item) ? " " + getStockDisplayUnit(item) : ""}`}</div>
                                      {getStockZone(item) && (
                                        <div className={`text-[10px] mt-1 flex items-center gap-1 ${selected ? "text-white/50" : "text-[#9a7060]"}`}>
                                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                          {getStockZone(item)}
                                        </div>
                                      )}
                                    </div>

                                    {stockView === "stock" ? (
                                      <div className="flex items-center justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openStockReceive(item, "add"); }}
                                          className="flex-1 rounded-xl bg-[#f0f7e5] border border-[#c8dfa0] px-3 py-2.5 text-left hover:bg-[#e5f0d5] transition-colors cursor-pointer flex items-center gap-2"
                                        >
                                          <svg className="w-3.5 h-3.5 text-[#5a7828] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
                                          <div>
                                            <div className="text-[10px] font-bold text-[#5a7828] uppercase tracking-wide">Réception</div>
                                            <div className="text-xs font-black text-[#2c1a10]">Ajouter du stock</div>
                                          </div>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); openStockReceive(item, "replace"); }}
                                          className="rounded-xl bg-[#faf5ef] border border-[#e5d5c5] px-3 py-2.5 hover:bg-[#f0e8dc] transition-colors cursor-pointer flex items-center gap-1.5"
                                        >
                                          <svg className="w-3.5 h-3.5 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                          <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide whitespace-nowrap">Corriger</div>
                                        </button>
                                      </div>
                                    ) : (
                                      <div className={`flex items-center justify-between text-xs font-semibold ${selected ? "text-white/70" : "text-[#9a7060]"}`}>
                                        <span className="flex items-center gap-1">
                                          {selected ? (
                                            <><svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Sélectionné</>
                                          ) : "Toucher pour préparer"}
                                        </span>
                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${selected ? "bg-white/20" : "bg-[#f0f7e5] border border-[#c8dfa0]"}`}>
                                          {selected ? (
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                          ) : (
                                            <svg className="w-4 h-4 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                                          )}
                                        </span>
                                      </div>
                                    )}

                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── ORDERPAD TAB ──── */}
            {activeTab === "orderpad" && (
              <>
                {/* Search + category filters */}
                <div className="bg-white rounded-2xl p-3 mb-4 border border-[#e5d5c5] shadow-sm space-y-3">
                  <div className="flex items-center gap-2 bg-[#faf5ef] border border-[#d8c8b8] rounded-xl px-3 py-2">
                    <svg className="w-4 h-4 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un produit, zone, sous-catégorie..."
                      className="w-full bg-transparent outline-none text-[#2c1a10] placeholder:text-[#b09080] text-sm font-medium"
                    />
                    {search && (
                      <button onClick={() => setSearch("")} className="text-[#9a7060] hover:text-[#2c1a10] transition-colors cursor-pointer">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Category pills */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {categories.filter((cat) => String(cat).trim().toLowerCase() !== "tous").map((cat) => (
                      <button
                        key={cat}
                        onClick={() => { setActiveCategory(cat); setActiveSubCategory(""); }}
                        className={`h-8 px-3 rounded-lg whitespace-nowrap text-xs font-bold shrink-0 transition-all cursor-pointer ${
                          activeCategory === cat
                            ? "bg-[#5a7828] text-white shadow-sm"
                            : "bg-[#faf5ef] text-[#6b4a3d] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                        }`}
                      >
                        {categoryEmojis[cat] || "📌"} {cat}
                      </button>
                    ))}
                  </div>

                  {/* Sub-category pills */}
                  {subCategories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        onClick={() => setActiveSubCategory("")}
                        className={`h-7 px-3 rounded-md text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                          !activeSubCategory
                            ? "bg-[#2c1a10] text-white"
                            : "bg-[#faf5ef] text-[#8b6f61] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                        }`}
                      >
                        Tous
                      </button>
                      {subCategories.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setActiveSubCategory(sub)}
                          className={`h-7 px-3 rounded-md whitespace-nowrap text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                            activeSubCategory === sub
                              ? "bg-[#2c1a10] text-white"
                              : "bg-[#faf5ef] text-[#8b6f61] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-[#9a7060] border border-[#e5d5c5] shadow-sm">
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-[#c8a882] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    </div>
                    <div className="font-semibold text-sm">Chargement des produits…</div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-[#9a7060] border border-[#e5d5c5] shadow-sm">
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-[#c8a882]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    </div>
                    <div className="font-semibold text-sm">Aucun produit trouvé.</div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedProducts.map(([subCategory, productsInGroup]) => (
                      <div key={subCategory}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-sm font-black text-[#2c1a10]">{subCategory}</span>
                          <div className="flex-1 h-px bg-[#e0d0c0]" />
                          <span className="text-[11px] font-semibold text-[#9a7060]">{productsInGroup.length}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                          {productsInGroup.map((product) => {
                            const selected = !!cart[product.id];
                            const cat = product.category || "Autres";
                            const sub = getSubCategory(product);
                            const supplier = getSupplier(product);

                            return (
                              <div
                                key={product.id}
                                className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                                  selected
                                    ? "bg-[#4a6620] text-white border-[#4a6620] shadow-xl ring-2 ring-[#5a7828]/40"
                                    : "bg-white text-[#2c1a10] border-[#e5d5c5] hover:shadow-lg hover:border-[#c8b8a8] active:scale-[0.98]"
                                }`}
                              >
                                {/* Photo / icon zone */}
                                <button
                                  onClick={() => selected ? removeItem(product.id) : addProduct(product)}
                                  className={`w-full h-20 flex items-center justify-center overflow-hidden cursor-pointer relative ${
                                    selected ? "bg-[#3d5518]" : "bg-[#f0e8dc]"
                                  }`}
                                >
                                  {product.photo ? (
                                    <img src={product.photo} alt={product.name || "Produit"} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-4xl">{categoryEmojis[cat] || "📌"}</span>
                                  )}
                                  {selected && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-[#3d5518]/60">
                                      <svg className="w-8 h-8 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                  )}
                                </button>

                                {/* Card body */}
                                <button
                                  onClick={() => selected ? removeItem(product.id) : addProduct(product)}
                                  className="w-full text-left p-4 cursor-pointer"
                                >
                                  <div className="flex justify-between gap-2 mb-2.5">
                                    <div className="flex-1 min-w-0">
                                      <div className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold mb-1.5 tracking-wide ${
                                        selected ? "bg-white/20 text-white/90" : "bg-[#f0e8dc] text-[#7a5a4a]"
                                      }`}>
                                        {sub}
                                      </div>
                                      <h3 className="text-sm font-black leading-tight truncate">{product.name}</h3>
                                    </div>
                                    <div className={`text-[10px] text-right shrink-0 max-w-[80px] leading-tight font-medium ${
                                      selected ? "text-white/60" : "text-[#9a7060]"
                                    }`}>
                                      {supplier}
                                    </div>
                                  </div>

                                  {/* Quantity box */}
                                  <div className={`rounded-xl p-3 mb-3 ${selected ? "bg-white/10 border border-white/20" : "bg-[#faf5ef] border border-[#ede0d0]"}`}>
                                    <div className={`text-[10px] font-semibold mb-0.5 uppercase tracking-wide ${selected ? "text-white/60" : "text-[#9a7060]"}`}>À commander</div>
                                    <div className="text-xl font-black">{product.suggested || 1} <span className={`text-sm font-semibold ${selected ? "text-white/70" : "text-[#6b4a3d]"}`}>{product.unit || "unité"}</span></div>
                                    {product.zone && (
                                      <div className={`text-[10px] mt-1 flex items-center gap-1 ${selected ? "text-white/50" : "text-[#9a7060]"}`}>
                                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                                        {product.zone}
                                      </div>
                                    )}
                                  </div>

                                  <div className={`flex items-center justify-between text-xs font-semibold ${selected ? "text-white/70" : "text-[#9a7060]"}`}>
                                    <span className="flex items-center gap-1">
                                      {selected ? (
                                        <>
                                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                          Ajouté
                                        </>
                                      ) : "Toucher pour ajouter"}
                                    </span>
                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-lg shadow-sm ${
                                      selected ? "bg-white/20" : "bg-[#f0f7e5] text-[#5a7828] border border-[#c8dfa0]"
                                    }`}>
                                      {selected ? (
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                                      )}
                                    </span>
                                  </div>
                                </button>

                                {isAdmin && (
                                  <button
                                    onClick={() => openSettings(product)}
                                    className={`flex w-full items-center gap-1.5 px-4 pb-3 text-[10px] font-bold text-left cursor-pointer transition-colors ${
                                      selected ? "text-white/60 hover:text-white" : "text-[#9a7060] hover:text-[#2c1a10]"
                                    }`}
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                                    Réglages
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── PREPS TAB ──── */}
            {activeTab === "preps" && (
              <>
                {loadingPreps ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-[#9a7060] border border-[#e5d5c5] shadow-sm">
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-[#c8a882] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    </div>
                    <div className="font-semibold text-sm">Chargement des préparations…</div>
                  </div>
                ) : preps.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-[#9a7060] border border-[#e5d5c5] shadow-sm">
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    </div>
                    <div className="font-semibold text-sm">Aucune préparation à faire.</div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedPreps.map(([category, prepsInGroup]) => (
                      <div key={category}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-sm font-black ${
                            category.includes("aujourd'hui") ? "text-red-600" :
                            category.includes("demain") ? "text-orange-500" : "text-[#2c1a10]"
                          }`}>{category}</span>
                          <div className="flex-1 h-px bg-[#e0d0c0]" />
                          <span className="text-[11px] font-semibold text-[#9a7060]">{prepsInGroup.length}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                          {prepsInGroup.map((prep) => {
                            const id = prep.id || getPrepName(prep);
                            const selected = !!cart[id];
                            const qty = getPrepQuantity(prep);
                            const unit = getPrepUnit(prep);
                            const status = getPrepStatus(prep);
                            const priority = getPrepPriority(prep);
                            const isUrgent = String(priority).toLowerCase().includes("urgent") || String(priority).toLowerCase().includes("haute");

                            return (
                              <div
                                key={id}
                                className={`rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                                  selected
                                    ? "bg-[#4a6620] text-white border-[#4a6620] shadow-xl ring-2 ring-[#5a7828]/40"
                                    : "bg-white text-[#2c1a10] border-[#e5d5c5] hover:shadow-lg hover:border-[#c8b8a8]"
                                }`}
                              >
                                {isUrgent && <div className="h-1.5 bg-gradient-to-r from-orange-500 to-amber-400" />}

                                <button
                                  onClick={() => selected ? removeItem(id) : addPrep(prep)}
                                  className="w-full text-left p-4 cursor-pointer"
                                >
                                  <div className="flex items-start justify-between gap-2 mb-2.5">
                                    <div className="flex-1 min-w-0">
                                      {isUrgent && (
                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold mb-1.5 ${
                                          selected ? "bg-white/20 text-white" : "bg-orange-50 text-orange-700 border border-orange-200"
                                        }`}>
                                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                          {priority}
                                        </div>
                                      )}
                                      <h3 className="text-sm font-black leading-tight">{getPrepName(prep)}</h3>
                                    </div>
                                    {!isUrgent && <div className={`text-[10px] text-right shrink-0 ${selected ? "text-white/60" : "text-[#9a7060]"}`}>{priority}</div>}
                                  </div>

                                  <div className={`rounded-xl p-3 mb-3 ${selected ? "bg-white/10 border border-white/20" : "bg-[#faf5ef] border border-[#ede0d0]"}`}>
                                    <div className={`text-[10px] font-semibold mb-0.5 uppercase tracking-wide ${selected ? "text-white/60" : "text-[#9a7060]"}`}>Quantité</div>
                                    <div className="text-xl font-black">{qty} <span className={`text-sm font-semibold ${selected ? "text-white/70" : "text-[#6b4a3d]"}`}>{unit}</span></div>
                                    <div className={`text-[10px] mt-1 font-medium ${selected ? "text-white/50" : "text-[#9a7060]"}`}>{status}</div>
                                    {getPrepDueDate(prep) && (
                                      <div className={`text-[10px] mt-0.5 flex items-center gap-1 ${selected ? "text-white/50" : "text-[#9a7060]"}`}>
                                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                                        {getPrepDueDate(prep).split("-").reverse().join("/")}
                                      </div>
                                    )}
                                  </div>

                                  <div className={`flex items-center justify-between text-xs font-semibold ${selected ? "text-white/70" : "text-[#9a7060]"}`}>
                                    <span className="flex items-center gap-1">
                                      {selected ? (
                                        <><svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Ajouté</>
                                      ) : "Toucher pour ajouter"}
                                    </span>
                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
                                      selected ? "bg-white/20" : "bg-[#f0f7e5] text-[#5a7828] border border-[#c8dfa0]"
                                    }`}>
                                      {selected ? (
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                      ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                                      )}
                                    </span>
                                  </div>
                                </button>

                                {isAdmin && (
                                  <button
                                    onClick={() => openSettings(prep)}
                                    className={`flex w-full items-center gap-1.5 px-4 pb-3 text-[10px] font-bold text-left cursor-pointer transition-colors ${
                                      selected ? "text-white/60 hover:text-white" : "text-[#9a7060] hover:text-[#2c1a10]"
                                    }`}
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                                    Réglages
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          {/* ── CART / ASIDE ─────────────────────────── */}
          <aside className={`col-span-12 sm:col-span-4 xl:col-span-3 ${(activeTab === "stock" && stockView === "stock") || (isAdmin && adminSection !== "dashboard" && ["products", "inventory", "settings", "orders", "reports"].includes(adminSection)) ? "hidden" : ""}`}>
            <div className="bg-white rounded-2xl border border-[#ddc9b5] shadow-md sm:sticky sm:top-[72px] overflow-hidden">
              {/* Cart header */}
              <div className="px-4 py-3.5 border-b border-[#f0e8dc] bg-[#faf5ef]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#2c1a10] flex items-center justify-center shrink-0">
                    {activeTab === "stock" ? (
                      <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/></svg>
                    ) : activeTab === "preps" ? (
                      <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-[#2c1a10] leading-tight">
                      {activeTab === "stock" ? "Envoyer en prépa" : activeTab === "preps" ? "Confirmer la prépa" : "Action du jour"}
                    </h2>
                    <p className="text-[10px] text-[#9a7060] mt-0.5">
                      {activeTab === "stock" ? "Sélectionne un produit puis un staff" : activeTab === "preps" ? "Valider une préparation terminée" : "Sélection staff depuis le pad"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Staff selector */}
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    Membre du staff
                  </label>
                  <select
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-3 py-2.5 text-sm font-semibold text-[#2c1a10] outline-none cursor-pointer focus:border-[#5a7828] transition-colors"
                  >
                    <option value="">Sélectionner…</option>
                    {staff.map((member) => (
                      <option key={member.id || getStaffName(member)} value={member.id || getStaffName(member)}>
                        {getStaffName(member)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due date (stock mode) */}
                {activeTab === "stock" && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                      Date prévue
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[["1", "+1 jour"], ["3", "+3 jours"], ["5", "+5 jours"], ["custom", "Perso"]].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDueDateMode(value)}
                          className={`rounded-lg px-2 py-2 text-xs font-bold border transition-all cursor-pointer ${
                            dueDateMode === value
                              ? "bg-[#5a7828] text-white border-[#5a7828] shadow-sm"
                              : "bg-[#faf5ef] text-[#6b4a3d] border-[#e5d5c5] hover:bg-[#f0e4d4]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {dueDateMode === "custom" && (
                      <input
                        type="date"
                        value={customDueDate}
                        onChange={(e) => setCustomDueDate(e.target.value)}
                        className="w-full mt-2 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-3 py-2 text-sm font-semibold text-[#2c1a10] outline-none"
                      />
                    )}
                    <div className="text-[11px] text-[#9a7060] font-semibold mt-1.5 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Prévu le : {selectedDueDate.split("-").reverse().join("/")}
                    </div>
                  </div>
                )}

                {/* Cart items */}
                <div>
                  {cartItems.length > 0 && (
                    <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-2 flex items-center justify-between">
                      <span>Sélection</span>
                      <span className="bg-[#2c1a10] text-[#f5ede0] rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black">{cartItems.length}</span>
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-[28vh] overflow-y-auto">
                    {cartItems.length === 0 ? (
                      <div className="text-[#b09080] bg-[#faf5ef] rounded-xl p-4 text-center text-xs font-medium border border-dashed border-[#e5d5c5]">
                        Toucher un produit pour l'ajouter
                      </div>
                    ) : (
                      cartItems.map((item) => (
                        <div key={item.id} className="flex justify-between gap-2 items-center px-3 py-2.5 rounded-xl bg-[#faf5ef] border border-[#ede0d0]">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-black text-[#2c1a10] truncate">{item.name}</div>
                            <div className="text-[10px] text-[#9a7060]">{item.type === "prep" ? "Préparation interne" : getSupplier(item)}</div>
                          </div>
                          <div className="text-xs font-black text-[#4a6620] whitespace-nowrap shrink-0 bg-[#f0f7e5] px-2 py-0.5 rounded-md border border-[#c8dfa0]">{item.qty} {item.unit}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Send button */}
                <button
                  onClick={sendToMokaOS}
                  disabled={cartItems.length === 0 || sending}
                  className={`w-full py-3.5 rounded-xl text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    cartItems.length === 0
                      ? "bg-[#ede0d4] text-[#b09080] cursor-not-allowed"
                      : "bg-[#2c1a10] text-[#f5ede0] shadow-lg hover:bg-[#1e100a] active:scale-[0.98]"
                  }`}
                >
                  {sending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      Envoi en cours…
                    </>
                  ) : activeTab === "stock" ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/><line x1="6" x2="18" y1="17" y2="17"/></svg>
                      Envoyer en préparation
                    </>
                  ) : activeTab === "preps" ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Confirmer comme fait
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      Envoyer vers MOKA-OS
                    </>
                  )}
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ── ADMIN PANEL (fullscreen overlay) ────────── */}
      {isAdmin && adminSection !== "dashboard" && (
        <div className="fixed inset-0 z-40 bg-[#f5ede0] overflow-y-auto">
          {/* Admin panel header */}
          <div className={`sticky top-0 z-10 bg-[#f5ede0]/95 backdrop-blur border-b border-[#e5d5c5] px-4 py-3 ${["products", "inventory"].includes(adminSection) ? "" : ""}`}>
            <div className="max-w-screen-2xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#2c1a10] flex items-center justify-center shrink-0">
                  {adminSection === "orders" && <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>}
                  {adminSection === "reports" && <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>}
                  {adminSection === "settings" && <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>}
                  {adminSection === "products" && <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>}
                  {adminSection === "inventory" && <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect width="6" height="4" x="9" y="3" rx="1"/><path d="m9 14 2 2 4-4"/></svg>}
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-[0.25em]">MÖKA OS · Admin</div>
                  <h1 className="text-xl font-black text-[#2c1a10] leading-tight">
                    {adminSection === "orders" && "Commandes fournisseurs"}
                    {adminSection === "reports" && "Rapports"}
                    {adminSection === "settings" && "Paramètres"}
                    {adminSection === "products" && "Catalogue produits"}
                    {adminSection === "inventory" && "Inventaire"}
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-screen-2xl mx-auto px-4 py-4">

            {/* PRODUCTS PANEL */}
            {adminSection === "products" && (
              <div className="bg-white rounded-2xl border border-[#e5d5c5] shadow-sm overflow-hidden" style={{height: "calc(100vh - 100px)"}}>
                <div className="p-3 border-b border-[#e5d5c5] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Base de données</div>
                    <h2 className="text-base font-black text-[#2c1a10]">Catalogue matières premières</h2>
                    <p className="text-[11px] text-[#9a7060]">Affichage complet de la database produits Notion.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => loadProductsDatabase(false)}
                      className="h-9 px-3 rounded-xl bg-[#faf5ef] border border-[#e5d5c5] text-xs font-bold text-[#6b4a3d] hover:bg-[#f0e4d4] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                      Actualiser
                    </button>
                    <button
                      onClick={openProductDbCreate}
                      className="h-9 px-3 rounded-xl bg-[#2c1a10] text-[#f5ede0] text-xs font-bold hover:bg-[#1e100a] transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                      Nouveau produit
                    </button>
                  </div>
                </div>

                {/* Search + category filters */}
                <div className="p-3 border-b border-[#e5d5c5] flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2 bg-[#faf5ef] border border-[#d8c8b8] rounded-xl px-3 py-2 flex-1">
                    <svg className="w-4 h-4 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input
                      value={productsDbSearch}
                      onChange={(e) => setProductsDbSearch(e.target.value)}
                      placeholder="Rechercher un produit..."
                      className="w-full bg-transparent outline-none text-[#2c1a10] placeholder:text-[#b09080] text-sm"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {productsDbCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setProductsDbCategory(cat)}
                        className={`h-9 px-3 rounded-xl whitespace-nowrap text-xs font-bold shrink-0 transition-all cursor-pointer ${
                          productsDbCategory === cat
                            ? "bg-[#2c1a10] text-white"
                            : "bg-[#faf5ef] text-[#6b4a3d] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                        }`}
                      >
                        {cat === "Tous" ? "Tous" : `${categoryEmojis[cat] || "📌"} ${cat}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[11px] font-semibold text-[#9a7060] px-3 py-1.5 border-b border-[#f0e8dc]">
                  {loadingProductsDb ? "Chargement…" : `${filteredProductsDb.length} produit${filteredProductsDb.length > 1 ? "s" : ""}`}
                </div>

                <div className="overflow-auto flex-1" style={{maxHeight: "calc(100vh - 260px)"}}>
                  <table className="w-full text-xs">
                    <thead className="bg-[#faf5ef] text-[#9a7060] sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-3 py-2.5 font-bold min-w-[160px]">Produit</th>
                        <th className="text-left px-3 py-2.5 font-bold">Visible</th>
                        <th className="text-left px-3 py-2.5 font-bold">Catégorie</th>
                        <th className="text-left px-3 py-2.5 font-bold">Sous-cat.</th>
                        <th className="text-left px-3 py-2.5 font-bold">Fournisseur</th>
                        <th className="text-left px-3 py-2.5 font-bold">Zone</th>
                        <th className="text-left px-3 py-2.5 font-bold">Unité</th>
                        <th className="text-left px-3 py-2.5 font-bold">Portion</th>
                        <th className="text-left px-3 py-2.5 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProductsDb.map((item, index) => (
                        <tr key={item.id || index} className="border-t border-[#f0e8dc] hover:bg-[#faf5ef] transition-colors">
                          <td className="px-3 py-2.5 font-bold text-[#2c1a10]">{item.ingredient || item.name || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              item.visibleOrderPad !== false ? "bg-[#f0f7e5] text-[#5a7828]" : "bg-red-50 text-red-600"
                            }`}>
                              {item.visibleOrderPad !== false ? "Oui" : "Non"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[#6b4a3d]">{categoryEmojis[item.categorie || item.category] || "📌"} {item.categorie || item.category || "—"}</td>
                          <td className="px-3 py-2.5 text-[#6b4a3d]">{item.sousCategorie || item.subcategory || "—"}</td>
                          <td className="px-3 py-2.5 text-[#6b4a3d]">{getProductsDbSupplierName(item)}</td>
                          <td className="px-3 py-2.5 text-[#6b4a3d]">{item.zoneStockage || item.zone || "—"}</td>
                          <td className="px-3 py-2.5 text-[#6b4a3d]">{item.uniteStock || item.unit || "—"}</td>
                          <td className="px-3 py-2.5 font-bold text-[#2c1a10]">{item.portionGrammes || item.portion || 0}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => openProductDbEdit(item)}
                                className="h-7 px-2.5 rounded-lg bg-[#5a7828] text-white text-[11px] font-bold hover:bg-[#4e6a22] transition-colors cursor-pointer"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => deleteProductDb(item)}
                                className="h-7 px-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold hover:bg-red-100 transition-colors cursor-pointer"
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* INVENTORY PANEL */}
            {adminSection === "inventory" && (
              <div className="space-y-4">
                {/* KPI row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Produits suivis", value: inventoryBaseItems.length, filter: "Tous", color: "text-[#2c1a10]", bg: "bg-white border-[#e5d5c5]", active: inventoryStatusFilter === "Tous" },
                    { label: "OK", value: inventoryBaseItems.filter((i) => { const s = String(getStockStatus(i)).toLowerCase(); return !s.includes("critique") && !s.includes("stock bas") && !s.includes("alerte") && !s.includes("à commander"); }).length, filter: "OK", color: "text-[#5a7828]", bg: "bg-[#f0f7e5] border-[#c8dfa0]", active: inventoryStatusFilter === "OK" },
                    { label: "Stock bas", value: inventoryBaseItems.filter((i) => { const s = String(getStockStatus(i)).toLowerCase(); return s.includes("stock bas") || s.includes("alerte") || s.includes("à commander"); }).length, filter: "Stock bas", color: "text-orange-500", bg: "bg-orange-50 border-orange-100", active: inventoryStatusFilter === "Stock bas" },
                    { label: "Critiques", value: inventoryBaseItems.filter((i) => String(getStockStatus(i)).toLowerCase().includes("critique")).length, filter: "Critiques", color: "text-red-600", bg: "bg-red-50 border-red-100", active: inventoryStatusFilter === "Critiques" },
                  ].map(({ label, value, filter, color, bg, active }) => (
                    <button
                      key={label}
                      onClick={() => setInventoryStatusFilter(inventoryStatusFilter === filter && filter !== "Tous" ? "Tous" : filter)}
                      className={`rounded-xl p-3 border text-left shadow-sm transition-all cursor-pointer hover:shadow-md ${bg} ${active && filter !== "Tous" ? "ring-2 ring-offset-1 ring-[#2c1a10]/20" : ""}`}
                    >
                      <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1">{label}</div>
                      <div className={`text-2xl font-black ${color}`}>{value}</div>
                    </button>
                  ))}
                </div>

                {/* Inventory table */}
                <div className="bg-white rounded-2xl border border-[#e5d5c5] shadow-sm overflow-hidden" style={{height: "calc(100vh - 220px)"}}>
                  <div className="p-3 border-b border-[#e5d5c5]">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {/* View toggle */}
                      {[{ key: "stock", label: "Stock" }, { key: "prepa", label: "Prépas" }].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => { setInventoryView(key); setInventoryCategory("Tous"); setInventoryStatusFilter("Tous"); }}
                          className={`h-8 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            inventoryView === key ? "bg-[#2c1a10] text-white" : "bg-[#faf5ef] text-[#6b4a3d] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                          }`}
                        >
                          {label}
                        </button>
                      ))}

                      <div className="ml-auto flex gap-2">
                        <button
                          className="h-8 px-3 rounded-lg bg-[#faf5ef] border border-[#e5d5c5] text-xs font-bold text-[#6b4a3d] hover:bg-[#f0e4d4] transition-colors cursor-pointer"
                          onClick={() => { setInvoiceModal(true); setInvoiceResults([]); setInvoiceImageUrl(""); setInvoiceImage(null); }}
                        >
                          📸 Scanner facture
                        </button>
                        <button
                          className="h-8 px-3 rounded-lg bg-[#faf5ef] border border-[#e5d5c5] text-xs font-bold text-[#6b4a3d] hover:bg-[#f0e4d4] transition-colors cursor-pointer"
                          onClick={() => alert("Bientôt : photo Z de caisse + IA décompte ventes")}
                        >
                          🧾 Scanner Z
                        </button>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2 bg-[#faf5ef] border border-[#d8c8b8] rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                        placeholder={inventoryView === "stock" ? "Rechercher un produit, zone, statut..." : "Rechercher une prépa, zone, statut..."}
                        className="w-full bg-transparent outline-none text-[#2c1a10] placeholder:text-[#b09080] text-sm"
                      />
                    </div>

                    {/* Category pills */}
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1 scrollbar-hide">
                      {inventoryCategories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setInventoryCategory(cat)}
                          className={`h-7 px-3 rounded-lg whitespace-nowrap text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                            inventoryCategory === cat
                              ? "bg-[#2c1a10] text-white"
                              : "bg-[#faf5ef] text-[#6b4a3d] border border-[#e5d5c5] hover:bg-[#f0e4d4]"
                          }`}
                        >
                          {cat === "Tous" ? "Tous" : `${categoryEmojis[cat] || "📌"} ${cat}`}
                        </button>
                      ))}
                    </div>

                    <div className="text-[11px] font-semibold text-[#9a7060] mt-1.5">
                      {inventoryFilteredStock.length} élément{inventoryFilteredStock.length > 1 ? "s" : ""}
                      {inventoryStatusFilter !== "Tous" && ` · ${inventoryStatusFilter}`}
                      {inventoryCategory !== "Tous" && ` · ${inventoryCategory}`}
                    </div>
                  </div>

                  <div className="overflow-auto" style={{maxHeight: "calc(100vh - 380px)"}}>
                    <table className="w-full text-xs">
                      <thead className="bg-[#faf5ef] text-[#9a7060] sticky top-0 z-10">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-bold min-w-[160px]">{inventoryView === "stock" ? "Produit" : "Prépa"}</th>
                          <th className="text-left px-3 py-2.5 font-bold">Catégorie</th>
                          <th className="text-left px-3 py-2.5 font-bold">Zone</th>
                          <th className="text-left px-3 py-2.5 font-bold">{inventoryView === "stock" ? "En stock" : "Portions"}</th>
                          <th className="text-left px-3 py-2.5 font-bold">Statut</th>
                          <th className="text-left px-3 py-2.5 font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryFilteredStock.map((item, index) => {
                          const status = getStockStatus(item);
                          const statusLower = String(status).toLowerCase();
                          const isCritical = statusLower.includes("critique");
                          const isLow = statusLower.includes("stock bas") || statusLower.includes("alerte") || statusLower.includes("à commander");
                          return (
                            <tr key={item.id || index} className="border-t border-[#f0e8dc] hover:bg-[#faf5ef] transition-colors">
                              <td className="px-3 py-2.5 font-bold text-[#2c1a10]">{getStockName(item)}</td>
                              <td className="px-3 py-2.5 text-[#6b4a3d]">{categoryEmojis[getStockCategory(item)] || "📌"} {getStockCategory(item)}</td>
                              <td className="px-3 py-2.5 text-[#6b4a3d]">{getStockZone(item) || "—"}</td>
                              <td className="px-3 py-2.5 font-black text-[#2c1a10]">{inventoryView === "stock" ? `${getStockQty(item)}${getStockDisplayUnit(item) ? " " + getStockDisplayUnit(item) : ""}` : `${getStockPortions(item)} portions`}</td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isCritical ? "bg-red-50 text-red-600" : isLow ? "bg-orange-50 text-orange-600" : "bg-[#f0f7e5] text-[#5a7828]"
                                }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => openInventoryAdjust(item)}
                                    className="h-7 px-2.5 rounded-lg bg-[#5a7828] text-white text-[11px] font-bold hover:bg-[#4e6a22] transition-colors cursor-pointer"
                                  >
                                    Ajuster
                                  </button>
                                  <button
                                    onClick={() => deleteProductDb(item)}
                                    className="h-7 px-2.5 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[11px] font-bold hover:bg-red-100 transition-colors cursor-pointer"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS PANEL */}
            {adminSection === "orders" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black tracking-[0.35em] text-[#a97862] uppercase">MÖKA OS</div>
                    <h2 className="text-xl font-black text-[#3b241b]">Commandes fournisseurs</h2>
                  </div>
                  <button onClick={loadSupplierOrders} className="rounded-full bg-white border border-[#eadfd4] px-3 py-2 text-xs font-black text-[#6b4a3d]">
                    {loadingSupplierOrders ? "Chargement…" : "↻"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <OrdKpi title="🔴 Critiques" value={ordCriticalCount} desc="À commander maintenant" color="text-red-600" />
                  <OrdKpi title="🟠 Alertes" value={ordAlertCount} desc="Stock bas bientôt" color="text-orange-500" />
                  <OrdKpi title="📦 Historique" value={supplierOrders.length} desc="Commandes enregistrées" color="text-[#6f8f32]" />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {[
                    { id: "urgent", icon: "🚨", label: "Urgences", count: ordUrgentItems.length },
                    { id: "compose", icon: "📝", label: "Composer", count: null },
                    { id: "history", icon: "📜", label: "Historique", count: supplierOrders.length },
                    { id: "suppliers", icon: "🏢", label: "Fournisseurs", count: (settingsCache.suppliers || []).length },
                  ].map((tab) => (
                    <button key={tab.id} onClick={() => setOrderView(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition ${orderView === tab.id ? "bg-[#6f8f32] text-white shadow-md" : "bg-white text-[#6b4a3d] border border-[#eadfd4]"}`}>
                      {tab.icon} {tab.label}
                      {tab.count !== null && <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${orderView === tab.id ? "bg-white/20 text-white" : "bg-[#f4eee7] text-[#a97862]"}`}>{tab.count}</span>}
                    </button>
                  ))}
                </div>

                {orderView === "urgent" && (
                  <div className="space-y-5">
                    {ordCartItems.length > 0 && (
                      <div className="bg-[#fffaf3] rounded-[1.1rem] p-4 text-[#3b241b] border border-[#eadfd4] shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <div className="font-black text-sm">Panier commande</div>
                          <span className="text-xs text-[#a97862]">{ordCartItems.length} produit{ordCartItems.length > 1 ? "s" : ""}</span>
                        </div>
                        <div className="space-y-2">
                          {ordCartItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 bg-[#f7efe4] rounded-xl px-3 py-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-black truncate">{item.name}</div>
                                <div className="text-[10px] text-[#a97862]">{item.fournisseur}</div>
                              </div>
                              <OrdStepper value={item.qty} onChange={(v) => updateOrderCartQty(item.id, v)} min={1} unit={item.unit} />
                              <button onClick={() => removeFromOrderCart(item.id)} className="text-[#a97862] hover:text-[#3b241b] text-lg font-black leading-none">×</button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => setOrderView("compose")} className="mt-3 w-full py-3 rounded-xl bg-[#6f8f32] text-white font-black text-sm">
                          Composer et envoyer →
                        </button>
                      </div>
                    )}
                    {ordUrgentBySupplier.map(([supplier, items]) => (
                      <div key={supplier}>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="text-sm font-black text-[#3b241b]">🏢 {supplier}</div>
                          <div className="flex-1 h-px bg-[#dccbbb]" />
                          <button onClick={() => items.forEach((i) => addToOrderCart(i))} className="text-xs font-black text-[#6f8f32] border border-[#6f8f32] px-3 py-1 rounded-full">
                            Tout ajouter
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {items.map((item) => {
                            const inCart = !!orderCart[item.id];
                            const isCrit = String(item.status).toLowerCase().includes("critique");
                            return (
                              <div key={item.id} className={`rounded-[1.25rem] border overflow-hidden transition ${inCart ? "bg-[#eef5df] border-[#6f8f32]" : "bg-white border-[#eadfd4]"}`}>
                                <div className={`h-1.5 ${isCrit ? "bg-red-500" : "bg-orange-400"}`} />
                                <div className="p-4">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <div className={`text-[11px] font-black mb-0.5 ${inCart ? "text-[#a97862]" : isCrit ? "text-red-600" : "text-orange-500"}`}>
                                        {isCrit ? "🔴 Critique" : "🟠 Stock bas"}
                                      </div>
                                      <div className="font-black text-[#3b241b]">{item.name}</div>
                                      <div className="text-[11px] mt-0.5 text-[#a97862]">
                                        {item.portionsRestantes} portions restantes · seuil {item.seuilCritique || "—"}
                                      </div>
                                    </div>
                                    {inCart && <OrdStepper value={orderCart[item.id].qty} onChange={(v) => updateOrderCartQty(item.id, v)} min={1} unit={item.unit} />}
                                  </div>
                                  {!inCart ? (
                                    <button onClick={() => addToOrderCart(item)} className="mt-3 w-full py-2 rounded-xl border-2 border-[#6f8f32] text-[#6f8f32] font-black text-xs">
                                      + Ajouter ({item.suggested} {item.unit})
                                    </button>
                                  ) : (
                                    <button onClick={() => removeFromOrderCart(item.id)} className="mt-2 w-full py-1.5 rounded-xl bg-white text-[#6f8f32] border border-[#6f8f32] font-black text-xs">
                                      ✓ Dans le panier · Retirer
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {!loadingStock && ordUrgentItems.length === 0 && (
                      <div className="bg-white border border-[#eadfd4] rounded-[1.2rem] p-6 text-sm font-bold text-[#a97862]">
                        Aucun stock critique ou bas pour le moment.
                      </div>
                    )}
                  </div>
                )}

                {orderView === "compose" && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-black text-[#a97862] mb-2">Sélectionner un fournisseur</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {(settingsCache.suppliers || []).map((s) => {
                          const name = ordGetSupplierName(s);
                          return (
                            <button key={s.id || name} onClick={() => setOrdSelectedSupplier(name)} className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition ${ordSelectedSupplier === name ? "bg-[#6f8f32] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {ordSupplierContact && <OrdSupplierContactCard supplier={ordSupplierContact} />}
                    <div className="bg-white rounded-[1.1rem] border border-[#eadfd4] shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#eadfd4] flex justify-between items-center">
                        <div className="text-sm font-black text-[#3b241b]">Produits à commander</div>
                        <div className="text-xs text-[#a97862] font-bold">{ordIncludedItems.length} sélectionnés</div>
                      </div>
                      <div className="divide-y divide-[#eadfd4]">
                        {ordSupplierProducts.map((p) => {
                          const item = composeCart[p.id] || { ...p, qty: p.suggested, included: false };
                          const isCrit = String(p.status).toLowerCase().includes("critique");
                          const isLow = isUrgentStock(p) && !isCrit;
                          return (
                            <div key={p.id} className={`px-4 py-3 flex items-center gap-3 transition ${!item.included ? "opacity-50" : ""}`}>
                              <OrdToggle checked={item.included} onChange={(v) => setComposeCart((prev) => ({ ...prev, [p.id]: { ...item, included: v } }))} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-[#3b241b] truncate">{p.name}</div>
                                {(isCrit || isLow) && <div className={`text-[11px] font-bold ${isCrit ? "text-red-600" : "text-orange-500"}`}>{isCrit ? "🔴 Critique" : "🟠 Stock bas"}</div>}
                              </div>
                              <OrdStepper value={item.qty} onChange={(v) => setComposeCart((prev) => ({ ...prev, [p.id]: { ...item, qty: v } }))} min={0} unit={p.unit} />
                            </div>
                          );
                        })}
                        {!loadingProductsDb && ordSupplierProducts.length === 0 && (
                          <div className="p-5 text-sm font-bold text-[#a97862]">Aucun produit relié à ce fournisseur dans la base ingrédients.</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-[#a97862] mb-1.5">Notes (optionnel)</label>
                      <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} placeholder="Ex : livraison matin SVP, emballage sous-vide..." className="w-full rounded-[1rem] border border-[#eadfd4] bg-white px-4 py-3 text-sm text-[#3b241b] outline-none resize-none placeholder:text-[#c8b4a8]" rows={2} />
                    </div>
                    <button onClick={() => setShowOrderPreview(true)} disabled={ordIncludedItems.length === 0} className="w-full py-4 rounded-[1rem] bg-[#6f8f32] text-white font-black shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                      👁 Prévisualiser et envoyer ({ordIncludedItems.length} produits)
                    </button>
                  </div>
                )}

                {orderView === "history" && (
                  <div className="space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {["Tous", "À commander", "Envoyé", "Reçu", "Annulé"].map((s) => (
                        <button key={s} onClick={() => setOrdStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition ${ordStatusFilter === s ? "bg-[#6f8f32] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-[#a97862] font-bold">{ordFilteredOrders.length} commandes</div>
                    {ordFilteredOrders.map((order) => (
                      <div key={order.id} className="bg-white rounded-[1.1rem] border border-[#eadfd4] shadow-sm overflow-hidden">
                        <div className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <OrdStatusBadge status={order.statut} />
                              <span className="text-[11px] text-[#a97862]">{String(order.dateCreation || "").slice(0, 10) || "Sans date"} · {order.staff}</span>
                            </div>
                            <div className="font-black text-sm text-[#3b241b]">{order.fournisseur}</div>
                            <div className="text-[11px] text-[#a97862] mt-1 truncate">{order.produit} × {order.quantite} {order.unite}</div>
                          </div>
                          <button onClick={() => setOrderDetail(order)} className="shrink-0 text-xs font-black text-[#6f8f32] border border-[#6f8f32] px-3 py-1.5 rounded-xl">
                            Détail →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {orderView === "suppliers" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(settingsCache.suppliers || []).map((supplier) => {
                      const name = ordGetSupplierName(supplier);
                      const supplierUrgents = ordUrgentItems.filter((p) => p.fournisseur === name);
                      return (
                        <div key={supplier.id || name} className="bg-white rounded-[1.25rem] border border-[#eadfd4] shadow-sm p-4">
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <div>
                              <div className="font-black text-[#3b241b]">{name}</div>
                              <div className="text-[11px] text-[#a97862] mt-0.5">{supplierUrgents.length} produit(s) à commander</div>
                            </div>
                            {supplierUrgents.length > 0 && (
                              <span className="text-xs bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-full">Urgent</span>
                            )}
                          </div>
                          <OrdSupplierContactCard supplier={supplier} compact />
                          {supplierUrgents.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#eadfd4]">
                              <div className="text-[10px] font-black text-[#a97862] mb-1.5">PRODUITS À COMMANDER</div>
                              <div className="space-y-1">
                                {supplierUrgents.slice(0, 4).map((p) => (
                                  <div key={p.id} className="flex items-center gap-2 text-[11px]">
                                    <OrdStatusBadge status={p.status} />
                                    <span className="font-bold text-[#3b241b]">{p.name}</span>
                                    <span className="text-[#a97862]">→ {p.suggested} {p.unit}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <button onClick={() => { setOrdSelectedSupplier(name); setOrderView("compose"); }} className="w-full mt-3 py-2 rounded-xl bg-[#6f8f32] text-white font-black text-xs">
                            Commander
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showOrderPreview && (
                  <OrdPreviewModal
                    buildMessage={buildOrderMessage}
                    selectedSupplier={ordSelectedSupplier}
                    supplier={ordSupplierContact}
                    setShowPreview={setShowOrderPreview}
                  />
                )}
                {orderDetail && (
                  <OrdDetailModal
                    orderDetail={orderDetail}
                    setOrderDetail={setOrderDetail}
                    supplier={(settingsCache.suppliers || []).find((s) => ordGetSupplierName(s) === orderDetail.fournisseur)}
                  />
                )}
              </div>
            )}

            {/* REPORTS PANEL */}
            {adminSection === "reports" && (
              <div className="bg-white rounded-2xl p-12 border border-[#e5d5c5] shadow-sm text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#f0e8dc] flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#9a7060]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                  </div>
                </div>
                <div className="text-lg font-black text-[#2c1a10]">Rapports</div>
                <p className="text-xs text-[#9a7060] mt-1">À développer plus tard.</p>
              </div>
            )}

            {/* SETTINGS PANEL */}
            {adminSection === "settings" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: "suppliers", title: "Fournisseurs", desc: "Ajouter, modifier, désactiver", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                  { key: "categories", title: "Catégories", desc: "Créer / organiser", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg> },
                  { key: "subcategories", title: "Sous-catégories", desc: "Ranger les produits", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> },
                  { key: "units", title: "Unités", desc: "kg, pièce, carton…", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg> },
                  { key: "zones", title: "Zones", desc: "Stockage et emplacement", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> },
                  { key: "staff", title: "Staff", desc: "Équipe et pointage", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                ].map(({ key, title, desc, icon }) => (
                  <button
                    key={key}
                    onClick={() => loadSettingsPanel(key)}
                    className="bg-white rounded-2xl p-5 border border-[#e5d5c5] shadow-sm text-left hover:shadow-md hover:border-[#d0c0b0] transition-all cursor-pointer active:scale-[0.98] group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[#f0e8dc] flex items-center justify-center text-[#6b4a3d] mb-3 group-hover:bg-[#2c1a10] group-hover:text-[#f5ede0] transition-all">{icon}</div>
                    <div className="text-base font-black text-[#2c1a10]">{title}</div>
                    <p className="text-[11px] text-[#9a7060] mt-1">{desc}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADMIN BOTTOM NAV ─────────────────────────── */}
      {isAdmin && (
        <div className="fixed left-1/2 bottom-4 -translate-x-1/2 z-50 bg-[#2c1a10]/95 backdrop-blur-md border border-[#3d2518] shadow-2xl rounded-2xl px-2 py-2 flex items-center gap-1 max-w-[96vw]">
          {[
            { id: "dashboard", label: "Dashboard", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg> },
            { id: "products", label: "Produits", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg> },
            { id: "inventory", label: "Inventaire", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect width="6" height="4" x="9" y="3" rx="1"/><path d="m9 14 2 2 4-4"/></svg> },
            { id: "orders", label: "Commandes", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg> },
            { id: "reports", label: "Rapports", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg> },
            { id: "settings", label: "Paramètres", icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> },
          ].map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => setAdminSection(id)}
              title={label}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-[9px] font-bold shrink-0 transition-all cursor-pointer min-w-[48px] ${
                adminSection === id
                  ? "bg-[#f5ede0] text-[#2c1a10]"
                  : "text-[#a08070] hover:text-[#f5ede0] hover:bg-white/10"
              }`}
            >
              {icon}
              <span className="leading-none">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── SETTINGS DATABASE MODAL ──────────────────── */}
      {settingsPanel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#e5d5c5] flex justify-between items-center shrink-0">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Paramètres</div>
                <h2 className="text-base font-black text-[#2c1a10] mt-0.5">
                  {settingsPanel === "suppliers" && "🏢 Fournisseurs"}
                  {settingsPanel === "staff" && "👥 Staff"}
                  {settingsPanel === "categories" && "📦 Catégories"}
                  {settingsPanel === "subcategories" && "📂 Sous-catégories"}
                  {settingsPanel === "units" && "📏 Unités"}
                  {settingsPanel === "zones" && "🗄️ Zones"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={openSettingsCreate}
                  className="h-9 px-3 rounded-xl bg-[#5a7828] text-white text-xs font-bold cursor-pointer hover:bg-[#4e6a22] transition-colors"
                >
                  ➕ Ajouter
                </button>
                <button
                  onClick={() => setSettingsPanel("")}
                  className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-lg text-[#9a7060] hover:bg-[#e5d5c5] transition-colors cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            {loadingSettingsPanel ? (
              <div className="p-10 text-center text-[#9a7060] font-semibold">Chargement…</div>
            ) : settingsData.length === 0 ? (
              <div className="p-10 text-center text-[#9a7060] font-semibold">Aucun élément trouvé.</div>
            ) : (
              <div className="overflow-auto flex-1">
                <table className="w-full text-xs">
                  <thead className="bg-[#faf5ef] text-[#9a7060] sticky top-0">
                    <tr>
                      {["Nom", "Catégorie / rôle", "Contact", "Téléphone", "Email", "Statut", "Actions"].map((h) => (
                        <th key={h} className="text-left px-3 py-2.5 font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {settingsData.map((item, index) => (
                      <tr key={item.id || item.nom || index} className="border-t border-[#f0e8dc] hover:bg-[#faf5ef] transition-colors">
                        <td className="px-3 py-2.5 font-bold text-[#2c1a10]">{item.nom || item.name || item.fournisseur || item.prenom || "Sans nom"}</td>
                        <td className="px-3 py-2.5 text-[#6b4a3d]">{item.categorie || item.category || item.role || "—"}</td>
                        <td className="px-3 py-2.5 text-[#6b4a3d]">{item.contact || item.methodeContact || "—"}</td>
                        <td className="px-3 py-2.5 text-[#6b4a3d]">{item.telephone || item.whatsapp || item.phone || "—"}</td>
                        <td className="px-3 py-2.5 text-[#6b4a3d]">{item.email || "—"}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.actif === false ? "bg-red-50 text-red-600" : "bg-[#f0f7e5] text-[#5a7828]"
                          }`}>
                            {item.actif === false ? "Inactif" : "Actif"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-1.5">
                            <button onClick={() => openSettingsEdit(item)} className="h-7 px-2.5 rounded-lg bg-white border border-[#e5d5c5] text-[11px] font-bold text-[#6b4a3d] hover:bg-[#faf5ef] transition-colors cursor-pointer">Modifier</button>
                            <button onClick={() => archiveSettingsDatabaseItem(item)} className="h-7 px-2.5 rounded-lg bg-red-50 border border-red-100 text-[11px] font-bold text-red-600 hover:bg-red-100 transition-colors cursor-pointer">Désactiver</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE SETTINGS ITEM MODAL ───────────────── */}
      {creatingSettingsItem && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Ajouter</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">
                  {settingsPanel === "suppliers" && "🏢 Nouveau fournisseur"}
                  {settingsPanel === "staff" && "👥 Nouveau staff"}
                  {settingsPanel === "categories" && "📦 Nouvelle catégorie"}
                  {settingsPanel === "subcategories" && "📂 Nouvelle sous-catégorie"}
                  {settingsPanel === "units" && "📏 Nouvelle unité"}
                  {settingsPanel === "zones" && "🗄️ Nouvelle zone"}
                </h2>
              </div>
              <button onClick={() => setCreatingSettingsItem(false)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nom</label>
                <input
                  value={creatingSettingsForm.nom || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, nom: e.target.value, name: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  placeholder="Nom…"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Catégorie / rôle</label>
                <input
                  value={creatingSettingsForm.categorie || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, categorie: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Méthode contact</label>
                <select
                  value={creatingSettingsForm.methodeContact || "WhatsApp"}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, methodeContact: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                >
                  <option>WhatsApp</option><option>Email</option><option>Téléphone</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Téléphone / WhatsApp</label>
                <input
                  value={creatingSettingsForm.telephone || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, telephone: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Email</label>
                <input
                  value={creatingSettingsForm.email || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                />
              </div>
              <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={creatingSettingsForm.actif !== false}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, actif: e.target.checked }))}
                  className="w-4 h-4"
                />
                Actif
              </label>
            </div>

            <button
              onClick={saveSettingsDatabaseCreate}
              disabled={savingSettingsPanel}
              className="w-full mt-5 py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-md hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingSettingsPanel ? "Création…" : "Créer ✅"}
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT SETTINGS ITEM MODAL ─────────────────── */}
      {editingSettingsItem && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Modifier</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">
                  {settingsPanel === "suppliers" ? "🏢 Fournisseur" : "👥 Staff"}
                </h2>
              </div>
              <button onClick={() => setEditingSettingsItem(null)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: "Nom", key: "nom", extra: (v) => ({ name: v }) },
                { label: "Catégorie / rôle", key: "categorie", extra: (v) => ({ role: v }) },
                { label: "Contact", key: "contact" },
                { label: "Téléphone / WhatsApp", key: "telephone", extra: (v) => ({ whatsapp: v, phone: v }) },
                { label: "Email", key: "email" },
              ].map(({ label, key, extra }, i) => (
                <div key={key} className={i === 0 ? "md:col-span-2" : ""}>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">{label}</label>
                  <input
                    value={editingSettingsForm[key] || ""}
                    onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, [key]: e.target.value, ...(extra ? extra(e.target.value) : {}) }))}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  />
                </div>
              ))}
              <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingSettingsForm.actif !== false}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, actif: e.target.checked }))}
                  className="w-4 h-4"
                />
                Actif
              </label>
            </div>

            <button
              onClick={saveSettingsDatabaseItem}
              disabled={savingSettingsPanel}
              className="w-full mt-5 py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-md hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingSettingsPanel ? "Enregistrement…" : "Enregistrer ✅"}
            </button>
          </div>
        </div>
      )}

      {/* ── STOCK RECEIVE MODAL ──────────────────────── */}
      {stockReceiveItem && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-md p-5">
            <div className="flex justify-between gap-4 items-start mb-4">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">{stockReceiveMode === "replace" ? "✏️ Corriger le stock" : "📦 Réception"}</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">{getStockName(stockReceiveItem)}</h2>
              </div>
              <button onClick={() => setStockReceiveItem(null)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
            </div>

            <div className="flex gap-2 mb-4">
              {[{ id: "add", label: "📦 Réception" }, { id: "replace", label: "✏️ Correction" }].map((m) => (
                <button key={m.id} onClick={() => setStockReceiveMode(m.id)} className={`flex-1 py-2 rounded-xl text-xs font-black transition ${stockReceiveMode === m.id ? "bg-[#2c1a10] text-white" : "bg-[#f0e8dc] text-[#6b4a3d]"}`}>
                  {m.label}
                </button>
              ))}
            </div>

            <div className="rounded-xl bg-[#faf5ef] border border-[#e5d5c5] p-4 mb-4">
              <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">En stock actuellement</div>
              <div className="text-2xl font-black text-[#2c1a10] mt-1">{getStockQty(stockReceiveItem)} {getStockDisplayUnit(stockReceiveItem)}</div>
              <div className="text-[11px] text-[#9a7060] mt-0.5">Statut : {getStockStatus(stockReceiveItem)}</div>
            </div>

            <div className="mb-3">
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">
                {stockReceiveMode === "replace" ? "Quantité totale réelle (remplace le stock)" : "Quantité reçue à ajouter"}
              </label>
              <input
                type="number"
                step="0.01"
                value={stockReceiveWeight}
                onChange={(e) => setStockReceiveWeight(e.target.value)}
                placeholder="Ex : 5"
                className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-4 text-2xl font-black text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Unité</label>
              <select
                value={stockReceiveUnit}
                onChange={(e) => setStockReceiveUnit(e.target.value)}
                className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 text-base font-bold text-[#2c1a10] outline-none"
              >
                {["kg", "g", "L", "ml", "pièce", "carton", "sachet", "bouteille"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <button
              onClick={saveStockReceive}
              disabled={savingStockReceive}
              className="w-full py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-md hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingStockReceive ? "Enregistrement…" : stockReceiveMode === "replace" ? "Corriger le stock ✅" : "Ajouter au stock ✅"}
            </button>
          </div>
        </div>
      )}

      {/* ── INVENTORY ADJUST MODAL ───────────────────── */}
      {inventoryItem && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-md p-5">
            <div className="flex justify-between gap-4 items-start mb-5">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">📋 Ajuster le stock</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">{getStockName(inventoryItem)}</h2>
              </div>
              <button onClick={() => setInventoryItem(null)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
            </div>

            <div className="rounded-xl bg-[#faf5ef] border border-[#e5d5c5] p-4 mb-4">
              <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">En stock actuellement</div>
              <div className="text-2xl font-black text-[#2c1a10] mt-1">{getStockQty(inventoryItem)} {getStockDisplayUnit(inventoryItem)}</div>
              <div className="text-[11px] text-[#9a7060] mt-0.5">Statut : {getStockStatus(inventoryItem)}</div>
            </div>

            <div className="mb-3">
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nouvelle quantité totale</label>
              <input
                type="number"
                step="0.01"
                value={inventoryWeight}
                onChange={(e) => setInventoryWeight(e.target.value)}
                placeholder="Ex : 4.25"
                className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-4 text-2xl font-black text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
              />
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Unité</label>
              <select
                value={inventoryUnit}
                onChange={(e) => setInventoryUnit(e.target.value)}
                className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 text-base font-bold text-[#2c1a10] outline-none"
              >
                {["kg", "g", "L", "ml", "pièce", "sachet", "carton", "bouteille", "barquette"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <button
              onClick={saveInventoryAdjust}
              disabled={savingInventory}
              className="w-full py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-md hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingInventory ? "Mise à jour…" : "Mettre à jour le stock ✅"}
            </button>
          </div>
        </div>
      )}

      {/* ── PRODUCT SETTINGS MODAL (quick edit) ──────── */}
      {settingsItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between gap-4 items-start mb-5">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">{settingsItem?.isNew ? "Nouveau produit" : "Réglages produit"}</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">{settingsForm.name || "Sans nom"}</h2>
              </div>
              <button onClick={() => setSettingsItem(null)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-3">
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nom produit</label>
                <input
                  type="text"
                  value={settingsForm.name || ""}
                  onChange={(e) => setSettingsForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Mangue fraîche"
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                />
              </div>

              {[
                ["Catégorie", "categorie", "select", categoryOptions],
                ["Sous-catégorie", "sousCategorie", "select", subCategoryOptions],
                ["Visible OrderPad", "visibleOrderPad", "checkbox", []],
                ["Fournisseur par défaut", "fournisseurDefaut", "select", fournisseurOptions],
                ["Zone de stockage", "zoneStockage", "select", zoneOptions],
                ["Quantité commandée", "quantiteCommandee", "number", []],
                ["Unité stock", "uniteStock", "select", uniteOptions],
                ["Unité commande", "uniteCommande", "select", uniteOptions],
                ["Portion (g)", "portion", "number", []],
                ["Seuil alerte", "seuilAlerte", "number", []],
                ["Seuil critique", "seuilCritique", "number", []],
              ].map(([label, key, type, options]) => (
                <div key={key}>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">{label}</label>
                  {type === "checkbox" ? (
                    <label className="flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!settingsForm[key]}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4"
                      />
                      Oui
                    </label>
                  ) : type === "select" ? (
                    <select
                      value={settingsForm[key] || ""}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                    >
                      <option value="">Sélectionner…</option>
                      {options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={settingsForm[key] ?? ""}
                      onChange={(e) => setSettingsForm((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="Non défini"
                      className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none placeholder:text-[#c0b0a8] focus:border-[#5a7828] transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSettingsItem(null)} className="flex-1 py-3 rounded-xl font-black bg-[#ede0d4] text-[#9a7060] hover:bg-[#e5d5c5] transition-colors cursor-pointer">Annuler</button>
              <button onClick={saveSettings} disabled={savingSettings} className="flex-1 py-3 rounded-xl font-black bg-[#5a7828] text-white hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer">
                {savingSettings ? "Enregistrement…" : "Enregistrer ✅"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE PRODUCT DB MODAL ───────────────────── */}
      {creatingProductDb && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Nouveau produit</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">Ajouter au catalogue</h2>
              </div>
              <button onClick={() => setCreatingProductDb(false)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nom du produit / ingrédient</label>
                <input
                  value={creatingProductDbForm.ingredient || ""}
                  onChange={(e) => setCreatingProductDbForm((prev) => ({ ...prev, ingredient: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-4 text-xl font-black text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  placeholder="Ex : Mangue fraîche"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Photo URL</label>
                  <input
                    value={creatingProductDbForm.photo || ""}
                    onChange={(e) => setCreatingProductDbForm((prev) => ({ ...prev, photo: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                    placeholder="Coller une URL image"
                  />
                </div>

                {[
                  ["Catégorie", "categorie", "select", productsDbCategories.filter((c) => c !== "Tous")],
                  ["Sous-catégorie", "sousCategorie", "select", productsDbSubCategoryChoices],
                  ["Fournisseur", "fournisseurDefaut", "select", productsDbSupplierChoices],
                  ["Zone de stockage", "zoneStockage", "select", productsDbZoneChoices],
                  ["Unité stock", "uniteStock", "select", productsDbUnitChoices],
                  ["Unité commande", "uniteCommande", "select", productsDbUnitChoices],
                  ["Qté commande suggérée", "quantiteCommandeSuggeree", "number", []],
                  ["Portion (g)", "portionGrammes", "number", []],
                  ["Seuil alerte", "seuilAlerte", "number", []],
                  ["Seuil critique", "seuilCritique", "number", []],
                ].map(([label, key, type, opts]) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">{label}</label>
                    {type === "select" ? (
                      <select
                        value={creatingProductDbForm[key] || ""}
                        onChange={(e) => setCreatingProductDbForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                      >
                        <option value="">À définir</option>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={creatingProductDbForm[key] ?? ""}
                        onChange={(e) => setCreatingProductDbForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                      />
                    )}
                  </div>
                ))}

                <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={creatingProductDbForm.visibleOrderPad !== false}
                    onChange={(e) => setCreatingProductDbForm((prev) => ({ ...prev, visibleOrderPad: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  Visible sur OrderPad
                </label>
              </div>
            </div>

            <button
              onClick={saveProductDbCreate}
              disabled={savingProductDb}
              className="w-full mt-5 py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-md hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingProductDb ? "Création…" : "Créer le produit ✅"}
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT PRODUCT DB MODAL ───────────────────── */}
      {editingProductDb && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Modifier le produit</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">{editingProductDb?.ingredient || editingProductDb?.name || "Produit"}</h2>
              </div>
              <button onClick={() => setEditingProductDb(null)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nom du produit</label>
                <input
                  value={editingProductDbForm.ingredient || ""}
                  onChange={(e) => setEditingProductDbForm((prev) => ({ ...prev, ingredient: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-4 text-xl font-black text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  ["Fournisseur", "fournisseurDefaut", "select", productsDbSupplierChoices],
                  ["Zone de stockage", "zoneStockage", "select", productsDbZoneChoices],
                  ["Méthode de suivi", "methodeSuivi", "select", ["Manuel", "Automatique", "Préparation"]],
                  ["Qté commande suggérée", "quantiteCommandeSuggeree", "number", []],
                  ["Portion (g)", "portionGrammes", "number", []],
                  ["Unité stock", "uniteStock", "select", productsDbUnitChoices],
                  ["Unité commande", "uniteCommande", "select", productsDbUnitChoices],
                  ["Seuil alerte", "seuilAlerte", "number", []],
                  ["Seuil critique", "seuilCritique", "number", []],
                ].map(([label, key, type, opts]) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">{label}</label>
                    {type === "select" ? (
                      <select
                        value={editingProductDbForm[key] || ""}
                        onChange={(e) => setEditingProductDbForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                      >
                        <option value="">À définir</option>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="number"
                        value={editingProductDbForm[key] ?? ""}
                        onChange={(e) => setEditingProductDbForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                      />
                    )}
                  </div>
                ))}

                <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProductDbForm.visibleOrderPad !== false}
                    onChange={(e) => setEditingProductDbForm((prev) => ({ ...prev, visibleOrderPad: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  Visible sur OrderPad
                </label>
              </div>

              {[["Utilisé dans", "utiliseDans"], ["Notes", "notes"]].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">{label}</label>
                  <textarea
                    value={editingProductDbForm[key] || ""}
                    onChange={(e) => setEditingProductDbForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="w-full min-h-[60px] rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={saveProductDbEdit}
              disabled={savingProductDb}
              className="w-full mt-5 py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-md hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {savingProductDb ? "Enregistrement…" : "Enregistrer les modifications ✅"}
            </button>
          </div>
        </div>
      )}

      {/* ── CLOCK MODAL ──────────────────────────────── */}
      {showClockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">

            {/* Header */}
            <div className="flex justify-between items-start gap-4 p-5 pb-4 border-b border-[#f0e8dc]">
              <div>
                <h2 className="text-xl font-black text-[#2c1a10]">Pointage</h2>
                <div className="text-sm font-bold text-[#e85d8a] mt-0.5 tabular-nums">
                  {clockNow.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}
                  {clockNow.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>
              <button onClick={() => setShowClockModal(false)} className="w-10 h-10 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>

            {/* Staff cards */}
            <div className="flex flex-col gap-3 p-4">
              {loadingClockStaff && (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <div className="w-8 h-8 border-4 border-[#e5d5c5] border-t-[#e85d8a] rounded-full animate-spin" />
                  <div className="text-sm font-bold text-[#9a7060]">Chargement de l'équipe…</div>
                </div>
              )}
              {!loadingClockStaff && !staff.length && !(settingsCache.staff?.length) && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="text-3xl">⚠️</div>
                  <div className="text-sm font-bold text-[#9a7060]">Aucun membre trouvé</div>
                  <div className="text-xs text-[#b09080]">Vérifier la connexion ou la base staff</div>
                </div>
              )}
              {(staff.length ? staff : (settingsCache.staff || [])).map((member) => {
                const staffId = member.id || getStaffName(member);
                const staffName = getStaffName(member);
                const status = clockStatuses[staffId] || "absent";
                const statusConfig = {
                  present: { label: "Présent",     color: "text-[#5a7828]",  dot: "bg-[#5a7828]" },
                  pause:   { label: "En pause",    color: "text-orange-500", dot: "bg-orange-400" },
                  done:    { label: "Terminé",     color: "text-[#9a7060]",  dot: "bg-[#9a7060]" },
                  absent:  { label: "Absent",      color: "text-[#b09080]",  dot: "bg-[#d5c5b5]" },
                }[status] || { label: "Absent", color: "text-[#b09080]", dot: "bg-[#d5c5b5]" };

                return (
                  <div key={staffId} className="rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-4">
                    {/* Name + status */}
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusConfig.dot}`} />
                      <div>
                        <div className="font-black text-2xl text-[#2c1a10] leading-tight">{staffName}</div>
                        <div className={`text-xs font-bold ${statusConfig.color}`}>{statusConfig.label}</div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    {status === "absent" && (
                      <button
                        disabled={clockSending}
                        onClick={() => sendClockAction(member, "Arrivée")}
                        className="w-full h-14 rounded-2xl bg-[#5a7828] text-white font-black text-base hover:bg-[#4e6a22] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        ✓ Arrivée
                      </button>
                    )}
                    {status === "present" && (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          disabled={clockSending}
                          onClick={() => sendClockAction(member, "Départ pause")}
                          className="h-14 rounded-2xl bg-orange-500 text-white font-black text-base hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Pause déjeuner
                        </button>
                        <button
                          disabled={clockSending}
                          onClick={() => sendClockAction(member, "Départ")}
                          className="h-14 rounded-2xl bg-[#2c1a10] text-white font-black text-base hover:bg-[#1e100a] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Fin de service
                        </button>
                      </div>
                    )}
                    {status === "pause" && (
                      <button
                        disabled={clockSending}
                        onClick={() => sendClockAction(member, "Retour pause")}
                        className="w-full h-14 rounded-2xl bg-[#5a7828] text-white font-black text-base hover:bg-[#4e6a22] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        ↩ Retour
                      </button>
                    )}
                    {status === "done" && (
                      <div className="h-14 rounded-2xl bg-[#f0e8dc] flex items-center justify-center font-black text-base text-[#b09080]">
                        Journée terminée ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN PIN MODAL ───────────────────────────── */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#e5d5c5] w-full max-w-sm p-6 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#92400E] via-[#B45309] to-[#5a7828]" />
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-[#2c1a10] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <h2 className="text-base font-black text-[#2c1a10]">Accès admin</h2>
                <p className="text-[11px] text-[#9a7060]">Code à 4 chiffres requis</p>
              </div>
            </div>

            <input
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              autoFocus
              className="w-full rounded-2xl border-2 border-[#e5d5c5] bg-[#faf5ef] px-4 py-4 text-center text-3xl font-black tracking-[0.6em] text-[#2c1a10] outline-none focus:border-[#2c1a10] transition-colors mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setShowAdminModal(false); setAdminPin(""); }}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#ede0d4] text-[#9a7060] hover:bg-[#e5d5c5] active:scale-95 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={unlockAdmin}
                className="flex-1 py-3 rounded-xl font-black text-sm bg-[#2c1a10] text-[#f5ede0] hover:bg-[#1e100a] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="11" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Entrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INVOICE SCANNER MODAL ────────────────────── */}
      {invoiceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#faf5ef] rounded-t-3xl sm:rounded-2xl shadow-2xl border border-[#e5d5c5] w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start gap-4 p-5 pb-4 border-b border-[#e5d5c5]">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Inventaire automatique</div>
                <h2 className="text-lg font-black text-[#2c1a10] mt-0.5">📸 Scanner une facture</h2>
                <p className="text-xs text-[#9a7060] mt-0.5">Claude AI analyse automatiquement les produits</p>
              </div>
              <button onClick={() => setInvoiceModal(false)} className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#9a7060] hover:bg-[#e5d5c5] hover:text-[#2c1a10] transition-all cursor-pointer shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Upload zone */}
              <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#d5c5b5] bg-white p-6 cursor-pointer hover:border-[#b89580] hover:bg-[#fdf8f3] transition-colors">
                <div className="text-4xl">{invoiceImageUrl ? "🔄" : "📷"}</div>
                <div className="text-sm font-bold text-[#6b4a3d]">{invoiceImageUrl ? "Changer de photo" : "Prendre une photo ou choisir un fichier"}</div>
                <div className="text-xs text-[#9a7060]">Facture, bon de livraison…</div>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInvoicePhoto} />
              </label>

              {/* Preview */}
              {invoiceImageUrl && (
                <div className="rounded-2xl overflow-hidden border border-[#e5d5c5] bg-white">
                  <img src={invoiceImageUrl} alt="Facture" className="w-full max-h-48 object-contain" />
                </div>
              )}

              {/* Analyzing spinner */}
              {invoiceAnalyzing && (
                <div className="flex items-center justify-center gap-3 py-6">
                  <div className="w-6 h-6 border-3 border-[#b89580] border-t-[#2c1a10] rounded-full animate-spin" />
                  <span className="text-sm font-bold text-[#6b4a3d]">Analyse en cours…</span>
                </div>
              )}

              {/* Results */}
              {invoiceResults.length > 0 && !invoiceAnalyzing && (
                <div className="flex flex-col gap-3">
                  <div className="text-xs font-black text-[#9a7060] uppercase tracking-wide">
                    Produits détectés ({invoiceResults.length})
                  </div>

                  {invoiceResults.map((r, i) => (
                    <div key={i} className={`rounded-xl border p-3 bg-white transition-opacity ${r.include ? "border-[#e5d5c5] opacity-100" : "border-[#e5d5c5] opacity-50"}`}>
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => setInvoiceResults((prev) => prev.map((item, idx) => idx === i ? { ...item, include: !item.include } : item))}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors cursor-pointer ${r.include ? "bg-[#5a7828] border-[#5a7828]" : "border-[#d5c5b5] bg-white"}`}
                        >
                          {r.include && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>

                        <div className="flex-1 min-w-0">
                          {/* Nom matché (stock) ou nom facture */}
                          <div className="text-sm font-black text-[#2c1a10] truncate">
                            {r.matched ? (r.matched.ingredient || r.matched.name || getStockName(r.matched)) : r.name}
                          </div>
                          {/* Nom sur la facture si différent du nom stock */}
                          {r.name_facture && r.matched && (
                            <div className="text-[11px] text-[#9a7060] truncate mt-0.5">{r.name_facture}</div>
                          )}
                          {/* Badge match + confidence */}
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {r.matched ? (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-[11px] font-bold text-green-700">
                                ✓ Identifié
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-bold text-orange-700">
                                ⚠ Non trouvé
                              </div>
                            )}
                            {r.confidence && (
                              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                r.confidence === "high"
                                  ? "bg-green-50 border-green-200 text-green-700"
                                  : r.confidence === "medium"
                                  ? "bg-amber-50 border-amber-200 text-amber-700"
                                  : "bg-red-50 border-red-200 text-red-700"
                              }`}>
                                {r.confidence === "high" ? "Confiance élevée" : r.confidence === "medium" ? "Confiance moyenne" : "Confiance faible"}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Qty + unit */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={r.quantite}
                            onChange={(e) => setInvoiceResults((prev) => prev.map((item, idx) => idx === i ? { ...item, quantite: Number(e.target.value) } : item))}
                            className="w-16 rounded-lg border border-[#e5d5c5] bg-[#faf5ef] px-2 py-1.5 text-sm font-bold text-[#2c1a10] text-center outline-none focus:border-[#5a7828] transition-colors"
                          />
                          <select
                            value={r.unite}
                            onChange={(e) => setInvoiceResults((prev) => prev.map((item, idx) => idx === i ? { ...item, unite: e.target.value } : item))}
                            className="rounded-lg border border-[#e5d5c5] bg-[#faf5ef] px-2 py-1.5 text-sm font-bold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors cursor-pointer"
                          >
                            {["kg","g","L","ml","pièce","sachet","carton","bouteille","barquette","boîte"].map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Actions */}
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => setInvoiceModal(false)}
                      className="flex-1 py-3 rounded-xl font-bold text-sm bg-[#f0e8dc] text-[#9a7060] hover:bg-[#e5d5c5] transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={saveInvoiceToStock}
                      disabled={invoiceSaving || !invoiceResults.some((r) => r.include && r.matched)}
                      className="flex-1 py-3 rounded-xl font-black text-sm bg-[#5a7828] text-white shadow-md hover:bg-[#4e6a22] transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {invoiceSaving ? "Enregistrement…" : `Enregistrer ${invoiceResults.filter((r) => r.include && r.matched).length} produit(s)`}
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state if no image yet */}
              {!invoiceImageUrl && !invoiceAnalyzing && invoiceResults.length === 0 && (
                <button
                  onClick={() => setInvoiceModal(false)}
                  className="w-full py-3 rounded-xl font-bold text-sm bg-[#f0e8dc] text-[#9a7060] hover:bg-[#e5d5c5] transition-colors cursor-pointer"
                >
                  Annuler
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

function OrdStatusBadge({ status }) {
  const s = String(status).toLowerCase();
  const isCrit = s.includes("critique");
  const isLow = s.includes("stock bas") || s.includes("alerte") || s.includes("envoyé") || s.includes("attente") || s.includes("commander");
  const isGood = s.includes("reçu") || s.includes("ok");
  const isCancel = s.includes("annulé");
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black ${isCrit ? "bg-red-100 text-red-700" : isLow ? "bg-orange-100 text-orange-700" : isGood ? "bg-green-100 text-green-700" : isCancel ? "bg-gray-100 text-gray-500" : "bg-blue-50 text-blue-700"}`}>
      {isCrit ? "🔴" : isLow ? "🟠" : isGood ? "✅" : isCancel ? "✖️" : "🔵"} {status}
    </span>
  );
}

function OrdStepper({ value, onChange, min = 0, unit = "" }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-7 h-7 rounded-lg bg-[#f4eee7] border border-[#eadfd4] text-[#3b241b] font-black text-sm flex items-center justify-center active:scale-95 transition">−</button>
      <div className="w-12 text-center font-black text-sm text-[#3b241b]">{value}</div>
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-[#6f8f32] text-white font-black text-sm flex items-center justify-center active:scale-95 transition">+</button>
      {unit && <span className="text-[11px] text-[#a97862] font-bold ml-1">{unit}</span>}
    </div>
  );
}

function OrdToggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-[#6f8f32]" : "bg-[#dccbbb]"}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function OrdKpi({ title, value, desc, color }) {
  return (
    <div className="rounded-[1.1rem] bg-white border border-[#eadfd4] p-3 shadow-sm">
      <div className="text-[11px] font-black text-[#a97862]">{title}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-[#a97862] mt-0.5">{desc}</div>
    </div>
  );
}

function OrdSupplierContactCard({ supplier, compact = false }) {
  const phone = ordGetSupplierPhone(supplier);
  const whatsapp = ordGetSupplierWhatsapp(supplier);
  const email = ordGetSupplierEmail(supplier);
  return (
    <div className={compact ? "flex gap-2" : "bg-white rounded-[1.1rem] border border-[#eadfd4] p-3 shadow-sm flex items-center justify-between gap-3"}>
      {!compact && (
        <div>
          <div className="text-xs font-black text-[#3b241b]">{ordGetSupplierName(supplier)}</div>
          <div className="text-[11px] text-[#a97862]">{[email, phone].find((v) => v && v !== "null") || "Contact à compléter"}</div>
        </div>
      )}
      <div className="flex gap-2">
        {phone && phone !== "null" && <a href={`tel:${phone}`} className="w-9 h-9 rounded-xl bg-[#f4eee7] flex items-center justify-center text-base">📞</a>}
        {whatsapp && whatsapp !== "null" && <a href={`https://wa.me/${String(whatsapp).replace(/\D/g, "")}`} className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-base">💬</a>}
        {email && email !== "null" && <a href={`mailto:${email}`} className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-base">📧</a>}
      </div>
    </div>
  );
}

function OrdPreviewModal({ buildMessage, selectedSupplier, supplier, setShowPreview }) {
  const message = buildMessage();
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-[1.4rem] shadow-xl border border-[#eadfd4] w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black tracking-[0.22em] text-[#a97862] uppercase">Prévisualisation</div>
            <h2 className="text-lg font-black text-[#3b241b]">Message à envoyer</h2>
          </div>
          <button onClick={() => setShowPreview(false)} className="w-9 h-9 rounded-full bg-[#f4eee7] flex items-center justify-center font-black text-[#a97862]">×</button>
        </div>
        <div className="bg-[#e8f5e1] rounded-[1rem] p-4 mb-4 font-mono text-sm text-[#2d5a1b] whitespace-pre-wrap leading-relaxed">{message}</div>
        <div className="flex gap-2">
          <button onClick={() => {
            const wa = ordGetSupplierWhatsapp(supplier);
            if (wa) window.open(`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-green-500 text-white font-black text-sm">💬 WhatsApp</button>
          <button onClick={() => {
            const em = ordGetSupplierEmail(supplier);
            if (em) window.open(`mailto:${em}?subject=Commande MÖKA&body=${encodeURIComponent(message)}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-blue-500 text-white font-black text-sm">📧 Email</button>
        </div>
        <button onClick={() => { alert("Prochaine étape : sauvegarde/envoi dans Notion ✅"); setShowPreview(false); }} className="w-full mt-2 py-3 rounded-[1rem] bg-[#6f8f32] text-white font-black text-sm">
          ✅ Marquer comme préparée
        </button>
      </div>
    </div>
  );
}

function OrdDetailModal({ orderDetail, supplier, setOrderDetail }) {
  const dateStr = String(orderDetail.dateCreation || "").slice(0, 10);
  const orderDate = dateStr
    ? new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const message = orderDetail.message ||
    `Bonjour ${orderDetail.fournisseur} 👋\n\nCommande du ${orderDate} :\n\n- ${orderDetail.produit} — ${orderDetail.quantite} ${orderDetail.unite}\n\nMerci 🙏\n— Équipe MÖKA`;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-[1.4rem] shadow-xl border border-[#eadfd4] w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black tracking-[0.22em] text-[#a97862] uppercase">Détail commande</div>
            <h2 className="text-lg font-black text-[#3b241b]">{orderDetail.fournisseur}</h2>
            <div className="flex items-center gap-2 mt-1">
              <OrdStatusBadge status={orderDetail.statut} />
              <span className="text-xs text-[#a97862]">{dateStr || "Sans date"} · {orderDetail.staff}</span>
            </div>
          </div>
          <button onClick={() => setOrderDetail(null)} className="w-9 h-9 rounded-full bg-[#f4eee7] flex items-center justify-center font-black text-[#a97862]">×</button>
        </div>
        <div className="bg-[#f7efe4] rounded-[1rem] p-3 mb-4">
          <div className="text-xs font-black text-[#a97862] mb-2">PRODUIT COMMANDÉ</div>
          <div className="text-sm font-bold text-[#3b241b]">{orderDetail.produit} × {orderDetail.quantite} {orderDetail.unite}</div>
        </div>
        <div className="text-xs font-black text-[#a97862] mb-2">MESSAGE</div>
        <div className="bg-[#e8f5e1] rounded-[1rem] p-4 font-mono text-xs text-[#2d5a1b] whitespace-pre-wrap leading-relaxed mb-4">{message}</div>
        <div className="flex gap-2">
          <button onClick={() => {
            const wa = ordGetSupplierWhatsapp(supplier);
            if (wa) window.open(`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-green-50 border border-green-200 text-green-700 font-black text-xs">💬 WhatsApp</button>
          <button onClick={() => navigator.clipboard?.writeText(message).then(() => alert("Copié !"))} className="flex-1 py-3 rounded-[1rem] bg-[#f4eee7] text-[#3b241b] font-black text-xs">📋 Copier</button>
        </div>
      </div>
    </div>
  );
}