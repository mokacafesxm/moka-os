"use client";

import { useState, useMemo } from "react";

const mockStock = [
  { id:"1", name:"Mangue fraîche", status:"Critique", portionsRestantes:2, category:"Fruits & légumes", fournisseur:"Metro Caraïbes", unit:"kg", suggested:5, seuilCritique:5 },
  { id:"2", name:"Lait entier", status:"Critique", portionsRestantes:1, category:"Produits laitiers", fournisseur:"Daval Distribution", unit:"L", suggested:24, seuilCritique:3 },
  { id:"3", name:"Café Colombia", status:"Critique", portionsRestantes:3, category:"Bar", fournisseur:"Moka Import", unit:"kg", suggested:10, seuilCritique:5 },
  { id:"4", name:"Ananas", status:"Stock bas", portionsRestantes:4, category:"Fruits & légumes", fournisseur:"Metro Caraïbes", unit:"pièce", suggested:8, seuilCritique:2 },
  { id:"5", name:"Beurre doux", status:"Stock bas", portionsRestantes:5, category:"Produits laitiers", fournisseur:"Daval Distribution", unit:"kg", suggested:6, seuilCritique:3 },
  { id:"6", name:"Farine T55", status:"Stock bas", portionsRestantes:6, category:"Boulangerie", fournisseur:"Saveur Antilles", unit:"kg", suggested:20, seuilCritique:5 },
  { id:"7", name:"Citron vert", status:"Stock bas", portionsRestantes:3, category:"Fruits & légumes", fournisseur:"Metro Caraïbes", unit:"kg", suggested:4, seuilCritique:2 },
];

const mockOrders = [
  { id:"o1", date:"2025-01-20", fournisseur:"Metro Caraïbes", produits:["Mangue fraîche × 5 kg","Ananas × 8 pièces","Citron vert × 3 kg"], statut:"Reçu", staff:"Sarah", message:"Bonjour Metro Caraïbes,\n\nCommande MÖKA CAFÉ – 20/01/2025\nPar : Sarah\n\n• Mangue fraîche × 5 kg\n• Ananas × 8 pièces\n• Citron vert × 3 kg\n\nMerci de confirmer réception.\n\nMÖKA CAFÉ SXM 🌴" },
  { id:"o2", date:"2025-01-18", fournisseur:"Daval Distribution", produits:["Lait entier × 24 L","Beurre doux × 5 kg"], statut:"Reçu", staff:"Marc", message:"Bonjour Daval Distribution,\n\nCommande MÖKA CAFÉ – 18/01/2025\nPar : Marc\n\n• Lait entier × 24 L\n• Beurre doux × 5 kg\n\nMerci.\n\nMÖKA CAFÉ SXM 🌴" },
  { id:"o3", date:"2025-01-23", fournisseur:"Moka Import", produits:["Café Colombia × 10 kg"], statut:"Envoyé", staff:"Sarah", message:"Bonjour Moka Import,\n\nCommande MÖKA CAFÉ – 23/01/2025\nPar : Sarah\n\n• Café Colombia × 10 kg\n\nMerci de confirmer dispo.\n\nMÖKA CAFÉ SXM 🌴" },
  { id:"o4", date:"2025-01-24", fournisseur:"Metro Caraïbes", produits:["Mangue fraîche × 3 kg","Ananas × 5 pièces"], statut:"En attente", staff:"Marc", message:"" },
  { id:"o5", date:"2025-01-15", fournisseur:"Saveur Antilles", produits:["Farine T55 × 25 kg","Sucre roux × 10 kg"], statut:"Reçu", staff:"Lisa", message:"Bonjour Saveur Antilles,\n\nCommande MÖKA CAFÉ – 15/01/2025\nPar : Lisa\n\n• Farine T55 × 25 kg\n• Sucre roux × 10 kg\n\nMerci.\n\nMÖKA CAFÉ SXM 🌴" },
  { id:"o6", date:"2025-01-10", fournisseur:"Daval Distribution", produits:["Crème fraîche × 6 L"], statut:"Annulé", staff:"Marc", message:"" },
];

