"use client";

import { useEffect, useMemo, useState } from "react";

const SETTINGS_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-settings";

const STOCK_URL =
  "https://mokacafesxm.app.n8n.cloud/webhook/moka-stock-live";

function normalizeArray(data, key) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.stock)) return data.stock;
  if (data?.id) return [data];
  return [];
}

function firstValue(obj, keys, fallback = "") {
  for (const key of keys) {
    const value = obj?.[key];

    if (Array.isArray(value)) {
      if (!value.length) continue;
      return value
        .map((v) => {
          if (typeof v === "string" || typeof v === "number") return v;
          return v?.name || v?.nom || v?.title || v?.plain_text || v?.id || "";
        })
        .filter(Boolean)
        .join(", ");
    }

    if (value && typeof value === "object") {
      if (value.start) return value.start;
      if (value.name || value.nom || value.title || value.id) {
        return value.name || value.nom || value.title || value.id;
      }
    }

    if (value !== undefined && value !== null && value !== "") return value;
  }

  return fallback;
}

function getSupplierName(supplier) {
  return firstValue(
    supplier,
    ["nom", "name", "fournisseur", "supplier", "title", "Nom", "Fournisseur"],
    "Sans nom"
  );
}

function getSupplierPhone(supplier) {
  return firstValue(
    supplier,
    ["telephone", "téléphone", "phone", "whatsapp", "WhatsApp", "Téléphone"],
    ""
  );
}

function getSupplierWhatsapp(supplier) {
  return firstValue(
    supplier,
    ["whatsapp", "WhatsApp", "telephone", "téléphone", "phone", "Téléphone"],
    ""
  );
}

function getSupplierEmail(supplier) {
  return firstValue(supplier, ["email", "Email", "mail", "Mail"], "");
}

function getStockName(item) {
  return firstValue(
    item,
    ["name", "produit", "Produit", "ingredient", "Ingredient", "ingrédient"],
    "Produit"
  );
}

function getStockStatus(item) {
  return firstValue(
    item,
    ["status", "statut", "Statut", "property_statut"],
    "À configurer"
  );
}

function getStockSupplier(item) {
  return firstValue(
    item,
    [
      "fournisseur",
      "fournisseurDefaut",
      "fournisseurDefautName",
      "supplier",
      "supplierName",
      "Fournisseur",
      "Fournisseur par défaut",
    ],
    "Sans fournisseur"
  );
}

function getStockUnit(item) {
  return firstValue(
    item,
    ["unit", "unite", "Unité", "uniteCommande", "uniteStock"],
    "kg"
  );
}

function getStockSuggested(item) {
  return Number(
    firstValue(
      item,
      [
        "suggested",
        "quantiteCommandee",
        "quantiteCommandeSuggeree",
        "quantiteSuggeree",
        "Quantité suggérée",
      ],
      1
    )
  ) || 1;
}

function getStockPortions(item) {
  return Number(
    firstValue(
      item,
      ["portionsRestantes", "portions", "Portions restantes", "property_portions_restantes"],
      0
    )
  ) || 0;
}

function getStockCriticalLimit(item) {
  return Number(
    firstValue(
      item,
      ["seuilCritique", "seuilCritiquePortion", "Seuil critique", "Seuil critique (portion)"],
      0
    )
  ) || 0;
}

function normalizeStock(item) {
  const status = String(getStockStatus(item));
  return {
    id: item?.id || item?.ingredientId || getStockName(item),
    name: getStockName(item),
    status,
    portionsRestantes: getStockPortions(item),
    fournisseur: getStockSupplier(item),
    unit: getStockUnit(item),
    suggested: getStockSuggested(item),
    seuilCritique: getStockCriticalLimit(item),
    raw: item,
  };
}

