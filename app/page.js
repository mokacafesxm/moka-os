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

const getSmartCategoryEmoji = (name) => {
  const n = name.toLowerCase();
  if (n.includes("bar") || n.includes("café") || n.includes("cafe")) return "☕";
  if (n.includes("boisson") || n.includes("jus") || n.includes("smoothie")) return "🥤";
  if (n.includes("viande") || n.includes("poulet") || n.includes("protéine") || n.includes("protein")) return "🍗";
  if (n.includes("laitier") || n.includes("lait") || n.includes("fromage") || n.includes("crème")) return "🥛";
  if (n.includes("fruit") || n.includes("légume") || n.includes("legume") || n.includes("végétal")) return "🥑";
  if (n.includes("boulang") || n.includes("pain") || n.includes("viennois")) return "🥖";
  if (n.includes("épice") || n.includes("epice") || n.includes("herbe") || n.includes("condiment")) return "🌿";
  if (n.includes("surgelé") || n.includes("surgele") || n.includes("congelé")) return "❄️";
  if (n.includes("sec") || n.includes("épicerie") || n.includes("epicerie") || n.includes("dry")) return "📦";
  if (n.includes("dessert") || n.includes("sucré") || n.includes("sucre") || n.includes("pâtisserie")) return "🍰";
  if (n.includes("packaging") || n.includes("emballage")) return "🛍️";
  if (n.includes("nettoyage") || n.includes("entretien") || n.includes("hygiène")) return "🧽";
  if (n.includes("alcool") || n.includes("vin") || n.includes("bière") || n.includes("spiritueux")) return "🍷";
  if (n.includes("poisson") || n.includes("fruit de mer") || n.includes("seafood")) return "🐟";
  if (n.includes("sauce") || n.includes("huile") || n.includes("vinaigre")) return "🫙";
  if (n.includes("céréale") || n.includes("cereale") || n.includes("farine") || n.includes("riz")) return "🌾";
  return "✨";
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

// Fuseau SXM : UTC-4, pas de DST (identique à America/Puerto_Rico)
const SXM_TIMEZONE = "America/Puerto_Rico";

// Parse "YYYY-MM-DD" comme date locale (évite l'interprétation UTC de new Date("YYYY-MM-DD"))
function parseSXMDate(dateString) {
  if (!dateString) return null;
  const [year, month, day] = String(dateString).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

// Formate une string "YYYY-MM-DD" en date lisible en français sans décalage UTC
function formatSXMDate(dateString, options = { weekday: "long", day: "numeric", month: "long" }) {
  const date = parseSXMDate(dateString);
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", options);
}

// Retourne la date courante SXM au format "YYYY-MM-DD" (pour écriture vers Notion)
function getSXMDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SXM_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
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

const formatHeures = (decimal) => {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
};

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

const ZONE_GROUPS = [
  { key: "frigo", label: "Frigo", icon: "🧊", match: (z) => z.toLowerCase().includes("frigo") && !z.toLowerCase().includes("prépa") && !z.toLowerCase().includes("prepa") && !z.toLowerCase().includes("congel") },
  { key: "congelateur", label: "Congélateur", icon: "❄️", match: (z) => z.toLowerCase().includes("congel") || z.toLowerCase().includes("congél") },
  { key: "bar", label: "Bar", icon: "☕", match: (z) => z.toLowerCase() === "bar" || z.toLowerCase() === "bar/dry" || z.toLowerCase() === "frigo bar" },
  { key: "dry", label: "Dry Storage", icon: "📦", match: (z) => z.toLowerCase().includes("dry") && !z.toLowerCase().includes("frigo") },
  { key: "prepas", label: "Frigo Prépas", icon: "👨‍🍳", match: (z) => z.toLowerCase().includes("prépa") || z.toLowerCase().includes("prepa") },
  { key: "pain", label: "Boulangerie", icon: "🍞", match: (z) => z.toLowerCase().includes("pain") },
  { key: "autre", label: "Sans zone", icon: "📍", match: (z) => !z || z === "Sans zone" },
];

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
  const [showScanFacture, setShowScanFacture] = useState(false);
  const [showScanZ, setShowScanZ] = useState(false);
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
  const [referentiels, setReferentiels] = useState(() => {
    if (typeof window === "undefined") return { categories: [], sousCategories: [], unites: [], zones: [] };
    try {
      const cached = JSON.parse(localStorage.getItem("mokaReferentielsCache") || "null");
      return cached || { categories: [], sousCategories: [], unites: [], zones: [] };
    } catch {
      return { categories: [], sousCategories: [], unites: [], zones: [] };
    }
  });
  const [loadingReferentiels, setLoadingReferentiels] = useState(false);
  const [refInput, setRefInput] = useState({ nom: "", emoji: "", abreviation: "", categorie: "", temperature: "", uniteType: "", ordre: "" });
  const [savingRef, setSavingRef] = useState(false);
  const [showRefAddModal, setShowRefAddModal] = useState(false);
  const [importingRef, setImportingRef] = useState(false);
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
  const [productsDbViewMode, setProductsDbViewMode] = useState("categorie");
  const [inventoryViewMode, setInventoryViewMode] = useState("zone");
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
  const [hasFixedBottomAction, setHasFixedBottomAction] = useState(false);
  const lastScrollY = useRef(0);
  const adminSectionRef = useRef(adminSection);
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
  const [clockStatusLoading, setClockStatusLoading] = useState(false);
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
  const [selectedStaffHours, setSelectedStaffHours] = useState(null);
  const [lastKnownDateSXM, setLastKnownDateSXM] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Puerto_Rico" })
  );

  const [orderView, setOrderView] = useState("history");
  const [orderCart, setOrderCart] = useState({});
  const [ordSelectedSupplier, setOrdSelectedSupplier] = useState("");
  const [orderDetail, setOrderDetail] = useState(null);
  const [showMultiPanelModal, setShowMultiPanelModal] = useState(false);
  const [orderNotes, setOrderNotes] = useState("");
  const [ordStatusFilter, setOrdStatusFilter] = useState("À commander");
  const [composeCart, setComposeCart] = useState({});
  const [stockStatusFilter, setStockStatusFilter] = useState("all");
  const [stockViewMode, setStockViewMode] = useState("zone");
  const [collapsedZones, setCollapsedZones] = useState(new Set(["Sans zone"]));
  const toggleZone = (key) => {
    setCollapsedZones(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const getTodaySXM = () =>
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Puerto_Rico" });

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

  const prepsCategories = useMemo(() => {
    const cats = new Set();
    preps.forEach(p => {
      const c = (p.station || p.type || p.category || "").trim();
      if (c) cats.add(c);
    });
    return [...cats].sort();
  }, [preps]);

  const prepsTodoByCategory = useMemo(() => {
    const counts = {};
    preps.forEach(p => {
      if (getPrepStatus(p).toLowerCase() === "à faire") {
        const c = (p.station || p.type || p.category || "").trim();
        if (c) counts[c] = (counts[c] || 0) + 1;
      }
    });
    return counts;
  }, [preps]);

  const filteredPreps = useMemo(() => {
    if (!prepsStation || prepsStation === "all") return preps;
    return preps.filter(p => {
      const c = (p.station || p.type || p.category || "").trim();
      return c.toLowerCase() === prepsStation.toLowerCase();
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

  useEffect(() => {
    if (!prepsCategories.length) return;
    setPrepsStation(prev => {
      if (prev && prepsCategories.includes(prev)) return prev;
      const urgentCat = prepsCategories.find(cat =>
        preps.some(p => {
          const c = (p.station || p.type || p.category || "").trim();
          return c === cat &&
            String(getPrepPriority(p)).toLowerCase().includes("haute") &&
            getPrepStatus(p).toLowerCase() === "à faire";
        })
      );
      return urgentCat || prepsCategories[0];
    });
  }, [prepsCategories]);

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
    ...(referentiels.categories.length ? referentiels.categories.map((c) => c.nom) : categoryOrder),
    ...products.map((p) => p.category || p.categorie),
  ]);

  const subCategoryOptions = uniqueValues([
    ...(referentiels.sousCategories.length ? referentiels.sousCategories.map((s) => s.nom) : []),
    ...products.map((p) => getSubCategory(p)),
  ]);

  const zoneOptions = uniqueValues([
    ...(referentiels.zones.length ? referentiels.zones.map((z) => z.nom) : []),
    ...products.map((p) => p.zone || p.zoneStockage || p.emplacement),
  ]);
  const uniteOptions = uniqueValues([
    ...(referentiels.unites.length ? referentiels.unites.map((u) => u.nom) : []),
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

    const isNotPrepa = (item) => {
      const cat = String(item.category || item.categorie || "").toLowerCase();
      return !cat.includes("prepa") && !cat.includes("prépa");
    };

    if (stockStatusFilter === "critical")
      filtered = filtered.filter(i => String(getStockStatus(i)).toLowerCase().includes("critique") && isNotPrepa(i));
    else if (stockStatusFilter === "low")
      filtered = filtered.filter(i => String(getStockStatus(i)).toLowerCase().includes("stock bas") && isNotPrepa(i));
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

  const stockByZone = useMemo(() => {
    if (stockView !== "stock") return null;
    const groups = {};
    const priorityScore = (item) => {
      const s = String(getStockStatus(item)).toLowerCase();
      if (s.includes("critique")) return 0;
      if (s.includes("stock bas") || s.includes("alerte")) return 1;
      if (s.includes("configurer")) return 3;
      return 2;
    };
    stockVisibleItems.forEach(item => {
      const zone = String(getStockZone(item)).trim() || "Sans zone";
      if (!groups[zone]) groups[zone] = [];
      groups[zone].push(item);
    });
    Object.keys(groups).forEach(zone => {
      groups[zone].sort((a, b) => priorityScore(a) - priorityScore(b));
    });
    // Tri alphabétique, "Sans zone" en dernier
    const sorted = {};
    Object.keys(groups).sort((a, b) => {
      if (a === "Sans zone") return 1;
      if (b === "Sans zone") return -1;
      return a.localeCompare(b, "fr");
    }).forEach(zone => { sorted[zone] = groups[zone]; });
    return sorted;
  }, [stockVisibleItems, stockView]);

  const prepCount = preps.filter(
    (prep) => getPrepStatus(prep) !== "Terminé" && getPrepStatus(prep) !== "Fait"
  ).length;


  const stockKpis = useMemo(() => {
    const rawStock = stockLive.filter(item => !isPrepStock(item));
    const total = rawStock.length;

    const critical = rawStock.filter((item) =>
      String(getStockStatus(item)).toLowerCase().includes("critique")
    ).length;

    const alert = rawStock.filter((item) => {
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
  const ordIncludedItems = Object.values(composeCart).filter((i) => i.included);
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
      const isDedicated = resource === "suppliers" || resource === "staff";
      let list;

      if (isDedicated) {
        const response = await fetch(`/api/settings/${resource}`);
        if (!response.ok) throw new Error(`Erreur settings ${response.status}`);
        list = await response.json();
      } else {
        const response = await fetch(SETTINGS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource, action: "list" }),
        });
        if (!response.ok) throw new Error(`Erreur settings ${response.status}`);
        const data = await response.json();
        list = Array.isArray(data) ? data : normalizeArray(data, resource);
      }

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
    if (isAdmin) loadReferentiels();
  }, [isAdmin]);

  // Silent background sync: create stock entries for any catalogue product missing one
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/sync-stock")
      .then(r => r.json())
      .then(data => {
        if (data.createdCount > 0) {
          console.log(`[autoSync] ${data.createdCount} produit(s) synchronisé(s) vers le stock`);
          refreshAll(2000);
        }
      })
      .catch(e => console.warn("[autoSync]", e.message));
  }, [isAdmin]);

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
  }, [isAdmin]);

  const fetchSettingsResource = async (resource) => {
    const isDedicated = resource === "suppliers" || resource === "staff";
    if (isDedicated) {
      const response = await fetch(`/api/settings/${resource}`);
      if (!response.ok) throw new Error(`Erreur settings ${response.status}`);
      return response.json();
    }
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
      const isDedicated = settingsPanel === "suppliers" || settingsPanel === "staff";
      let response;

      if (isDedicated) {
        response = await fetch(`/api/settings/${settingsPanel}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(creatingSettingsForm),
        });
      } else {
        response = await fetch(SETTINGS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: settingsPanel,
            action: "create",
            data: creatingSettingsForm,
          }),
        });
      }

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
      showToast("Erreur création : " + error.message, "error");
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
      const isDedicated = settingsPanel === "suppliers" || settingsPanel === "staff";
      let response;

      if (isDedicated) {
        response = await fetch(`/api/settings/${settingsPanel}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingSettingsForm),
        });
      } else {
        response = await fetch(SETTINGS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resource: settingsPanel,
            action: "update",
            id: editingSettingsForm.id,
            data: editingSettingsForm,
          }),
        });
      }

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
      showToast("Erreur modification : " + error.message, "error");
    } finally {
      setSavingSettingsPanel(false);
    }
  };

  const deleteSupplierOrStaff = async (item) => {
    if (!settingsPanel || !item?.id) return;
    if (!confirm("Supprimer définitivement cet élément ?")) return;
    try {
      const endpoint = settingsPanel === "suppliers"
        ? "/api/settings/suppliers"
        : "/api/settings/staff";
      const res = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Erreur suppression");
      const updated = settingsData.filter((row) => row.id !== item.id);
      setSettingsData(updated);
      setSettingsCache((prev) => {
        const next = { ...prev, [settingsPanel]: updated };
        if (typeof window !== "undefined") {
          localStorage.setItem("mokaSettingsCache", JSON.stringify(next));
        }
        return next;
      });
      showToast("Élément supprimé");
    } catch (error) {
      console.error(error);
      showToast("Erreur suppression : " + error.message, "error");
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

  const loadReferentiels = async () => {
    setLoadingReferentiels(true);
    try {
      const res = await fetch("/api/settings/referentiels");
      const data = await res.json();
      setReferentiels(data);
      if (typeof window !== "undefined") {
        localStorage.setItem("mokaReferentielsCache", JSON.stringify(data));
      }
    } catch (err) { console.error("loadReferentiels:", err); }
    finally { setLoadingReferentiels(false); }
  };

  useEffect(() => {
    if (["categories","sousCategories","unites","zones"].includes(settingsPanel)) loadReferentiels();
  }, [settingsPanel]);

  const addRef = async () => {
    if (!refInput.nom.trim()) return;
    setSavingRef(true);
    const payload = {
      type: settingsPanel,
      nom: refInput.nom.trim(),
      emoji: refInput.emoji?.trim() || "",
      abreviation: refInput.abreviation?.trim() || "",
      categorie: refInput.categorie?.trim() || "",
      uniteType: refInput.uniteType || "",
      temperature: refInput.temperature || "",
      ordre: Number(refInput.ordre) || 99,
    };
    console.log("[addRef] Payload:", payload);
    try {
      const res = await fetch("/api/settings/referentiels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRefInput({ nom: "", emoji: "", abreviation: "", categorie: "", uniteType: "", temperature: "", ordre: "" });
      setShowRefAddModal(false);
      await loadReferentiels();
    } catch (err) {
      console.error("Erreur addRef:", err);
      alert("Erreur lors de l'ajout ❌");
    } finally {
      setSavingRef(false);
    }
  };

  const deleteRef = async (id) => {
    await fetch("/api/settings/referentiels", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadReferentiels();
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

  const markOrderSent = async (order) => {
    try {
      const res = await fetch("/api/supplier-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, statut: "Envoyé", dateEnvoi: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Erreur mise à jour statut");
      setSupplierOrders(prev => prev.map(o => o.id === order.id ? { ...o, statut: "Envoyé" } : o));
      setOrderDetail(null);
      setOrdStatusFilter("Envoyé");
      showToast("Commande marquée comme envoyée ✅");
    } catch (err) {
      console.error("[markOrderSent]", err);
      showToast("Erreur : " + err.message, "error");
    }
  };

  const markOrderReceived = async (order) => {
    if (!confirm(`Marquer la commande ${order.fournisseur} comme reçue et ajouter au stock ?`)) return;
    try {
      const updateRes = await fetch("/api/supplier-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id, statut: "Reçu" }),
      });
      if (!updateRes.ok) throw new Error("Erreur mise à jour statut commande");

      console.log("[markOrderReceived] order:", JSON.stringify({
        id: order.id, fournisseur: order.fournisseur, source: order.source,
        produit: order.produit, produits: order.produits, message: order.message?.slice(0, 200),
      }));

      // Bug 1 : isComposed étendu — source varie selon le chemin d'envoi
      const isComposed =
        order.source === "Commandes" ||
        order.source === "MÖKA OS Orders" ||
        order.source === "MokaOS" ||
        (Array.isArray(order.produits) && order.produits.length > 1) ||
        String(order.produit || "").startsWith("Order composée");

      let products = [];

      if (isComposed) {
        // Priorité 1 : tableau order.produits (array Notion) si disponible
        const produitsArray = order.produits || order.products || [];
        if (Array.isArray(produitsArray) && produitsArray.length > 0) {
          products = produitsArray.map(p => {
            if (typeof p === "string") {
              const cleaned = p.replace(/^[•\-]\s*/, "").trim();
              const crossIdx = cleaned.indexOf(" × ");
              const dashIdx  = cleaned.indexOf(" — ");
              const sepIdx   = crossIdx !== -1 ? crossIdx : dashIdx;
              if (sepIdx === -1) return { name: cleaned, qty: 1, unit: "" };
              const name    = cleaned.slice(0, sepIdx).trim();
              const qtyUnit = cleaned.slice(sepIdx + 3).trim();
              const m = qtyUnit.match(/^([0-9.,]+)\s*(.*)$/);
              return { name, qty: m ? parseFloat(m[1].replace(",", ".")) || 1 : 1, unit: m ? m[2].trim() : "" };
            }
            return {
              name: p.produit || p.name || p.ingredient || "",
              qty:  Number(p.quantite || p.qty || 1),
              unit: p.unite || p.unit || "",
            };
          }).filter(p => p.name);
        }

        // Priorité 2 : parser le message texte — formats "• Nom × qty unit" ET "- Nom — qty unit"
        if (products.length === 0 && order.message) {
          products = order.message
            .split("\n")
            .filter(l => /^[•\-]/.test(l.trim()))
            .map(l => {
              const cleaned = l.replace(/^[•\-]\s*/, "").trim();
              const m1 = cleaned.match(/^(.+?)\s*[×x]\s*([0-9.,]+)\s*(.*)$/i);
              const m2 = cleaned.match(/^(.+?)\s*—\s*([0-9.,]+)\s*(.*)$/);
              const m  = m1 || m2;
              if (!m) return { name: cleaned, qty: 1, unit: "" };
              return { name: m[1].trim(), qty: parseFloat(m[2].replace(",", ".")) || 1, unit: m[3].trim() };
            })
            .filter(p => p.name);
        }
      }

      // Fallback : commande simple (un seul produit)
      if (products.length === 0 && order.produit) {
        products = [{ name: order.produit, qty: Number(order.quantite) || 1, unit: order.unite || "" }];
      }

      console.log("[markOrderReceived] Produits parsés:", products);

      // Bug 4 : normalize insensible aux accents et casse
      const normalize = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

      // Update stock via stockLive (STOCK page ID, pas INGREDIENTS page ID)
      await Promise.allSettled(products.map(async (p) => {
        const nameLower   = normalize(p.name);
        const catalogItem = productsDb.find(db => normalize(db.ingredient || db.name || "") === nameLower);
        const stockItem   = stockLive.find(s =>
          (catalogItem?.id && s.ingredientId === catalogItem.id) ||
          normalize(s.name) === nameLower ||
          normalize(s.ingredient) === nameLower
        );
        console.log("[markOrderReceived] Stock update:", { name: p.name, qty: p.qty, unit: p.unit, stockId: stockItem?.id || null });

        if (!stockItem?.id) {
          // Bug 3 : upsert au lieu de skip silencieux
          console.warn("[markOrderReceived] Entrée stock manquante pour:", p.name, "— tentative de création");
          try {
            await fetch(STOCK_UPDATE_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: p.name, poidsTotal: p.qty, mode: "upsert", Unite: p.unit, source: "Réception commande" }),
            });
            console.log("[markOrderReceived] Entrée stock créée pour:", p.name);
          } catch (e) {
            console.error("[markOrderReceived] Impossible de créer entrée stock pour:", p.name, e);
          }
          return;
        }
        return fetch(STOCK_UPDATE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: stockItem.id, poidsTotal: p.qty, mode: "add", Unite: p.unit || stockItem.uniteStock || "" }),
        });
      }));

      setSupplierOrders(prev => prev.map(o => o.id === order.id ? { ...o, statut: "Reçu" } : o));
      setOrderDetail(null);
      setOrdStatusFilter("Reçu");

      refreshAll(1500);

      showToast(`Commande ${order.fournisseur} marquée reçue — stock mis à jour`);
    } catch (err) {
      console.error("[markOrderReceived]", err);
      showToast("Erreur lors de la réception : " + err.message, "error");
    }
  };

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
      if (adminSectionRef.current === "reports") {
        if (y > 200) setHasFixedBottomAction(true);
        else if (y < 50) setHasFixedBottomAction(false);
      }
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
      const todaySXM = getTodaySXM();
      if (todaySXM !== lastKnownDateSXM) {
        setClockStatuses({});
        setLastKnownDateSXM(todaySXM);
        fetch("/api/clock-status")
          .then(r => r.json())
          .then(statuses => setClockStatuses(statuses))
          .catch(() => {});
      }
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
    const checkMidnight = setInterval(() => {
      const todaySXM = getTodaySXM();
      if (todaySXM !== lastKnownDateSXM) {
        setClockStatuses({});
        setLastKnownDateSXM(todaySXM);
        fetch("/api/clock-status")
          .then(r => r.json())
          .then(statuses => setClockStatuses(statuses))
          .catch(() => {});
      }
    }, 60000);
    return () => clearInterval(checkMidnight);
  }, [lastKnownDateSXM]);

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
  }, [isAdmin, adminSection]);

  useEffect(() => {
    if (!isAdmin || adminSection !== "orders" || ordSelectedSupplier) return;
    const suppliers = settingsCache.suppliers || [];
    if (suppliers.length) setOrdSelectedSupplier(ordGetSupplierName(suppliers[0]));
  }, [isAdmin, adminSection, settingsCache.suppliers]);

  useEffect(() => {
    if (!ordSelectedSupplier || !ordSupplierProducts.length) return;
    setComposeCart((prev) => {
      const next = { ...prev };
      let changed = false;
      ordSupplierProducts.forEach((p) => {
        if (!(p.id in next)) {
          next[p.id] = { ...p, qty: p.suggested ?? p.quantiteCommandee ?? 1, included: isUrgentStock(p), fournisseurNom: ordSelectedSupplier };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [ordSelectedSupplier, ordSupplierProducts]);

  useEffect(() => {
    adminSectionRef.current = adminSection;
    const inOrders = adminSection === "orders" && orderView === "compose" && ordIncludedItems.length > 0;
    const modalOpen = showMultiPanelModal || !!orderDetail;
    setHasFixedBottomAction(inOrders || modalOpen);
  }, [adminSection, orderView, ordIncludedItems.length, showMultiPanelModal, orderDetail]);

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

  const openClockModal = async () => {
    setShowClockModal(true);
    setClockStatusLoading(true);
    try {
      if (!staff.length) {
        const res = await fetch(STAFF_URL);
        const data = await res.json();
        setStaff(normalizeArray(data, "staff"));
      }
      const res = await fetch("/api/clock-status?t=" + Date.now());
      const statuses = await res.json();
      setClockStatuses(statuses);
    } catch {}
    finally { setClockStatusLoading(false); }
  };

  useEffect(() => {
    if (!showClockModal) return;
    const interval = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [showClockModal]);

  useEffect(() => {
    if (!showClockModal) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/clock-status?t=" + Date.now());
        const statuses = await res.json();
        setClockStatuses(statuses);
      } catch {}
    }, 15000);
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

  // Resyncs productsDb + products + stockLive after any Notion write.
  // delay accounts for Notion propagation lag (~3-5s).
  const refreshAll = async (delay = 3500) => {
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
    await Promise.allSettled([
      loadProductsDatabase(false),
      refreshOrderPadProducts(),
    ]);
    console.log("[refreshAll] Sync complète ✅");
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
      const response = await fetch("/api/settings/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredient: creatingProductDbForm.ingredient,
          fournisseurDefaut: creatingProductDbForm.fournisseurDefaut || "",
          fournisseurId: creatingProductDbForm.fournisseurId || "",
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
        }),
      });

      if (!response.ok) throw new Error(`Erreur create ${response.status}`);
      const result = await response.json().catch(() => ({}));
      if (!result.success) throw new Error(result.error || "Notion n'a pas confirmé la création");

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
      refreshAll(4000);
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
      const res = await fetch("/api/settings/suppliers");
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
      const response = await fetch("/api/settings/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProductDbForm.id,
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
        }),
      });

      const resText = await response.text();
      console.log("💾 saveProductDbEdit — réponse:", response.status, resText.slice(0, 200));
      if (!response.ok) throw new Error(`Erreur update ${response.status}: ${resText.slice(0, 200)}`);
      const editResult = (() => { try { return JSON.parse(resText); } catch { return {}; } })();
      if (!editResult.success) throw new Error(editResult.error || "Notion n'a pas confirmé la modification");

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
      refreshAll();
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
      const response = await fetch("/api/settings/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || `Erreur delete ${response.status}`);

      const updated = productsDb.filter((row) => row.id !== item.id);
      setProductsDb(updated);

      if (typeof window !== "undefined") {
        localStorage.setItem("mokaProductsDbCache", JSON.stringify(updated));
      }

      showToast("Produit supprimé");
      refreshAll();
    } catch (error) {
      console.error(error);
      showToast("Erreur suppression produit : " + error.message, "error");
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
        const productPayload = {
          ingredient: payload.name,
          fournisseurDefaut: payload.fournisseurDefaut || "",
          fournisseurId: payload.fournisseurDefautId || "",
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
        };
        if (!isNewProduct) productPayload.id = payload.id;
        response = await fetch("/api/settings/products", {
          method: isNewProduct ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(productPayload),
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

      refreshAll();

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
    if (referentiels.categories.length) {
      return ["Tous", ...referentiels.categories
        .map(c => c.nom).filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "fr"))];
    }
    // fallback : valeurs déjà présentes dans productsDb
    const found = [...new Set(productsDb.map((p) => p.categorie || p.category || "Autres"))]
      .filter(Boolean);
    return ["Tous", ...found.sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    })];
  }, [referentiels.categories, productsDb]);

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
      .filter(s => s.actif !== false)
      .map(s => ({ id: s.id || "", name: s.nom || s.name || s.fournisseur || "" }))
      .filter(s => s.id && s.name)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [settingsCache.suppliers]);

  const productsDbZoneChoices = useMemo(() => {
    if (referentiels.zones.length) {
      return referentiels.zones.map(z => z.nom).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
    }
    // fallback
    const fromSettings = (settingsCache.zones || []).map(z => z.nom || z.name || z.zone || "").filter(Boolean);
    const fromProducts = productsDb.map(p => p.zoneStockage || p.zone || "").filter(Boolean);
    return [...new Set([...fromSettings, ...fromProducts])].sort();
  }, [referentiels.zones, settingsCache, productsDb]);

  const productsDbUnitChoices = useMemo(() => {
    if (referentiels.unites.length) {
      return referentiels.unites.map(u => u.abreviation || u.nom).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
    }
    // fallback
    const fromSettings = (settingsCache.units || []).map(u => u.nom || u.name || u.unite || "").filter(Boolean);
    const fromProducts = productsDb.flatMap(p => [p.uniteStock, p.uniteCommande, p.unit]).filter(Boolean);
    return [...new Set([...fromSettings, ...fromProducts, "kg", "g", "L", "ml", "pièce", "carton", "sachet", "bouteille"])].sort();
  }, [referentiels.unites, settingsCache, productsDb]);

  const productsDbSubCategoryChoices = useMemo(() => {
    const selectedCat = creatingProductDb
      ? creatingProductDbForm.categorie
      : (editingProductDb ? editingProductDbForm.categorie : "");
    if (referentiels.sousCategories.length) {
      const filtered = selectedCat
        ? referentiels.sousCategories.filter(s => s.categorie === selectedCat)
        : referentiels.sousCategories;
      return filtered.map(s => s.nom).filter(Boolean).sort((a, b) => a.localeCompare(b, "fr"));
    }
    // fallback
    const fromSettings = (settingsCache.subcategories || []).map(s => s.nom || s.name || "").filter(Boolean);
    const fromProducts = productsDb.map(p => p.sousCategorie || p.subcategory || "").filter(Boolean);
    return [...new Set([...fromSettings, ...fromProducts])].sort();
  }, [referentiels.sousCategories, creatingProductDb, creatingProductDbForm.categorie, editingProductDb, editingProductDbForm.categorie, settingsCache, productsDb]);

  // Dans le formulaire Modifier : injecte la valeur actuelle si absente de la liste référentiels
  const withCurrentVal = (currentValue, opts) => {
    if (currentValue && !opts.includes(currentValue)) return [currentValue, ...opts];
    return opts;
  };

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
            onClick={openClockModal}
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

        {/* ── ADMIN KPI CARDS ──────────────────────────── */}
        {isAdmin && (
          <div className="flex flex-row gap-2 w-full mb-4">
            {[
              { label: "Critiques",  value: stockKpis.critical,    color: "text-red-600",     onClick: () => setActiveTab("stock") },
              { label: "Alertes",    value: stockKpis.alert,       color: "text-orange-600",  onClick: () => setActiveTab("stock") },
              { label: "Prépas",     value: prepCount,             color: "text-[#4a6620]",   onClick: () => setActiveTab("preps") },
              { label: "Commandes",  value: supplierOrders.length, color: "text-[#2c1a10]",   onClick: () => setAdminSection("orders") },
            ].map(({ label, value, color, onClick }) => (
              <button key={label} onClick={onClick}
                className="flex-1 px-3 py-2 rounded-xl border border-[#e5d5c5] bg-white/70 text-left cursor-pointer hover:shadow-md active:scale-[0.98] transition-all shadow-sm">
                <div className={`text-lg font-black ${color}`}>{value}</div>
                <div className="text-[10px] font-bold text-[#9a7060]">{label}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── TABS ────────────────────────────────────── */}
        <div className="flex gap-1.5 mb-4 backdrop-blur-xl bg-white/40 rounded-2xl p-1.5 border border-white/30 shadow-md w-full">
          <button
            onClick={() => {
              setActiveTab("orderpad");
              if (!activeCategory && categories[0]) setActiveCategory(categories[0]);
            }}
            className={`${isIphone ? "h-8 text-[11px]" : "h-10 text-xs"} flex-1 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "orderpad"
                ? "bg-white/80 text-[#2c1a10] shadow-md"
                : "text-[#6b4a3d] hover:bg-white/40"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            OrderPad
          </button>

          <button
            onClick={() => setActiveTab("stock")}
            className={`${isIphone ? "h-8 text-[11px]" : "h-10 text-xs"} flex-1 rounded-xl font-bold whitespace-nowrap transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "stock"
                ? "bg-white/80 text-[#2c1a10] shadow-md"
                : "text-[#6b4a3d] hover:bg-white/40"
            }`}
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            Stock Live
            {(() => { const critCount = stockLive.filter(i => !isPrepStock(i) && String(getStockStatus(i)).toLowerCase().includes("critique")).length; return critCount > 0 ? <span className="bg-red-500 text-white text-[10px] font-black rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">{critCount}</span> : null; })()}
          </button>

          <button
            onClick={() => setActiveTab("preps")}
            className={`${isIphone ? "h-8 text-[11px]" : "h-10 text-xs"} flex-1 rounded-xl font-bold whitespace-nowrap transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "preps"
                ? "bg-white/80 text-[#2c1a10] shadow-md"
                : "text-[#6b4a3d] hover:bg-white/40"
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
                      <div className="flex items-center gap-2 backdrop-blur-sm bg-white/60 border border-white/50 rounded-xl px-3 py-2">
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
                      <div className="flex w-full gap-2">
                        <button
                          onClick={() => setStockView("prepa")}
                          className={`relative flex-1 py-3 rounded-2xl text-sm font-black cursor-pointer transition-all ${
                            stockView === "prepa" ? "bg-[#2c1a10] text-white shadow-md" : "bg-white border border-[#e5d5c5] text-[#2c1a10] hover:bg-[#faf5ef]"
                          }`}
                        >
                          Prépas
                          {prepCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                              {prepCount}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => { setStockView("stock"); if (stockCategories[0]) setActiveStockCategory(stockCategories[0]); }}
                          className={`relative flex-1 py-3 rounded-2xl text-sm font-black cursor-pointer transition-all ${
                            stockView === "stock" ? "bg-[#2c1a10] text-white shadow-md" : "bg-white border border-[#e5d5c5] text-[#2c1a10] hover:bg-[#faf5ef]"
                          }`}
                        >
                          Stock
                          {stockKpis.critical > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                              {stockKpis.critical}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Zone / Catégorie toggle */}
                      {stockView === "stock" && (
                        <div className="flex bg-white rounded-2xl p-1 border border-[#e5d5c5] shadow-sm gap-1">
                          {[["zone", "📍 Par zone"], ["categorie", "🏷️ Par catégorie"]].map(([val, label]) => (
                            <button key={val}
                              onClick={() => setStockViewMode(val)}
                              className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${
                                stockViewMode === val
                                  ? "bg-[#2c1a10] text-white shadow-md"
                                  : "text-[#9a7060] hover:bg-[#faf5ef]"
                              }`}>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Category pills — uniquement en mode catégorie */}
                      {stockView === "stock" && stockViewMode === "categorie" && (
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                          {stockCategories.filter((cat) => String(cat).trim().toLowerCase() !== "tous").map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setActiveStockCategory(cat)}
                              className={`h-7 px-3 rounded-lg whitespace-nowrap text-xs font-bold shrink-0 transition-all cursor-pointer ${
                                activeStockCategory === cat
                                  ? "bg-[#5a7828] text-white"
                                  : "backdrop-blur-sm bg-white/50 text-[#6b4a3d] border border-white/40 hover:bg-white/70"
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

                    {/* Stock view — par zone ou par catégorie */}
                    {stockView === "stock" && stockViewMode === "zone" && stockByZone ? (
                      /* ── Vue par zone ── */
                      <div className="space-y-3">
                        {Object.entries(stockByZone).map(([zoneName, items]) => {
                          if (items.length === 0) return null;
                          const critCount = items.filter(i => String(getStockStatus(i)).toLowerCase().includes("critique")).length;
                          const lowCount = items.filter(i => String(getStockStatus(i)).toLowerCase().includes("stock bas")).length;
                          const isCollapsed = collapsedZones.has(zoneName);
                          const zl = zoneName.toLowerCase();
                          const zoneIcon = zl.includes("congel") || zl.includes("congél") ? "❄️"
                            : zl.includes("frigo") ? "🧊"
                            : zl === "bar" || zl.includes("bar") ? "☕"
                            : zl.includes("dry") || zl.includes("sec") ? "📦"
                            : zl.includes("pain") || zl.includes("boulang") ? "🍞"
                            : zoneName === "Sans zone" ? "📍"
                            : "🗄️";
                          return (
                            <div key={zoneName} className="backdrop-blur-sm bg-white/70 border border-white/50 overflow-hidden shadow-sm rounded-2xl">
                              <button
                                onClick={() => toggleZone(zoneName)}
                                className="w-full flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-[#faf5ef] transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="text-lg">{zoneIcon}</span>
                                  <div className="text-left">
                                    <div className="text-sm font-black text-[#2c1a10]">{zoneName}</div>
                                    <div className="text-[10px] text-[#9a7060] font-medium">
                                      {items.length} produit{items.length > 1 ? "s" : ""}
                                      {critCount > 0 && <span className="ml-1.5 text-red-500 font-bold">· {critCount} critique{critCount > 1 ? "s" : ""}</span>}
                                      {lowCount > 0 && !critCount && <span className="ml-1.5 text-orange-500 font-bold">· {lowCount} bas</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {critCount > 0 && <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{critCount}</span>}
                                  {lowCount > 0 && <span className="w-5 h-5 rounded-full bg-orange-400 text-white text-[10px] font-black flex items-center justify-center">{lowCount}</span>}
                                  <svg className={`w-4 h-4 text-[#9a7060] transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                                  </svg>
                                </div>
                              </button>
                              {!isCollapsed && (
                                <div className="divide-y divide-[#f5ede0]">
                                  {items.map(item => {
                                    const stockId = item.id || getStockName(item);
                                    const status = getStockStatus(item);
                                    const isCritical = String(status).toLowerCase().includes("critique");
                                    const isLow = String(status).toLowerCase().includes("stock bas");
                                    const qty = getStockQty(item);
                                    const unit = getStockDisplayUnit(item);
                                    return (
                                      <div key={stockId} className="flex items-center gap-3 px-4 py-3 hover:bg-[#faf5ef] transition-colors">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isCritical ? "bg-red-500" : isLow ? "bg-orange-400" : String(status).toLowerCase().includes("configurer") ? "bg-gray-300" : "bg-[#5a7828]"}`}/>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-bold text-[#2c1a10] truncate">{getStockName(item)}</div>
                                          {isCritical && <div className="text-[10px] text-red-500 font-bold">CRITIQUE — À commander</div>}
                                          {isLow && !isCritical && <div className="text-[10px] text-orange-500 font-bold">Stock bas</div>}
                                        </div>
                                        <div className={`text-sm font-black shrink-0 ${isCritical ? "text-red-600" : isLow ? "text-orange-500" : "text-[#2c1a10]"}`}>
                                          {qty || "—"}{unit && <span className="text-xs font-semibold text-[#9a7060] ml-0.5">{unit}</span>}
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); openStockReceive(item, "add"); }}
                                          className="w-8 h-8 rounded-xl bg-[#f0f7e5] border border-[#c8dfa0] flex items-center justify-center shrink-0 cursor-pointer active:bg-[#e0f0d0] transition-colors">
                                          <svg className="w-3.5 h-3.5 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); openStockReceive(item, "replace"); }}
                                          className="w-8 h-8 rounded-xl bg-[#faf5ef] border border-[#e5d5c5] flex items-center justify-center shrink-0 cursor-pointer active:bg-[#f0e8dc] transition-colors">
                                          <svg className="w-3.5 h-3.5 text-[#9a7060]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* ── Vue par catégorie ── */
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
                              <div className="space-y-2">
                                {items.map((item) => {
                                  const stockId = item.id || getStockName(item);
                                  const status = getStockStatus(item);
                                  const isCritical = String(status).toLowerCase().includes("critique");
                                  const isLow = String(status).toLowerCase().includes("stock bas");
                                  return (
                                    <div key={stockId} onClick={() => openStockReceive(item, "add")}
                                      className={`flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl border transition-all active:scale-[0.98] cursor-pointer ${isCritical ? "border-l-4 border-l-red-400 border-[#fde8e8]" : isLow ? "border-l-4 border-l-orange-400 border-[#fef3e2]" : "border-[#e5d5c5]"}`}
                                    >
                                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCritical ? "bg-red-500" : isLow ? "bg-orange-400" : String(status).toLowerCase().includes("configurer") ? "bg-gray-300" : "bg-[#5a7828]"}`}/>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-black text-[#2c1a10] truncate">{getStockName(item)}</div>
                                        <div className="text-[10px] text-[#9a7060] font-medium">{getStockCategory(item)}{item.sousCategorie ? ` · ${item.sousCategorie}` : ""}</div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div className={`text-base font-black ${isCritical ? "text-red-600" : isLow ? "text-orange-500" : "text-[#2c1a10]"}`}>
                                          {getStockQty(item) || "—"}<span className="text-xs font-semibold text-[#9a7060] ml-0.5">{getStockDisplayUnit(item)}</span>
                                        </div>
                                        {!String(status).toLowerCase().includes("configurer") && (
                                          <div className={`text-[9px] font-bold ${isCritical ? "text-red-500" : isLow ? "text-orange-400" : "text-[#5a7828]"}`}>
                                            {isCritical ? "CRITIQUE" : isLow ? "BAS" : "OK"}
                                          </div>
                                        )}
                                      </div>
                                      <button onClick={(e) => { e.stopPropagation(); openStockReceive(item, "add"); }} className="w-9 h-9 rounded-xl bg-[#f0f7e5] border border-[#c8dfa0] flex items-center justify-center shrink-0 active:bg-[#e0f0d0] cursor-pointer">
                                        <svg className="w-4 h-4 text-[#5a7828]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                {items.map((item) => {
                                  const stockId = item.id || getStockName(item);
                                  const selected = stockView === "prepa" && !!cart[stockId];
                                  const status = getStockStatus(item);
                                  const isCritical = String(status).toLowerCase().includes("critique");
                                  const isLow = String(status).toLowerCase().includes("stock bas");
                                  return (
                                    <div key={stockId}
                                      onClick={() => { if (stockView === "stock") { openStockReceive(item, "add"); return; } selected ? removeItem(stockId) : addStockPrep(item); }}
                                      className={`rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.98] ${selected ? "bg-[#4a6620] text-white border-[#4a6620] shadow-xl ring-2 ring-[#5a7828]/40" : "bg-white text-[#2c1a10] border-[#e5d5c5] hover:shadow-lg hover:border-[#c8b8a8]"}`}
                                    >
                                      <div className={`h-1.5 ${isCritical ? "bg-gradient-to-r from-red-600 to-red-400" : isLow ? "bg-gradient-to-r from-orange-500 to-amber-400" : selected ? "bg-white/30" : "bg-gradient-to-r from-[#5a7828] to-[#7aa830]"}`} />
                                      <div className="p-4">
                                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold mb-2.5 ${isCritical ? selected ? "bg-white/20 text-white" : "bg-red-50 text-red-700 border border-red-200" : isLow ? selected ? "bg-white/20 text-white" : "bg-orange-50 text-orange-700 border border-orange-200" : selected ? "bg-white/20 text-white" : "bg-[#f0f7e5] text-[#4a6620] border border-[#c8dfa0]"}`}>
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
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openStockReceive(item, "add"); }} className="flex-1 rounded-xl bg-[#f0f7e5] border border-[#c8dfa0] px-3 py-2.5 text-left hover:bg-[#e5f0d5] transition-colors cursor-pointer flex items-center gap-2">
                                              <svg className="w-3.5 h-3.5 text-[#5a7828] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg>
                                              <div><div className="text-[10px] font-bold text-[#5a7828] uppercase tracking-wide">Réception</div><div className="text-xs font-black text-[#2c1a10]">Ajouter du stock</div></div>
                                            </button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); openStockReceive(item, "replace"); }} className="rounded-xl bg-[#faf5ef] border border-[#e5d5c5] px-3 py-2.5 hover:bg-[#f0e8dc] transition-colors cursor-pointer flex items-center gap-1.5">
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
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── ORDERPAD TAB ──── */}
            {activeTab === "orderpad" && (
              <>
                {/* Search + category filters */}
                <div className="bg-white rounded-2xl p-3 mb-4 border border-[#e5d5c5] shadow-sm space-y-3">
                  <div className="flex items-center gap-2 backdrop-blur-sm bg-white/60 border border-white/50 rounded-xl px-3 py-2">
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

                  {/* Category circles */}
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.filter((cat) => {
                      const cl = String(cat).trim().toLowerCase();
                      return cl !== "tous" && !cl.includes("prépa") && !cl.includes("prepa");
                    }).map((cat) => {
                      const isActive = activeCategory === cat;
                      const cartCount = Object.values(cart).filter(item => (item.category || "Autres") === cat).length;
                      return (
                        <div
                          key={cat}
                          onClick={() => { setActiveCategory(cat); setActiveSubCategory(""); }}
                          className="flex flex-col items-center gap-1 w-16 shrink-0 cursor-pointer relative"
                        >
                          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl border-2 transition-all ${
                            isActive ? "bg-[#2c1a10] border-[#2c1a10]" : "bg-white border-[#e5d5c5]"
                          }`}>
                            {getSmartCategoryEmoji(cat)}
                          </div>
                          <span className={`text-[10px] font-black text-center truncate w-16 ${isActive ? "text-[#2c1a10]" : "text-[#6b4a3d]"}`}>{cat}</span>
                          {cartCount > 0 && (
                            <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center">
                              {cartCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Sub-category pills */}
                  {subCategories.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      <button
                        onClick={() => setActiveSubCategory("")}
                        className={`h-7 px-3 rounded-md text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                          !activeSubCategory
                            ? "bg-[#2c1a10] text-white"
                            : "backdrop-blur-sm bg-white/50 text-[#8b6f61] border border-white/40 hover:bg-white/70"
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
                              : "backdrop-blur-sm bg-white/50 text-[#8b6f61] border border-white/40 hover:bg-white/70"
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

                        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
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
                                  className={`w-full h-14 flex items-center justify-center overflow-hidden cursor-pointer relative ${
                                    selected ? "bg-[#3d5518]" : "bg-[#f0e8dc]"
                                  }`}
                                >
                                  {product.photo ? (
                                    <img src={product.photo} alt={product.name || "Produit"} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-2xl">{categoryEmojis[cat] || "📌"}</span>
                                  )}
                                  {selected && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-[#3d5518]/60">
                                      <svg className="w-5 h-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </div>
                                  )}
                                </button>

                                {/* Card body */}
                                <button
                                  onClick={() => selected ? removeItem(product.id) : addProduct(product)}
                                  className="w-full text-left p-2 cursor-pointer"
                                >
                                  <div className="flex justify-between gap-1 mb-1.5">
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-xs font-black leading-tight line-clamp-2">{product.name}</h3>
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
                {/* Filtres catégorie */}
                <div className="flex w-full gap-2">
                  {prepsCategories.map(cat => {
                    const todoCount = prepsTodoByCategory[cat] || 0;
                    const isActive = prepsStation === cat;
                    return (
                      <button key={cat} onClick={() => setPrepsStation(cat)}
                        className={`relative flex-1 py-3 rounded-2xl text-sm font-black cursor-pointer transition-all ${
                          isActive ? "bg-[#2c1a10] text-white shadow-md" : "bg-white border border-[#e5d5c5] text-[#2c1a10] hover:bg-[#faf5ef]"
                        }`}>
                        {cat}
                        {todoCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                            {todoCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
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
                          Aucune prépa en attente{prepsStation ? ` en ${prepsStation}` : ""}
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
                          <button
                            onClick={() => removeItem(item.id)}
                            className="shrink-0 w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-all cursor-pointer ml-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
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
              station: prepsStation || prepsCategories[0] || "Bar",
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
        <div className="fixed right-4 z-40" style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}>
          <button
            onClick={() => setShowMobileCart(true)}
            className="w-14 h-14 rounded-full bg-[#5a7828] text-white shadow-xl flex items-center justify-center cursor-pointer active:scale-95 transition-transform relative"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">{cartItems.length}</span>
          </button>
        </div>
      )}

      {/* ── MOBILE CART DRAWER (iPhone) ──────────────── */}
      {isIphone && showMobileCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="flex-1 bg-black/50" onClick={() => setShowMobileCart(false)} />
          <div className="bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "82vh" }}>
            <div className="w-10 h-1 bg-[#e5d5c5] rounded-full mx-auto mt-3 mb-1 shrink-0" />
            {/* Cart header */}
            <div className="px-4 py-3 border-b border-[#f0e8dc] bg-[#faf5ef] flex items-center justify-between shrink-0">
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
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
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
                      <button
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-all cursor-pointer ml-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Send button — toujours visible, hors du scroll */}
            <div className="shrink-0 px-4 pt-3 border-t border-[#f0e8dc]" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
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
              <><div className="h-2" /><div className="backdrop-blur-sm bg-white/70 border border-white/50 shadow-sm overflow-hidden rounded-2xl" style={{height: "calc(100vh - 100px)"}}>
                {/* Single unified filter bar */}
                <div className="p-3 border-b border-[#e5d5c5] space-y-2">
                  {/* Search + action buttons */}
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 backdrop-blur-sm bg-white/60 border border-white/50 rounded-xl px-3 py-2 flex-1 focus-within:bg-white/80 focus-within:border-white/70 transition-all">
                      <svg className="w-4 h-4 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input value={productsDbSearch} onChange={(e) => setProductsDbSearch(e.target.value)} placeholder="Rechercher un produit…" className="w-full bg-transparent outline-none text-[#2c1a10] placeholder:text-[#b09080] text-sm"/>
                      {productsDbSearch && <button onClick={() => setProductsDbSearch("")} className="text-[#9a7060] cursor-pointer"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                    </div>
                    <button onClick={() => loadProductsDatabase(false)} className="h-10 px-3 rounded-xl bg-[#faf5ef] border border-[#e5d5c5] text-[#6b4a3d] hover:bg-[#f0e4d4] transition-colors cursor-pointer shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    </button>
                    <button onClick={openProductDbCreate} className="h-10 px-3 rounded-xl bg-[#2c1a10] text-[#f5ede0] hover:bg-[#1e100a] transition-colors cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5 text-xs font-black">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                      Nouveau
                    </button>
                  </div>
                  {/* Zone / Catégorie toggle */}
                  <div className="flex bg-[#faf5ef] rounded-xl p-1 border border-[#e5d5c5] gap-1">
                    {[["categorie","🏷️ Par catégorie"],["zone","📍 Par zone"]].map(([val,label]) => (
                      <button key={val} onClick={() => setProductsDbViewMode(val)}
                        className={`flex-1 py-2 rounded-lg text-xs font-black cursor-pointer transition-all ${productsDbViewMode === val ? "bg-[#2c1a10] text-white shadow-sm" : "text-[#9a7060] hover:text-[#2c1a10]"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Category pills */}
                  <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                    {productsDbCategories.filter(c => {const cl=c.toLowerCase(); return cl !== "tous" ? !cl.includes("prépa") && !cl.includes("prepa") : true;}).map((cat) => (
                      <button key={cat} onClick={() => setProductsDbCategory(cat)}
                        className={`h-7 px-3 rounded-lg whitespace-nowrap text-xs font-bold shrink-0 transition-all cursor-pointer ${productsDbCategory === cat ? "bg-[#5a7828] text-white" : "bg-white text-[#6b4a3d] border border-[#e5d5c5] hover:bg-[#faf5ef]"}`}>
                        {cat === "Tous" ? "Tous" : `${getSmartCategoryEmoji(cat)} ${cat}`}
                      </button>
                    ))}
                  </div>
                  <div className="text-[11px] font-semibold text-[#9a7060] flex items-center gap-2">
                    {loadingProductsDb ? "Chargement…" : `${filteredProductsDb.length} produit${filteredProductsDb.length > 1 ? "s" : ""}`}
                    {syncingProductsDb && !loadingProductsDb && <span className="animate-pulse">· Sync…</span>}
                  </div>
                </div>

                <div className="overflow-auto" style={{maxHeight: "calc(100vh - 300px)"}}>
                  {(() => {
                    const groups = {};
                    filteredProductsDb.forEach(item => {
                      const key = productsDbViewMode === "zone"
                        ? (String(item.zoneStockage || item.zone || "Sans zone").trim() || "Sans zone")
                        : (item.categorie || item.category || "Autres");
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(item);
                    });
                    const sortedKeys = Object.keys(groups).sort((a, b) => {
                      if (a === "Sans zone" || a === "Autres") return 1;
                      if (b === "Sans zone" || b === "Autres") return -1;
                      return a.localeCompare(b, "fr");
                    });
                    return sortedKeys.map(groupKey => (
                      <div key={groupKey}>
                        <div className="px-4 py-2 bg-[#faf5ef] border-b border-[#e5d5c5] text-[10px] font-black text-[#9a7060] uppercase tracking-wide sticky top-0 z-10 mb-2">
                          {productsDbViewMode === "zone" ? "📍" : getSmartCategoryEmoji(groupKey)} {groupKey} — {groups[groupKey].length}
                        </div>
                        <div className="px-3 py-2">
                        {groups[groupKey].map((item, idx) => (
                          <div key={item.id || idx} className="rounded-2xl border border-[#e5d5c5] bg-white px-4 py-3 shadow-sm flex items-start gap-3 hover:shadow-md hover:border-[#d0c0b0] transition-all mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-[#2c1a10]">{item.ingredient || item.name || "—"}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${item.visibleOrderPad !== false ? "bg-[#f0f7e5] text-[#5a7828]" : "bg-gray-100 text-gray-500"}`}>
                                  {item.visibleOrderPad !== false ? "Visible" : "Masqué"}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[10px] text-[#6b4a3d]">
                                <span>{getSmartCategoryEmoji(item.categorie || item.category || "")} {item.categorie || item.category || "—"}</span>
                                {(item.zoneStockage || item.zone) && <span>📍 {item.zoneStockage || item.zone}</span>}
                                {getProductsDbSupplierName(item) && <span>🏪 {getProductsDbSupplierName(item)}</span>}
                                {(item.uniteStock || item.unit) && <span>📏 {item.uniteStock || item.unit}</span>}
                                {(item.portionGrammes || item.portion) ? <span>⚖️ {item.portionGrammes || item.portion}g</span> : null}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => openProductDbEdit(item)} className="h-7 px-2.5 rounded-xl bg-[#5a7828] text-white text-[10px] font-black hover:bg-[#4e6a22] transition-colors cursor-pointer">✏️</button>
                              <button onClick={() => deleteProductDb(item)} className="h-7 px-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[10px] font-black hover:bg-red-100 transition-colors cursor-pointer">✕</button>
                            </div>
                          </div>
                        ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div></>
            )}

            {/* INVENTORY PANEL */}
            {adminSection === "inventory" && (
              <div className={`space-y-3 ${isIphone ? "pb-32" : "pb-28"}`}>
                <div className="h-2" />
                {/* 2 boutons majeurs */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowScanFacture(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 backdrop-blur-sm bg-white/70 border border-white/50 shadow-sm hover:bg-white/90 hover:shadow-md active:scale-[0.97] transition-all duration-200 cursor-pointer rounded-2xl"
                  >
                    <span className="text-2xl">📸</span>
                    <span className="text-xs font-black text-[#2c1a10]">Scanner facture</span>
                    <span className="text-[10px] text-[#9a7060]">IA → mise à jour stock</span>
                  </button>
                  <button
                    onClick={() => setShowScanZ(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-1.5 py-4 backdrop-blur-sm bg-white/70 border border-white/50 shadow-sm hover:bg-white/90 hover:shadow-md active:scale-[0.97] transition-all duration-200 cursor-pointer rounded-2xl"
                  >
                    <span className="text-2xl">🧾</span>
                    <span className="text-xs font-black text-[#2c1a10]">Scanner Z caisse</span>
                    <span className="text-[10px] text-[#9a7060]">IA → décompte ventes</span>
                  </button>
                </div>

                <div className="backdrop-blur-sm bg-white/70 border border-white/50 shadow-sm overflow-hidden rounded-2xl">
                  <div className="p-3 border-b border-[#e5d5c5] space-y-2">
                    {/* Search */}
                    <div className="flex items-center gap-2 backdrop-blur-sm bg-white/60 border border-white/50 rounded-xl px-3 py-2">
                      <svg className="w-4 h-4 text-[#9a7060] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input value={stockSearch} onChange={(e) => setStockSearch(e.target.value)}
                        placeholder={inventoryView === "stock" ? "Rechercher un produit stock…" : "Rechercher une prépa…"}
                        className="w-full bg-transparent outline-none text-[#2c1a10] placeholder:text-[#b09080] text-sm font-medium"/>
                      {stockSearch && <button onClick={() => setStockSearch("")} className="text-[#9a7060] cursor-pointer hover:text-[#2c1a10] transition-colors"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                    </div>

                    {/* View toggle — pills full-width */}
                    <div className="flex w-full gap-2">
                      {[{ key: "stock", label: "Stock" }, { key: "prepa", label: "Prépas" }].map(({ key, label }) => (
                        <button key={key}
                          onClick={() => { setInventoryView(key); setInventoryCategory("Tous"); setInventoryStatusFilter("Tous"); }}
                          className={`relative flex-1 py-3 rounded-2xl text-sm font-black cursor-pointer transition-all ${inventoryView === key ? "bg-[#2c1a10] text-white shadow-md" : "bg-white border border-[#e5d5c5] text-[#2c1a10] hover:bg-[#faf5ef]"}`}>
                          {label}
                          {key === "stock" && stockKpis.critical > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">{stockKpis.critical}</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Zone / Catégorie toggle */}
                    <div className="flex bg-white rounded-2xl p-1 border border-[#e5d5c5] shadow-sm gap-1">
                      {[["zone","📍 Par zone"],["categorie","🏷️ Par catégorie"]].map(([val,label]) => (
                        <button key={val}
                          onClick={() => { setInventoryViewMode(val); setInventoryCategory("Tous"); }}
                          className={`flex-1 py-2 rounded-xl text-xs font-black cursor-pointer transition-all ${inventoryViewMode === val ? "bg-[#2c1a10] text-white shadow-md" : "text-[#9a7060] hover:bg-[#faf5ef]"}`}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Category pills */}
                    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                      {inventoryCategories.map((cat) => (
                        <button key={cat} onClick={() => setInventoryCategory(cat)}
                          className={`h-7 px-3 rounded-lg whitespace-nowrap text-xs font-bold shrink-0 transition-all cursor-pointer ${inventoryCategory === cat ? "bg-[#5a7828] text-white" : "backdrop-blur-sm bg-white/50 text-[#6b4a3d] border border-white/40 hover:bg-white/70"}`}>
                          {cat === "Tous" ? "Tous" : `${getSmartCategoryEmoji(cat)} ${cat}`}
                        </button>
                      ))}
                    </div>

                    {/* Status filter pills */}
                    <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                      {[
                        ["all", "Tout", null],
                        ["critical", "🔴 Critiques", inventoryBaseItems.filter(i => String(getStockStatus(i)).toLowerCase().includes("critique")).length],
                        ["low", "🟠 Stock bas", inventoryBaseItems.filter(i => { const s = String(getStockStatus(i)).toLowerCase(); return s.includes("stock bas") || s.includes("alerte") || s.includes("à commander"); }).length],
                        ["ok", "🟢 OK", null],
                      ].map(([val, label, count]) => (
                        <button key={val}
                          onClick={() => setInventoryStatusFilter(val === "all" ? "Tous" : val === "critical" ? "Critiques" : val === "low" ? "Stock bas" : "OK")}
                          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap ${
                            (val === "all" && inventoryStatusFilter === "Tous") || (val === "critical" && inventoryStatusFilter === "Critiques") || (val === "low" && inventoryStatusFilter === "Stock bas") || (val === "ok" && inventoryStatusFilter === "OK")
                              ? "bg-[#2c1a10] text-white shadow-md"
                              : "bg-white border border-[#e5d5c5] text-[#6b4a3d]"
                          }`}>
                          {label}
                          {count > 0 && <span className="bg-white/20 px-1 rounded-md text-[9px] font-black">{count}</span>}
                        </button>
                      ))}
                    </div>

                    <div className="text-[11px] font-semibold text-[#9a7060]">
                      {inventoryFilteredStock.length} élément{inventoryFilteredStock.length > 1 ? "s" : ""}
                      {inventoryStatusFilter !== "Tous" && ` · ${inventoryStatusFilter}`}
                      {inventoryCategory !== "Tous" && ` · ${inventoryCategory}`}
                    </div>
                  </div>

                  {/* Card list — groupé par zone ou catégorie */}
                  <div className="overflow-auto" style={{maxHeight: "calc(100vh - 420px)"}}>
                    {inventoryFilteredStock.length === 0 ? (
                      <div className="text-center text-[#9a7060] text-sm py-12">Aucun élément</div>
                    ) : (() => {
                      const renderCard = (item, index) => {
                        const status = getStockStatus(item);
                        const statusLower = String(status).toLowerCase();
                        const isCritical = statusLower.includes("critique");
                        const isLow = statusLower.includes("stock bas") || statusLower.includes("alerte") || statusLower.includes("à commander");
                        const qty = inventoryView === "stock"
                          ? `${getStockQty(item)}${getStockDisplayUnit(item) ? " " + getStockDisplayUnit(item) : ""}`
                          : `${getStockPortions(item)} portions`;
                        return (
                          <div key={item.id || index} className="rounded-2xl border border-[#e5d5c5] bg-white px-4 py-3 shadow-sm flex items-center gap-3 hover:shadow-md hover:border-[#d0c0b0] transition-all mb-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${isCritical ? "bg-red-500" : isLow ? "bg-orange-400" : statusLower.includes("configurer") ? "bg-gray-300" : "bg-[#5a7828]"}`}/>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-[#2c1a10] truncate">{getStockName(item)}</div>
                              <div className="text-[10px] text-[#9a7060]">
                                {inventoryViewMode === "zone"
                                  ? <>{getSmartCategoryEmoji(getStockCategory(item))} {getStockCategory(item)}</>
                                  : <>📍 {getStockZone(item) || "Sans zone"}</>
                                }
                              </div>
                              {isCritical && <div className="text-[10px] text-red-500 font-bold">CRITIQUE — À commander</div>}
                              {isLow && !isCritical && <div className="text-[10px] text-orange-500 font-bold">Stock bas</div>}
                            </div>
                            <div className={`text-sm font-black shrink-0 ${isCritical ? "text-red-600" : isLow ? "text-orange-500" : "text-[#2c1a10]"}`}>{qty}</div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => openInventoryAdjust(item)} className="h-7 px-2.5 rounded-xl bg-[#5a7828] text-white text-[10px] font-black hover:bg-[#4e6a22] transition-colors cursor-pointer">Ajuster</button>
                              <button onClick={() => deleteProductDb(item)} className="h-7 px-2.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[10px] font-black hover:bg-red-100 transition-colors cursor-pointer">✕</button>
                            </div>
                          </div>
                        );
                      };
                      const groups = {};
                      inventoryFilteredStock.forEach(item => {
                        const key = inventoryViewMode === "zone"
                          ? (String(getStockZone(item) || "Sans zone").trim() || "Sans zone")
                          : (getStockCategory(item) || "Autres");
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(item);
                      });
                      const sortedKeys = Object.keys(groups).sort((a, b) => {
                        if (a === "Sans zone" || a === "Autres") return 1;
                        if (b === "Sans zone" || b === "Autres") return -1;
                        return a.localeCompare(b, "fr");
                      });
                      return sortedKeys.map(groupKey => (
                        <div key={groupKey}>
                          <div className="px-4 py-2 bg-[#faf5ef] border-b border-[#e5d5c5] text-[10px] font-black text-[#9a7060] uppercase tracking-wide sticky top-0 z-10 mb-2">
                            {inventoryViewMode === "zone" ? "📍" : getSmartCategoryEmoji(groupKey)} {groupKey} — {groups[groupKey].length}
                          </div>
                          <div className="px-3 py-2">
                            {groups[groupKey].map((item, idx) => renderCard(item, idx))}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS PANEL */}
            {adminSection === "orders" && (
              <div className={`min-h-[calc(100vh-120px)] relative ${isIphone ? "pb-32" : "pb-28"}`}>
                {/* ── Header: 2-tab switcher + refresh ── */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex gap-1.5 bg-white/60 rounded-2xl p-1.5 border border-[#e5d5c5] shadow-sm flex-1">
                    {[["history","📜 Historique"],["compose","📝 Composer"]].map(([id,label]) => (
                      <button key={id} onClick={() => setOrderView(id)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 ${orderView === id ? "bg-[#2c1a10] text-white shadow-md" : "text-[#6b4a3d] hover:bg-[#f0e4d4]"}`}>
                        {label}
                        {id === "history" && supplierOrders.length > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${orderView === id ? "bg-white/20" : "bg-[#f0e4d4]"}`}>{supplierOrders.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button onClick={loadSupplierOrders}
                    className="w-10 h-10 shrink-0 rounded-xl backdrop-blur-sm bg-white/50 border border-white/40 text-[#6b4a3d] hover:bg-white/70 cursor-pointer flex items-center justify-center text-base transition-colors">
                    {loadingSupplierOrders ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : "↻"}
                  </button>
                </div>

                {/* ── VUE COMPOSER ── */}
                {orderView === "compose" && (
                  <div className="space-y-4 pb-28">
                    {/* Fournisseurs — bulles circulaires scrollables */}
                    <div>
                      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-2">Fournisseur</div>
                      {(settingsCache.suppliers || []).length === 0 ? (
                        <div className="rounded-2xl p-8 text-center text-sm text-[#9a7060]" style={{ background: "rgba(255,255,255,0.7)" }}>
                          Aucun fournisseur configuré dans les paramètres.
                        </div>
                      ) : (
                        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-hide px-1">
                          {(settingsCache.suppliers || []).map((s) => {
                            const name = ordGetSupplierName(s);
                            const urgentCount = ordUrgentItems.filter((i) => i.fournisseur === name).length;
                            const selectedCount = Object.values(composeCart).filter(i => i.included && i.fournisseurNom === name).length;
                            const isSelected = ordSelectedSupplier === name;
                            return (
                              <button key={s.id || name}
                                onClick={() => setOrdSelectedSupplier(name)}
                                className="flex flex-col items-center shrink-0 w-20 gap-0 cursor-pointer relative">
                                <div className="relative">
                                  <div
                                    className="w-20 h-20 rounded-full flex items-center justify-center p-2 border-2 transition-all duration-200"
                                    style={isSelected
                                      ? { background: "#2c1a10", borderColor: "#2c1a10", boxShadow: "0 4px 16px rgba(44,26,16,0.25)" }
                                      : { background: "#ffffff", borderColor: "#e5d5c5", boxShadow: "0 2px 8px rgba(44,26,16,0.08)" }
                                    }
                                  >
                                    <span className={`text-[10px] font-black text-center leading-tight break-words hyphens-auto ${isSelected ? "text-white" : "text-[#2c1a10]"}`}>{name}</span>
                                  </div>
                                  {selectedCount > 0 && (
                                    <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-[#5a7828] text-white text-[9px] font-black flex items-center justify-center">
                                      {selectedCount}
                                    </span>
                                  )}
                                  {urgentCount > 0 && selectedCount === 0 && (
                                    <span className="absolute top-0 right-0 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                                      {urgentCount}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Card contact fournisseur sélectionné */}
                    {ordSelectedSupplier && ordSupplierContact && (() => {
                      const phone = ordGetSupplierPhone(ordSupplierContact);
                      const whatsapp = ordGetSupplierWhatsapp(ordSupplierContact);
                      const waNumber = (whatsapp || phone).replace(/\D/g, "");
                      const displayPhone = whatsapp || phone;
                      return (
                        <div className="w-full rounded-2xl px-4 py-3 flex items-center justify-between gap-3 mb-3 overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", border: "1px solid rgba(229,213,197,0.8)", boxSizing: "border-box" }}>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="text-[11px] font-black text-[#9a7060] uppercase tracking-wide truncate max-w-full">{ordSelectedSupplier}</div>
                            {displayPhone && <div className="text-[11px] text-[#9a7060] mt-0.5 truncate max-w-full overflow-hidden">{displayPhone}</div>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {phone && (
                              <a href={`tel:${phone.replace(/\D/g, "")}`}
                                className="w-10 h-10 bg-[#f0e8dc] rounded-xl flex items-center justify-center text-base hover:bg-[#e5d5c5] transition-colors cursor-pointer">
                                📞
                              </a>
                            )}
                            {waNumber && (
                              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
                                className="w-10 h-10 bg-green-50 border border-green-200 rounded-xl flex items-center justify-center text-base hover:bg-green-100 transition-colors cursor-pointer">
                                💬
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Produits du fournisseur sélectionné */}
                    {ordSelectedSupplier && (
                      <div className="backdrop-blur-sm bg-white/80 border border-[#e5d5c5] rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-[#e5d5c5] flex items-center justify-between">
                          <div>
                            <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide">Produits — {ordSelectedSupplier}</div>
                            <div className="text-xs text-[#9a7060] mt-0.5">{ordIncludedItems.length}/{ordSupplierProducts.length} sélectionnés</div>
                          </div>
                        </div>
                        {loadingProductsDb ? (
                          <div className="p-6 text-center text-sm text-[#9a7060]">Chargement…</div>
                        ) : ordSupplierProducts.length === 0 ? (
                          <div className="p-5 text-sm text-[#9a7060]">Aucun produit lié à ce fournisseur dans la base.</div>
                        ) : (
                          <div className="divide-y divide-[#f5ede0]">
                            {[...ordSupplierProducts].sort((a, b) => {
                              const aU = isUrgentStock(a) ? 0 : 1;
                              const bU = isUrgentStock(b) ? 0 : 1;
                              return aU - bU;
                            }).map((p) => {
                              const item = composeCart[p.id] || { ...p, qty: p.suggested, included: isUrgentStock(p) };
                              const isCrit = String(p.status).toLowerCase().includes("critique");
                              const isLow = isUrgentStock(p) && !isCrit;
                              return (
                                <div key={p.id} className={`px-4 py-3 flex items-center gap-3 transition-colors ${!item.included ? "opacity-40" : ""}`}>
                                  <OrdToggle checked={item.included}
                                    onChange={(v) => setComposeCart((prev) => ({ ...prev, [p.id]: { ...item, included: v, fournisseurId: ordSupplierContact?.id || null, fournisseurNom: ordSelectedSupplier } }))} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-black text-[#2c1a10] truncate">{p.name}</div>
                                    {isCrit && <div className="text-[10px] font-bold text-red-600">🔴 Critique</div>}
                                    {isLow && <div className="text-[10px] font-bold text-orange-500">🟠 Stock bas</div>}
                                  </div>
                                  <OrdStepper value={item.qty}
                                    onChange={(v) => setComposeCart((prev) => ({ ...prev, [p.id]: { ...item, qty: v } }))}
                                    min={0} unit={p.unit} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {ordIncludedItems.length > 0 && (
                      <textarea value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Livraison matin, emballage sous-vide…"
                        className="w-full rounded-2xl border border-[#e5d5c5] bg-white/80 backdrop-blur-sm px-4 py-3 text-sm text-[#2c1a10] outline-none resize-none placeholder:text-[#b09080] focus:border-[#c8a882] transition"
                        rows={2} />
                    )}
                  </div>
                )}

                {/* ── VUE HISTORIQUE ── */}
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
                    <div className="space-y-2">
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {["À commander", "Envoyé", "Reçu", "Annulé"].map((s) => (
                          <button key={s} onClick={() => setOrdStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer ${ordStatusFilter === s ? "bg-[#2c1a10] text-white" : "backdrop-blur-sm bg-white/50 border border-white/40 text-[#6b4a3d] hover:bg-white/70"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                      <div className="text-[11px] text-[#9a7060] font-bold">{ordFilteredOrders.length} commande{ordFilteredOrders.length !== 1 ? "s" : ""}</div>
                      {ordFilteredOrders.length === 0 && (
                        <div className="bg-white rounded-2xl border border-[#e5d5c5] p-8 text-center text-sm text-[#9a7060]">Aucune commande.</div>
                      )}
                      {grouped.map(([mois, orders]) => (
                        <div key={mois}>
                          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide px-1 py-2 mt-3 first:mt-0">{mois}</div>
                          <div className="space-y-2">
                            {orders.map((order) => (
                              <div key={order.id} className="backdrop-blur-sm bg-white/70 border border-white/50 shadow-sm overflow-hidden rounded-2xl">
                                <div className="px-4 py-3 flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <OrdStatusBadge status={order.statut} />
                                      <span className="text-[10px] text-[#9a7060]">{formatDateSXM(order.dateCreation || order.dateEnvoi)}</span>
                                    </div>
                                    <div className="font-black text-sm text-[#2c1a10] truncate">{order.produit}</div>
                                    <div className="text-[11px] text-[#9a7060] mt-0.5 truncate">{order.fournisseur}</div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {order.statut !== "Reçu" && order.statut !== "Annulé" && (
                                      <button onClick={() => markOrderReceived(order)}
                                        className="text-xs font-black text-white bg-[#5a7828] px-3 py-1.5 rounded-xl cursor-pointer hover:bg-[#4e6a22] transition-colors">
                                        ✅ Reçu
                                      </button>
                                    )}
                                    <button onClick={() => setOrderDetail(order)}
                                      className="text-xs font-black text-[#5a7828] border border-[#5a7828] px-3 py-1.5 rounded-xl cursor-pointer hover:bg-[#f0f7e5] transition-colors">
                                      Détail →
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ── CTA Composer ── */}
                {orderView === "compose" && ordIncludedItems.length > 0 && (
                  <div className="sticky bottom-4 z-10 mx-4 pb-4">
                    <button onClick={() => setShowMultiPanelModal(true)}
                      className="w-full py-4 rounded-2xl bg-[#5a7828] text-white font-black text-sm shadow-lg active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      {(() => {
                        const nbFourn = new Set(ordIncludedItems.map(i => i.fournisseurNom).filter(Boolean)).size;
                        return nbFourn > 1
                          ? `Préparer les messages → ${nbFourn} fournisseurs`
                          : "Préparer le message →";
                      })()}
                    </button>
                  </div>
                )}

                {/* ── Modals ── */}
                {showMultiPanelModal && (
                  <OrdMultiPanelModal groups={composeCartGroups} onClose={() => setShowMultiPanelModal(false)}
                    onAllSent={async () => { setShowMultiPanelModal(false); setComposeCart({}); setOrdSelectedSupplier(""); await loadSupplierOrders(); setOrderView("history"); }} />
                )}
                {orderDetail && (
                  <OrdDetailModal
                    orderDetail={orderDetail}
                    setOrderDetail={setOrderDetail}
                    supplier={(settingsCache.suppliers || []).find((s) => ordGetSupplierName(s) === orderDetail.fournisseur)}
                    onMarkSent={() => markOrderSent(orderDetail)}
                    onMarkReceived={() => markOrderReceived(orderDetail)}
                  />
                )}
              </div>
            )}

            {/* REPORTS PANEL */}
            {adminSection === "reports" && (
              <div className={`space-y-4 ${isIphone ? "pb-36" : "pb-32"}`}>
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

                    {/* Heures travaillées par staff */}
                    <div className="bg-white rounded-2xl p-5 border border-[#e5d5c5] shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-[#2c1a10]">⏱ Heures travaillées</h3>
                        <span className="text-[10px] font-bold text-[#9a7060] bg-[#faf5ef] px-2 py-1 rounded-lg">
                          {reportsPeriode === "tout" ? "Tout" : reportsPeriode === "mois" ? "Ce mois" : "7 jours"}
                        </span>
                      </div>
                      {reportsData.staff.heures?.length === 0 ? (
                        <div className="text-center text-[#9a7060] text-xs py-8">Aucune donnée de pointage</div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {reportsData.staff.heures?.map(({ nom, heures, detail }) => (
                            <div key={nom} onClick={() => setSelectedStaffHours({ nom, heures, detail })} className="bg-gradient-to-br from-[#faf5ef] to-[#f0e8dc] rounded-xl p-3 border border-[#e5d5c5] cursor-pointer hover:shadow-md transition-all active:scale-[0.97]">
                              <div className="w-7 h-7 rounded-lg bg-[#2c1a10] flex items-center justify-center text-white text-[10px] font-black mb-2">
                                {nom.charAt(0).toUpperCase()}
                              </div>
                              <div className="text-xl font-black text-[#2c1a10]">{formatHeures(heures)}</div>
                              <div className="text-[10px] font-bold text-[#9a7060] truncate">{nom}</div>
                            </div>
                          ))}
                        </div>
                      )}
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

            {/* Modal détail heures staff */}
            {selectedStaffHours && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setSelectedStaffHours(null)}>
                <div onClick={e => e.stopPropagation()} className="backdrop-blur-2xl bg-white/90 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-white/50 w-full sm:max-w-md max-h-[80vh] overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
                  <div className="w-10 h-1 bg-[#e5d5c5] rounded-full mx-auto mt-3 mb-1 sm:hidden"/>
                  <div className="px-5 py-4 border-b border-[#e5d5c5] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#2c1a10] flex items-center justify-center text-white text-sm font-black">
                        {selectedStaffHours.nom.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-base font-black text-[#2c1a10]">{selectedStaffHours.nom}</div>
                        <div className="text-xs text-[#9a7060] font-semibold">{formatHeures(selectedStaffHours.heures)} au total</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedStaffHours(null)} className="w-8 h-8 rounded-xl bg-white border border-[#e5d5c5] flex items-center justify-center cursor-pointer">×</button>
                  </div>
                  <div className="p-4 space-y-2">
                    {selectedStaffHours.detail.length === 0 ? (
                      <div className="text-center text-[#9a7060] text-sm py-8">Aucun détail disponible</div>
                    ) : (
                      selectedStaffHours.detail.map(({ date, heures, incomplete }) => (
                        <div key={date} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-[#e5d5c5]">
                          <div>
                            <div className="text-sm font-bold text-[#2c1a10]">
                              {formatSXMDate(date)}
                            </div>
                            {incomplete && (
                              <div className="text-[10px] text-orange-500 font-bold">⚠️ Pointage incomplet (pas de départ)</div>
                            )}
                          </div>
                          <div className="text-sm font-black text-[#5a7828]">{formatHeures(heures)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="h-24" aria-hidden="true" />
              </div>
            )}

            {/* SETTINGS PANEL */}
            {adminSection === "settings" && (
              <div className={`space-y-4 ${isIphone ? "pb-32" : "pb-28"}`}>
                <div className="h-2" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: "suppliers",     panelType: null,             title: "Fournisseurs",     desc: "Ajouter, modifier, désactiver", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                  { key: "categories",   panelType: "categories",     title: "Catégories",       desc: "Créer / organiser", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg> },
                  { key: "subcategories",panelType: "sousCategories", title: "Sous-catégories", desc: "Ranger les produits", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> },
                  { key: "units",        panelType: "unites",         title: "Unités",           desc: "kg, pièce, carton…", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg> },
                  { key: "zones",        panelType: "zones",          title: "Zones",            desc: "Stockage et emplacement", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> },
                  { key: "staff",        panelType: null,             title: "Staff",            desc: "Équipe et pointage", icon: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                ].map(({ key, title, desc, icon, panelType }) => (
                  <button
                    key={key}
                    onClick={() => panelType ? (setSettingsPanel(panelType), loadReferentiels()) : loadSettingsPanel(key)}
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

      {/* ── Modal Ajouter Référentiel ── */}
      {showRefAddModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setShowRefAddModal(false)}>
          <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div className="relative w-full max-w-sm rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Ajouter</div>
              <h2 className="text-base font-black text-[#2c1a10] mt-0.5">
                {settingsPanel === "categories" && "🏷 Nouvelle catégorie"}
                {settingsPanel === "sousCategories" && "📂 Nouvelle sous-catégorie"}
                {settingsPanel === "unites" && "⚖️ Nouvelle unité"}
                {settingsPanel === "zones" && "🗺 Nouvelle zone"}
              </h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nom *</label>
                <input value={refInput.nom} onChange={(e) => setRefInput((p) => ({ ...p, nom: e.target.value }))}
                  placeholder="Nom…"
                  className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors" />
              </div>
              {settingsPanel === "categories" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Emoji</label>
                  <input value={refInput.emoji} onChange={(e) => setRefInput((p) => ({ ...p, emoji: e.target.value }))}
                    placeholder="📦" maxLength={4}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-center outline-none focus:border-[#5a7828] transition-colors" />
                </div>
              )}
              {settingsPanel === "zones" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Emoji</label>
                  <input value={refInput.emoji} onChange={(e) => setRefInput((p) => ({ ...p, emoji: e.target.value }))}
                    placeholder="🧊" maxLength={4}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-center outline-none focus:border-[#5a7828] transition-colors" />
                </div>
              )}
              {settingsPanel === "unites" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Abréviation</label>
                  <input value={refInput.abreviation} onChange={(e) => setRefInput((p) => ({ ...p, abreviation: e.target.value }))}
                    placeholder="kg" maxLength={10}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm outline-none focus:border-[#5a7828] transition-colors" />
                </div>
              )}
              {settingsPanel === "unites" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Type</label>
                  <select value={refInput.uniteType} onChange={(e) => setRefInput((p) => ({ ...p, uniteType: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors">
                    <option value="">Choisir…</option>
                    <option value="Poids">Poids</option>
                    <option value="Volume">Volume</option>
                    <option value="Pièce">Pièce</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>
              )}
              {settingsPanel === "sousCategories" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Catégorie parente</label>
                  <select value={refInput.categorie} onChange={(e) => setRefInput((p) => ({ ...p, categorie: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors">
                    <option value="">Aucune</option>
                    {referentiels.categories.map((c) => <option key={c.id} value={c.nom}>{c.emoji} {c.nom}</option>)}
                  </select>
                </div>
              )}
              {settingsPanel === "zones" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Température</label>
                  <select value={refInput.temperature} onChange={(e) => setRefInput((p) => ({ ...p, temperature: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors">
                    <option value="">Choisir…</option>
                    <option value="Ambiant">Ambiant</option>
                    <option value="Froid">Froid</option>
                    <option value="Surgelé">Surgelé</option>
                  </select>
                </div>
              )}
              {(settingsPanel === "categories" || settingsPanel === "sousCategories") && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Ordre</label>
                  <input type="number" value={refInput.ordre} onChange={(e) => setRefInput((p) => ({ ...p, ordre: e.target.value }))}
                    placeholder="99"
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm outline-none focus:border-[#5a7828] transition-colors" />
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
              <button onClick={() => setShowRefAddModal(false)}
                className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
                Annuler
              </button>
              <button onClick={addRef} disabled={savingRef || !refInput.nom.trim()}
                className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50 hover:bg-[#4e6a22] transition-colors">
                {savingRef ? "Ajout…" : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Scanner facture ── */}
      {showScanFacture && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowScanFacture(false)}>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <h2 className="text-base font-black text-[#2c1a10]">📸 Scanner une facture</h2>
              <p className="text-xs text-[#9a7060]">Prenez en photo votre facture fournisseur — l'IA extrait les produits et quantités automatiquement</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#2c1a10] text-white font-black text-sm cursor-pointer active:scale-[0.98] transition-all">
                📷 Prendre une photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                  setShowScanFacture(false);
                  setInvoiceModal(true);
                  setInvoiceResults([]);
                  setInvoiceImageUrl("");
                  setInvoiceImage(null);
                  handleInvoicePhoto(e);
                }} />
              </label>
              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#f0e8dc] text-[#2c1a10] font-black text-sm cursor-pointer active:scale-[0.98] transition-all">
                🖼 Choisir depuis la galerie
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  setShowScanFacture(false);
                  setInvoiceModal(true);
                  setInvoiceResults([]);
                  setInvoiceImageUrl("");
                  setInvoiceImage(null);
                  handleInvoicePhoto(e);
                }} />
              </label>
              <button onClick={() => setShowScanFacture(false)}
                className="w-full py-3 text-sm font-bold text-[#9a7060] cursor-pointer">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Scanner Z de caisse ── */}
      {showScanZ && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowScanZ(false)}>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <h2 className="text-base font-black text-[#2c1a10]">🧾 Scanner un Z de caisse</h2>
              <p className="text-xs text-[#9a7060]">Photographiez votre Z de caisse — l'IA comptabilise les ventes automatiquement</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#2c1a10] text-white font-black text-sm cursor-pointer active:scale-[0.98] transition-all">
                📷 Prendre une photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={() => { setShowScanZ(false); showToast("Fonctionnalité bientôt disponible", "warning"); }} />
              </label>
              <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-[#f0e8dc] text-[#2c1a10] font-black text-sm cursor-pointer active:scale-[0.98] transition-all">
                🖼 Choisir depuis la galerie
                <input type="file" accept="image/*" className="hidden" onChange={() => { setShowScanZ(false); showToast("Fonctionnalité bientôt disponible", "warning"); }} />
              </label>
              <button onClick={() => setShowScanZ(false)}
                className="w-full py-3 text-sm font-bold text-[#9a7060] cursor-pointer">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN BOTTOM NAV — glassmorphism ─────────── */}
      {isAdmin && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[90] flex justify-center"
          style={{
            transition: "opacity 0.25s ease, transform 0.25s ease",
            opacity: hasFixedBottomAction ? 0 : 1,
            transform: hasFixedBottomAction ? "translateY(20px)" : "translateY(0)",
            pointerEvents: hasFixedBottomAction ? "none" : "auto",
          }}
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <div
            className="flex items-center gap-1 px-2 py-2 rounded-[2rem]"
            style={{
              background: "rgba(245, 237, 224, 0.45)",
              backdropFilter: "blur(32px) saturate(180%)",
              WebkitBackdropFilter: "blur(32px) saturate(180%)",
              border: "1px solid rgba(255,255,255,0.55)",
              boxShadow: "0 8px 32px rgba(44,26,16,0.15), inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            {[
              { id: "dashboard", label: "Dashboard", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></svg> },
              { id: "products", label: "Produits", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/><circle cx="18.5" cy="15.5" r="2.5"/><path d="M20.27 17.27 22 19"/></svg> },
              { id: "inventory", label: "Inventaire", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect width="6" height="4" x="9" y="3" rx="1"/><path d="m9 12 2 2 4-4"/></svg> },
              { id: "orders", label: "Commandes", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> },
              { id: "reports", label: "Rapports", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg> },
              ...(!isIphone ? [{ id: "settings", label: "Paramètres", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> }] : []),
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setAdminSection(id)}
                className="relative flex flex-col items-center justify-center w-12 h-12 rounded-[1.1rem] transition-all duration-200 cursor-pointer shrink-0"
                style={adminSection === id ? {
                  background: "rgba(255,255,255,0.7)",
                  boxShadow: "0 2px 8px rgba(44,26,16,0.12), inset 0 1px 0 rgba(255,255,255,0.9)",
                } : {}}
              >
                <span className={adminSection === id ? "text-[#2c1a10]" : "text-[#9a7060]"}>
                  {icon}
                </span>
                {adminSection === id && (
                  <span className="text-[8px] font-black text-[#2c1a10] mt-0.5 leading-none whitespace-nowrap">
                    {label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SETTINGS DATABASE MODAL ──────────────────── */}
      {settingsPanel && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="backdrop-blur-2xl bg-white/90 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/50 w-full sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-[#e5d5c5] flex justify-between items-center shrink-0">
              <div>
                <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Paramètres</div>
                <h2 className="text-base font-black text-[#2c1a10] mt-0.5">
                  {settingsPanel === "suppliers" && "🏢 Fournisseurs"}
                  {settingsPanel === "staff" && "👥 Staff"}
                  {settingsPanel === "categories" && "🏷 Catégories"}
                  {settingsPanel === "sousCategories" && "📂 Sous-catégories"}
                  {settingsPanel === "unites" && "⚖️ Unités"}
                  {settingsPanel === "zones" && "🗺 Zones"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {["suppliers","staff"].includes(settingsPanel) && (
                  <button
                    onClick={() => loadSettingsPanel(settingsPanel)}
                    disabled={loadingSettingsPanel}
                    className="h-9 px-3 rounded-xl border border-[#e5d5c5] bg-white text-[10px] font-black text-[#9a7060] cursor-pointer disabled:opacity-50 hover:bg-[#f0e8dc] transition-colors"
                  >
                    {loadingSettingsPanel ? "…" : "↻ Actualiser"}
                  </button>
                )}
                {["categories","sousCategories","unites","zones"].includes(settingsPanel) && (
                  <button
                    onClick={async () => {
                      if (!confirm("Importer toutes les valeurs existantes depuis la base Matières premières ?")) return;
                      setImportingRef(true);
                      try {
                        const res = await fetch("/api/settings/referentiels/import", { method: "POST" });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Erreur serveur");
                        await loadReferentiels();
                        alert(`Import terminé ✅\n+${data.imported.categories} catégories\n+${data.imported.sousCategories} sous-catégories\n+${data.imported.zones} zones\n+${data.imported.unites} unités`);
                      } catch (err) {
                        alert("Erreur import : " + err.message);
                      } finally {
                        setImportingRef(false);
                      }
                    }}
                    disabled={importingRef}
                    className="h-9 px-3 rounded-xl border border-[#e5d5c5] bg-white text-[10px] font-black text-[#9a7060] cursor-pointer disabled:opacity-50 hover:bg-[#f0e8dc] transition-colors"
                  >
                    {importingRef ? "Import…" : "⬇ Importer"}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (["categories","sousCategories","unites","zones"].includes(settingsPanel)) {
                      setRefInput({ nom: "", emoji: "", abreviation: "", categorie: "", temperature: "", uniteType: "", ordre: "" });
                      setShowRefAddModal(true);
                    } else {
                      openSettingsCreate();
                    }
                  }}
                  className="h-9 px-3 rounded-xl bg-[#5a7828] text-white text-xs font-bold cursor-pointer hover:bg-[#4e6a22] transition-colors"
                >
                  ➕ Nouveau
                </button>
                <button
                  onClick={() => setSettingsPanel("")}
                  className="w-9 h-9 rounded-xl bg-[#f0e8dc] flex items-center justify-center text-lg text-[#9a7060] hover:bg-[#e5d5c5] transition-colors cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>

            {["categories","sousCategories","unites","zones"].includes(settingsPanel) ? (
              <div className="flex-1 overflow-y-auto px-4 py-3 pb-32 space-y-2">
                {(referentiels[settingsPanel] || []).length === 0 && !loadingReferentiels && (
                  <div className="text-center text-[#9a7060] text-sm py-10">
                    Aucun élément — cliquez sur ➕ Nouveau pour en ajouter.
                  </div>
                )}
                {(referentiels[settingsPanel] || []).length === 0 && loadingReferentiels && (
                  <div className="text-center text-[#9a7060] text-sm py-10 animate-pulse">
                    Chargement…
                  </div>
                )}
                {(referentiels[settingsPanel] || []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[#e5d5c5] bg-white px-4 py-3 shadow-sm flex items-center gap-3">
                    {item.emoji && <span className="text-xl shrink-0">{item.emoji}</span>}
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-[#2c1a10] truncate">{item.nom}</div>
                      {item.abreviation && <div className="text-xs text-[#9a7060]">{item.abreviation}</div>}
                      {item.uniteType && <div className="text-xs text-[#9a7060]">{item.uniteType}</div>}
                      {item.categorie && <div className="text-xs text-[#9a7060]">↳ {item.categorie}</div>}
                      {item.temperature && <div className="text-xs text-[#9a7060]">{item.temperature}</div>}
                    </div>
                    <button onClick={() => deleteRef(item.id)}
                      className="shrink-0 h-8 px-3 rounded-xl bg-red-50 border border-red-100 text-red-500 text-xs font-bold cursor-pointer hover:bg-red-100 transition-colors">
                      🗑 Supprimer
                    </button>
                  </div>
                ))}
              </div>
            ) : loadingSettingsPanel ? (
              <div className="flex-1 px-4 py-10 text-center text-[#9a7060] text-sm animate-pulse">Chargement…</div>
            ) : settingsData.length === 0 ? (
              <div className="flex-1 px-4 py-10 text-center text-[#9a7060] text-sm">Aucun élément — cliquez sur ➕ Nouveau pour en ajouter.</div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4 py-3 pb-32 space-y-2">
                {settingsData.map((item, index) => (
                  <div key={item.id || item.nom || index} className="rounded-2xl border border-[#e5d5c5] bg-white px-4 py-3 shadow-sm flex items-center gap-3">
                    <div className="text-xl shrink-0">
                      {settingsPanel === "suppliers" ? "🏢" : "👤"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-[#2c1a10] truncate">{item.nom || item.name || item.fournisseur || item.prenom || "Sans nom"}</div>
                      <div className="text-xs text-[#9a7060] flex items-center gap-2 flex-wrap">
                        {(item.categorie || item.category || item.role) && <span>{item.categorie || item.category || item.role}</span>}
                        {(item.telephone || item.whatsapp || item.phone) && <span>📞 {item.telephone || item.whatsapp || item.phone}</span>}
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${item.actif === false ? "bg-red-50 text-red-600" : "bg-[#f0f7e5] text-[#5a7828]"}`}>
                          {item.actif === false ? "Inactif" : "Actif"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => openSettingsEdit(item)} className="h-8 px-3 rounded-xl bg-[#f0e8dc] border border-[#e5d5c5] text-xs font-bold text-[#6b4a3d] hover:bg-[#e5d5c5] transition-colors cursor-pointer">✏️</button>
                      <button onClick={() => deleteSupplierOrStaff(item)} className="h-8 px-3 rounded-xl bg-red-50 border border-red-100 text-xs font-bold text-red-500 hover:bg-red-100 transition-colors cursor-pointer">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE SETTINGS ITEM MODAL ───────────────── */}
      {creatingSettingsItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setCreatingSettingsItem(false)}>
          <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Ajouter</div>
              <h2 className="text-base font-black text-[#2c1a10] mt-0.5">
                {settingsPanel === "suppliers" && "🏢 Nouveau fournisseur"}
                {settingsPanel === "staff" && "👥 Nouveau staff"}
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Nom *</label>
                <input
                  value={creatingSettingsForm.nom || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, nom: e.target.value, name: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  placeholder="Nom…"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">{settingsPanel === "staff" ? "Rôle" : "Catégorie"}</label>
                <input
                  value={creatingSettingsForm.categorie || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, categorie: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  placeholder={settingsPanel === "staff" ? "Barista, Caissier…" : "Boissons, Épicerie…"}
                />
              </div>
              {settingsPanel === "suppliers" && (
                <div>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Méthode contact</label>
                  <select
                    value={creatingSettingsForm.methodeContact || "WhatsApp"}
                    onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, methodeContact: e.target.value }))}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  >
                    <option>WhatsApp</option><option>Email</option><option>Téléphone</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Téléphone / WhatsApp</label>
                <input
                  value={creatingSettingsForm.telephone || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, telephone: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  placeholder="+590…"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">Email</label>
                <input
                  value={creatingSettingsForm.email || ""}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  placeholder="contact@…"
                />
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={creatingSettingsForm.actif !== false}
                  onChange={(e) => setCreatingSettingsForm((prev) => ({ ...prev, actif: e.target.checked }))}
                  className="w-4 h-4 accent-[#5a7828]"
                />
                Actif
              </label>
            </div>

            <div className="flex gap-3 pt-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
              <button onClick={() => setCreatingSettingsItem(false)}
                className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
                Annuler
              </button>
              <button
                onClick={saveSettingsDatabaseCreate}
                disabled={savingSettingsPanel || !creatingSettingsForm.nom?.trim()}
                className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50 hover:bg-[#4e6a22] transition-colors">
                {savingSettingsPanel ? "Création…" : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SETTINGS ITEM MODAL ─────────────────── */}
      {editingSettingsItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={() => setEditingSettingsItem(null)}>
          <div className="absolute inset-0 bg-black/40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} />
          <div className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[10px] font-bold text-[#9a7060] uppercase tracking-wide">Modifier</div>
              <h2 className="text-base font-black text-[#2c1a10] mt-0.5">
                {settingsPanel === "suppliers" ? "🏢 Fournisseur" : "👥 Staff"}
              </h2>
            </div>

            <div className="space-y-3">
              {[
                { label: "Nom", key: "nom", extra: (v) => ({ name: v }), placeholder: "Nom…" },
                { label: settingsPanel === "staff" ? "Rôle" : "Catégorie", key: "categorie", extra: (v) => ({ role: v }), placeholder: settingsPanel === "staff" ? "Barista, Caissier…" : "Boissons…" },
                { label: "Téléphone / WhatsApp", key: "telephone", extra: (v) => ({ whatsapp: v, phone: v }), placeholder: "+590…" },
                { label: "Email", key: "email", placeholder: "contact@…" },
              ].map(({ label, key, extra, placeholder }) => (
                <div key={key}>
                  <label className="block text-[10px] font-bold text-[#9a7060] uppercase tracking-wide mb-1.5">{label}</label>
                  <input
                    value={editingSettingsForm[key] || ""}
                    onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, [key]: e.target.value, ...(extra ? extra(e.target.value) : {}) }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold text-[#2c1a10] outline-none focus:border-[#5a7828] transition-colors"
                  />
                </div>
              ))}
              <label className="flex items-center gap-3 rounded-xl border border-[#e5d5c5] bg-white px-4 py-3 text-sm font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingSettingsForm.actif !== false}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, actif: e.target.checked }))}
                  className="w-4 h-4 accent-[#5a7828]"
                />
                Actif
              </label>
            </div>

            <div className="flex gap-3 pt-1" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
              <button onClick={() => setEditingSettingsItem(null)}
                className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
                Annuler
              </button>
              <button
                onClick={saveSettingsDatabaseItem}
                disabled={savingSettingsPanel}
                className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50 hover:bg-[#4e6a22] transition-colors">
                {savingSettingsPanel ? "Enregistrement…" : "Sauvegarder"}
              </button>
            </div>
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
              className="w-full py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-lg hover:bg-[#4e6a22] active:scale-[0.96] transition-all duration-100 disabled:opacity-50 cursor-pointer"
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
              className="w-full py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-lg hover:bg-[#4e6a22] active:scale-[0.96] transition-all duration-100 disabled:opacity-50 cursor-pointer"
            >
              {savingInventory ? "Mise à jour…" : "Mettre à jour le stock ✅"}
            </button>
          </div>
        </div>
      )}

      {/* ── PRODUCT SETTINGS MODAL (quick edit) ──────── */}
      {settingsItem && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="backdrop-blur-2xl bg-white/90 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-white/50 w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5">
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
              className="w-full mt-5 py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-lg hover:bg-[#4e6a22] active:scale-[0.96] transition-all duration-100 disabled:opacity-50 cursor-pointer"
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
                    {editingProductDbForm.fournisseurDefaut && !productsDbSupplierChoices.find(s => s.name === editingProductDbForm.fournisseurDefaut) && (
                      <option value={editingProductDbForm.fournisseurId || ""}>{editingProductDbForm.fournisseurDefaut} (actuel)</option>
                    )}
                    {productsDbSupplierChoices.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {editingProductDbForm.fournisseurId && (
                    <div className="text-[9px] text-[#9a7060] mt-1 font-mono truncate">ID: {editingProductDbForm.fournisseurId}</div>
                  )}
                </div>

                {[
                  ["Catégorie", "categorie", "select", productsDbCategories.filter(c => c !== "Tous")],
                  ["Sous-catégorie", "sousCategorie", "select", productsDbSubCategoryChoices],
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
                        {withCurrentVal(editingProductDbForm[key], opts).map((o) => <option key={o} value={o}>{o}</option>)}
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
              className="w-full mt-5 py-3.5 rounded-xl bg-[#5a7828] text-white font-black text-sm shadow-lg hover:bg-[#4e6a22] active:scale-[0.96] transition-all duration-100 disabled:opacity-50 cursor-pointer"
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

          {clockStatusLoading && (
            <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border-b border-orange-100">
              <div className="w-3 h-3 rounded-full border-2 border-orange-400 border-t-transparent animate-spin"/>
              <span className="text-xs text-orange-600 font-semibold">Synchronisation en cours...</span>
            </div>
          )}

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
                        className="w-full h-14 rounded-2xl bg-[#5a7828] text-white font-black text-base shadow-lg hover:bg-[#4e6a22] active:scale-[0.96] transition-all duration-100 disabled:opacity-50 cursor-pointer"
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
                        className="w-full h-14 rounded-2xl bg-[#5a7828] text-white font-black text-base shadow-lg hover:bg-[#4e6a22] active:scale-[0.96] transition-all duration-100 disabled:opacity-50 cursor-pointer"
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
          <div className="backdrop-blur-2xl bg-white/90 rounded-3xl shadow-2xl border border-white/50 w-full max-w-sm p-6 relative">
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
  const s = String(status || "");
  let cls, icon;
  if (s === "À commander") { cls = "bg-orange-100 text-orange-700 border border-orange-200"; icon = "🟠"; }
  else if (s === "Envoyé")  { cls = "bg-blue-100 text-blue-700 border border-blue-200";   icon = "📤"; }
  else if (s === "Reçu")    { cls = "bg-green-100 text-green-700 border border-green-200"; icon = "✅"; }
  else if (s === "Annulé")  { cls = "bg-gray-100 text-gray-500 border border-gray-200";    icon = "✖️"; }
  else                       { cls = "bg-blue-50 text-blue-700 border border-blue-100";    icon = "🔵"; }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${cls}`}>
      {icon} {s}
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
  const [currentStep, setCurrentStep] = React.useState(0);
  const [sentPanels, setSentPanels] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const touchStartX = React.useRef(null);

  const n = groups.length;
  const currentGroup = groups[Math.min(currentStep, n - 1)];
  if (!currentGroup) return null;

  const message = buildGroupedMessage(currentGroup.fournisseurNom, currentGroup.items);
  const wa = currentGroup.supplier ? ordGetSupplierWhatsapp(currentGroup.supplier) : null;
  const em = currentGroup.supplier ? ordGetSupplierEmail(currentGroup.supplier) : null;
  const isLast = currentStep === n - 1;
  const isSent = !!sentPanels[currentGroup.fournisseurId || currentGroup.fournisseurNom];

  const markSent = async (group) => {
    const key = group.fournisseurId || group.fournisseurNom;
    if (sentPanels[key]) return;
    setSaving(true);
    const msg = buildGroupedMessage(group.fournisseurNom, group.items);
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
      console.error("Erreur markSent:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAndAdvance = async () => {
    await markSent(currentGroup);
    if (isLast) { onAllSent(); } else { setCurrentStep((s) => s + 1); }
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -50 && currentStep < n - 1) setCurrentStep((s) => s + 1);
    if (delta > 50 && currentStep > 0) setCurrentStep((s) => s - 1);
    touchStartX.current = null;
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md bg-[#f5ede0] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header fixe */}
        <div className="shrink-0 px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide">
              {currentStep + 1} / {n} fournisseur{n > 1 ? "s" : ""}
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white border border-[#e5d5c5] flex items-center justify-center text-[#9a7060] text-lg font-black cursor-pointer">
              ×
            </button>
          </div>
          {n > 1 && (
            <div className="flex gap-1.5 justify-center">
              {groups.map((g, i) => {
                const sent = !!sentPanels[g.fournisseurId || g.fournisseurNom];
                return (
                  <button key={i} onClick={() => setCurrentStep(i)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      i === currentStep ? "bg-[#2c1a10] w-6" : sent ? "bg-[#5a7828] w-3" : "bg-[#e5d5c5] w-1.5"
                    }`} />
                );
              })}
            </div>
          )}
        </div>

        {/* Carousel scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}>
          <div className="text-xl font-black text-[#2c1a10] mb-3">{currentGroup.fournisseurNom}</div>
          <div className="bg-[#e8f5e1] rounded-2xl p-4 mb-3"
            style={{ border: "1px solid rgba(134,188,106,0.3)" }}>
            <div className="text-[10px] font-black text-[#5a8a3a] mb-2 uppercase tracking-wide">Aperçu message</div>
            <div className="font-mono text-xs text-[#2d5a1b] whitespace-pre-wrap leading-relaxed">{message}</div>
          </div>
          <div className="space-y-1.5 pb-3">
            {currentGroup.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-[#e5d5c5]">
                <span className="text-xs font-bold text-[#2c1a10] truncate flex-1">{item.name}</span>
                <span className="text-xs font-black text-[#9a7060] shrink-0 ml-2">{item.qty} {item.unit}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer fixe */}
        <div className="shrink-0 px-5 pt-3 space-y-2 border-t border-[#e5d5c5]"
          style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
          {n > 1 && (
            <div className="flex items-center justify-between mb-1">
              <button onClick={() => setCurrentStep((s) => s - 1)} disabled={currentStep === 0}
                className="text-xs font-bold text-[#9a7060] disabled:opacity-30 cursor-pointer px-2">
                ← {currentStep > 0 ? groups[currentStep - 1].fournisseurNom : ""}
              </button>
              <button onClick={() => setCurrentStep((s) => s + 1)} disabled={isLast}
                className="text-xs font-bold text-[#9a7060] disabled:opacity-30 cursor-pointer px-2">
                {!isLast ? groups[currentStep + 1].fournisseurNom : ""} →
              </button>
            </div>
          )}
          {wa && (
            <a href={`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`}
              target="_blank" rel="noreferrer"
              onClick={() => markSent(currentGroup)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#25D366] text-white font-black text-sm cursor-pointer active:scale-[0.98] transition-all">
              💬 Envoyer sur WhatsApp
            </a>
          )}
          {em && !wa && (
            <a href={`mailto:${em}?subject=Commande MÖKA&body=${encodeURIComponent(message)}`}
              onClick={() => markSent(currentGroup)}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#2563eb] text-white font-black text-sm cursor-pointer active:scale-[0.98] transition-all">
              📧 Envoyer par Email
            </a>
          )}
          <button onClick={handleMarkAndAdvance} disabled={saving}
            className={`w-full py-4 rounded-2xl font-black text-sm cursor-pointer active:scale-[0.98] transition-all disabled:opacity-60 ${
              isSent ? "bg-[#5a7828] text-white" : "bg-[#2c1a10] text-white"
            }`}>
            {saving ? "Enregistrement…" : isSent
              ? (isLast ? "✅ Terminé — fermer" : `Suivant → ${groups[currentStep + 1].fournisseurNom}`)
              : (isLast ? "✅ Marquer comme envoyé" : `✅ Marquer comme envoyé · Suivant →`)}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdPreviewModal({ buildMessage, selectedSupplier, supplier, setShowPreview, onSent }) {
  const message = buildMessage();
  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-3">
      <div className="backdrop-blur-2xl bg-white/90 rounded-[1.4rem] shadow-xl border border-white/50 w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
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

function OrdDetailModal({ orderDetail, supplier, setOrderDetail, onMarkSent, onMarkReceived }) {
  const dateStr = String(orderDetail.dateCreation || "").slice(0, 10);
  const message = orderDetail.message || "";
  const statut = orderDetail.statut || "";
  const wa = ordGetSupplierWhatsapp(supplier);

  const btnWhatsApp = message && wa ? (
    <button onClick={() => window.open(`https://wa.me/${String(wa).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`)}
      className="flex-1 py-3 rounded-[1rem] bg-green-50 border border-green-200 text-green-700 font-black text-xs">
      💬 Envoyer WhatsApp
    </button>
  ) : null;

  const btnCopy = message ? (
    <button onClick={() => navigator.clipboard?.writeText(message).then(() => showToast("Copié !"))}
      className="flex-1 py-3 rounded-[1rem] bg-[#f4eee7] text-[#3b241b] font-bold text-xs">
      📋 Copier
    </button>
  ) : null;

  const btnMarkSent = (
    <button onClick={onMarkSent}
      className="flex-1 py-3 rounded-[1rem] bg-[#2c1a10] text-white font-black text-xs">
      ✅ Marquer comme envoyé
    </button>
  );

  const btnMarkReceived = (
    <button onClick={onMarkReceived}
      className="flex-1 py-3 rounded-[1rem] bg-[#5a7828] text-white font-black text-xs">
      ✅ Marquer comme reçu
    </button>
  );

  let footer = null;
  if (statut === "À commander") {
    footer = <>{btnWhatsApp}{btnMarkSent}</>;
  } else if (statut === "Envoyé") {
    footer = <>{btnMarkReceived}{btnCopy}</>;
  } else {
    // Reçu, Annulé ou autre → lecture seule
    footer = btnCopy;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#e5d5c5] w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
        <div className="flex-1 overflow-y-auto p-5 min-h-0">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div>
              <div className="text-[10px] font-black tracking-[0.22em] text-[#a97862] uppercase">Détail commande</div>
              <h2 className="text-lg font-black text-[#3b241b]">{orderDetail.produit}</h2>
              <div className="flex items-center gap-2 mt-1">
                <OrdStatusBadge status={statut} />
                <span className="text-xs text-[#a97862]">{orderDetail.fournisseur} · {dateStr || "Sans date"}</span>
              </div>
            </div>
            <button onClick={() => setOrderDetail(null)} className="w-9 h-9 rounded-full bg-[#f4eee7] flex items-center justify-center font-black text-[#a97862]">×</button>
          </div>
          <div className="text-xs font-black text-[#a97862] mb-2">MESSAGE ENVOYÉ</div>
          <div className="bg-[#e8f5e1] rounded-[1rem] p-4 font-mono text-xs text-[#2d5a1b] whitespace-pre-wrap leading-relaxed">
            {message || "Aucun message enregistré"}
          </div>
        </div>
        {footer && (
          <div className="shrink-0 px-5 pt-3 border-t border-[#e5d5c5] flex gap-2" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}