const mockSuppliers = [
  { id:"s1", name:"Metro Caraïbes", telephone:"+590 590 XX XX XX", whatsapp:"+590 690 XX XX XX", email:"commandes@metro-caraibes.fr", categories:["Fruits & légumes","Boulangerie"], productsCount:12, lastOrder:"20/01/2025", delai:"24-48h" },
  { id:"s2", name:"Daval Distribution", telephone:"+590 690 YY YY YY", whatsapp:"+590 690 YY YY YY", email:"contact@daval.gp", categories:["Produits laitiers","Fromages"], productsCount:7, lastOrder:"18/01/2025", delai:"48h" },
  { id:"s3", name:"Moka Import", telephone:"+590 590 ZZ ZZ ZZ", whatsapp:"+590 690 ZZ ZZ ZZ", email:"orders@mokaimport.com", categories:["Bar","Boissons"], productsCount:9, lastOrder:"23/01/2025", delai:"3-5 jours" },
  { id:"s4", name:"Saveur Antilles", telephone:"+590 690 WW WW WW", whatsapp:"+590 690 WW WW WW", email:"saveur@antilles.gp", categories:["Sec & épicerie","Boulangerie"], productsCount:16, lastOrder:"15/01/2025", delai:"48h" },
];

const productsBySupplier = {
  "Metro Caraïbes": [
    { id:"1", name:"Mangue fraîche", unit:"kg", suggested:5, status:"Critique" },
    { id:"4", name:"Ananas", unit:"pièce", suggested:8, status:"Stock bas" },
    { id:"7", name:"Citron vert", unit:"kg", suggested:4, status:"Stock bas" },
    { id:"m1", name:"Tomate grappe", unit:"kg", suggested:3, status:"OK" },
    { id:"m2", name:"Avocat", unit:"pièce", suggested:10, status:"OK" },
    { id:"m3", name:"Gingembre frais", unit:"kg", suggested:1, status:"OK" },
  ],
  "Daval Distribution": [
    { id:"2", name:"Lait entier", unit:"L", suggested:24, status:"Critique" },
    { id:"5", name:"Beurre doux", unit:"kg", suggested:6, status:"Stock bas" },
    { id:"d1", name:"Crème fraîche", unit:"L", suggested:4, status:"OK" },
    { id:"d2", name:"Yaourt nature", unit:"pot", suggested:12, status:"OK" },
  ],
  "Moka Import": [
    { id:"3", name:"Café Colombia", unit:"kg", suggested:10, status:"Critique" },
    { id:"mi1", name:"Thé Earl Grey", unit:"boîte", suggested:2, status:"OK" },
    { id:"mi2", name:"Cacao pur", unit:"kg", suggested:3, status:"OK" },
  ],
  "Saveur Antilles": [
    { id:"6", name:"Farine T55", unit:"kg", suggested:20, status:"Stock bas" },
    { id:"sa1", name:"Sucre roux", unit:"kg", suggested:10, status:"OK" },
    { id:"sa2", name:"Huile tournesol", unit:"L", suggested:5, status:"OK" },
  ],
};