function normalizeOrder(order) {
  return {
    id: firstValue(order, ["id"], `order-${Math.random()}`),
    date: String(firstValue(order, ["dateCreation", "Date création", "property_date_cr_ation", "created_time"], "")).slice(0, 10),
    fournisseur: firstValue(order, ["fournisseur", "Fournisseur", "property_fournisseur", "supplier"], "Sans fournisseur"),
    produit: firstValue(order, ["produit", "Produit", "property_produit", "name", "ingredient"], "Produit"),
    quantite: firstValue(order, ["quantite", "quantité", "Quantité", "property_quantit_sugg_r_e", "quantiteCommandee"], ""),
    unite: firstValue(order, ["unite", "Unité", "unit", "property_unit"], ""),
    statut: firstValue(order, ["statut", "Statut", "property_statut"], "À commander"),
    staff: firstValue(order, ["staff", "Staff", "property_staff"], "—"),
    message: firstValue(order, ["message", "Message envoyé", "property_message_envoy", "commentaire"], ""),
  };
}

function StatusBadge({ status }) {
  const s = String(status).toLowerCase();
  const isCrit = s.includes("critique");
  const isLow = s.includes("stock bas") || s.includes("alerte") || s.includes("envoyé") || s.includes("attente") || s.includes("commander");
  const isGood = s.includes("reçu") || s.includes("ok");
  const isCancel = s.includes("annulé");

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black ${
      isCrit ? "bg-red-100 text-red-700" :
      isLow ? "bg-orange-100 text-orange-700" :
      isGood ? "bg-green-100 text-green-700" :
      isCancel ? "bg-gray-100 text-gray-500" :
      "bg-blue-50 text-blue-700"
    }`}>
      {isCrit ? "🔴" : isLow ? "🟠" : isGood ? "✅" : isCancel ? "✖️" : "🔵"} {status}
    </span>
  );
}

function Stepper({ value, onChange, min = 0, unit = "" }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(min, value - 1))} className="w-7 h-7 rounded-lg bg-[#f4eee7] border border-[#eadfd4] text-[#3b241b] font-black text-sm flex items-center justify-center active:scale-95 transition">−</button>
      <div className="w-12 text-center font-black text-sm text-[#3b241b]">{value}</div>
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-[#6f8f32] text-white font-black text-sm flex items-center justify-center active:scale-95 transition">+</button>
      {unit && <span className="text-[11px] text-[#a97862] font-bold ml-1">{unit}</span>}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-[#6f8f32]" : "bg-[#dccbbb]"}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function CommandesPreview() {
  const [orderView, setOrderView] = useState("urgent");
  const [stock, setStock] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderCart, setOrderCart] = useState({});
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [orderDetail, setOrderDetail] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [composeCart, setComposeCart] = useState({});
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);

    try {
      const [stockRes, suppliersRes, ordersRes] = await Promise.all([
        fetch(STOCK_URL),
        fetch(SETTINGS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: "suppliers", action: "list" }),
        }),
        fetch(SETTINGS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resource: "supplierOrders", action: "list" }),
        }),
      ]);

      const stockData = await stockRes.json();
      const suppliersData = await suppliersRes.json();
      const ordersData = await ordersRes.json();

      const stockList = normalizeArray(stockData, "stock").map(normalizeStock);
      const suppliersList = normalizeArray(suppliersData, "suppliers");
      const ordersList = normalizeArray(ordersData, "orders").map(normalizeOrder);

      const UUID_RE = /^[0-9a-f-]{36}$/i;
      const supplierIdMap = {};
      suppliersList.forEach((s) => { if (s.id) supplierIdMap[s.id] = getSupplierName(s); });
      const stockIdMap = {};
      stockList.forEach((item) => { if (item.id) stockIdMap[item.id] = item.name; });
      const resolvedOrders = ordersList.map((o) => ({
        ...o,
        fournisseur: UUID_RE.test(String(o.fournisseur)) ? (supplierIdMap[o.fournisseur] || o.fournisseur) : o.fournisseur,
        produit: UUID_RE.test(String(o.produit)) ? (stockIdMap[o.produit] || o.produit) : o.produit,
      }));

      setStock(stockList);
      setSuppliers(suppliersList);
      setOrders(resolvedOrders);

      const firstSupplier =
        suppliersList[0] ? getSupplierName(suppliersList[0]) :
        stockList.find((i) => i.fournisseur)?.fournisseur ||
        "";

      setSelectedSupplier((prev) => prev || firstSupplier);

      const init = {};
      stockList.forEach((item) => {
        const urgent = isUrgent(item);
        init[item.id] = {
          ...item,
          qty: item.suggested || 1,
          included: urgent,
        };
      });
      setComposeCart(init);
    } catch (error) {
      console.error("Erreur chargement commandes fournisseurs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const isUrgent = (item) => {
    const s = String(item.status || "").toLowerCase();
    return s.includes("critique") || s.includes("stock bas") || s.includes("alerte") || s.includes("commander");
  };

  const urgentItems = stock.filter(isUrgent);

  const urgentBySupplier = useMemo(() => {
    const map = {};
    urgentItems.forEach((item) => {
      const supplier = item.fournisseur || "Sans fournisseur";
      if (!map[supplier]) map[supplier] = [];
      map[supplier].push(item);
    });
    return Object.entries(map);
  }, [urgentItems]);

  const supplierProducts = useMemo(() => {
    return stock.filter((item) => (item.fournisseur || "Sans fournisseur") === selectedSupplier);
  }, [stock, selectedSupplier]);

  const includedItems = supplierProducts.filter((p) => composeCart[p.id]?.included);

  const filteredOrders = useMemo(() => {
    const list = statusFilter === "Tous" ? orders : orders.filter((o) => o.statut === statusFilter);
    return [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [orders, statusFilter]);

  const criticalCount = stock.filter((i) => String(i.status).toLowerCase().includes("critique")).length;
  const alertCount = stock.filter((i) => {
    const s = String(i.status).toLowerCase();
    return s.includes("stock bas") || s.includes("alerte") || s.includes("commander");
  }).length;

  const addToCart = (item) => {
    setOrderCart((prev) => ({
      ...prev,
      [item.id]: { ...item, qty: item.suggested || 1 },
    }));

    setSelectedSupplier(item.fournisseur || selectedSupplier);
  };

  const updateCartQty = (id, qty) => {
    setOrderCart((prev) => ({ ...prev, [id]: { ...prev[id], qty } }));
  };

  const removeFromCart = (id) => {
    setOrderCart((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  };

  const cartItems = Object.values(orderCart);

  const buildMessage = () => {
    const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const lines = includedItems
      .map((p) => `- ${p.name} — ${composeCart[p.id]?.qty || p.suggested} ${p.unit}`)
      .join("\n");
    return `Bonjour ${selectedSupplier} 👋\n\nVoici notre commande du ${date} :\n\n${lines}${notes ? `\n\nNotes : ${notes}` : ""}\n\nMerci 🙏\n— Équipe MÖKA`;
  };

  const supplierContact = suppliers.find((s) => getSupplierName(s) === selectedSupplier);

  const TABS = [
    { id: "urgent", icon: "🚨", label: "Urgences", count: urgentItems.length },
    { id: "compose", icon: "📝", label: "Composer", count: null },
    { id: "history", icon: "📜", label: "Historique", count: orders.length },
    { id: "suppliers", icon: "🏢", label: "Fournisseurs", count: suppliers.length },
  ];

  return (
    <div className="min-h-screen bg-[#f7efe4] text-[#332019] pb-10">
      <div className="max-w-6xl mx-auto px-3 pt-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-black tracking-[0.35em] text-[#a97862] uppercase">MÖKA OS</div>
            <h1 className="text-xl font-black text-[#3b241b]">Commandes fournisseurs</h1>
          </div>

          <button onClick={loadAll} className="rounded-full bg-white border border-[#eadfd4] px-3 py-2 text-xs font-black text-[#6b4a3d]">
            {loading ? "Chargement…" : "↻"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Kpi title="🔴 Critiques" value={criticalCount} desc="À commander maintenant" color="text-red-600" />
          <Kpi title="🟠 Alertes" value={alertCount} desc="Stock bas bientôt" color="text-orange-500" />
          <Kpi title="📦 Historique" value={orders.length} desc="Commandes enregistrées" color="text-[#6f8f32]" />
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setOrderView(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition ${orderView === tab.id ? "bg-[#6f8f32] text-white shadow-md" : "bg-white text-[#6b4a3d] border border-[#eadfd4]"}`}>
              {tab.icon} {tab.label}
              {tab.count !== null && <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${orderView === tab.id ? "bg-white/20 text-white" : "bg-[#f4eee7] text-[#a97862]"}`}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {orderView === "urgent" && (
          <div className="space-y-5">
            {cartItems.length > 0 && (
              <div className="bg-[#fffaf3] rounded-[1.1rem] p-4 text-[#3b241b] border border-[#eadfd4] shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-black text-sm">Panier commande</div>
                  <span className="text-xs text-[#a97862]">{cartItems.length} produit{cartItems.length > 1 ? "s" : ""}</span>
                </div>

                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 bg-[#f7efe4] rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black truncate">{item.name}</div>
                        <div className="text-[10px] text-[#a97862]">{item.fournisseur}</div>
                      </div>
                      <Stepper value={item.qty} onChange={(v) => updateCartQty(item.id, v)} min={1} unit={item.unit} />
                      <button onClick={() => removeFromCart(item.id)} className="text-[#a97862] hover:text-[#3b241b] text-lg font-black leading-none">×</button>
                    </div>
                  ))}
                </div>

                <button onClick={() => setOrderView("compose")} className="mt-3 w-full py-3 rounded-xl bg-[#6f8f32] text-white font-black text-sm">
                  Composer et envoyer →
                </button>
              </div>
            )}

            {urgentBySupplier.map(([supplier, items]) => (
              <div key={supplier}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-sm font-black text-[#3b241b]">🏢 {supplier}</div>
                  <div className="flex-1 h-px bg-[#dccbbb]" />
                  <button onClick={() => items.forEach((i) => addToCart(i))} className="text-xs font-black text-[#6f8f32] border border-[#6f8f32] px-3 py-1 rounded-full">
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
                              <div className={`font-black ${inCart ? "text-[#3b241b]" : "text-[#3b241b]"}`}>{item.name}</div>
                              <div className={`text-[11px] mt-0.5 ${inCart ? "text-[#a97862]" : "text-[#a97862]"}`}>
                                {item.portionsRestantes} portions restantes · seuil {item.seuilCritique || "—"}
                              </div>
                            </div>

                            {inCart && <Stepper value={orderCart[item.id].qty} onChange={(v) => updateCartQty(item.id, v)} min={1} unit={item.unit} />}
                          </div>

                          {!inCart ? (
                            <button onClick={() => addToCart(item)} className="mt-3 w-full py-2 rounded-xl border-2 border-[#6f8f32] text-[#6f8f32] font-black text-xs">
                              + Ajouter ({item.suggested} {item.unit})
                            </button>
                          ) : (
                            <button onClick={() => removeFromCart(item.id)} className="mt-2 w-full py-1.5 rounded-xl bg-white text-[#6f8f32] border border-[#6f8f32] font-black text-xs">
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

            {!loading && urgentItems.length === 0 && (
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
                {suppliers.map((s) => {
                  const name = getSupplierName(s);
                  return (
                    <button key={s.id || name} onClick={() => setSelectedSupplier(name)} className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition ${selectedSupplier === name ? "bg-[#6f8f32] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            {supplierContact && (
              <SupplierContactCard supplier={supplierContact} />
            )}

            <div className="bg-white rounded-[1.1rem] border border-[#eadfd4] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#eadfd4] flex justify-between items-center">
                <div className="text-sm font-black text-[#3b241b]">Produits à commander</div>
                <div className="text-xs text-[#a97862] font-bold">{includedItems.length} sélectionnés</div>
              </div>

              <div className="divide-y divide-[#eadfd4]">
                {supplierProducts.map((p) => {
                  const item = composeCart[p.id] || { ...p, qty: p.suggested, included: false };
                  const isCrit = String(p.status).toLowerCase().includes("critique");
                  const isLow = isUrgent(p) && !isCrit;

                  return (
                    <div key={p.id} className={`px-4 py-3 flex items-center gap-3 transition ${!item.included ? "opacity-50" : ""}`}>
                      <Toggle checked={item.included} onChange={(v) => setComposeCart((prev) => ({ ...prev, [p.id]: { ...item, included: v } }))} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-black text-[#3b241b] truncate">{p.name}</div>
                        {(isCrit || isLow) && <div className={`text-[11px] font-bold ${isCrit ? "text-red-600" : "text-orange-500"}`}>{isCrit ? "🔴 Critique" : "🟠 Stock bas"}</div>}
                      </div>
                      <Stepper value={item.qty} onChange={(v) => setComposeCart((prev) => ({ ...prev, [p.id]: { ...item, qty: v } }))} min={0} unit={p.unit} />
                    </div>
                  );
                })}

                {!loading && supplierProducts.length === 0 && (
                  <div className="p-5 text-sm font-bold text-[#a97862]">
                    Aucun produit relié à ce fournisseur dans le stock live.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-[#a97862] mb-1.5">Notes (optionnel)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex : livraison matin SVP, emballage sous-vide..." className="w-full rounded-[1rem] border border-[#eadfd4] bg-white px-4 py-3 text-sm text-[#3b241b] outline-none resize-none placeholder:text-[#c8b4a8]" rows={2} />
            </div>

            <button onClick={() => setShowPreview(true)} disabled={includedItems.length === 0} className="w-full py-4 rounded-[1rem] bg-[#6f8f32] text-white font-black shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
              👁 Prévisualiser et envoyer ({includedItems.length} produits)
            </button>
          </div>
        )}

        {orderView === "history" && (
          <div className="space-y-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {["Tous", "À commander", "Envoyé", "Reçu", "Annulé"].map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition ${statusFilter === s ? "bg-[#6f8f32] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
                  {s}
                </button>
              ))}
            </div>

            <div className="text-xs text-[#a97862] font-bold">{filteredOrders.length} commandes</div>

            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-[1.1rem] border border-[#eadfd4] shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={order.statut} />
                      <span className="text-[11px] text-[#a97862]">{order.date || "Sans date"} · {order.staff}</span>
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
            {suppliers.map((supplier) => {
              const name = getSupplierName(supplier);
              const supplierUrgents = urgentItems.filter((p) => p.fournisseur === name);

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

                  <SupplierContactCard supplier={supplier} compact />

                  {supplierUrgents.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#eadfd4]">
                      <div className="text-[10px] font-black text-[#a97862] mb-1.5">PRODUITS À COMMANDER</div>
                      <div className="space-y-1">
                        {supplierUrgents.slice(0, 4).map((p) => (
                          <div key={p.id} className="flex items-center gap-2 text-[11px]">
                            <StatusBadge status={p.status} />
                            <span className="font-bold text-[#3b241b]">{p.name}</span>
                            <span className="text-[#a97862]">→ {p.suggested} {p.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => { setSelectedSupplier(name); setOrderView("compose"); }} className="w-full mt-3 py-2 rounded-xl bg-[#6f8f32] text-white font-black text-xs">
                    Commander
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showPreview && (
        <PreviewModal
          buildMessage={buildMessage}
          selectedSupplier={selectedSupplier}
          supplier={supplierContact}
          setShowPreview={setShowPreview}
        />
      )}

      {orderDetail && (
        <OrderDetailModal orderDetail={orderDetail} setOrderDetail={setOrderDetail} supplier={suppliers.find((s) => getSupplierName(s) === orderDetail.fournisseur)} />
      )}
    </div>
  );
}

function Kpi({ title, value, desc, color }) {
  return (
    <div className="rounded-[1.1rem] bg-white border border-[#eadfd4] p-3 shadow-sm">
      <div className="text-[11px] font-black text-[#a97862]">{title}</div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      <div className="text-[10px] text-[#a97862] mt-0.5">{desc}</div>
    </div>
  );
}

function SupplierContactCard({ supplier, compact = false }) {
  const phone = getSupplierPhone(supplier);
  const whatsapp = getSupplierWhatsapp(supplier);
  const email = getSupplierEmail(supplier);

  return (
    <div className={compact ? "flex gap-2" : "bg-white rounded-[1.1rem] border border-[#eadfd4] p-3 shadow-sm flex items-center justify-between gap-3"}>
      {!compact && (
        <div>
          <div className="text-xs font-black text-[#3b241b]">{getSupplierName(supplier)}</div>
          <div className="text-[11px] text-[#a97862]">{email || phone || "Contact à compléter"}</div>
        </div>
      )}

      <div className="flex gap-2">
        {phone && <a href={`tel:${phone}`} className="w-9 h-9 rounded-xl bg-[#f4eee7] flex items-center justify-center text-base">📞</a>}
        {whatsapp && <a href={`https://wa.me/${String(whatsapp).replace(/\D/g, "")}`} className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-base">💬</a>}
        {email && <a href={`mailto:${email}`} className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-base">📧</a>}
      </div>
    </div>
  );
}

