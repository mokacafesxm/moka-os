"use client";

import React, { useEffect, useMemo, useState } from "react";

const PRODUCTS_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-orderpad-products";

const SEND_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-orderpad-send";

const PREPS_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-preps-to-do";

const STAFF_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-staff-list";

const STOCK_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-stock-live";

const PRODUCT_UPDATE_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-product-update";

const PRODUCT_CREATE_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-product-create";

const COMPLETE_PREP_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-prep-complete";

const CREATE_PREP_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-create-prep";

const CLOCK_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-staff-clock";

const SETTINGS_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-settings";

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
  if (Array.isArray(product?.supplier)) {
    return product.supplier.length > 0
      ? product.supplier.join(", ")
      : "À définir";
  }

  return product?.supplier || "À définir";
}

function getStockName(item) {
  return item?.name || item?.produit || item?.Produit || item?.ingredient || "Produit";
}

function getStockStatus(item) {
  return item?.status || item?.statut || item?.Statut || "À configurer";
}

function getStockPortions(item) {
  return item?.portionsRestantes || item?.portions || item?.["Portions restantes"] || 0;
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
    member?.name ||
    member?.prenom ||
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
  const [settingsCache, setSettingsCache] = useState(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem("mokaSettingsCache") || "{}"); }
    catch { return {}; }
  });
  const [loadingSettingsPanel, setLoadingSettingsPanel] = useState(false);
  const [editingSettingsItem, setEditingSettingsItem] = useState(null);
  const [editingSettingsForm, setEditingSettingsForm] = useState({});
  const [savingSettingsPanel, setSavingSettingsPanel] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState("");

  const [showClockModal, setShowClockModal] = useState(false);
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

      return matchesCategory && matchesSubCategory && matchesSearch;
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

  const fournisseurOptions = uniqueValues(products.map((p) => getSupplier(p)));
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
  }, [stockLive, stockSearch]);

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

    return stockProducts.filter((item) => {
      const cat = getStockCategory(item);
      return !activeStockCategory || cat === activeStockCategory;
    });
  }, [stockView, stockPreps, stockProducts, activeStockCategory]);

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

    const data = await response.json();
    return Array.isArray(data) ? data : normalizeArray(data, resource);
  };
  useEffect(() => {
    if (!isAdmin || adminSection !== "settings") return;

    ["suppliers", "staff"].forEach(async (resource) => {
      if (settingsCache[resource]) return;

      try {
        const list = await fetchSettingsResource(resource);
        setSettingsCache((prev) => ({ ...prev, [resource]: list }));
      } catch (error) {
        console.error("Préchargement paramètres:", resource, error);
      }
    });
  }, [isAdmin, adminSection]);

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

    setSettingsItem(item);
    setSettingsForm({
      id: getEditableId(item),
      name: item?.name || getPrepName(item),
      categorie: item?.category || item?.categorie || "Autres",
      sousCategorie: item?.subcategory || item?.sousCategorie || getSubCategory(item),
      visibleOrderPad: item?.visible ?? item?.visibleOrderPad ?? true,
      fournisseurDefaut: getSupplier(item),
      zoneStockage: item?.zone || item?.zoneStockage || item?.emplacement || "",
      quantiteCommandee: item?.quantiteCommandee || item?.suggested || item?.quantity || "",
      uniteStock: item?.unit || item?.uniteStock || "kg",
      uniteCommande: item?.uniteCommande || item?.unit || "kg",
      portion: item?.portion || item?.portionGrammes || "",
      seuilAlerte: item?.seuilAlerte || item?.seuilAlertePortion || "",
      seuilCritique: item?.seuilCritique || item?.seuilCritiquePortion || "",
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
      zoneStockage: settingsForm.zoneStockage,
      quantiteCommandee: Number(settingsForm.quantiteCommandee) || 0,
      uniteStock: settingsForm.uniteStock,
      uniteCommande: settingsForm.uniteCommande,
      portion: Number(settingsForm.portion) || 0,
      seuilAlerte: Number(settingsForm.seuilAlerte) || 0,
      seuilCritique: Number(settingsForm.seuilCritique) || 0,
    };

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

    if (!isNewProduct) {
      applyLocalUpdate();
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(isNewProduct ? PRODUCT_CREATE_URL : PRODUCT_UPDATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`Erreur webhook ${response.status}`);

      alert(isNewProduct ? "Produit créé ✅" : "Réglages produit mis à jour ✅");
      setSettingsItem(null);

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
    <main className="min-h-screen bg-[#f7efe4] text-[#332019] pb-28">
      <div className="max-w-[1600px] mx-auto px-5 py-3">
        <header className="flex items-end justify-between gap-5 mb-3">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-[#3b241b]">
              MÖKA
            </h1>

            <div className="text-sm tracking-[0.42em] text-[#a97862] mt-1">
              SUPPLIER ORDER PAD
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto max-w-[70vw] pb-1">
            <button
              onClick={() => setShowClockModal(true)}
              className="rounded-[1.5rem] px-4 py-3 shadow-sm border font-black text-sm bg-white/90 text-[#3b241b] border-[#eadfd4]"
            >
              ⏱ Pointage
            </button>

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
              className={`rounded-[1.5rem] px-4 py-3 shadow-sm border font-black text-sm ${
                isAdmin
                  ? "bg-[#6f8f32] text-white border-[#6f8f32]"
                  : "bg-white/90 text-[#3b241b] border-[#eadfd4]"
              }`}
            >
              {isAdmin ? "👤 Admin ON" : "👤 Admin"}
            </button>

            {isAdmin && (
              <button
                onClick={openNewProduct}
                className="rounded-[1.5rem] px-4 py-3 shadow-sm border font-black text-sm bg-[#6f8f32] text-white border-[#6f8f32]"
              >
                ➕ Produit
              </button>
            )}

            <div className="bg-white/90 rounded-[1.5rem] px-4 py-3 shadow-sm border border-[#eadfd4] text-right text-sm shrink-0">
              <div className="text-xs text-[#a97862]">Commande automatique</div>

              <div className="font-black text-base text-[#3b241b]">17:45 SXM</div>
            </div>
          </div>
        </header>

        <div className="flex gap-3 mt-3 mb-3 overflow-x-auto pb-2">
<button
            onClick={() => {
                setActiveTab("orderpad");
                if (!activeCategory && categories[0]) {
                  setActiveCategory(categories[0]);
                }
              }}
            className={`px-5 py-2 rounded-full text-sm font-black transition ${
              activeTab === "orderpad"
                ? "bg-[#3b241b] text-white shadow-md"
                : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
            }`}
          >
            🛒 OrderPad
          </button>

          <button
            onClick={() => setActiveTab("stock")}
            className={`px-5 py-2 rounded-full text-sm font-black transition ${
              activeTab === "stock"
                ? "bg-[#3b241b] text-white shadow-md"
                : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              Stock Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab("preps")}
            className={`relative min-w-[360px] whitespace-nowrap px-6 py-2 rounded-full text-sm font-black transition flex items-center justify-center gap-4 ${
              activeTab === "preps"
                ? "bg-[#3b241b] text-white shadow-md"
                : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
            }`}
          >
            👨‍🍳 Préparations à faire
            {prepCount > 0 && (
              <span className="static bg-red-600 text-white text-xs font-black rounded-full min-w-6 h-6 px-2 flex items-center justify-center shadow-md">
                {prepCount}
              </span>
            )}
          </button>
        
        </div>


        {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <button
            onClick={() => setActiveTab("stock")}
            className="rounded-[1.5rem] bg-white/90 border border-[#eadfd4] p-4 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="text-xs font-black text-[#a97862]">🔴 Produits critiques</div>
            <div className="text-3xl font-black text-red-600 mt-2">{stockKpis.critical}</div>
            <div className="text-xs font-bold text-[#a97862] mt-1">À commander en priorité</div>
          </button>

          <button
            onClick={() => setActiveTab("stock")}
            className="rounded-[1.5rem] bg-white/90 border border-[#eadfd4] p-4 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="text-xs font-black text-[#a97862]">🟠 Alertes stock</div>
            <div className="text-3xl font-black text-orange-500 mt-2">{stockKpis.alert}</div>
            <div className="text-xs font-bold text-[#a97862] mt-1">Sous seuil bientôt</div>
          </button>

          <button
            onClick={() => setActiveTab("preps")}
            className="rounded-[1.5rem] bg-white/90 border border-[#eadfd4] p-4 text-left shadow-sm active:scale-[0.99]"
          >
            <div className="text-xs font-black text-[#a97862]">👨‍🍳 Prépas à faire</div>
            <div className="text-3xl font-black text-[#6f8f32] mt-2">{prepCount}</div>
            <div className="text-xs font-bold text-[#a97862] mt-1">Aujourd’hui / à venir</div>
          </button>

          <div className="rounded-[1.5rem] bg-white/90 border border-[#eadfd4] p-4 shadow-sm">
            <div className="text-xs font-black text-[#a97862]">📦 Produits suivis</div>
            <div className="text-3xl font-black text-[#3b241b] mt-2">{stockKpis.total}</div>
            <div className="text-xs font-bold text-[#a97862] mt-1">Stock Live</div>
          </div>
        </div>
        )}

        <div className="grid grid-cols-12 gap-4 items-start">
          <section className="col-span-12 sm:col-span-8 xl:col-span-9">
            {activeTab === "stock" && (
              <>
                {loadingStock ? (
                  <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                    Chargement du stock live…
                  </div>
                ) : stockLive.length === 0 ? (
                  <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                    Aucun stock trouvé.
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white/80 border border-[#eadfd4] rounded-[1.5rem] p-3 shadow-sm">
                      <div className="flex items-center gap-3 rounded-[1.1rem] bg-[#fffaf3] border border-[#d6b8a7] px-4 py-2">
                        <span className="text-xl">🔍</span>

                        <input
                          value={stockSearch}
                          onChange={(e) => setStockSearch(e.target.value)}
                          placeholder={stockView === "prepa" ? "Rechercher une prépa..." : "Rechercher un produit stock..."}
                          className="w-full bg-transparent outline-none text-[#3b241b] placeholder:text-[#b08d7b] font-semibold"
                        />
                      </div>

                      <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                        <button
                          onClick={() => {
                            setStockView("prepa");
                            ;
                          }}
                          className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs sm:text-sm font-black shrink-0 transition ${
                            stockView === "prepa"
                              ? "bg-[#6f8f32] text-white shadow-md"
                              : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
                          }`}
                        >
                          👨‍🍳 Prépas
                        </button>

                        <button
                          onClick={() => {
                            setStockView("stock");
                            if (stockCategories[0]) {
                              setActiveStockCategory(stockCategories[0]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs sm:text-sm font-black shrink-0 transition ${
                            stockView === "stock"
                              ? "bg-[#6f8f32] text-white shadow-md"
                              : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
                          }`}
                        >
                          📦 Stock
                        </button>
                      </div>

                      {stockView === "stock" && (
                        <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                          {stockCategories.filter((cat) => String(cat).trim().toLowerCase() !== "tous").map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setActiveStockCategory(cat)}
                              className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs sm:text-sm font-black shrink-0 transition ${
                                activeStockCategory === cat
                                  ? "bg-[#3b241b] text-white shadow-md"
                                  : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
                              }`}
                            >
                              {`${categoryEmojis[cat] || "📌"} ${cat}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-8">
                      {groupedStockItems.map(([category, items]) => (
                        <div key={category}>
                          <div className="flex items-center gap-4 mb-4">
                            <div className="text-xl font-black text-[#3b241b] whitespace-nowrap">
                              {stockView === "prepa" ? "👨‍🍳 Prépas" : `${categoryEmojis[category] || "📌"} ${category}`}
                            </div>

                            <div className="flex-1 h-[1px] bg-[#dccbbb]" />

                            <div className="text-xs font-bold text-[#a97862]">
                              {items.length} produits
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {items.map((item) => {
                              const stockId = item.id || getStockName(item);
                              const selected = !!cart[stockId];
                              const status = getStockStatus(item);
                              const isCritical = String(status).includes("Critique");
                              const isLow = String(status).includes("Stock bas");

                              return (
                                <div
                                  key={stockId}
                                  onClick={() => selected ? removeItem(stockId) : addStockPrep(item)}
                                  className={`rounded-[1.75rem] shadow-sm border transition overflow-hidden cursor-pointer ${
                                    selected
                                      ? "bg-[#6f8f32] text-white border-[#6f8f32]"
                                      : "bg-white text-[#3b241b] border-[#eadfd4]"
                                  }`}
                                >
                                  <div className={`h-3 ${
                                    isCritical ? "bg-red-600" : isLow ? "bg-orange-500" : "bg-[#6f8f32]"
                                  }`} />

                                  <div className="p-5">
                                    <div className={`text-xs font-black mb-2 ${
                                      selected ? "text-white/80" : "text-[#6f8f32]"
                                    }`}>
                                      {status}
                                    </div>

                                    <h2 className="text-lg font-black leading-tight">
                                      {getStockName(item)}
                                    </h2>

                                    <div className={`mt-5 rounded-2xl p-4 ${
                                      selected ? "bg-white/20" : "bg-[#f7efe4]"
                                    }`}>
                                      <div className="text-xs opacity-70">
                                        {stockView === "prepa" ? "Portions restantes" : "Stock actuel"}
                                      </div>

                                      <div className="text-2xl font-black mt-1">
                                        {getStockPortions(item)}
                                      </div>

                                      {getStockZone(item) && (
                                        <div className="text-xs opacity-70 mt-2">
                                          Zone : {getStockZone(item)}
                                        </div>
                                      )}
                                    </div>

                                    <div className="mt-4 flex justify-between items-center">
                                      <span className={`text-sm font-semibold ${
                                        selected ? "text-white/80" : "text-[#a97862]"
                                      }`}>
                                        {selected ? "Sélectionné" : "Toucher pour préparer"}
                                      </span>

                                      <span className="text-3xl">
                                        {selected ? "✅" : "＋"}
                                      </span>
                                    </div>

                                    {isAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openSettings(item);
                                        }}
                                        className={`block mt-4 text-sm font-bold underline ${
                                          selected ? "text-white/80" : "text-[#a97862]"
                                        }`}
                                      >
                                        ⚙️ Corriger stock
                                      </button>
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

            {activeTab === "orderpad" && (
              <>
                <div className="bg-white/80 border border-[#eadfd4] rounded-[1.5rem] p-3 mb-3 shadow-sm">
                  <div className="flex items-center gap-3 rounded-[1.1rem] bg-[#fffaf3] border border-[#d6b8a7] px-4 py-2">
                    <span className="text-xl">🔍</span>

                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un produit, une zone, une sous-catégorie..."
                      className="w-full bg-transparent outline-none text-[#3b241b] placeholder:text-[#b08d7b] font-semibold"
                    />
                  </div>

                  <div className="flex gap-3 mt-4 overflow-x-auto pb-1">
                    {categories.filter((cat) => String(cat).trim().toLowerCase() !== "tous").map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setActiveCategory(cat);
                          setActiveSubCategory("");
                        }}
                        className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs sm:text-sm font-black shrink-0 transition ${
                          activeCategory === cat
                            ? "bg-[#6f8f32] text-white shadow-md"
                            : "bg-white text-[#6b4a3d] border border-[#eadfd4]"
                        }`}
                      >
                        {`${categoryEmojis[cat] || "📌"} ${cat}`}
                      </button>
                    ))}
                  </div>

                  {subCategories.length > 0 && (
                    <div className="flex flex-nowrap gap-2 mt-2 overflow-x-auto pb-1 whitespace-nowrap">
{subCategories.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setActiveSubCategory(sub)}
                          className={`px-3 py-1.5 rounded-full whitespace-nowrap text-xs font-black transition ${
                            activeSubCategory === sub
                              ? "bg-[#3b241b] text-white"
                              : "bg-[#f7efe4] text-[#8b6f61] border border-[#eadfd4]"
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                    Chargement des produits…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                    Aucun produit trouvé.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groupedProducts.map(([subCategory, productsInGroup]) => (
                      <div key={subCategory}>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="text-xl font-black text-[#3b241b] whitespace-nowrap">
                            {subCategory}
                          </div>

                          <div className="flex-1 h-[1px] bg-[#dccbbb]" />

                          <div className="text-xs font-bold text-[#a97862]">
                            {productsInGroup.length} produits
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                          {productsInGroup.map((product) => {
                            const selected = !!cart[product.id];
                            const cat = product.category || "Autres";
                            const sub = getSubCategory(product);
                            const supplier = getSupplier(product);
                            const productUrl = product.url || null;

                            return (
                              <div
                                key={product.id}
                                className={`rounded-[1.75rem] shadow-sm border transition overflow-hidden ${
                                  selected
                                    ? "bg-[#6f8f32] text-white border-[#6f8f32]"
                                    : "bg-white text-[#3b241b] border-[#eadfd4]"
                                }`}
                              >
                                <button
                                  onClick={() =>
                                    selected
                                      ? removeItem(product.id)
                                      : addProduct(product)
                                  }
                                  className={`w-full h-20 flex items-center justify-center overflow-hidden ${
                                    selected ? "bg-white/10" : "bg-[#efe4d7]"
                                  }`}
                                >
                                  {product.photo ? (
                                    <img
                                      src={product.photo}
                                      alt={product.name || "Produit"}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-5xl">
                                      {categoryEmojis[cat] || "📌"}
                                    </span>
                                  )}
                                </button>

                                <button
                                  onClick={() =>
                                    selected
                                      ? removeItem(product.id)
                                      : addProduct(product)
                                  }
                                  className="w-full text-left p-5 active:scale-[0.99]"
                                >
                                  <div className="flex justify-between gap-4">
                                    <div>
                                      <div
                                        className={`text-xs font-black mb-1 ${
                                          selected
                                            ? "text-white/85"
                                            : "text-[#6f8f32]"
                                        }`}
                                      >
                                        {categoryEmojis[cat] || "📌"} {cat}
                                      </div>

                                      <div
                                        className={`inline-flex mb-3 px-3 py-1 rounded-full text-xs font-black ${
                                          selected
                                            ? "bg-white/20 text-white"
                                            : "bg-[#f7efe4] text-[#a97862]"
                                        }`}
                                      >
                                        {sub}
                                      </div>

                                      <h2 className="text-lg font-black leading-tight">
                                        {product.name}
                                      </h2>
                                    </div>

                                    <div
                                      className={`text-xs text-right max-w-[120px] ${
                                        selected
                                          ? "text-white/75"
                                          : "text-[#a97862]"
                                      }`}
                                    >
                                      {supplier}
                                    </div>
                                  </div>

                                  <div
                                    className={`mt-5 rounded-2xl p-4 ${
                                      selected ? "bg-white/20" : "bg-[#f7efe4]"
                                    }`}
                                  >
                                    <div className="text-xs opacity-70">
                                      À commander
                                    </div>

                                    <div className="text-2xl font-black mt-1">
                                      {product.suggested || 1}{" "}
                                      {product.unit || "unité"}
                                    </div>

                                    {product.zone && (
                                      <div className="text-xs opacity-70 mt-2">
                                        Zone : {product.zone}
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-4 flex justify-between items-center">
                                    <span
                                      className={`text-sm font-semibold ${
                                        selected
                                          ? "text-white/80"
                                          : "text-[#a97862]"
                                      }`}
                                    >
                                      {selected
                                        ? "Ajouté"
                                        : "Toucher pour ajouter"}
                                    </span>

                                    <span className="text-3xl">
                                      {selected ? "✅" : "＋"}
                                    </span>
                                  </div>
                                </button>

                                {isAdmin && (
                                  <button
                                    onClick={() => openSettings(product)}
                                    className={`block px-5 pb-5 text-sm font-bold underline ${
                                      selected
                                        ? "text-white/80"
                                        : "text-[#a97862]"
                                    }`}
                                  >
                                    ⚙️ Réglages
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

            {activeTab === "preps" && (
              <>
                {loadingPreps ? (
                  <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                    Chargement des préparations…
                  </div>
                ) : preps.length === 0 ? (
                  <div className="bg-white rounded-[2rem] p-10 text-center text-[#a97862]">
                    Aucune préparation à faire.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {groupedPreps.map(([category, prepsInGroup]) => (
                      <div key={category}>
                        <div className="flex items-center gap-4 mb-4">
                          <div className="text-xl font-black text-[#3b241b] whitespace-nowrap">
                            👨‍🍳 {category}
                          </div>

                          <div className="flex-1 h-[1px] bg-[#dccbbb]" />

                          <div className="text-xs font-bold text-[#a97862]">
                            {prepsInGroup.length} prépas
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                          {prepsInGroup.map((prep) => {
                            const id = prep.id || getPrepName(prep);
                            const selected = !!cart[id];
                            const name = getPrepName(prep);
                            const qty = getPrepQuantity(prep);
                            const unit = getPrepUnit(prep);
                            const status = getPrepStatus(prep);
                            const priority = getPrepPriority(prep);

                            return (
                              <div
                                key={id}
                                className={`rounded-[1.75rem] shadow-sm border transition overflow-hidden ${
                                  selected
                                    ? "bg-[#6f8f32] text-white border-[#6f8f32]"
                                    : "bg-white text-[#3b241b] border-[#eadfd4]"
                                }`}
                              >
                                <button
                                  onClick={() =>
                                    selected ? removeItem(id) : addPrep(prep)
                                  }
                                  className={`w-full text-left p-5 active:scale-[0.99] ${
                                    selected ? "text-white" : "text-[#3b241b]"
                                  }`}
                                >
                                  <div className="flex justify-between gap-4">
                                    <div>
                                      <div
                                        className={`text-xs font-black mb-2 ${
                                          selected
                                            ? "text-white/85"
                                            : "text-[#6f8f32]"
                                        }`}
                                      >
                                        👨‍🍳 Préparation
                                      </div>

                                      <h2 className="text-lg font-black leading-tight">
                                        {name}
                                      </h2>
                                    </div>

                                    <div
                                      className={`text-xs text-right max-w-[120px] ${
                                        selected
                                          ? "text-white/75"
                                          : "text-[#a97862]"
                                      }`}
                                    >
                                      {priority}
                                    </div>
                                  </div>

                                  <div
                                    className={`mt-5 rounded-2xl p-4 ${
                                      selected ? "bg-white/20" : "bg-[#f7efe4]"
                                    }`}
                                  >
                                    <div className="text-xs opacity-70">
                                      Quantité à préparer
                                    </div>

                                    <div className="text-2xl font-black mt-1">
                                      {qty} {unit}
                                    </div>

                                    <div className="text-xs opacity-70 mt-2">
                                      Statut : {status}
                                    </div>

                                    {getPrepDueDate(prep) && (
                                      <div className="text-xs opacity-70 mt-1">
                                        Date prévue : {getPrepDueDate(prep).split("-").reverse().join("/")}
                                      </div>
                                    )}

                                    {prep.assignedTo && (
                                      <div className="text-xs opacity-70 mt-1">
                                        Assigné à : {prep.assignedTo}
                                      </div>
                                    )}
                                  </div>

                                  <div className="mt-4 flex justify-between items-center">
                                    <span
                                      className={`text-sm font-semibold ${
                                        selected
                                          ? "text-white/80"
                                          : "text-[#a97862]"
                                      }`}
                                    >
                                      {selected
                                        ? "Ajouté à l’action"
                                        : "Toucher pour ajouter"}
                                    </span>

                                    <span className="text-3xl">
                                      {selected ? "✅" : "＋"}
                                    </span>
                                  </div>
                                </button>

                                {isAdmin && (
                                  <button
                                    onClick={() => openSettings(prep)}
                                    className={`block px-5 pb-5 text-sm font-bold underline ${
                                      selected
                                        ? "text-white/80"
                                        : "text-[#a97862]"
                                    }`}
                                  >
                                    ⚙️ Réglages
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

          <aside className={`col-span-12 sm:col-span-4 xl:col-span-3 sm:sticky sm:top-3 sm:self-start sm:max-h-[calc(100vh-1rem)] sm:overflow-y-auto"stock" && stockView === "stock" ? "hidden" : ""}`}>
            <div className="bg-white/95 rounded-[1.5rem] p-4 shadow-sm border border-[#eadfd4] sticky top-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto max-h-[calc(100vh-1.5rem)] overflow-y-auto">
              <h2 className="text-xl font-black text-[#3b241b]">
                {activeTab === "stock"
                  ? "👨‍🍳 Envoyer en préparation"
                  : activeTab === "preps"
                  ? "👨‍🍳 Confirmer la préparation"
                  : "🛒 Action du jour"}
              </h2>

              <p className="text-sm text-[#a97862] mt-1">
                {activeTab === "stock"
                  ? "Sélectionne un produit Stock Live puis un staff"
                  : activeTab === "preps"
                  ? "Valider une préparation terminée"
                  : "Sélection staff depuis le pad"}
              </p>

              <div className="mt-4">
                <label className="block text-xs font-black text-[#a97862] mb-2">
                  Membre du staff
                </label>

                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#3b241b] outline-none"
                >
                  <option value="">Sélectionner...</option>

                  {staff.map((member) => (
                    <option
                      key={member.id || getStaffName(member)}
                      value={member.id || getStaffName(member)}
                    >
                      {getStaffName(member)}
                    </option>
                  ))}
                </select>
              </div>

              {activeTab === "stock" && stockView === "prepa" && (
                <div className="mt-4">
                  <label className="block text-xs font-black text-[#a97862] mb-2">
                    Date prévue
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["1", "+1 jour"],
                      ["3", "+3 jours"],
                      ["5", "+5 jours"],
                      ["custom", "Perso"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDueDateMode(value)}
                        className={`rounded-2xl px-3 py-3 text-xs font-black border ${
                          dueDateMode === value
                            ? "bg-[#6f8f32] text-white border-[#6f8f32]"
                            : "bg-[#fffaf3] text-[#6b4a3d] border-[#eadfd4]"
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
                      className="w-full mt-3 rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#3b241b] outline-none"
                    />
                  )}

                  <div className="text-xs text-[#a97862] font-bold mt-2">
                    Prévu le : {selectedDueDate.split("-").reverse().join("/")}
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-3">
                {cartItems.length === 0 && (
                  <div className="text-[#a97862] bg-[#f7efe4] rounded-2xl p-5 text-center">
                    Aucun élément sélectionné
                  </div>
                )}

                {cartItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-3 border-b border-[#eadfd4] pb-3"
                  >
                    <div>
                      <div className="font-black">{item.name}</div>

                      <div className="text-xs text-[#a97862]">
                        {item.type === "prep"
                          ? "Préparation interne"
                          : getSupplier(item)}
                      </div>
                    </div>

                    <div className="font-black whitespace-nowrap text-[#6f8f32]">
                      {item.qty} {item.unit}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={sendToMokaOS}
                disabled={cartItems.length === 0 || sending}
                className={`w-full mt-4 py-3 rounded-2xl font-black transition ${
                  cartItems.length === 0
                    ? "bg-[#eadfd4] text-[#a97862]"
                    : "bg-[#6f8f32] text-white shadow-md"
                }`}
              >
                {sending
                  ? "Envoi en cours…"
                  : activeTab === "stock"
                  ? "Envoyer en préparation 👨‍🍳"
                  : activeTab === "preps"
                  ? "Confirmer comme fait ✅"
                  : "Envoyer vers MOKA-OS"}
              </button>
            </div>
          </aside>
        </div>
      </div>




      {settingsPanel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-[2rem] shadow-xl border border-[#eadfd4] w-[94vw] max-w-5xl max-h-[86vh] overflow-hidden">
            <div className="p-5 border-b border-[#eadfd4] flex justify-between items-start gap-4">
              <div>
                <div className="text-xs font-black tracking-[0.25em] text-[#a97862] uppercase">
                  Paramètres
                </div>
                <h2 className="text-2xl font-black text-[#3b241b] mt-1">
                  {settingsPanel === "suppliers" && "🏢 Fournisseurs"}
                  {settingsPanel === "staff" && "👥 Staff"}
                  {settingsPanel === "categories" && "📦 Catégories"}
                  {settingsPanel === "subcategories" && "📂 Sous-catégories"}
                  {settingsPanel === "units" && "📏 Unités"}
                  {settingsPanel === "zones" && "🗄️ Zones"}
                </h2>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => loadSettingsPanel(settingsPanel)}
                  className="rounded-2xl px-4 py-3 bg-[#f7efe4] text-[#6b4a3d] font-black text-sm border border-[#eadfd4]"
                >
                  ↻ Actualiser
                </button>

                <button
                  onClick={() => setSettingsPanel("")}
                  className="w-12 h-12 rounded-full bg-[#f4eee7] hover:bg-[#eadfd4] flex items-center justify-center text-3xl font-black text-[#a97862]"
                >
                  ×
                </button>
              </div>
            </div>

            {loadingSettingsPanel ? (
              <div className="p-10 text-center text-[#a97862] font-black">
                Chargement…
              </div>
            ) : settingsData.length === 0 ? (
              <div className="p-10 text-center text-[#a97862] font-black">
                Aucun élément trouvé.
              </div>
            ) : (
              <div className="overflow-auto max-h-[70vh]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f7efe4] text-[#a97862] sticky top-0">
                    <tr>
                      <th className="text-left p-4 font-black">Nom</th>
                      <th className="text-left p-4 font-black">Catégorie / rôle</th>
                      <th className="text-left p-4 font-black">Contact</th>
                      <th className="text-left p-4 font-black">Téléphone</th>
                      <th className="text-left p-4 font-black">Email</th>
                      <th className="text-left p-4 font-black">Statut</th>
                      <th className="text-left p-4 font-black">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {settingsData.map((item, index) => (
                      <tr key={item.id || item.nom || item.name || index} className="border-t border-[#eadfd4]">
                        <td className="p-4 font-black text-[#3b241b]">
                          {item.nom || item.name || item.fournisseur || item.prenom || "Sans nom"}
                        </td>
                        <td className="p-4 text-[#6b4a3d] font-bold">
                          {item.categorie || item.category || item.role || "—"}
                        </td>
                        <td className="p-4 text-[#6b4a3d]">
                          {item.contact || item.methodeContact || "—"}
                        </td>
                        <td className="p-4 text-[#6b4a3d]">
                          {item.telephone || item.whatsapp || item.phone || "—"}
                        </td>
                        <td className="p-4 text-[#6b4a3d]">
                          {item.email || "—"}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-black ${
                            item.actif === false
                              ? "bg-red-100 text-red-700"
                              : "bg-[#eef5df] text-[#6f8f32]"
                          }`}>
                            {item.actif === false ? "Inactif" : "Actif"}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openSettingsEdit(item)}
                              className="rounded-xl px-3 py-2 bg-white border border-[#eadfd4] font-black text-[#6b4a3d]"
                            >
                              ✏️ Modifier
                            </button>

                            <button
                              onClick={() => archiveSettingsDatabaseItem(item)}
                              className="rounded-xl px-3 py-2 bg-red-50 border border-red-100 font-black text-red-700"
                            >
                              Désactiver
                            </button>
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


      {editingSettingsItem && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-3">
          <div className="bg-white rounded-[2rem] shadow-xl border border-[#eadfd4] w-[92vw] max-w-xl max-h-[86vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <div className="text-xs font-black tracking-[0.25em] text-[#a97862] uppercase">
                  Modifier
                </div>
                <h2 className="text-2xl font-black text-[#3b241b]">
                  {settingsPanel === "suppliers" ? "🏢 Fournisseur" : "👥 Staff"}
                </h2>
              </div>

              <button
                onClick={() => setEditingSettingsItem(null)}
                className="w-12 h-12 rounded-full bg-[#f4eee7] flex items-center justify-center text-3xl font-black text-[#a97862]"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-[#a97862] mb-2">
                  Nom
                </label>
                <input
                  value={editingSettingsForm.nom || ""}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, nom: e.target.value, name: e.target.value }))}
                  className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-4 py-3 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#a97862] mb-2">
                  Catégorie / rôle
                </label>
                <input
                  value={editingSettingsForm.categorie || ""}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, categorie: e.target.value, role: e.target.value }))}
                  className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-4 py-3 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#a97862] mb-2">
                  Contact
                </label>
                <input
                  value={editingSettingsForm.contact || ""}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, contact: e.target.value }))}
                  className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-4 py-3 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#a97862] mb-2">
                  Téléphone / WhatsApp
                </label>
                <input
                  value={editingSettingsForm.telephone || ""}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, telephone: e.target.value, whatsapp: e.target.value, phone: e.target.value }))}
                  className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-4 py-3 font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#a97862] mb-2">
                  Email
                </label>
                <input
                  value={editingSettingsForm.email || ""}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-4 py-3 font-bold outline-none"
                />
              </div>

              <label className="md:col-span-2 flex items-center gap-3 rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-4 py-3 font-black">
                <input
                  type="checkbox"
                  checked={editingSettingsForm.actif !== false}
                  onChange={(e) => setEditingSettingsForm((prev) => ({ ...prev, actif: e.target.checked }))}
                />
                Actif
              </label>
            </div>

            <button
              onClick={saveSettingsDatabaseItem}
              disabled={savingSettingsPanel}
              className="w-full mt-5 py-4 rounded-2xl bg-[#6f8f32] text-white font-black shadow-md"
            >
              {savingSettingsPanel ? "Enregistrement…" : "Enregistrer ✅"}
            </button>
          </div>
        </div>
      )}

      {showClockModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-[2rem] shadow-xl border border-[#eadfd4] w-[92vw] max-w-xl max-h-[86vh] overflow-y-auto p-4">
            <div className="flex justify-between gap-4 items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-[#3b241b]">
                  ⏱ Pointage staff
                </h2>
                <p className="text-sm text-[#a97862] mt-1">
                  Arrivée, pause, retour pause et départ.
                </p>
              </div>

              <button
                onClick={() => setShowClockModal(false)}
                className="w-12 h-12 rounded-full bg-[#f4eee7] hover:bg-[#eadfd4] flex items-center justify-center text-3xl font-black text-[#a97862] shrink-0"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {staff.map((member) => {
                const staffId = member.id || getStaffName(member);
                const staffName = getStaffName(member);
                const status = clockStatuses[staffId] || "absent";

                const statusLabel =
                  status === "present"
                    ? "🟢 Présent"
                    : status === "pause"
                    ? "🟠 En pause"
                    : status === "done"
                    ? "⚫ Terminé"
                    : "⚪ Pas pointé";

                return (
                  <div
                    key={staffId}
                    className="rounded-[1.25rem] border border-[#eadfd4] bg-[#fffaf3] p-3"
                  >
                    <div className="flex justify-between gap-3 items-start">
                      <div>
                        <div className="font-black text-base text-[#3b241b]">
                          {staffName}
                        </div>
                        <div className="text-sm font-bold text-[#a97862] mt-1">
                          {statusLabel}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {status === "absent" && (
                        <button
                          disabled={clockSending}
                          onClick={() => sendClockAction(member, "Arrivée")}
                          className="col-span-2 bg-[#6f8f32] text-white py-2 rounded-xl font-black text-sm"
                        >
                          Arrivée ✅
                        </button>
                      )}

                      {status === "present" && (
                        <>
                          <button
                            disabled={clockSending}
                            onClick={() => sendClockAction(member, "Départ pause")}
                            className="bg-orange-500 text-white py-2 rounded-xl font-black text-sm"
                          >
                            Pause
                          </button>

                          <button
                            disabled={clockSending}
                            onClick={() => sendClockAction(member, "Départ")}
                            className="bg-[#3b241b] text-white py-2 rounded-xl font-black text-sm"
                          >
                            Départ
                          </button>
                        </>
                      )}

                      {status === "pause" && (
                        <button
                          disabled={clockSending}
                          onClick={() => sendClockAction(member, "Retour pause")}
                          className="col-span-2 bg-[#6f8f32] text-white py-2 rounded-xl font-black text-sm"
                        >
                          Retour pause ✅
                        </button>
                      )}

                      {status === "done" && (
                        <button
                          disabled
                          className="col-span-2 bg-[#eadfd4] text-[#a97862] py-2 rounded-xl font-black text-sm"
                        >
                          Journée terminée
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-[2rem] shadow-xl border border-[#eadfd4] w-full max-w-sm p-6">
            <h2 className="text-2xl font-black text-[#3b241b]">
              👤 Accès admin
            </h2>

            <p className="text-sm text-[#a97862] mt-2">
              Entrez le code à 4 chiffres pour accéder aux réglages.
            </p>

            <input
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              className="w-full mt-6 rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-4 py-4 text-center text-3xl font-black tracking-[0.4em] text-[#3b241b] outline-none"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowAdminModal(false);
                  setAdminPin("");
                }}
                className="flex-1 py-4 rounded-2xl font-black bg-[#eadfd4] text-[#a97862]"
              >
                Annuler
              </button>

              <button
                onClick={unlockAdmin}
                className="flex-1 py-4 rounded-2xl font-black bg-[#6f8f32] text-white"
              >
                Entrer ✅
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsItem && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-[1.5rem] shadow-xl border border-[#eadfd4] w-[92vw] max-w-2xl max-h-[84vh] overflow-y-auto p-4">
            <div className="flex justify-between gap-4 items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-[#3b241b]">
                  {settingsItem?.isNew ? "➕ Nouveau produit" : "⚙️ Réglages produit"}
                </h2>
                <p className="text-sm text-[#a97862] mt-1">
                  {settingsForm.name}
                </p>
              </div>

              <button
                onClick={() => setSettingsItem(null)}
                className="w-12 h-12 rounded-full bg-[#f4eee7] hover:bg-[#eadfd4] flex items-center justify-center text-3xl font-black text-[#a97862] shrink-0"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="col-span-2 md:col-span-3">
                <label className="block text-xs font-black text-[#a97862] mb-2">
                  Nom produit
                </label>

                <input
                  type="text"
                  value={settingsForm.name || ""}
                  onChange={(e) =>
                    setSettingsForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Ex: Mangue fraîche"
                  className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#3b241b] outline-none"
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
                ["Seuil alerte (portion)", "seuilAlerte", "number", []],
                ["Seuil critique (portion)", "seuilCritique", "number", []],
              ].map(([label, key, type, options]) => (
                <div key={key}>
                  <label className="block text-xs font-black text-[#a97862] mb-2">
                    {label}
                  </label>

                  {type === "checkbox" ? (
                    <label className="flex items-center gap-3 rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#3b241b]">
                      <input
                        type="checkbox"
                        checked={!!settingsForm[key]}
                        onChange={(e) =>
                          setSettingsForm((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                        className="w-5 h-5"
                      />
                      Oui
                    </label>
                  ) : type === "select" ? (
                    <select
                      value={settingsForm[key] || ""}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#3b241b] outline-none"
                    >
                      <option value="">Sélectionner...</option>

                      {options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      value={settingsForm[key] || ""}
                      onChange={(e) =>
                        setSettingsForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-[#eadfd4] bg-[#fffaf3] px-3 py-2 text-sm font-bold text-[#3b241b] outline-none"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setSettingsItem(null)}
                className="flex-1 py-4 rounded-2xl font-black bg-[#eadfd4] text-[#a97862]"
              >
                Annuler
              </button>

              <button
                onClick={saveSettings}
                disabled={savingSettings}
                className="flex-1 py-4 rounded-2xl font-black bg-[#6f8f32] text-white"
              >
                {savingSettings ? "Enregistrement…" : "Enregistrer ✅"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && adminSection !== "dashboard" && (
        <div className="fixed inset-0 z-40 bg-[#f7efe4] text-[#332019] overflow-y-auto px-5 pt-6 pb-32">
          <div className="max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <div className="text-xs font-black tracking-[0.35em] text-[#a97862] uppercase">
                  MÖKA OS
                </div>

                <h1 className="text-4xl font-black text-[#3b241b] mt-2">
                  {adminSection === "products" && "📦 Produits"}
                  {adminSection === "inventory" && "📋 Inventaire"}
                  {adminSection === "orders" && "🛒 Commandes"}
                  {adminSection === "reports" && "📊 Rapports"}
                  {adminSection === "settings" && "⚙️ Paramètres"}
                </h1>
              </div>

              <button
                onClick={() => setAdminSection("dashboard")}
                className="rounded-2xl px-5 py-3 bg-white border border-[#eadfd4] font-black text-[#6b4a3d]"
              >
                Retour dashboard
              </button>
            </div>

            {adminSection === "products" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={openNewProduct} className="bg-white rounded-[2rem] p-6 border border-[#eadfd4] text-left shadow-sm">
                  <div className="text-3xl mb-4">➕</div>
                  <div className="text-xl font-black">Créer un produit</div>
                  <p className="text-sm text-[#a97862] mt-2">Ajouter une matière première complète.</p>
                </button>

                <div className="bg-white rounded-[2rem] p-6 border border-[#eadfd4] shadow-sm">
                  <div className="text-3xl mb-4">✏️</div>
                  <div className="text-xl font-black">Modifier produits</div>
                  <p className="text-sm text-[#a97862] mt-2">Utilise les boutons réglages sur les cartes produits.</p>
                </div>

                <div className="bg-white rounded-[2rem] p-6 border border-[#eadfd4] shadow-sm">
                  <div className="text-3xl mb-4">🗂️</div>
                  <div className="text-xl font-black">Archivage</div>
                  <p className="text-sm text-[#a97862] mt-2">À connecter ensuite : désactiver / masquer produit.</p>
                </div>
              </div>
            )}

            {adminSection === "inventory" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-[2rem] p-6 border border-[#eadfd4] shadow-sm">
                  <div className="text-3xl mb-4">🚨</div>
                  <div className="text-xl font-black">Alertes stock</div>
                  <p className="text-sm text-[#a97862] mt-2">Seuils, ruptures, corrections.</p>
                </div>

                <div className="bg-white rounded-[2rem] p-6 border border-[#eadfd4] shadow-sm">
                  <div className="text-3xl mb-4">📸</div>
                  <div className="text-xl font-black">Photo facture</div>
                  <p className="text-sm text-[#a97862] mt-2">À connecter avec IA inventaire.</p>
                </div>

                <div className="bg-white rounded-[2rem] p-6 border border-[#eadfd4] shadow-sm">
                  <div className="text-3xl mb-4">🗄️</div>
                  <div className="text-xl font-black">Zones</div>
                  <p className="text-sm text-[#a97862] mt-2">Bar, dry, frigo, congélateur.</p>
                </div>
              </div>
            )}

            {adminSection === "orders" && (
              <div className="bg-white rounded-[2rem] p-8 border border-[#eadfd4] shadow-sm">
                <div className="text-3xl mb-4">🛒</div>
                <div className="text-xl font-black">Commandes fournisseurs</div>
                <p className="text-sm text-[#a97862] mt-2">Historique, messages envoyés, suivi réception.</p>
              </div>
            )}

            {adminSection === "reports" && (
              <div className="bg-white rounded-[2rem] p-8 border border-[#eadfd4] shadow-sm">
                <div className="text-3xl mb-4">📊</div>
                <div className="text-xl font-black">Rapports</div>
                <p className="text-sm text-[#a97862] mt-2">À développer plus tard.</p>
              </div>
            )}

            {adminSection === "settings" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  ["🏢", "Fournisseurs", "Ajouter, modifier, désactiver"],
                  ["📦", "Catégories", "Créer / organiser"],
                  ["📂", "Sous-catégories", "Ranger les produits"],
                  ["📏", "Unités", "kg, pièce, carton..."],
                  ["🗄️", "Zones", "Stockage et emplacement"],
                  ["👥", "Staff", "Équipe et pointage"],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="bg-white rounded-[2rem] p-6 border border-[#eadfd4] shadow-sm">
                    <div className="text-3xl mb-4">{icon}</div>
                    <div className="text-xl font-black">{title}</div>
                    <p className="text-sm text-[#a97862] mt-2">{desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="fixed left-1/2 bottom-5 -translate-x-1/2 z-50 bg-white/95 backdrop-blur-xl border border-[#eadfd4] shadow-2xl rounded-[2.2rem] px-4 py-3 flex items-center gap-2 max-w-[95vw] overflow-x-auto">
          {[
            ["dashboard", "🏠", "Dashboard"],
            ["products", "📦", "Produits"],
            ["inventory", "📋", "Inventaire"],
            ["orders", "🛒", "Commandes"],
            ["reports", "📊", "Rapports"],
            ["settings", "⚙️", "Paramètres"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setAdminSection(id)}
              className={`w-14 h-14 rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-1 shrink-0 ${
                adminSection === id
                  ? "bg-[#3b241b] text-white"
                  : "text-[#6b4a3d] hover:bg-[#f7efe4]"
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
      )}

    </main>
  );
}