function StatusBadge({ status }) {
  const s = String(status).toLowerCase();
  const isCrit = s.includes("critique");
  const isLow = s.includes("stock bas") || s.includes("alerte") || s.includes("envoyé") || s.includes("en attente");
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
      <button onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-lg bg-[#3b241b] text-white font-black text-sm flex items-center justify-center active:scale-95 transition">+</button>
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
  const [orderCart, setOrderCart] = useState({});
  const [selectedSupplier, setSelectedSupplier] = useState("Metro Caraïbes");
  const [orderDetail, setOrderDetail] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [notes, setNotes] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
  const [composeCart, setComposeCart] = useState(() => {
    const init = {};
    Object.values(productsBySupplier).flat().forEach((p) => {
      init[p.id] = { ...p, qty: p.suggested, included: p.status !== "OK" };
    });
    return init;
  });

  const urgentItems = mockStock.filter((i) => {
    const s = i.status.toLowerCase();
    return s.includes("critique") || s.includes("stock bas");
  });

  const urgentBySupplier = useMemo(() => {
    const map = {};
    urgentItems.forEach((item) => {
      const s = item.fournisseur || "Inconnu";
      if (!map[s]) map[s] = [];
      map[s].push(item);
    });
    return Object.entries(map);
  }, [urgentItems]);

  const addToCart = (item) => {
    setOrderCart((prev) => ({
      ...prev,
      [item.id]: { ...item, qty: item.suggested || 1 },
    }));
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
  const criticalCount = mockStock.filter((i) => i.status === "Critique").length;
  const alertCount = mockStock.filter((i) => i.status === "Stock bas").length;
  const weekOrders = mockOrders.filter((o) => o.statut !== "Annulé").length;

  const supplierProducts = productsBySupplier[selectedSupplier] || [];
  const includedItems = supplierProducts.filter((p) => composeCart[p.id]?.included);

  const buildMessage = () => {
    const date = new Date().toLocaleDateString("fr-FR");
    const lines = includedItems.map((p) => `• ${p.name} × ${composeCart[p.id]?.qty || p.suggested} ${p.unit}`).join("\n");
    return `Bonjour ${selectedSupplier},\n\nCommande MÖKA CAFÉ – ${date}\nPar : Staff\n\n${lines}${notes ? `\n\nNotes : ${notes}` : ""}\n\nMerci de confirmer.\n\nMÖKA CAFÉ SXM 🌴`;
  };

  const filteredOrders = statusFilter === "Tous" ? mockOrders : mockOrders.filter((o) => o.statut === statusFilter);

  const TABS = [
    { id: "urgent", icon: "🚨", label: "Urgences", count: urgentItems.length },
    { id: "compose", icon: "📝", label: "Composer", count: null },
    { id: "history", icon: "📜", label: "Historique", count: mockOrders.length },
    { id: "suppliers", icon: "🏢", label: "Fournisseurs", count: mockSuppliers.length },
  ];

  return (
    <div className="min-h-screen bg-[#f7efe4] text-[#332019] pb-10">
      <div className="max-w-4xl mx-auto px-3 pt-4">
        <div className="mb-4">
          <div className="text-[10px] font-black tracking-[0.35em] text-[#a97862] uppercase">MÖKA OS</div>
          <h1 className="text-2xl font-black text-[#3b241b]">🛒 Commandes fournisseurs</h1>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Kpi title="🔴 Critiques" value={criticalCount} desc="À commander maintenant" color="text-red-600" />
          <Kpi title="🟠 Alertes" value={alertCount} desc="Stock bas bientôt" color="text-orange-500" />
          <Kpi title="📦 Cette semaine" value={weekOrders} desc="Commandes passées" color="text-[#6f8f32]" />
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setOrderView(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition ${orderView === tab.id ? "bg-[#3b241b] text-white shadow-md" : "bg-white text-[#6b4a3d] border border-[#eadfd4]"}`}>
              {tab.icon} {tab.label}
              {tab.count !== null && <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${orderView === tab.id ? "bg-white/20 text-white" : "bg-[#f4eee7] text-[#a97862]"}`}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {orderView === "urgent" && (
          <div className="space-y-5">
            {cartItems.length > 0 && (
              <div className="bg-[#3b241b] rounded-[1.1rem] p-4 text-white shadow-md">
                <div className="flex justify-between items-center mb-3">
                  <div className="font-black text-sm">🛒 Panier commande</div>
                  <span className="text-xs text-white/70">{cartItems.length} produit{cartItems.length > 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2">
                  {cartItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 bg-white/10 rounded-xl px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black truncate">{item.name}</div>
                        <div className="text-[10px] text-white/60">{item.fournisseur}</div>
                      </div>
                      <Stepper value={item.qty} onChange={(v) => updateCartQty(item.id, v)} min={1} unit={item.unit} />
                      <button onClick={() => removeFromCart(item.id)} className="text-white/50 hover:text-white text-lg font-black leading-none">×</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setOrderView("compose")} className="mt-3 w-full py-3 rounded-xl bg-[#6f8f32] text-white font-black text-sm">Composer et envoyer →</button>
              </div>
            )}

            {urgentBySupplier.map(([supplier, items]) => (
              <div key={supplier}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-sm font-black text-[#3b241b]">🏢 {supplier}</div>
                  <div className="flex-1 h-px bg-[#dccbbb]" />
                  <button onClick={() => items.forEach((i) => addToCart(i))} className="text-xs font-black text-[#6f8f32] border border-[#6f8f32] px-3 py-1 rounded-full">Tout ajouter</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {items.map((item) => {
                    const inCart = !!orderCart[item.id];
                    const isCrit = item.status === "Critique";
                    return (
                      <div key={item.id} className={`rounded-[1.25rem] border overflow-hidden transition ${inCart ? "bg-[#6f8f32] border-[#6f8f32]" : "bg-white border-[#eadfd4]"}`}>
                        <div className={`h-1.5 ${isCrit ? "bg-red-500" : "bg-orange-400"}`} />
                        <div className="p-4">
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <div className={`text-[11px] font-black mb-0.5 ${inCart ? "text-white/70" : isCrit ? "text-red-600" : "text-orange-500"}`}>{isCrit ? "🔴 Critique" : "🟠 Stock bas"}</div>
                              <div className={`font-black ${inCart ? "text-white" : "text-[#3b241b]"}`}>{item.name}</div>
                              <div className={`text-[11px] mt-0.5 ${inCart ? "text-white/70" : "text-[#a97862]"}`}>{item.portionsRestantes} portions restantes · seuil {item.seuilCritique}</div>
                            </div>
                            {inCart && <Stepper value={orderCart[item.id].qty} onChange={(v) => updateCartQty(item.id, v)} min={1} unit={item.unit} />}
                          </div>
                          {!inCart ? (
                            <button onClick={() => addToCart(item)} className="mt-3 w-full py-2 rounded-xl border-2 border-[#3b241b] text-[#3b241b] font-black text-xs">+ Ajouter ({item.suggested} {item.unit})</button>
                          ) : (
                            <button onClick={() => removeFromCart(item.id)} className="mt-2 w-full py-1.5 rounded-xl bg-white/20 text-white font-black text-xs">✓ Dans le panier · Retirer</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {orderView === "compose" && (
          <ComposeView
            suppliers={mockSuppliers}
            productsBySupplier={productsBySupplier}
            selectedSupplier={selectedSupplier}
            setSelectedSupplier={setSelectedSupplier}
            composeCart={composeCart}
            setComposeCart={setComposeCart}
            includedItems={includedItems}
            notes={notes}
            setNotes={setNotes}
            setShowPreview={setShowPreview}
          />
        )}

        {orderView === "history" && (
          <HistoryView
            filteredOrders={filteredOrders}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            setOrderDetail={setOrderDetail}
          />
        )}

        {orderView === "suppliers" && (
          <SuppliersView
            suppliers={mockSuppliers}
            productsBySupplier={productsBySupplier}
            setSelectedSupplier={setSelectedSupplier}
            setOrderView={setOrderView}
          />
        )}
      </div>

      {showPreview && (
        <PreviewModal
          buildMessage={buildMessage}
          selectedSupplier={selectedSupplier}
          suppliers={mockSuppliers}
          setShowPreview={setShowPreview}
        />
      )}

      {orderDetail && (
        <OrderDetailModal orderDetail={orderDetail} suppliers={mockSuppliers} setOrderDetail={setOrderDetail} />
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

function ComposeView({ suppliers, productsBySupplier, selectedSupplier, setSelectedSupplier, composeCart, setComposeCart, includedItems, notes, setNotes, setShowPreview }) {
  const supplierProducts = productsBySupplier[selectedSupplier] || [];
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs font-black text-[#a97862] mb-2">Sélectionner un fournisseur</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {suppliers.map((s) => (
            <button key={s.id} onClick={() => setSelectedSupplier(s.name)} className={`px-4 py-2 rounded-full text-xs font-black whitespace-nowrap transition ${selectedSupplier === s.name ? "bg-[#3b241b] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
              {s.name}
              {(productsBySupplier[s.name] || []).some((p) => p.status === "Critique") && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-red-500" />}
            </button>
          ))}
        </div>
      </div>

      {(() => {
        const sup = suppliers.find((s) => s.name === selectedSupplier);
        return sup ? (
          <div className="bg-white rounded-[1.1rem] border border-[#eadfd4] p-3 shadow-sm flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-[#3b241b]">{sup.name}</div>
              <div className="text-[11px] text-[#a97862]">Délai : {sup.delai} · {sup.productsCount} produits</div>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${sup.telephone}`} className="w-9 h-9 rounded-xl bg-[#f4eee7] flex items-center justify-center text-base">📞</a>
              <a href={`https://wa.me/${sup.whatsapp?.replace(/\D/g, "")}`} className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-base">💬</a>
              <a href={`mailto:${sup.email}`} className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-base">📧</a>
            </div>
          </div>
        ) : null;
      })()}

      <div className="bg-white rounded-[1.1rem] border border-[#eadfd4] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[#eadfd4] flex justify-between items-center">
          <div className="text-sm font-black text-[#3b241b]">Produits à commander</div>
          <div className="text-xs text-[#a97862] font-bold">{includedItems.length} sélectionnés</div>
        </div>
        <div className="divide-y divide-[#eadfd4]">
          {supplierProducts.map((p) => {
            const item = composeCart[p.id] || { ...p, qty: p.suggested, included: false };
            const isCrit = p.status === "Critique";
            const isLow = p.status === "Stock bas";
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
  );
}

function HistoryView({ filteredOrders, statusFilter, setStatusFilter, setOrderDetail }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {["Tous", "En attente", "Envoyé", "Reçu", "Annulé"].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition ${statusFilter === s ? "bg-[#3b241b] text-white" : "bg-white border border-[#eadfd4] text-[#6b4a3d]"}`}>
            {s === "En attente" ? "🟡" : s === "Envoyé" ? "🔵" : s === "Reçu" ? "✅" : s === "Annulé" ? "✖️" : ""} {s}
          </button>
        ))}
      </div>

      <div className="text-xs text-[#a97862] font-bold">{filteredOrders.length} commandes</div>

      {filteredOrders.sort((a, b) => b.date.localeCompare(a.date)).map((order) => (
        <div key={order.id} className="bg-white rounded-[1.1rem] border border-[#eadfd4] shadow-sm overflow-hidden">
          <div className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={order.statut} />
                <span className="text-[11px] text-[#a97862]">{order.date.split("-").reverse().join("/")} · {order.staff}</span>
              </div>
              <div className="font-black text-sm text-[#3b241b]">{order.fournisseur}</div>
              <div className="text-[11px] text-[#a97862] mt-1 truncate">{order.produits.join(" · ")}</div>
            </div>
            <button onClick={() => setOrderDetail(order)} className="shrink-0 text-xs font-black text-[#6f8f32] border border-[#6f8f32] px-3 py-1.5 rounded-xl">Détail →</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuppliersView({ suppliers, productsBySupplier, setSelectedSupplier, setOrderView }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {suppliers.map((supplier) => (
        <div key={supplier.id} className="bg-white rounded-[1.25rem] border border-[#eadfd4] shadow-sm p-4">
          <div className="flex justify-between items-start gap-2 mb-3">
            <div>
              <div className="font-black text-[#3b241b]">{supplier.name}</div>
              <div className="text-[11px] text-[#a97862] mt-0.5">{supplier.productsCount} produits · Délai {supplier.delai}</div>
            </div>
            {(productsBySupplier[supplier.name] || []).some((p) => p.status === "Critique") && <span className="text-xs bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-full">Urgent</span>}
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {supplier.categories.map((cat) => <span key={cat} className="text-[10px] font-bold bg-[#f4eee7] text-[#6b4a3d] px-2 py-0.5 rounded-full">{cat}</span>)}
          </div>

          <div className="text-[11px] text-[#a97862] mb-3">Dernière commande : {supplier.lastOrder}</div>

          <div className="flex gap-2">
            <a href={`tel:${supplier.telephone}`} className="flex-1 py-2 rounded-xl bg-[#f4eee7] text-[#3b241b] font-black text-xs flex items-center justify-center gap-1">📞 Appeler</a>
            <a href={`https://wa.me/${supplier.whatsapp?.replace(/\D/g, "")}`} className="flex-1 py-2 rounded-xl bg-green-50 border border-green-100 text-green-700 font-black text-xs flex items-center justify-center gap-1">💬 WhatsApp</a>
            <button onClick={() => { setSelectedSupplier(supplier.name); setOrderView("compose"); }} className="flex-1 py-2 rounded-xl bg-[#3b241b] text-white font-black text-xs flex items-center justify-center gap-1">🛒 Commander</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PreviewModal({ buildMessage, selectedSupplier, suppliers, setShowPreview }) {
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

        <div className="bg-[#e8f5e1] rounded-[1rem] p-4 mb-4 font-mono text-sm text-[#2d5a1b] whitespace-pre-wrap leading-relaxed">{buildMessage()}</div>

        <div className="flex gap-2">
          <button onClick={() => {
            const sup = suppliers.find((s) => s.name === selectedSupplier);
            if (sup?.whatsapp) window.open(`https://wa.me/${sup.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(buildMessage())}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-green-500 text-white font-black text-sm">💬 Envoyer WhatsApp</button>

          <button onClick={() => {
            const sup = suppliers.find((s) => s.name === selectedSupplier);
            if (sup?.email) window.open(`mailto:${sup.email}?subject=Commande MÖKA&body=${encodeURIComponent(buildMessage())}`);
          }} className="flex-1 py-3 rounded-[1rem] bg-blue-500 text-white font-black text-sm">📧 Envoyer Email</button>
        </div>

        <button onClick={() => { alert("Commande sauvegardée dans Besoin fournisseur ✅"); setShowPreview(false); }} className="w-full mt-2 py-3 rounded-[1rem] bg-[#6f8f32] text-white font-black text-sm">
          ✅ Enregistrer dans MÖKA OS
        </button>
      </div>
    </div>
  );
}

function OrderDetailModal({ orderDetail, suppliers, setOrderDetail }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-[1.4rem] shadow-xl border border-[#eadfd4] w-full max-w-lg max-h-[85vh] overflow-y-auto p-5">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <div className="text-[10px] font-black tracking-[0.22em] text-[#a97862] uppercase">Détail commande</div>
            <h2 className="text-lg font-black text-[#3b241b]">{orderDetail.fournisseur}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={orderDetail.statut} />
              <span className="text-xs text-[#a97862]">{orderDetail.date.split("-").reverse().join("/")} · {orderDetail.staff}</span>
            </div>
          </div>
          <button onClick={() => setOrderDetail(null)} className="w-9 h-9 rounded-full bg-[#f4eee7] flex items-center justify-center font-black text-[#a97862]">×</button>
        </div>

        <div className="bg-[#f7efe4] rounded-[1rem] p-3 mb-4">
          <div className="text-xs font-black text-[#a97862] mb-2">PRODUITS COMMANDÉS</div>
          {orderDetail.produits.map((p, i) => <div key={i} className="text-sm font-bold text-[#3b241b] py-1 border-b border-[#eadfd4] last:border-0">{p}</div>)}
        </div>

        {orderDetail.message ? (
          <>
            <div className="text-xs font-black text-[#a97862] mb-2">MESSAGE ENVOYÉ</div>
            <div className="bg-[#e8f5e1] rounded-[1rem] p-4 font-mono text-xs text-[#2d5a1b] whitespace-pre-wrap leading-relaxed mb-4">{orderDetail.message}</div>
            <div className="flex gap-2">
              <button onClick={() => {
                const sup = suppliers.find((s) => s.name === orderDetail.fournisseur);
                if (sup?.whatsapp) window.open(`https://wa.me/${sup.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(orderDetail.message)}`);
              }} className="flex-1 py-3 rounded-[1rem] bg-green-50 border border-green-200 text-green-700 font-black text-xs">💬 Re-envoyer WhatsApp</button>
              <button onClick={() => navigator.clipboard?.writeText(orderDetail.message).then(() => alert("Copié !"))} className="flex-1 py-3 rounded-[1rem] bg-[#f4eee7] text-[#3b241b] font-black text-xs">📋 Copier</button>
            </div>
          </>
        ) : (
          <div className="text-center text-xs text-[#a97862] py-4">Aucun message enregistré pour cette commande.</div>
        )}
      </div>
    </div>
  );
}