function PreviewModal({ buildMessage, selectedSupplier, supplier, setShowPreview }) {
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
            const whatsapp = getSupplierWhatsapp(supplier);
            if (whatsapp) window.open(`https://wa.me/${String(whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-green-500 text-white font-black text-sm">💬 WhatsApp</button>

          <button onClick={() => {
            const email = getSupplierEmail(supplier);
            if (email) window.open(`mailto:${email}?subject=Commande MÖKA&body=${encodeURIComponent(message)}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-blue-500 text-white font-black text-sm">📧 Email</button>
        </div>

        <button onClick={() => { alert("Prochaine étape : sauvegarde/envoi dans Notion ✅"); setShowPreview(false); }} className="w-full mt-2 py-3 rounded-[1rem] bg-[#6f8f32] text-white font-black text-sm">
          ✅ Marquer comme préparée
        </button>
      </div>
    </div>
  );
}

function OrderDetailModal({ orderDetail, supplier, setOrderDetail }) {
  const message = orderDetail.message || `${orderDetail.produit} × ${orderDetail.quantite} ${orderDetail.unite}`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-[1.4rem] shadow-xl border border-[#eadfd4] w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black tracking-[0.22em] text-[#a97862] uppercase">Détail commande</div>
            <h2 className="text-lg font-black text-[#3b241b]">{orderDetail.fournisseur}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={orderDetail.statut} />
              <span className="text-xs text-[#a97862]">{orderDetail.date || "Sans date"} · {orderDetail.staff}</span>
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
            const whatsapp = getSupplierWhatsapp(supplier);
            if (whatsapp) window.open(`https://wa.me/${String(whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(message)}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-green-50 border border-green-200 text-green-700 font-black text-xs">💬 WhatsApp</button>

          <button onClick={() => navigator.clipboard?.writeText(message).then(() => alert("Copié !"))} className="flex-1 py-3 rounded-[1rem] bg-[#f4eee7] text-[#3b241b] font-black text-xs">📋 Copier</button>
        </div>
      </div>
    </div>
  );
}
