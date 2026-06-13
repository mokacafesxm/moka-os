"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

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
  const raw = prep?.name || prep?.action || prep?.produit ||
              prep?.prep || prep?.preparation || prep?.Préparation ||
              prep?.property_action || "Préparation";
  return String(raw).replace(/^Préparer\s+/i, "").trim() || "Préparation";
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

  const [reportsData, setReportsData] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsPeriode, setReportsPeriode] = useState("week");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

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
  const [syncingProductsDb, setSyncingProductsDb] = useState(false);
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
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [adminPinEnabled, setAdminPinEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("mokaAdminEnabled") !== "false";
  });
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaveMsg, setPinSaveMsg] = useState("");
  const [navVisible, setNavVisible] = useState(true);
  const [navCompact, setNavCompact] = useState(false);
  const lastScrollY = useRef(0);
  const [deviceType, setDeviceType] = useState("desktop");
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [lastSync, setLastSync] = useState(new Date());
  const [prepsStation, setPrepsStation] = useState("all");
  const [showNewPrepModal, setShowNewPrepModal] = useState(false);
  const [newPrepForm, setNewPrepForm] = useState({
    produit: "", quantite: 1, unite: "kg", priorite: "Normale",
    station: "Cuisine", dueDate: new Date().toISOString().slice(0, 10), staffName: "",
  });
  const [newPrepSearch, setNewPrepSearch] = useState("");
  const [savingNewPrep, setSavingNewPrep] = useState(false);

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
  const [showMultiPanelModal, setShowMultiPanelModal] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [ordStatusFilter, setOrdStatusFilter] = useState("Tous");
  const [composeCart, setComposeCart] = useState({});
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

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

        setActiveCategory((prev) => prev || list[0]?.category || list[0]?.categorie || "");

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

  const filteredPreps = useMemo(() => {
    if (prepsStation === "all") return preps;
    return preps.filter((p) => {
      const s = String(p.station || p.type || p.category || "").toLowerCase();
      return prepsStation === "bar" ? s.includes("bar") : s.includes("cuisine") || !s.includes("bar");
    });
  }, [preps, prepsStation]);

  const prepsByStatus = useMemo(() => ({
    urgent: filteredPreps.filter((p) =>
      String(getPrepPriority(p)).toLowerCase().includes("haute") &&
      getPrepStatus(p).toLowerCase() === "à faire"
    ),
    todo: filteredPreps.filter((p) =>
      !String(getPrepPriority(p)).toLowerCase().includes("haute") &&
      getPrepStatus(p).toLowerCase() === "à faire"
    ),
    done: filteredPreps.filter((p) => getPrepStatus(p).toLowerCase() === "fait"),
  }), [filteredPreps]);

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
    let filtered = q ? stockProducts : stockProducts.filter((item) => {
      const cat = getStockCategory(item);
      return !activeStockCategory || cat === activeStockCategory;
    });

    if (stockStatusFilter === "critical")
      filtered = filtered.filter(i => String(getStockStatus(i)).toLowerCase().includes("critique"));
    else if (stockStatusFilter === "low")
      filtered = filtered.filter(i => String(getStockStatus(i)).toLowerCase().includes("stock bas"));
    else if (stockStatusFilter === "ok")
      filtered = filtered.filter(i => {
        const s = String(getStockStatus(i)).toLowerCase();
        return !s.includes("critique") && !s.includes("stock bas") && !s.includes("configurer");
      });

    const priorityScore = (item) => {
      const s = String(getStockStatus(item)).toLowerCase();
      if (s.includes("critique")) return 0;
      if (s.includes("stock bas") || s.includes("alerte")) return 1;
      if (s.includes("configurer")) return 3;
      return 2;
    };

    return filtered.sort((a, b) => priorityScore(a) - priorityScore(b));
  }, [stockView, stockPreps, stockProducts, activeStockCategory, stockSearch, stockStatusFilter]);

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
  const ordCriticalCount = stockLive.filter((item) => String(getStockStatus(item)).toLowerCase().includes("critique") && !isPrepaCategory(item)).length;
  const ordACommanderCount = supplierOrders.filter((o) => o.statut === "À commander").length;
  const ordEnvoyeCount = supplierOrders.filter((o) => o.statut === "Envoyé").length;
  const ordSupplierContact = (settingsCache.suppliers || []).find((s) => ordGetSupplierName(s) === ordSelectedSupplier);
  const ordIncludedItems = ordSupplierProducts.filter((p) => composeCart[p.id]?.included);
  const composeCartGroups = useMemo(() => {
    const map = {};
    Object.values(composeCart).forEach((item) => {
      if (!item.included) return;
      const key = item.fournisseurId || item.fournisseurNom || "sans";
      if (!map[key]) {
        map[key] = {
          fournisseurId: item.fournisseurId || null,
          fournisseurNom: item.fournisseurNom || item.fournisseur || "Sans fournisseur",
          supplier: (settingsCache.suppliers || []).find((s) => s.id === item.fournisseurId) || null,
          items: [],
        };
      }
      map[key].items.push(item);
    });
    return Object.values(map);
  }, [composeCart, settingsCache]);
  const composeCartTotal = Object.values(composeCart).filter((i) => i.included).length;
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
    const staffId = getStaffName(member);
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
      showToast("Erreur pointage", "error");
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
      if (!cached || !cached.length) showToast("Erreur chargement paramètres", "error");
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
      showToast("Nom obligatoire", "error");
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
      showToast("Élément créé");
    } catch (error) {
      console.error(error);
      showToast("Erreur création database", "error");
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
      showToast("Modification enregistrée");
    } catch (error) {
      console.error(error);
      showToast("Erreur modification database", "error");
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
      showToast("Élément désactivé");
    } catch (error) {
      console.error(error);
      showToast("Erreur désactivation", "error");
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
      dateCreation: orderValue(order, ["date", "dateCreation", "Date création", "property_date_cr_ation", "property_date_creation"], ""),
      dateEnvoi: orderValue(order, ["dateEnvoi", "date_envoi", "Envoyé le", "property_date_envoi", "property_envoy_le"], ""),
      message: orderValue(order, ["message", "Message envoyé", "property_message_envoy", "property_message_envoye", "commentaire"], ""),
    };
  };

  const markAsSent = async (items) => {
    try {
      await Promise.all((items || []).map((item) =>
        fetch("/api/supplier-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateStatus",
            id: item.id,
            statut: "Envoyé",
            dateSent: new Date().toISOString(),
          }),
        })
      ));
      await loadSupplierOrders();
    } catch (err) {
      console.error("Erreur markAsSent:", err);
    }
  };

  const loadSupplierOrders = async () => {
    setLoadingSupplierOrders(true);
    try {
      const response = await fetch(`/api/supplier-orders?t=${Date.now()}`);

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

  const loadReports = async (periode) => {
    setReportsLoading(true);
    try {
      const p = periode || reportsPeriode;
      const res = await fetch(`/api/reports?period=${p}&t=${Date.now()}`);
      if (!res.ok) throw new Error(`Erreur reports ${res.status}`);
      const data = await res.json();
      setReportsData(data);
    } catch (err) {
      console.error("Erreur rapports:", err);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || adminSection !== "reports") return;
    loadReports(reportsPeriode);
  }, [isAdmin, adminSection]);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const diff = y - lastScrollY.current;
      if (diff > 5) setNavCompact(true);
      else if (diff < -5) setNavCompact(false);
      if (diff > 50) setNavVisible(false);
      else if (diff < -10) setNavVisible(true);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const detect = () => {
      const w = window.innerWidth;
      if (w < 430) setDeviceType("iphone");
      else if (w <= 1024) setDeviceType("ipad");
      else setDeviceType("desktop");
    };
    detect();
    window.addEventListener("resize", detect);
    return () => window.removeEventListener("resize", detect);
  }, []);

  useEffect(() => {
    const poll = () => {
      fetch(STAFF_URL)
        .then(r => r.json())
        .then(data => { const list = normalizeArray(data, "staff"); if (list.length) setStaff(list); })
        .catch(() => {});
      fetch(STOCK_URL)
        .then(r => r.json())
        .then(data => { const fresh = normalizeArray(data, "stock"); setStockLive(fresh); localStorage.setItem("mokaStockCache", JSON.stringify(fresh)); })
        .catch(() => {});
      fetch(PREPS_URL)
        .then(r => r.json())
        .then(data => { const list = normalizeArray(data, "preps"); setPreps(list); localStorage.setItem("mokaPrepsCache", JSON.stringify(list)); })
        .catch(() => {});
      fetch("/api/clock-status")
        .then(r => r.json())
        .then(statuses => { if (Object.keys(statuses).length > 0) setClockStatuses(statuses); })
        .catch(() => {});
      setLastSync(new Date());
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      fetch(STAFF_URL)
        .then(r => r.json())
        .then(data => { const list = normalizeArray(data, "staff"); if (list.length) setStaff(list); })
        .catch(() => {});
      fetch(STOCK_URL)
        .then(r => r.json())
        .then(data => { const fresh = normalizeArray(data, "stock"); setStockLive(fresh); })
        .catch(() => {});
      fetch(PREPS_URL)
        .then(r => r.json())
        .then(data => { const list = normalizeArray(data, "preps"); setPreps(list); })
        .catch(() => {});
      fetch("/api/clock-status")
        .then(r => r.json())
        .then(statuses => { if (Object.keys(statuses).length > 0) setClockStatuses(statuses); })
        .catch(() => {});
      setLastSync(new Date());
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    const newMsg = { role: "user", content: trimmed };
    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/reports/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updated,
          context: reportsData ? {
            stock: reportsData.stock,
            preps: reportsData.preps,
            commandes: reportsData.commandes,
          } : null,
        }),
      });
      if (!res.ok) throw new Error("Erreur chat");
      const { reply } = await res.json();
      setChatMessages([...updated, { role: "assistant", content: reply }]);
    } catch (err) {
      setChatMessages([...updated, { role: "assistant", content: "Désolé, une erreur s'est produite. Réessaie." }]);
    } finally {
      setChatLoading(false);
    }
  };

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

    if (silent) {
      setSyncingProductsDb(true);
    } else if (!cached.length) {
      setLoadingProductsDb(true);
    }

    try {
      const response = await fetch(PRODUCTS_URL);

      if (!response.ok) throw new Error(`Erreur products ${response.status}`);

      const data = await response.json();
      const list = Array.isArray(data) ? data : normalizeArray(data, "products");

      if (silent) {
        const freshJson = JSON.stringify(list);
        const cachedJson = localStorage.getItem("mokaProductsDbCache") || "[]";
        if (freshJson !== cachedJson) {
          setProductsDb(list);
          if (typeof window !== "undefined") {
            localStorage.setItem("mokaProductsDbCache", freshJson);
            localStorage.setItem("mokaProductsDbCacheUpdatedAt", String(Date.now()));
          }
        }
      } else {
        setProductsDb(list);
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaProductsDbCache", JSON.stringify(list));
          localStorage.setItem("mokaProductsDbCacheUpdatedAt", String(Date.now()));
        }
      }
    } catch (error) {
      console.error(error);
      if (!cached.length && !silent) showToast("Erreur chargement base produits", "error");
    } finally {
      setSyncingProductsDb(false);
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
      showToast("Nom ingrédient obligatoire", "error");
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
            fournisseurDefaut: creatingProductDbForm.fournisseurDefaut || "",
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
      setActiveTab("orderpad");
      showToast("Produit ajouté");
      setTimeout(async () => { await loadProductsDatabase(false); await refreshOrderPadProducts(); }, 2500);
    } catch (error) {
      console.error(error);
      showToast("Erreur création produit", "error");
    } finally {
      setSavingProductDb(false);
    }
  };

  const openProductDbEdit = async (item) => {
    // Si l'item vient du stock live, utiliser ingredientId (page INGREDIENTS)
    const correctId = item.ingredientId && item.ingredientId !== item.id
      ? item.ingredientId
      : item.id;

    let suppliersList = [];
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "suppliers", action: "list" }),
      });
      suppliersList = await res.json();
      if (suppliersList?.length) {
        setSettingsCache((prev) => {
          const next = { ...prev, suppliers: suppliersList };
          if (typeof window !== "undefined") localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
          return next;
        });
      }
    } catch {}

    const supplierName = String(
      item.fournisseurDefaut || item.supplier || item.fournisseurDefautName || ""
    ).trim().toLowerCase();

    const resolvedSupplierId = suppliersList.find((s) => {
      const sName = String(s.nom || s.name || s.fournisseur || "")
        .trim().toLowerCase();
      return sName === supplierName;
    })?.id || "";

    console.log("🔵 supplier match:", supplierName, "→", resolvedSupplierId, "| correctId:", correctId);

    setEditingProductDb(item);
    setEditingProductDbForm({
      id: correctId || "",
      ingredient: item.ingredient || item.name || "",
      categorie: item.categorie || item.category || "",
      sousCategorie: item.sousCategorie || item.subcategory || "",
      visibleOrderPad: item.visibleOrderPad !== false,
      fournisseurDefaut: item.fournisseurDefaut || item.supplier || "",
      fournisseurId: resolvedSupplierId,
      zoneStockage: item.zoneStockage || item.zone || "",
      methodeSuivi: item.methodeSuivi || "",
      quantiteCommandeSuggeree: item.quantiteCommandeSuggeree || item.suggested || 0,
      uniteStock: item.uniteStock || item.unit || "",
      uniteCommande: item.uniteCommande || "",
      portionGrammes: item.portionGrammes || item.portion || 0,
      seuilAlerte: item.seuilAlerte || 0,
      seuilCritique: item.seuilCritique || 0,
      notes: item.notes || "",
      utiliseDans: item.utiliseDans || "",
    });
  };


  const saveProductDbEdit = async () => {
    console.log("💾 saveProductDbEdit", { id: editingProductDbForm.id, ingredient: editingProductDbForm.ingredient, fournisseurId: editingProductDbForm.fournisseurId, fournisseurDefaut: editingProductDbForm.fournisseurDefaut });
    if (!editingProductDbForm.id) {
      showToast("ID produit manquant", "error");
      return;
    }

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
            fournisseurDefaut: editingProductDbForm.fournisseurDefaut || "",
            fournisseurId: editingProductDbForm.fournisseurId || "",
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

      const resText = await response.text();
      console.log("💾 saveProductDbEdit — réponse:", response.status, resText.slice(0, 200));
      if (!response.ok) throw new Error(`Erreur update ${response.status}: ${resText.slice(0, 200)}`);

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
      showToast("Produit modifié");
      setTimeout(async () => { await loadProductsDatabase(false); await refreshOrderPadProducts(); }, 2500);
    } catch (error) {
      console.error(error);
      showToast("Erreur modification produit", "error");
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

      showToast("Produit supprimé");
    } catch (error) {
      console.error(error);
      showToast("Erreur suppression produit", "error");
    }
  };

  const unlockAdmin = () => {
    const adminEnabled = localStorage.getItem("mokaAdminEnabled") !== "false";
    if (!adminEnabled) { showToast("Mode admin désactivé", "error"); return; }
    const savedPin = localStorage.getItem("mokaPinCode") || "3578";
    if (adminPin === savedPin) {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminPin("");
      showToast("Mode admin activé");
    } else {
      showToast("Code admin incorrect", "error");
    }
  };

  const openSettings = async (item) => {
    if (!isAdmin) {
      setShowAdminModal(true);
      return;
    }

    // Cherche le produit correspondant dans productsDb pour avoir les vraies données INGREDIENTS
    const enriched = productsDb.find((p) =>
      p.id === item.id ||
      p.id === item.ingredientId ||
      (p.ingredient || p.name || "").toLowerCase() === (item.name || item.ingredient || "").toLowerCase()
    );

    // Utilise les données enrichies si trouvées
    const itemToEdit = enriched ? { ...enriched, id: enriched.id } : item;

    // Appelle openProductDbEdit avec les bonnes données
    await openProductDbEdit(itemToEdit);
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
      showToast("ID produit introuvable", "error");
      return;
    }

    if (isNewProduct && !String(settingsForm.name || "").trim()) {
      showToast("Nom produit obligatoire", "error");
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

      showToast(isNewProduct ? "Produit créé" : "Réglages mis à jour");
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

      setTimeout(async () => { await loadProductsDatabase(false); await refreshOrderPadProducts(); }, 2500);

      if (isNewProduct) {
        setActiveTab("orderpad");
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      showToast(!isNewProduct ? "Affichage mis à jour (webhook lent)" : "Erreur : produit non créé", !isNewProduct ? "warning" : "error");
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

        const matchesSearch = !q || [
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
        ].join(" ").toLowerCase().includes(q);

        return matchesCategory && matchesSearch;
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
    return (settingsCache.suppliers || [])
      .map((s) => ({ id: s.id || "", name: s.nom || s.name || s.fournisseur || "" }))
      .filter((s) => s.id && s.name);
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
    setTimeout(() => {
      document.getElementById("stockReceiveInput")?.focus();
    }, 100);
  };

  const saveStockReceive = async () => {
    if (!stockReceiveItem) return;

    if (!stockReceiveWeight) {
      showToast("Entre la quantité", "error");
      return;
    }

    setSavingStockReceive(true);

    try {
      const response = await fetch(STOCK_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: stockReceiveItem.id,
          poidsTotal: Number(stockReceiveWeight),
          mode: stockReceiveMode,
          Unite: stockReceiveUnit || stockReceiveItem.uniteStock || stockReceiveItem.unit || "kg",
        }),
      });

      if (!response.ok) throw new Error(`Erreur réception stock ${response.status}`);

      setStockReceiveItem(null);
      setStockReceiveWeight("");
      showToast(stockReceiveMode === "replace" ? "Stock corrigé" : "Stock reçu ajouté");

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
      showToast("Erreur ajout réception stock", "error");
    } finally {
      setSavingStockReceive(false);
    }
  };

  const saveInventoryAdjust = async () => {
    if (!inventoryItem) return;

    if (!inventoryWeight) {
      showToast("Entre un poids total mesuré", "error");
      return;
    }

    setSavingInventory(true);

    try {
      const response = await fetch(STOCK_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inventoryItem.id,
          poidsTotal: Number(inventoryWeight),
          mode: "replace",
          Unite: inventoryUnit,
        }),
      });

      if (!response.ok) throw new Error(`Erreur stock update ${response.status}`);

      setInventoryItem(null);
      setInventoryWeight("");
      showToast("Stock mis à jour");

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
      showToast("Erreur mise à jour stock", "error");
    } finally {
      setSavingInventory(false);
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const MAX = 800;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
              if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
              else { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement("canvas");
            canvas.width = w || 800;
            canvas.height = h || 600;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
            if (dataUrl && dataUrl.length > 100) {
              resolve(dataUrl.split(",")[1]);
            } else {
              // Fallback : envoie l'image originale sans compression
              resolve(e.target.result.split(",")[1]);
            }
          } catch {
            // Fallback Safari : image originale
            resolve(e.target.result.split(",")[1]);
          }
        };
        img.onerror = () => resolve(e.target.result.split(",")[1]);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
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
      const stockNames = [
        ...productsDb.map(p => p.ingredient || p.name || ""),
        ...stockLive.map(p => getStockName(p))
      ].filter(Boolean).slice(0, 200);

      const formData = new FormData();
      formData.append("base64", base64);
      formData.append("mediaType", mediaType || "image/jpeg");
      formData.append("stockNames", JSON.stringify(stockNames));

      const response = await fetch("/api/analyze-invoice", {
        method: "POST",
        body: formData,
      });

      console.log("🟢 Status:", response.status);
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const parsed = data.results || [];

      const fuzzyMatch = (search, list, getField) => {
        const s = search.toLowerCase().trim();
        if (!s) return null;
        let found = list.find(p => getField(p).toLowerCase().trim() === s);
        if (found) return found;
        found = list.find(p => {
          const n = getField(p).toLowerCase().trim();
          return n.includes(s) || s.includes(n);
        });
        if (found) return found;
        const words = s.split(/\s+/).filter(w => w.length >= 4);
        found = list.find(p => {
          const n = getField(p).toLowerCase();
          return words.some(w => n.includes(w));
        });
        return found || null;
      };

      const results = parsed.map((item) => {
        const nameStock = String(item.name_stock || "").trim();
        const nameFacture = String(item.name_facture || item.name || "").trim();
        const getDbName = p => String(p.ingredient || p.name || "");
        const getStockLiveName = p => String(getStockName(p));
        let matched = null;
        if (nameStock) {
          matched = fuzzyMatch(nameStock, productsDb, getDbName) ||
                    fuzzyMatch(nameStock, stockLive, getStockLiveName);
        }
        if (!matched && nameFacture) {
          matched = fuzzyMatch(nameFacture, productsDb, getDbName) ||
                    fuzzyMatch(nameFacture, stockLive, getStockLiveName);
        }
        return {
          ...item,
          name: nameFacture || nameStock,
          matched,
          include: item.confidence === "high" && !!matched,
        };
      });
      setInvoiceResults(results);
    } catch (err) {
      console.error("❌ Erreur:", err);
      showToast("Erreur : " + err.message, "error");
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
      showToast(`${toSave.length} produit(s) ajouté(s) au stock`);
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
      showToast("Erreur enregistrement stock", "error");
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
      showToast("Sélectionne un membre du staff avant d’envoyer", "error");
      return;
    }

    setSending(true);

    try {
      if (activeTab === "stock") {
        const payload = cartItems
          .filter((item) => item.type === "stock-prep")
          .map((item) => ({
            id: item.id,
            produit: getStockName(item),
            quantite: item.suggested || item.quantitePrep || item.qty || 1,
            unite: item.unit || item.uniteStock || "kg",
            priorite: (() => {
              const status = String(getStockStatus(item)).toLowerCase();
              if (status.includes("critique")) return "Haute";
              if (status.includes("stock bas") || status.includes("alerte")) return "Normale";
              return "Normale";
            })(),
            statut: "À faire",
            staffName: getStaffName(staff.find((s) =>
              (s.id || getStaffName(s)) === selectedStaff
            )) || selectedStaffName || "",
            staffId: selectedStaff || "",
            source: "Stock Live",
            dueDate: selectedDueDate || new Date().toISOString().slice(0, 10),
            datePrevue: selectedDueDate || new Date().toISOString().slice(0, 10),
            date: new Date().toISOString(),
          }));

        const response = await fetch(CREATE_PREP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);

        setCart({});
        loadPreps();
        showToast("Préparation ajoutée");
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
        showToast("Préparation confirmée");
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
      showToast("Commande envoyée vers MOKA-OS");
    } catch (error) {
      console.error(error);
      showToast("Erreur : la commande n'a pas été envoyée", "error");
    } finally {
      setSending(false);
    }
  };

  const isIphone = deviceType === "iphone";
  const isIpad = deviceType === "ipad";

  const renderPrepCard = (prep) => {
    const id = prep.id || getPrepName(prep);
    const selected = !!cart[id];
    const qty = getPrepQuantity(prep);
    const unit = getPrepUnit(prep);
    const status = getPrepStatus(prep);
    const priority = getPrepPriority(prep);
    const isUrgent = String(priority).toLowerCase().includes("urgent") || String(priority).toLowerCase().includes("haute");

    return (
      <div key={id} className={`rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer active:scale-[0.98] ${
        selected ? "bg-[#4a6620] text-white border-[#4a6620] shadow-xl ring-2 ring-[#5a7828]/40"
                 : "bg-white text-[#2c1a10] border-[#e5d5c5] hover:shadow-lg hover:border-[#c8b8a8]"
      }`}>
        {isUrgent && <div className="h-1.5 bg-gradient-to-r from-orange-500 to-amber-400" />}
        <button onClick={() => selected ? removeItem(id) : addPrep(prep)} className="w-full text-left p-4 cursor-pointer">
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
              {prep.assignedTo && <div className={`text-[10px] mt-0.5 ${selected ? "text-white/60" : "text-[#9a7060]"}`}>→ {prep.assignedTo}</div>}
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
              {selected ? <><svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Ajouté</> : "Toucher pour ajouter"}
            </span>
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${
              selected ? "bg-white/20" : "bg-[#f0f7e5] text-[#5a7828] border border-[#c8dfa0]"
            }`}>
              {selected
                ? <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
              }
            </span>
          </div>
        </button>
        {isAdmin && (
          <button onClick={() => openSettings(prep)} className={`flex w-full items-center gap-1.5 px-4 pb-3 text-[10px] font-bold text-left cursor-pointer transition-colors ${
            selected ? "text-white/60 hover:text-white" : "text-[#9a7060] hover:text-[#2c1a10]"
          }`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            Réglages
          </button>
        )}
      </div>
    );
  };

  const prepProducts = useMemo(() => {
    return productsDb
      .filter(p => {
        const cat = String(p.categorie || p.category || "").trim();
        const subcat = String(p.sousCategorie || p.subcategory || "").trim();
        if (cat !== "PREPA") return false;
        if (newPrepForm.station === "Bar") return subcat === "BAR";
        if (newPrepForm.station === "Cuisine") return subcat === "CUISINE";
        return true;
      })
      .sort((a, b) =>
        String(a.ingredient || a.name || "").localeCompare(String(b.ingredient || b.name || ""), "fr")
      );
  }, [productsDb, newPrepForm.station]);

  return (
    <main
      className="min-h-screen bg-[#f5ede0] text-[#1a1008]"
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)",
      }}
    >

      {/* ── HEADER ─────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#f5ede0]/96 backdrop-blur-md border-b border-[#ddc9b5] px-4 pb-2.5 shadow-sm" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3">

          {/* Brand gauche */}
          <div className="flex items-center gap-2 shrink-0">
            <div className={`rounded-2xl bg-[#2c1a10] flex items-center justify-center shadow-md ${isIphone ? "w-8 h-8" : "w-10 h-10"}`}>
              <svg viewBox="0 0 24 24" fill="none" className={`text-[#f5ede0] ${isIphone ? "w-4 h-4" : "w-5 h-5"}`} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                <line x1="6" x2="6" y1="2" y2="4"/>
                <line x1="10" x2="10" y1="2" y2="4"/>
                <line x1="14" x2="14" y1="2" y2="4"/>
              </svg>
            </div>
            {!isIphone && (
              <div>
                <div className="font-black text-[#2c1a10] text-base leading-none tracking-tight">MÖKA</div>
                <div className="text-[10px] text-[#9a7060] tracking-[0.25em] uppercase mt-0.5">Order Pad</div>
                <div className="text-[9px] text-[#9a7060]">
                  Sync {lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Puerto_Rico" })}
                </div>
              </div>
            )}
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
              // Charge les statuts du jour depuis Notion
              fetch("/api/clock-status")
                .then(r => r.json())
                .then(statuses => {
                  if (Object.keys(statuses).length > 0) setClockStatuses(statuses);
                })
                .catch(() => {});
            }}
            className={`relative rounded-xl bg-white border-2 border-[#e85d8a] text-[#e85d8a] font-black text-sm shadow-sm ring-2 ring-[#e85d8a]/25 hover:bg-[#fff0f5] transition-all cursor-pointer flex items-center gap-2 ${isIphone ? "h-9 px-2.5" : "h-10 px-4"}`}
          >
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#e85d8a] animate-ping opacity-75" />
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M9.5 2.5h5"/><path d="M12 2v2.5"/>
            </svg>
            {!isIphone && "Pointage"}
          </button>

          {/* Admin droite + Paramètres iPhone groupés */}
          <div className="flex items-center gap-1.5">
            {isAdmin && isIphone && (
              <button
                onClick={() => setAdminSection("settings")}
                className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                  adminSection === "settings"
                    ? "bg-[#5a7828] text-white border-[#5a7828]"
                    : "bg-white text-[#6b4a3d] border-[#e5d5c5]"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"/>
                  <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/>
                </svg>
              </button>
            )}
            <button
            onClick={() => {
              if (isAdmin) {
                setIsAdmin(false);
                setAdminSection("dashboard");
                showToast("Mode admin désactivé", "warning");
              } else {
                setShowAdminModal(true);
              }
            }}
            className={`rounded-xl font-bold text-xs border shadow-sm active:scale-95 transition-all flex items-center gap-2 cursor-pointer ${isIphone ? "h-9 px-2.5" : "h-10 px-3.5"} ${
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
            {!isIphone && <span>{isAdmin ? "Admin ON" : "Admin"}</span>}
          </button>
          </div>
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
            className={`${isIphone ? "h-8 px-3 text-[11px]" : "h-10 px-4 text-xs"} rounded-xl font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
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
            className={`${isIphone ? "h-8 px-3 text-[11px]" : "h-10 px-4 text-xs"} rounded-xl font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
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
            className={`${isIphone ? "h-8 px-3 text-[11px]" : "h-10 px-4 text-xs"} rounded-xl font-bold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 cursor-pointer ${
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
            (isAdmin && adminSection !== "dashboard" && ["products", "inventory", "settings", "orders", "reports"].includes(adminSection)) || isIphone
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

                      {/* Status filter pills */}
                      {stockView === "stock" && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {[
                            ["all", "Tout", null],
                            ["critical", "🔴 Critiques", stockKpis.critical],
                            ["low", "🟠 Bas", stockKpis.alert],
                            ["ok", "🟢 OK", null],
                          ].map(([val, label, count]) => (
                            <button key={val}
                              onClick={() => setStockStatusFilter(val)}
                              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                                stockStatusFilter === val
                                  ? "bg-[#2c1a10] text-white shadow-md"
                                  : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
                              }`}>
                              {label}
                              {count > 0 && (
                                <span className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center ${
                                  stockStatusFilter === val ? "bg-white/20" : "bg-[#f0e8dc]"
                                }`}>
                                  {count}
                                </span>
                              )}
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

                          {isIphone && stockView === "stock" ? (
                            /* ── iPhone compact list view ── */
                            <div className="space-y-2">
                              {items.map((item) => {
                                const stockId = item.id || getStockName(item);
                                const status = getStockStatus(item);
                                const isCritical = String(status).toLowerCase().includes("critique");
                                const isLow = String(status).toLowerCase().includes("stock bas");
                                return (
                                  <div key={stockId}
                                    onClick={() => openStockReceive(item, "add")}
                                    className={`flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border transition-all active:scale-[0.98] cursor-pointer ${
                                      isCritical ? "border-l-4 border-l-red-400 border-[#fde8e8]" :
                                      isLow ? "border-l-4 border-l-orange-400 border-[#fef3e2]" :
                                      "border-[#e5d5c5]"
                                    }`}
                                  >
                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                      isCritical ? "bg-red-500" :
                                      isLow ? "bg-orange-400" :
                                      String(status).toLowerCase().includes("configurer") ? "bg-gray-300" :
                                      "bg-[#5a7828]"
                                    }`}/>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-black text-[#2c1a10] truncate">{getStockName(item)}</div>
                                      <div className="text-[10px] text-[#9a7060] font-medium">
                                        {getStockCategory(item)}{item.sousCategorie ? ` · ${item.sousCategorie}` : ""}
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className={`text-base font-black ${isCritical ? "text-red-600" : isLow ? "text-orange-500" : "text-[#2c1a10]"}`}>
                                        {getStockQty(item) || "—"}
                                        <span className="text-xs font-semibold text-[#9a7060] ml-0.5">{getStockDisplayUnit(item)}</span>
                                      </div>
                                      {!String(status).toLowerCase().includes("configurer") && (
                                        <div className={`text-[9px] font-bold ${isCritical ? "text-red-500" : isLow ? "text-orange-400" : "text-[#5a7828]"}`}>
                                          {isCritical ? "CRITIQUE" : isLow ? "BAS" : "OK"}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openStockReceive(item, "add"); }}
                                      className="w-9 h-9 rounded-xl bg-[#f0f7e5] border border-[#c8dfa0] flex items-center justify-center shrink-0 active:bg-[#e0f0d0] cursor-pointer"
                                    >
                                      <svg className="w-4 h-4 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                      </svg>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* ── iPad / desktop card grid ── */
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
                                    <div className={`h-1.5 ${isCritical ? "bg-gradient-to-r from-red-600 to-red-400" : isLow ? "bg-gradient-to-r from-orange-500 to-amber-400" : selected ? "bg-white/30" : "bg-gradient-to-r from-[#5a7828] to-[#7aa830]"}`} />
                                    <div className="p-4">
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
                                          <button type="button" onClick={(e) => { e.stopPropagation(); openStockReceive(item, "add"); }}
                                            className="flex-1 rounded-xl bg-[#f0f7e5] border border-[#c8dfa0] px-3 py-2.5 text-left hover:bg-[#e5f0d5] transition-colors cursor-pointer flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 text-[#5a7828] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
                                            <div><div className="text-[10px] font-bold text-[#5a7828] uppercase tracking-wide">Réception</div><div className="text-xs font-black text-[#2c1a10]">Ajouter du stock</div></div>
                                          </button>
                                          <button type="button" onClick={(e) => { e.stopPropagation(); openStockReceive(item, "replace"); }}
                                            className="rounded-xl bg-[#faf5ef] border border-[#e5d5c5] px-3 py-2.5 hover:bg-[#f0e8dc] transition-colors cursor-pointer flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide whitespace-nowrap">Corriger</div>
                                          </button>
                                        </div>
                                      ) : (
                                        <div className={`flex items-center justify-between text-xs font-semibold ${selected ? "text-white/70" : "text-[#9a7060]"}`}>
                                          <span className="flex items-center gap-1">
                                            {selected ? (<><svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Sélectionné</>) : "Toucher pour préparer"}
                                          </span>
                                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-sm ${selected ? "bg-white/20" : "bg-[#f0f7e5] border border-[#c8dfa0]"}`}>
                                            {selected ? (<svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>) : (<svg className="w-4 h-4 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
              <div className="space-y-4">
                {/* Toggle Bar / Cuisine */}
                <div className="flex bg-white rounded-2xl p-1 border border-[#e5d5c5] shadow-sm gap-1">
                  {[["all", "🍽️ Tout"], ["bar", "☕ Bar"], ["cuisine", "👨‍🍳 Cuisine"]].map(([val, label]) => (
                    <button key={val} onClick={() => setPrepsStation(val)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all ${
                        prepsStation === val ? "bg-[#2c1a10] text-white shadow-md" : "text-[#9a7060] hover:bg-[#faf5ef]"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>

                {loadingPreps ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-[#9a7060] border border-[#e5d5c5] shadow-sm">
                    <div className="flex justify-center mb-3">
                      <svg className="w-8 h-8 text-[#c8a882] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    </div>
                    <div className="font-semibold text-sm">Chargement des préparations…</div>
                  </div>
                ) : (
                  <>
                    {/* Urgentes */}
                    {prepsByStatus.urgent.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-xs font-black text-red-600 uppercase tracking-wide">Urgent — {prepsByStatus.urgent.length}</span>
                          <div className="flex-1 h-px bg-red-100" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {prepsByStatus.urgent.map((prep) => renderPrepCard(prep))}
                        </div>
                      </div>
                    )}

                    {/* À faire */}
                    {prepsByStatus.todo.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-black text-[#2c1a10] uppercase tracking-wide">À faire — {prepsByStatus.todo.length}</span>
                          <div className="flex-1 h-px bg-[#e5d5c5]" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {prepsByStatus.todo.map((prep) => renderPrepCard(prep))}
                        </div>
                      </div>
                    )}

                    {/* Faites */}
                    {prepsByStatus.done.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-[#9a7060] uppercase tracking-wide">✅ Faites — {prepsByStatus.done.length}</span>
                          <div className="flex-1 h-px bg-[#e5d5c5]" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 opacity-60">
                          {prepsByStatus.done.map((prep) => renderPrepCard(prep))}
                        </div>
                      </div>
                    )}

                    {/* Empty */}
                    {filteredPreps.length === 0 && (
                      <div className="bg-white rounded-2xl p-12 text-center border border-[#e5d5c5] shadow-sm">
                        <div className="text-4xl mb-3">✅</div>
                        <div className="font-black text-[#2c1a10]">Tout est prêt !</div>
                        <div className="text-sm text-[#9a7060] mt-1">
                          Aucune prépa en attente{prepsStation !== "all" ? ` au ${prepsStation}` : ""}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          {/* ── CART / ASIDE ─────────────────────────── */}
          <aside className={`col-span-12 sm:col-span-4 xl:col-span-3 ${isIphone || (activeTab === "stock" && stockView === "stock") || (isAdmin && adminSection !== "dashboard" && ["products", "inventory", "settings", "orders", "reports"].includes(adminSection)) ? "hidden" : ""}`}>
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

      {/* ── NOUVELLE PRÉPA FAB ──────────────────────── */}
      {activeTab === "preps" && (
        <button
          onClick={async () => {
            const prepCount = productsDb.filter(p =>
              String(p.categorie || p.category || "").toUpperCase() === "PREPA"
            ).length;
            if (prepCount === 0) {
              try {
                const res = await fetch(PRODUCTS_URL + "?t=" + Date.now());
                const data = await res.json();
                const list = Array.isArray(data) ? data : data?.products || [];
                if (list.length > 0) {
                  setProductsDb(list);
                  localStorage.setItem("mokaProductsDbCache", JSON.stringify(list));
                }
              } catch {}
            }
            setNewPrepForm(prev => ({
              ...prev,
              staffName: selectedStaffName || "",
              station: prepsStation === "bar" ? "Bar" : "Cuisine",
            }));
            setShowNewPrepModal(true);
          }}
          className="fixed z-40 flex items-center gap-2 px-4 py-3 bg-[#5a7828] text-white rounded-2xl shadow-xl font-black text-sm cursor-pointer active:scale-95 transition-transform"
          style={{ bottom: `calc(env(safe-area-inset-bottom) + 80px)`, right: "16px" }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouvelle prépa
        </button>
      )}

      {/* ── MOBILE CART FAB (iPhone) ─────────────────── */}
      {isIphone && cartItems.length > 0 && !showMobileCart && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[#5a7828] text-white shadow-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{cartItems.length}</span>
        </button>
      )}

      {/* ── MOBILE CART DRAWER (iPhone) ──────────────── */}
      {isIphone && showMobileCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="flex-1 bg-black/50" onClick={() => setShowMobileCart(false)} />
          <div className="bg-white rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="w-10 h-1 bg-[#e5d5c5] rounded-full mx-auto mt-3 mb-1" />
            {/* Cart header */}
            <div className="px-4 py-3 border-b border-[#f0e8dc] bg-[#faf5ef] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[#2c1a10] flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                </div>
                <div className="text-sm font-black text-[#2c1a10]">
                  {activeTab === "stock" ? "Envoyer en prépa" : activeTab === "preps" ? "Confirmer la prépa" : "Action du jour"}
                </div>
              </div>
              <button onClick={() => setShowMobileCart(false)} className="w-7 h-7 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#6b4a3d] cursor-pointer">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Staff selector */}
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Membre du staff</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-3 py-2.5 text-sm font-semibold text-[#2c1a10] outline-none cursor-pointer"
                >
                  <option value="">Sélectionner…</option>
                  {staff.map((member) => (
                    <option key={member.id || getStaffName(member)} value={member.id || getStaffName(member)}>
                      {getStaffName(member)}
                    </option>
                  ))}
                </select>
              </div>
              {/* Cart items */}
              <div>
                {cartItems.length > 0 && (
                  <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Sélection</span>
                    <span className="bg-[#2c1a10] text-[#f5ede0] rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-black">{cartItems.length}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2 items-center px-3 py-2.5 rounded-xl bg-[#faf5ef] border border-[#ede0d0]">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-[#2c1a10] truncate">{item.name}</div>
                        <div className="text-[10px] text-[#9a7060]">{item.type === "prep" ? "Préparation interne" : getSupplier(item)}</div>
                      </div>
                      <div className="text-xs font-black text-[#4a6620] whitespace-nowrap shrink-0 bg-[#f0f7e5] px-2 py-0.5 rounded-md border border-[#c8dfa0]">{item.qty} {item.unit}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Send button */}
              <button
                onClick={() => { sendToMokaOS(); setShowMobileCart(false); }}
                disabled={cartItems.length === 0 || sending}
                className={`w-full py-3.5 rounded-xl text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  cartItems.length === 0
                    ? "bg-[#ede0d4] text-[#b09080] cursor-not-allowed"
                    : "bg-[#2c1a10] text-[#f5ede0] shadow-lg hover:bg-[#1e100a] active:scale-[0.98]"
                }`}
              >
                {sending ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Envoi…</>
                ) : activeTab === "stock" ? (
                  <>Envoyer en préparation</>
                ) : activeTab === "preps" ? (
                  <>Confirmer comme fait</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Envoyer vers MOKA-OS</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN PANEL (fullscreen overlay) ────────── */}
      {isAdmin && adminSection !== "dashboard" && (
        <div className="fixed inset-0 z-40 bg-[#f5ede0] overflow-y-auto">
          {/* Admin panel header */}
          <div className="sticky top-0 z-10 bg-[#f5ede0]/95 backdrop-blur border-b border-[#e5d5c5] px-4 pb-3" style={{ paddingTop: "env(safe-area-inset-top)" }}>
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
                  <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">MÖKA OS · Admin</div>
                  <h1 className="text-xl font-black text-[#2c1a10] leading-tight">
                    {adminSection === "dashboard" && "Dashboard"}
                    {adminSection === "orders" && "Commandes"}
                    {adminSection === "reports" && "Rapports & IA"}
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
              <><div className="h-2" /><div className="bg-white rounded-2xl border border-[#e5d5c5] shadow-sm overflow-hidden" style={{height: "calc(100vh - 100px)"}}>
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

                <div className="text-[11px] font-semibold text-[#9a7060] px-3 py-1.5 border-b border-[#f0e8dc] flex items-center gap-2">
                  {loadingProductsDb ? "Chargement…" : `${filteredProductsDb.length} produit${filteredProductsDb.length > 1 ? "s" : ""}`}
                  {syncingProductsDb && !loadingProductsDb && (
                    <span className="text-[10px] text-[#9a7060] animate-pulse">Synchronisation…</span>
                  )}
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
              </div></>
            )}

            {/* INVENTORY PANEL */}
            {adminSection === "inventory" && (
              <div className="space-y-4">
                <div className="h-2" />
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
                          onClick={() => showToast("Bientôt : photo Z de caisse + IA décompte ventes", "warning")}
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
                <div className="flex justify-end">
                  <button onClick={loadSupplierOrders} className="rounded-full bg-white border border-[#eadfd4] px-3 py-2 text-xs font-black text-[#6b4a3d]">
                    {loadingSupplierOrders ? "Chargement…" : "↻"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => { setActiveTab("stock"); }} className="rounded-[1.1rem] bg-red-50 border border-red-100 p-3 shadow-sm text-left cursor-pointer hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <div className="text-[11px] font-black text-red-600">Critiques</div>
                    </div>
                    <div className="text-2xl font-black text-red-600">{ordCriticalCount}</div>
                    <div className="text-[10px] text-red-400 mt-0.5">produits stock</div>
                  </button>
                  <button onClick={() => { setOrderView("history"); setOrdStatusFilter("À commander"); }} className="rounded-[1.1rem] bg-orange-50 border border-orange-100 p-3 shadow-sm text-left cursor-pointer hover:bg-orange-100 transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                      <div className="text-[11px] font-black text-orange-500">À commander</div>
                    </div>
                    <div className="text-2xl font-black text-orange-500">{ordACommanderCount}</div>
                    <div className="text-[10px] text-orange-400 mt-0.5">commandes en attente</div>
                  </button>
                  <button onClick={() => { setOrderView("history"); setOrdStatusFilter("Envoyé"); }} className="rounded-[1.1rem] bg-[#f0f7e5] border border-[#c8dfa0] p-3 shadow-sm text-left cursor-pointer hover:bg-[#e4f2d4] transition-colors">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#5a7828] shrink-0" />
                      <div className="text-[11px] font-black text-[#5a7828]">Envoyées</div>
                    </div>
                    <div className="text-2xl font-black text-[#5a7828]">{ordEnvoyeCount}</div>
                    <div className="text-[10px] text-[#7a9840] mt-0.5">commandes envoyées</div>
                  </button>
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
                    {composeCartTotal > 0 && (
                      <div className="text-xs font-bold text-[#6f8f32] bg-[#f0f7e8] border border-[#c5dfa0] rounded-xl px-3 py-2">
                        {composeCartGroups.length} fournisseur{composeCartGroups.length > 1 ? "s" : ""} · {composeCartTotal} produit{composeCartTotal > 1 ? "s" : ""} sélectionné{composeCartTotal > 1 ? "s" : ""}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-black text-[#a97862] mb-2">Sélectionner un fournisseur</div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {(settingsCache.suppliers || []).map((s) => {
                          const name = ordGetSupplierName(s);
                          const count = Object.values(composeCart).filter((i) => i.included && (i.fournisseurId === s.id || i.fournisseurNom === name)).length;
                          return (
                            <button key={s.id || name} onClick={() => setOrdSelectedSupplier(name)} className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition flex items-center gap-1.5 ${ordSelectedSupplier === name ? "bg-[#6f8f32] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
                              {name}
                              {count > 0 && <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black ${ordSelectedSupplier === name ? "bg-white/30 text-white" : "bg-[#6f8f32] text-white"}`}>{count}</span>}
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
                              <OrdToggle checked={item.included} onChange={(v) => setComposeCart((prev) => ({ ...prev, [p.id]: { ...item, included: v, fournisseurId: ordSupplierContact?.id || null, fournisseurNom: ordSelectedSupplier } }))} />
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
                    <button onClick={() => setShowMultiPanelModal(true)} disabled={composeCartTotal === 0} className="w-full py-4 rounded-[1rem] bg-[#6f8f32] text-white font-black shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                      📦 Préparer les commandes ({composeCartGroups.length} fournisseur{composeCartGroups.length > 1 ? "s" : ""})
                    </button>
                  </div>
                )}

                {orderView === "history" && (() => {
                  const formatDateSXM = (d) => {
                    if (!d) return "—";
                    const dt = new Date(d);
                    if (isNaN(dt)) return "—";
                    return dt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Puerto_Rico" });
                  };
                  const groupByMonth = (orders) => {
                    const groups = {};
                    orders.forEach((order) => {
                      const d = new Date(order.dateCreation || order.dateEnvoi || "");
                      const key = isNaN(d) ? "Sans date" : d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "America/Puerto_Rico" });
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(order);
                    });
                    return Object.entries(groups).sort(([a], [b]) => {
                      if (a === "Sans date") return 1;
                      if (b === "Sans date") return -1;
                      return new Date("1 " + b) - new Date("1 " + a);
                    });
                  };
                  const grouped = groupByMonth(ordFilteredOrders);
                  return (
                    <div className="space-y-1">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {["Tous", "À commander", "Envoyé", "Reçu", "Annulé"].map((s) => (
                          <button key={s} onClick={() => setOrdStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition ${ordStatusFilter === s ? "bg-[#6f8f32] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-[#a97862] font-bold pb-1">{ordFilteredOrders.length} commande{ordFilteredOrders.length !== 1 ? "s" : ""}</div>
                      {grouped.map(([mois, orders]) => (
                        <div key={mois}>
                          <div className="text-xs font-black text-[#9a7060] uppercase tracking-wide px-1 py-2 mt-3 first:mt-0">{mois}</div>
                          <div className="space-y-2">
                            {orders.map((order) => (
                              <div key={order.id} className="bg-white rounded-[1.1rem] border border-[#eadfd4] shadow-sm overflow-hidden">
                                <div className="px-4 py-3 flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <OrdStatusBadge status={order.statut} />
                                      <span className="text-[11px] text-[#a97862]">{formatDateSXM(order.dateCreation || order.dateEnvoi)}</span>
                                    </div>
                                    <div className="font-black text-sm text-[#3b241b] truncate">{order.produit}</div>
                                    <div className="text-[11px] text-[#a97862] mt-0.5 truncate">{order.fournisseur}</div>
                                  </div>
                                  <button onClick={() => setOrderDetail(order)} className="shrink-0 text-xs font-black text-[#6f8f32] border border-[#6f8f32] px-3 py-1.5 rounded-xl cursor-pointer">
                                    Détail →
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

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

                {showMultiPanelModal && (
                  <OrdMultiPanelModal
                    groups={composeCartGroups}
                    onClose={() => setShowMultiPanelModal(false)}
                    onAllSent={async () => {
                      setShowMultiPanelModal(false);
                      setComposeCart({});
                      setOrdSelectedSupplier("");
                      await loadSupplierOrders();
                      setOrderView("history");
                    }}
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
              <div className="space-y-4">
                <div className="h-2" />
                {/* Period selector */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-xl font-black text-[#2c1a10]">Rapports</div>
                    <p className="text-xs text-[#9a7060] mt-0.5">Données live depuis Notion</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {["today", "week", "month"].map((p) => (
                      <button
                        key={p}
                        onClick={() => { setReportsPeriode(p); loadReports(p); }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          reportsPeriode === p
                            ? "bg-[#2c1a10] text-[#f5ede0]"
                            : "bg-white border border-[#e5d5c5] text-[#6b4a3d] hover:border-[#2c1a10]"
                        }`}
                      >
                        {p === "today" ? "Aujourd'hui" : p === "week" ? "Cette semaine" : "Ce mois"}
                      </button>
                    ))}
                    <button
                      onClick={() => loadReports(reportsPeriode)}
                      disabled={reportsLoading}
                      className="w-8 h-8 rounded-xl bg-white border border-[#e5d5c5] flex items-center justify-center text-[#6b4a3d] hover:border-[#2c1a10] transition-all cursor-pointer disabled:opacity-50"
                    >
                      <svg className={`w-3.5 h-3.5 ${reportsLoading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                    </button>
                  </div>
                </div>

                {reportsLoading && !reportsData && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 border border-[#e5d5c5] animate-pulse h-28" />
                    ))}
                  </div>
                )}

                {reportsData && (
                  <>
                    {/* Bento Row 1: KPI Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {/* 1. Chiffre d'affaires */}
                      <div className="rounded-2xl p-5 border flex flex-col gap-1 bg-gradient-to-br from-[#faf0e0] to-[#f5e8cc] border-[#e5c87a]">
                        <div className="w-9 h-9 rounded-xl bg-[#fde88a]/60 flex items-center justify-center mb-1">
                          <svg className="w-5 h-5 text-[#8a6a00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/><path d="M12 18V6"/></svg>
                        </div>
                        <div className="text-3xl font-black text-[#8a6a00]">
                          {reportsData.ca?.total || "—"}
                        </div>
                        <div className="text-xs font-bold text-[#8a6a00]">Chiffre d'affaires</div>
                        <div className="text-[10px] text-[#8a6a00]/70">
                          {reportsData.ca ? reportsData.ca.subtitle : "Connecter la caisse"}
                        </div>
                      </div>

                      {/* 2. Dépenses fournisseurs */}
                      <div className="rounded-2xl p-5 border flex flex-col gap-1 bg-gradient-to-br from-orange-50 to-orange-100/60 border-orange-200">
                        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center mb-1">
                          <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><line x1="12" x2="12" y1="22.08" y2="12"/></svg>
                        </div>
                        <div className="text-3xl font-black text-orange-600">
                          {reportsData.commandes.total}
                        </div>
                        <div className="text-xs font-bold text-orange-700">Dépenses fournisseurs</div>
                        <div className="text-[10px] text-orange-500">{reportsData.commandes.envoyees} envoyées</div>
                      </div>

                      {/* 3. Commandes */}
                      <div className="rounded-2xl p-5 border flex flex-col gap-1 bg-gradient-to-br from-[#faf5ef] to-[#f5ede0] border-[#e5d5c5]">
                        <div className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center mb-1">
                          <svg className="w-5 h-5 text-[#6b4a3d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                        </div>
                        <div className="text-3xl font-black text-[#6b4a3d]">
                          {reportsData.commandes.total}
                        </div>
                        <div className="text-xs font-bold text-[#6b4a3d]">Commandes</div>
                        <div className="text-[10px] text-[#9a7060]">{reportsData.commandes.enAttente} en attente</div>
                      </div>

                      {/* 4. Staff actif */}
                      <div className="rounded-2xl p-5 border flex flex-col gap-1 bg-gradient-to-br from-[#f0f7e5] to-[#e5f0d0] border-[#c8dfa0]">
                        <div className="w-9 h-9 rounded-xl bg-[#d4ecaa]/60 flex items-center justify-center mb-1">
                          <svg className="w-5 h-5 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        </div>
                        <div className="text-3xl font-black text-[#5a7828]">
                          {reportsData.staff.presences.length}
                        </div>
                        <div className="text-xs font-bold text-[#5a7828]">Staff actif</div>
                        <div className="text-[10px] text-[#5a7828]/70">membres pointés</div>
                      </div>

                      {/* 5. Stock critique */}
                      <div className={`rounded-2xl p-5 border flex flex-col gap-1 bg-gradient-to-br ${
                        reportsData.stock.critique > 0
                          ? "from-red-50 to-red-100/60 border-red-200"
                          : "from-emerald-50 to-emerald-100/60 border-emerald-200"
                      }`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1 ${
                          reportsData.stock.critique > 0 ? "bg-red-100" : "bg-emerald-100"
                        }`}>
                          <svg className={`w-5 h-5 ${reportsData.stock.critique > 0 ? "text-red-600" : "text-emerald-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        </div>
                        <div className={`text-3xl font-black ${reportsData.stock.critique > 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {reportsData.stock.critique}
                        </div>
                        <div className={`text-xs font-bold ${reportsData.stock.critique > 0 ? "text-red-700" : "text-emerald-700"}`}>Stock critique</div>
                        <div className={`text-[10px] ${reportsData.stock.critique > 0 ? "text-red-400" : "text-emerald-500"}`}>{reportsData.stock.alerte} en alerte</div>
                      </div>
                    </div>

                    {/* Bento Row 2: Fournisseurs bar chart + Stock critique list */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Commandes par fournisseur */}
                      <div className="bg-white rounded-2xl p-5 border border-[#e5d5c5]">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-[#f0e8dc] flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#6b4a3d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>
                          </div>
                          <div className="text-sm font-black text-[#2c1a10]">Commandes par fournisseur</div>
                        </div>
                        {reportsData.commandes.byFournisseur.length === 0 ? (
                          <p className="text-xs text-[#9a7060] text-center py-4">Aucune commande sur cette période</p>
                        ) : (
                          <div className="space-y-2.5">
                            {(() => {
                              const max = Math.max(...reportsData.commandes.byFournisseur.map((f) => f.count), 1);
                              return reportsData.commandes.byFournisseur.map((f) => (
                                <div key={f.nom} className="flex items-center gap-3">
                                  <div className="text-xs font-bold text-[#2c1a10] w-28 truncate shrink-0">{f.nom}</div>
                                  <div className="flex-1 bg-[#f0e8dc] rounded-full h-2 overflow-hidden">
                                    <div
                                      className="h-full bg-[#2c1a10] rounded-full transition-all duration-500"
                                      style={{ width: `${(f.count / max) * 100}%` }}
                                    />
                                  </div>
                                  <div className="text-xs font-black text-[#6b4a3d] w-5 text-right shrink-0">{f.count}</div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Stock critique */}
                      <div className="bg-white rounded-2xl p-5 border border-[#e5d5c5]">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                          </div>
                          <div className="text-sm font-black text-[#2c1a10]">Stock en alerte</div>
                          {reportsData.stock.critique > 0 && (
                            <span className="ml-auto text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              {reportsData.stock.critique} items
                            </span>
                          )}
                        </div>
                        {reportsData.stock.criticalItems.length === 0 ? (
                          <div className="flex flex-col items-center py-4 gap-2">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <p className="text-xs font-bold text-emerald-700">Tout est OK !</p>
                            <p className="text-[10px] text-[#9a7060]">Aucun stock critique</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {reportsData.stock.criticalItems.map((name) => (
                              <div key={name} className="flex items-center gap-2 bg-red-50 rounded-xl px-3 py-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                <span className="text-xs font-bold text-[#2c1a10] truncate">{name}</span>
                              </div>
                            ))}
                            {reportsData.stock.critique > 5 && (
                              <p className="text-[10px] text-[#9a7060] text-center pt-1">
                                +{reportsData.stock.critique - 5} autres…
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bento Row 3: Top prépas + MOKA AI chat */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Top prépas */}
                      <div className="bg-white rounded-2xl p-5 border border-[#e5d5c5]">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-[#f0e8dc] flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#6b4a3d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect width="6" height="4" x="9" y="3" rx="1"/></svg>
                          </div>
                          <div className="text-sm font-black text-[#2c1a10]">Prépas en cours</div>
                          <span className="ml-auto text-[10px] font-black bg-[#f0e8dc] text-[#6b4a3d] px-2 py-0.5 rounded-full">
                            {reportsData.preps.total} total
                          </span>
                        </div>
                        {reportsData.preps.top.length === 0 ? (
                          <p className="text-xs text-[#9a7060] text-center py-4">Aucune prépa</p>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5">
                            {reportsData.preps.top.map((p) => (
                              <div
                                key={p.name}
                                className={`rounded-xl px-3 py-2 text-xs font-bold truncate border ${
                                  p.priority === "Urgente"
                                    ? "bg-red-50 border-red-200 text-red-700"
                                    : p.priority === "Haute"
                                    ? "bg-amber-50 border-amber-200 text-amber-700"
                                    : "bg-[#f7f3ef] border-[#e5d5c5] text-[#2c1a10]"
                                }`}
                              >
                                {p.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* MOKA AI Chat */}
                      <div className="bg-[#2c1a10] rounded-2xl p-5 flex flex-col gap-3 min-h-[260px]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#f5ede0]/15 flex items-center justify-center">
                            <svg className="w-4 h-4 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                          </div>
                          <div className="text-sm font-black text-[#f5ede0]">MOKA AI</div>
                          <span className="text-[9px] font-bold bg-[#f5ede0]/15 text-[#f5ede0]/70 px-2 py-0.5 rounded-full">Claude Haiku</span>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto space-y-2 max-h-[140px]" id="moka-chat-messages">
                          {chatMessages.length === 0 && (
                            <div className="space-y-1.5">
                              {[
                                "Quels produits sont en rupture ?",
                                "Résume l'activité de la semaine",
                                "Quelles prépas sont urgentes ?",
                              ].map((s) => (
                                <button
                                  key={s}
                                  onClick={() => { setChatInput(s); }}
                                  className="w-full text-left text-[10px] text-[#f5ede0]/60 bg-[#f5ede0]/8 hover:bg-[#f5ede0]/15 rounded-xl px-3 py-2 transition-all cursor-pointer font-medium"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}
                          {chatMessages.map((m, i) => (
                            <div
                              key={i}
                              className={`text-xs rounded-xl px-3 py-2 max-w-[85%] ${
                                m.role === "user"
                                  ? "bg-[#f5ede0] text-[#2c1a10] ml-auto font-bold"
                                  : "bg-[#f5ede0]/12 text-[#f5ede0] font-medium"
                              }`}
                            >
                              {m.content}
                            </div>
                          ))}
                          {chatLoading && (
                            <div className="bg-[#f5ede0]/12 rounded-xl px-3 py-2 w-16 flex gap-1 items-center">
                              {[0, 1, 2].map((i) => (
                                <div key={i} className="w-1 h-1 rounded-full bg-[#f5ede0]/60 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                            placeholder="Pose une question…"
                            className="flex-1 bg-[#f5ede0]/10 border border-[#f5ede0]/20 rounded-xl px-3 py-2 text-xs text-[#f5ede0] placeholder-[#f5ede0]/40 outline-none focus:border-[#f5ede0]/50 transition-all"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={!chatInput.trim() || chatLoading}
                            className="w-9 h-9 rounded-xl bg-[#f5ede0] flex items-center justify-center text-[#2c1a10] disabled:opacity-40 hover:bg-white transition-all cursor-pointer shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!reportsLoading && !reportsData && (
                  <div className="bg-white rounded-2xl p-12 border border-[#e5d5c5] text-center">
                    <p className="text-xs text-[#9a7060]">Impossible de charger les données. <button onClick={() => loadReports(reportsPeriode)} className="text-[#2c1a10] font-bold underline cursor-pointer">Réessayer</button></p>
                  </div>
                )}
              </div>
            )}

            {/* SETTINGS PANEL */}
            {adminSection === "settings" && (
              <div className="space-y-4">
                <div className="h-2" />
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
                {/* Sécurité tile */}
                <button
                  onClick={() => { setShowSecurityModal(true); setPinSaveMsg(""); setNewPin(""); setConfirmPin(""); }}
                  className="bg-white rounded-2xl p-5 border border-[#e5d5c5] shadow-sm text-left hover:shadow-md hover:border-[#d0c0b0] transition-all cursor-pointer active:scale-[0.98] group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-[#f0e8dc] flex items-center justify-center text-[#6b4a3d] mb-3 group-hover:bg-[#2c1a10] group-hover:text-[#f5ede0] transition-all">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <div className="text-base font-black text-[#2c1a10]">Sécurité</div>
                  <p className="text-[11px] text-[#9a7060] mt-1">PIN admin & accès</p>
                </button>
              </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADMIN BOTTOM NAV — glassmorphism ─────────── */}
      {isAdmin && (() => {
        const dashboardSVG = <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>;
        const productsSVG  = <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>;
        const inventorySVG = <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m9 12 2 2 4-4"/></>;
        const ordersSVG    = <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>;
        const reportsSVG   = <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>;
        const settingsSVG  = <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></>;
        const navItems = [
          { id: "dashboard", icon: dashboardSVG },
          { id: "products",  icon: productsSVG  },
          { id: "inventory", icon: inventorySVG },
          { id: "orders",    icon: ordersSVG    },
          { id: "reports",   icon: reportsSVG   },
          ...(!isIphone ? [{ id: "settings", icon: settingsSVG }] : []),
        ];
        const navWidth = navCompact ? "w-auto px-5" : "w-[280px]";
        return (
          <div
            className="fixed z-50 transition-all duration-500 ease-out"
            style={{
              bottom: `calc(env(safe-area-inset-bottom) + 16px)`,
              left: "50%",
              transform: `translateX(-50%) translateY(${navVisible ? "0" : "calc(100% + 20px)"})`,
            }}
          >
            <div
              className={`flex items-center justify-around transition-all duration-500 ease-out ${navWidth} py-3 rounded-full`}
              style={{
                background: "rgba(255, 252, 248, 0.55)",
                backdropFilter: "blur(24px) saturate(200%) brightness(1.1)",
                WebkitBackdropFilter: "blur(24px) saturate(200%) brightness(1.1)",
                boxShadow: "0 4px 24px rgba(44, 26, 16, 0.08), inset 0 1px 0 rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.5)",
              }}
            >
              {navItems.map(({ id, icon }) => (
                <button
                  key={id}
                  onClick={() => setAdminSection(id)}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all duration-200 active:scale-90 ${
                    adminSection === id ? "bg-[#2c1a10]" : "hover:bg-[#2c1a10]/8"
                  }`}
                >
                  <svg
                    className={`transition-all duration-200 ${navCompact ? "w-4 h-4" : "w-5 h-5"} ${adminSection === id ? "text-[#f5ede0]" : "text-[#9a7060]"}`}
                    fill="none" viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={adminSection === id ? 2.2 : 1.8}
                    strokeLinecap="round" strokeLinejoin="round"
                  >
                    {icon}
                  </svg>
                  {adminSection === id && !navCompact && (
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2c1a10] opacity-40" />
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

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
                id="stockReceiveInput"
                autoFocus
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
                  ["Fournisseur", "fournisseurDefaut", "select", productsDbSupplierChoices.map((s) => s.name)],
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
                {/* Fournisseur — select spécial avec id comme value */}
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Fournisseur</label>
                  <select
                    value={editingProductDbForm.fournisseurId || ""}
                    onChange={(e) => {
                      const opt = productsDbSupplierChoices.find((s) => s.id === e.target.value);
                      setEditingProductDbForm((prev) => ({
                        ...prev,
                        fournisseurId: e.target.value,
                        fournisseurDefaut: opt?.name || "",
                      }));
                    }}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-[#faf5ef] px-4 py-3 font-semibold text-[#2c1a10] outline-none"
                  >
                    <option value="">À définir ({productsDbSupplierChoices.length} choix)</option>
                    {productsDbSupplierChoices.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {editingProductDbForm.fournisseurId && (
                    <div className="text-[9px] text-[#9a7060] mt-1 font-mono truncate">ID: {editingProductDbForm.fournisseurId}</div>
                  )}
                </div>

                {[
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

      {/* ── NOUVELLE PRÉPA MODAL ─────────────────────── */}
      {showNewPrepModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#f5ede0]"
             style={{ paddingTop: "env(safe-area-inset-top)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5d5c5] shrink-0">
            <h2 className="text-base font-black text-[#2c1a10]">+ Nouvelle prépa</h2>
            <button onClick={() => setShowNewPrepModal(false)}
              className="w-8 h-8 rounded-xl bg-white border border-[#e5d5c5] flex items-center justify-center cursor-pointer">
              <svg className="w-4 h-4 text-[#9a7060]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Contenu — pas de scroll, tout visible */}
          <div className="flex-1 flex flex-col px-4 py-3 gap-3 overflow-hidden">

            {/* Station */}
            <div className="flex gap-2">
              {["Bar", "Cuisine"].map(s => (
                <button key={s}
                  onClick={() => setNewPrepForm(p => ({ ...p, station: s, produit: "", quantite: 1, unite: "kg" }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    newPrepForm.station === s ? "bg-[#2c1a10] text-white" : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
                  }`}>
                  {s === "Bar" ? "☕ Bar" : "👨‍🍳 Cuisine"}
                </button>
              ))}
            </div>

            {/* Produit */}
            <div>
              <label className="text-[9px] font-black text-[#9a7060] uppercase tracking-wide">Produit</label>
              <select
                value={newPrepForm.produit}
                onChange={e => {
                  const selected = prepProducts.find(p => (p.ingredient || p.name || "") === e.target.value);
                  setNewPrepForm(prev => ({
                    ...prev,
                    produit: e.target.value,
                    quantite: selected?.quantiteCommandeSuggeree || selected?.suggested || 1,
                    unite: selected?.uniteStock || selected?.unit || "kg",
                  }));
                }}
                className="mt-0.5 w-full bg-white border border-[#e5d5c5] rounded-xl px-3 py-2.5 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828]">
                <option value="">-- Choisir ({newPrepForm.station}) --</option>
                {prepProducts.map(p => {
                  const nom = p.ingredient || p.name || "";
                  const qte = p.quantiteCommandeSuggeree || p.suggested || "";
                  const unit = p.uniteStock || p.unit || "";
                  return (
                    <option key={p.id} value={nom}>
                      {nom}{qte ? ` — ${qte} ${unit}` : ""}
                    </option>
                  );
                })}
              </select>
              {prepProducts.length === 0 && (
                <div className="mt-0.5 text-[10px] text-orange-500">
                  Aucune prépa {newPrepForm.station} — vérifier Notion
                </div>
              )}
            </div>

            {/* Quantité + Unité */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] font-black text-[#9a7060] uppercase tracking-wide">Quantité</label>
                <input type="number" min="0.1" step="0.1" value={newPrepForm.quantite}
                  onChange={e => setNewPrepForm(p => ({ ...p, quantite: Number(e.target.value) }))}
                  className="mt-0.5 w-full bg-white border border-[#e5d5c5] rounded-xl px-3 py-2.5 text-sm font-black text-[#2c1a10] outline-none focus:border-[#5a7828]" />
              </div>
              <div className="flex-1">
                <label className="text-[9px] font-black text-[#9a7060] uppercase tracking-wide">Unité</label>
                <select value={newPrepForm.unite}
                  onChange={e => setNewPrepForm(p => ({ ...p, unite: e.target.value }))}
                  className="mt-0.5 w-full bg-white border border-[#e5d5c5] rounded-xl px-3 py-2.5 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828]">
                  {["kg","g","L","ml","pièce","portion","batch","sachet","barquette","boîte"].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Priorité */}
            <div className="flex gap-2">
              {["Normale", "Haute"].map(p => (
                <button key={p}
                  onClick={() => setNewPrepForm(prev => ({ ...prev, priorite: p }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                    newPrepForm.priorite === p
                      ? p === "Haute" ? "bg-orange-500 text-white" : "bg-[#5a7828] text-white"
                      : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
                  }`}>
                  {p === "Haute" ? "⚡ Urgente" : "✓ Normale"}
                </button>
              ))}
            </div>

            {/* Assigner + Date */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] font-black text-[#9a7060] uppercase tracking-wide">Assigner à</label>
                <select value={newPrepForm.staffName}
                  onChange={e => setNewPrepForm(p => ({ ...p, staffName: e.target.value }))}
                  className="mt-0.5 w-full bg-white border border-[#e5d5c5] rounded-xl px-3 py-2.5 text-xs text-[#2c1a10] outline-none focus:border-[#5a7828]">
                  <option value="">Non assigné</option>
                  {staff.map(s => (
                    <option key={s.id || getStaffName(s)} value={getStaffName(s)}>{getStaffName(s)}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[9px] font-black text-[#9a7060] uppercase tracking-wide">Pour quand</label>
                <input type="date" value={newPrepForm.dueDate}
                  onChange={e => setNewPrepForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="mt-0.5 w-full bg-white border border-[#e5d5c5] rounded-xl px-3 py-2.5 text-xs text-[#2c1a10] outline-none focus:border-[#5a7828]" />
              </div>
            </div>

          </div>

          {/* Bouton Créer — toujours visible en bas */}
          <div className="px-4 py-3 border-t border-[#e5d5c5] shrink-0"
               style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
            <button
              onClick={async () => {
                if (!newPrepForm.produit) return;
                setSavingNewPrep(true);
                try {
                  const res = await fetch(CREATE_PREP_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify([{
                      produit: newPrepForm.produit,
                      quantite: newPrepForm.quantite,
                      unite: newPrepForm.unite,
                      priorite: newPrepForm.priorite,
                      statut: "À faire",
                      staffName: newPrepForm.staffName,
                      station: newPrepForm.station,
                      source: "Manuel",
                      dueDate: newPrepForm.dueDate,
                      date: new Date().toISOString(),
                    }]),
                  });
                  if (!res.ok) throw new Error("Erreur serveur");
                  setShowNewPrepModal(false);
                  setNewPrepForm({ produit: "", quantite: 1, unite: "kg", priorite: "Normale", station: "Cuisine", dueDate: new Date().toISOString().slice(0, 10), staffName: "" });
                  setTimeout(() => loadPreps(), 1500);
                } catch (err) {
                  showToast("Erreur : " + err.message, "error");
                } finally {
                  setSavingNewPrep(false);
                }
              }}
              disabled={!newPrepForm.produit || savingNewPrep}
              className="w-full py-3.5 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer hover:bg-[#4e6a22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {savingNewPrep ? "Création..." : "✅ Créer la prépa"}
            </button>
          </div>
        </div>
      )}

      {/* ── CLOCK MODAL ──────────────────────────────── */}
      {showClockModal && (
        <div className="fixed inset-0 z-50 bg-[#f5ede0] overflow-y-auto">

          {/* Header sticky */}
          <div
            className="sticky top-0 z-10 bg-[#f5ede0]/95 backdrop-blur border-b border-[#e5d5c5] px-4 pb-3 shrink-0"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">MÖKA OS</div>
                <h1 className="text-xl font-black text-[#2c1a10]">⏱ Pointage</h1>
                <div className="text-xs text-[#e85d8a] font-bold mt-0.5 tabular-nums">
                  {clockNow.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  {" · "}
                  {clockNow.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </div>
              </div>
              <button
                onClick={() => setShowClockModal(false)}
                className="w-10 h-10 rounded-2xl bg-white border border-[#e5d5c5] flex items-center justify-center text-[#9a7060] hover:bg-[#f0e4d4] transition-colors cursor-pointer shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Staff cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
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
                const staffId = getStaffName(member);
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
      )}

      {/* ── SECURITY MODAL ───────────────────────────── */}
      {showSecurityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-[#e5d5c5] w-full max-w-sm p-6 relative">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2c1a10] via-[#6b4a3d] to-[#5a7828] rounded-t-3xl" />
            <button onClick={() => setShowSecurityModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-[#6b4a3d] hover:bg-[#e5d5c5] transition-all cursor-pointer">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-[#2c1a10] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-[#f5ede0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div className="text-base font-black text-[#2c1a10]">Sécurité & Accès Admin</div>
                <p className="text-[11px] text-[#9a7060]">PIN et activation du mode admin</p>
              </div>
            </div>

            {/* Toggle mode admin */}
            <div className="bg-[#f7f3ef] rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-[#2c1a10]">Mode admin activé</div>
                  <p className="text-[10px] text-[#9a7060] mt-0.5">Si désactivé, le mode admin ne peut pas être ouvert</p>
                </div>
                <button
                  onClick={() => {
                    const next = !adminPinEnabled;
                    setAdminPinEnabled(next);
                    localStorage.setItem("mokaAdminEnabled", String(next));
                  }}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${adminPinEnabled ? "bg-[#5a7828]" : "bg-[#d5c5b5]"}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${adminPinEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>

            {/* Change PIN */}
            <div className="bg-[#f7f3ef] rounded-2xl p-4 space-y-3">
              <div className="text-sm font-black text-[#2c1a10]">Changer le code PIN</div>
              <div>
                <label className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Nouveau code (4 chiffres)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={newPin}
                  onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, "")); setPinSaveMsg(""); }}
                  placeholder="••••"
                  className="mt-1 w-full bg-white border border-[#e5d5c5] rounded-xl px-3 py-2.5 text-sm text-[#2c1a10] font-mono tracking-[0.4em] outline-none focus:border-[#2c1a10] transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Confirmer le code</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => { setConfirmPin(e.target.value.replace(/\D/g, "")); setPinSaveMsg(""); }}
                  placeholder="••••"
                  className="mt-1 w-full bg-white border border-[#e5d5c5] rounded-xl px-3 py-2.5 text-sm text-[#2c1a10] font-mono tracking-[0.4em] outline-none focus:border-[#2c1a10] transition-all"
                />
              </div>
              {pinSaveMsg && (
                <p className={`text-xs font-bold ${pinSaveMsg.startsWith("✅") ? "text-[#5a7828]" : "text-red-600"}`}>{pinSaveMsg}</p>
              )}
              <button
                onClick={() => {
                  if (newPin.length !== 4) { setPinSaveMsg("Le code doit faire 4 chiffres."); return; }
                  if (newPin !== confirmPin) { setPinSaveMsg("Les codes ne correspondent pas."); return; }
                  localStorage.setItem("mokaPinCode", newPin);
                  setPinSaveMsg("✅ Code mis à jour");
                  setNewPin("");
                  setConfirmPin("");
                }}
                className="w-full bg-[#2c1a10] text-[#f5ede0] rounded-xl py-2.5 text-sm font-black hover:bg-[#3d2518] transition-all cursor-pointer active:scale-[0.98]"
              >
                Enregistrer
              </button>
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

      {/* ── TOASTS ─────────────────────────────────────── */}
      <div className="fixed right-4 z-[90] flex flex-col gap-2 pointer-events-none"
           style={{ bottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
        {toasts.map(toast => (
          <div key={toast.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl text-white text-sm font-bold pointer-events-auto ${
              toast.type === "error"
                ? "bg-red-500"
                : toast.type === "warning"
                ? "bg-orange-500"
                : "bg-[#5a7828]"
            }`}>
            <span>{toast.type === "error" ? "❌" : toast.type === "warning" ? "⚠️" : "✅"}</span>
            {toast.message}
          </div>
        ))}
      </div>

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

function buildGroupedMessage(fournisseurNom, items, dateOverride) {
  const dateStr = dateOverride || new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "America/Puerto_Rico",
  });
  const lines = items.map((p) => `- ${p.name} — ${p.qty} ${p.unit}`).join("\n");
  return `Bonjour ${fournisseurNom} 👋\n\nCommande du ${dateStr} :\n\n${lines}\n\nMerci 🙏\n— Équipe MÖKA`;
}

function getGridCols(n) {
  if (n === 1) return "md:grid-cols-1";
  if (n === 2) return "md:grid-cols-2";
  if (n <= 4)  return "md:grid-cols-2";
  return "md:grid-cols-3";
}

function OrdMultiPanelModal({ groups, onClose, onAllSent }) {
  const [sentPanels, setSentPanels] = React.useState({});

  const n = groups.length;
  const compact = n >= 3;
  const veryCompact = n >= 5;
  const btnPy = veryCompact ? "py-1.5" : compact ? "py-2" : "py-3";
  const btnSz = veryCompact ? "text-[11px] font-bold" : compact ? "text-xs font-bold" : "text-sm font-black";
  const msgSz = n >= 4 ? "text-[10px]" : "text-xs";
  const cardHeaderPad = compact ? "px-3 py-2" : "px-4 py-3";

  const allSent = n > 0 && groups.every((g) => sentPanels[g.fournisseurId || g.fournisseurNom]);

  const markGroupSent = async (group) => {
    const key = group.fournisseurId || group.fournisseurNom;
    const dateStr = new Date().toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "America/Puerto_Rico",
    });
    const msg = buildGroupedMessage(group.fournisseurNom, group.items, dateStr);
    try {
      await fetch("/api/supplier-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produit: `Order composée — ${group.fournisseurNom}`,
          quantite: group.items.length,
          fournisseurId: group.fournisseurId || null,
          fournisseur: group.fournisseurNom,
          statut: "Envoyé",
          source: "Commandes",
          message: msg,
          produits: group.items.map((p) => ({ name: p.name, qty: p.qty, unit: p.unit, produitId: p.id || null })),
        }),
      });
      setSentPanels((prev) => ({ ...prev, [key]: true }));
    } catch (err) {
      console.error("Erreur markGroupSent:", err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-[#eadfd4] shrink-0">
        <div>
          <div className="text-[10px] font-black tracking-[0.22em] text-[#a97862] uppercase">Commandes</div>
          <h2 className="text-lg font-black text-[#3b241b]">{n} fournisseur{n > 1 ? "s" : ""} à contacter</h2>
        </div>
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-[#f4eee7] flex items-center justify-center font-black text-[#a97862] text-lg cursor-pointer">×</button>
      </div>

      {allSent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-[#f9f5f0] p-8">
          <div className="text-6xl">✅</div>
          <div className="text-xl font-black text-[#3b241b] text-center">Toutes les commandes envoyées !</div>
          <button onClick={onAllSent} className="px-8 py-4 rounded-xl bg-[#6f8f32] text-white font-black text-sm cursor-pointer hover:bg-[#5a7228] transition-colors">
            Fermer et voir l'historique
          </button>
        </div>
      ) : (
        <div className={`flex-1 overflow-auto p-4 grid grid-cols-1 ${getGridCols(n)} gap-3 content-start`}>
          {groups.map((group) => {
            const key = group.fournisseurId || group.fournisseurNom;
            const isSent = sentPanels[key];
            const message = buildGroupedMessage(group.fournisseurNom, group.items);
            const wa = group.supplier ? ordGetSupplierWhatsapp(group.supplier) : null;
            const em = group.supplier ? ordGetSupplierEmail(group.supplier) : null;
            return (
              <div key={key} className={`rounded-[1.2rem] border overflow-hidden flex flex-col transition-all ${isSent ? "bg-[#f0f7e8] border-[#6f8f32] opacity-70" : "bg-white border-[#eadfd4] shadow-sm"}`}>
                <div className={`${cardHeaderPad} border-b border-[#eadfd4] flex items-center justify-between`}>
                  <div>
                    <div className={`font-black text-[#3b241b] ${compact ? "text-sm" : "text-base"}`}>{group.fournisseurNom}</div>
                    <div className="text-[11px] text-[#a97862]">{group.items.length} produit{group.items.length > 1 ? "s" : ""}</div>
                  </div>
                  {isSent && <span className="text-[#6f8f32] font-black text-sm">✅ Envoyé</span>}
                </div>
                <div className={`divide-y divide-[#f0e8dc] ${compact ? "px-3" : "px-4"} flex-1`}>
                  {group.items.map((p) => (
                    <div key={p.id} className={`${compact ? "py-1.5" : "py-2"} flex justify-between text-sm`}>
                      <span className={`font-bold text-[#3b241b] truncate flex-1 mr-2 ${compact ? "text-xs" : "text-sm"}`}>{p.name}</span>
                      <span className="text-[#a97862] shrink-0 text-xs">{p.qty} {p.unit}</span>
                    </div>
                  ))}
                </div>
                <div className={`mx-2 my-2 bg-[#e8f5e1] rounded-xl p-2 font-mono ${msgSz} text-[#2d5a1b] whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto`}>
                  {message}
                </div>
                {!isSent && (
                  <div className="px-2 pb-2 flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <button onClick={async () => {
                        if (wa) window.open(`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
                        await markGroupSent(group);
                      }} className={`flex-1 ${btnPy} rounded-xl bg-[#25D366] text-white ${btnSz} cursor-pointer hover:bg-[#1db954] transition-colors`}>
                        💬 WhatsApp
                      </button>
                      <button onClick={async () => {
                        if (em) window.open(`mailto:${em}?subject=Commande MÖKA&body=${encodeURIComponent(message)}`);
                        await markGroupSent(group);
                      }} className={`flex-1 ${btnPy} rounded-xl bg-[#2563eb] text-white ${btnSz} cursor-pointer hover:bg-[#1d4ed8] transition-colors`}>
                        📧 Email
                      </button>
                    </div>
                    <button onClick={() => markGroupSent(group)} className={`w-full ${btnPy} rounded-xl bg-[#2c1a10] text-white ${btnSz} cursor-pointer hover:bg-[#1e100a] transition-colors`}>
                      ✅ Marquer comme envoyé
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrdPreviewModal({ buildMessage, selectedSupplier, supplier, setShowPreview, onSent }) {
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
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex gap-3">
            <button onClick={async () => {
              const wa = ordGetSupplierWhatsapp(supplier);
              if (wa) window.open(`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
              await onSent?.();
              setShowPreview(false);
            }} className="flex-1 py-3.5 rounded-xl bg-[#25D366] text-white font-black text-sm cursor-pointer hover:bg-[#1db954] transition-colors">💬 WhatsApp</button>
            <button onClick={async () => {
              const em = ordGetSupplierEmail(supplier);
              if (em) window.open(`mailto:${em}?subject=Commande MÖKA&body=${encodeURIComponent(message)}`);
              await onSent?.();
              setShowPreview(false);
            }} className="flex-1 py-3.5 rounded-xl bg-[#2563eb] text-white font-black text-sm cursor-pointer hover:bg-[#1d4ed8] transition-colors">📧 Email</button>
          </div>
          <button onClick={async () => {
            await onSent?.();
            setShowPreview(false);
          }} className="w-full py-3.5 rounded-xl bg-[#2c1a10] text-white font-black text-sm cursor-pointer hover:bg-[#1e100a] transition-colors">✅ Marquer comme envoyé</button>
        </div>
      </div>
    </div>
  );
}

function OrdDetailModal({ orderDetail, supplier, setOrderDetail }) {
  const dateStr = String(orderDetail.dateCreation || "").slice(0, 10);
  const message = orderDetail.message || "";
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-[1.4rem] shadow-xl border border-[#eadfd4] w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black tracking-[0.22em] text-[#a97862] uppercase">Détail commande</div>
            <h2 className="text-lg font-black text-[#3b241b]">{orderDetail.produit}</h2>
            <div className="flex items-center gap-2 mt-1">
              <OrdStatusBadge status={orderDetail.statut} />
              <span className="text-xs text-[#a97862]">{orderDetail.fournisseur} · {dateStr || "Sans date"}</span>
            </div>
          </div>
          <button onClick={() => setOrderDetail(null)} className="w-9 h-9 rounded-full bg-[#f4eee7] flex items-center justify-center font-black text-[#a97862]">×</button>
        </div>
        <div className="text-xs font-black text-[#a97862] mb-2">MESSAGE ENVOYÉ</div>
        <div className="bg-[#e8f5e1] rounded-[1rem] p-4 font-mono text-xs text-[#2d5a1b] whitespace-pre-wrap leading-relaxed mb-4">
          {message || "Aucun message enregistré"}
        </div>
        {message && (
          <div className="flex gap-2">
            <button onClick={() => {
              const wa = ordGetSupplierWhatsapp(supplier);
              if (wa) window.open(`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
            }} className="flex-1 py-3 rounded-[1rem] bg-green-50 border border-green-200 text-green-700 font-black text-xs">💬 WhatsApp</button>
            <button onClick={() => navigator.clipboard?.writeText(message).then(() => showToast("Copié !"))} className="flex-1 py-3 rounded-[1rem] bg-[#f4eee7] text-[#3b241b] font-black text-xs">📋 Copier</button>
          </div>
        )}
      </div>
    </div>
  );
}