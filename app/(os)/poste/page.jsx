"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import ReceiveModal, { parseOrderProducts } from "../../components/shared/ReceiveModal";
import { getPosteStatus, setPosteStatus } from "../../components/shared/posteStatus";

const POSTES = [
  { key: "Bar", nom: "Bar", emoji: "☕" },
  { key: "Cuisine", nom: "Cuisine", emoji: "👨‍🍳" },
  { key: "Salle", nom: "Salle", emoji: "🛋" },
  { key: "Plonge", nom: "Plonge", emoji: "🚿" },
];

const WORKFLOW_IDS_BY_POSTE = {
  Bar: { ouverture: "ouverture-bar", fermeture: "fermeture-bar" },
  Cuisine: { ouverture: "ouverture-cuisine", fermeture: "fermeture-cuisine" },
  Salle: { ouverture: "ouverture-salle", fermeture: "fermeture-salle" },
};

const SXM_TZ = "America/Puerto_Rico";
const CLOSE_HOUR = 15;

function getSXMParts(date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: SXM_TZ, hour: "numeric", hour12: false }).format(date));
  const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: SXM_TZ, minute: "numeric" }).format(date));
  return { hour, minute };
}

function formatHeureSXM(isoDate) {
  if (!isoDate) return "";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: SXM_TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(isoDate));
}

// Stocks bas — mapping par catégorie produit (pas par Zone_stockage, qui
// encode un lieu de stockage physique — "Frigo prépas", "Dry Storage" — et
// ne contient jamais la valeur "Cuisine"). Les fruits/légumes sont partagés
// Bar (smoothies) + Cuisine (bowls/plats), donc comptés dans les deux.
function isBarProduct(item) {
  const cat = String(item.category || item.categorie || "").toLowerCase();
  return cat.includes("bar") || cat.includes("café") || cat.includes("cafe")
    || cat.includes("coffee") || cat.includes("boisson")
    || cat.includes("iced") || cat.includes("matcha") || cat.includes("ube");
}
function isFruitVegProduct(item) {
  const cat = String(item.category || item.categorie || "").toLowerCase();
  return cat.includes("fruit") || cat.includes("légume") || cat.includes("legume")
    || cat.includes("végétal") || cat.includes("vegetal") || cat.includes("fresh");
}
function isCuisineProduct(item) {
  return !isBarProduct(item);
}
function isStockLow(item) {
  const s = String(item.statut || "").toLowerCase();
  return s.includes("critique") || s.includes("stock bas");
}

function SectionCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">{title}</div>
      {children}
    </div>
  );
}

function ClosingBanner({ hour, minute }) {
  if (hour < 14 || hour >= 16) return null;
  const minutesToClose = CLOSE_HOUR * 60 - (hour * 60 + minute);
  const timeLabel = `${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
  return (
    <div
      className="rounded-2xl p-3.5 text-sm font-bold flex items-center justify-between gap-2"
      style={{ background: "#fef3c7", color: "#854f0b", border: "1px solid #fcd34d" }}
    >
      <span>
        ⏰ {timeLabel} — {minutesToClose > 0 ? `Fermeture dans ${minutesToClose} min` : `Fermeture dépassée de ${-minutesToClose} min`}
      </span>
    </div>
  );
}

function TempsList({ executions, posteNom }) {
  // Ne pas filtrer sur "valeurTemperature != null" : getNumber() (_notion.js,
  // partagé par toute l'app) retourne 0 par défaut quand la propriété Notion
  // est vide, pas null — indiscernable d'une vraie lecture à 0°C. On filtre
  // plutôt sur le nom de l'étape, qui encode déjà son type ("... — Température ...").
  const releves = executions.filter(
    (e) => String(e.nom || "").includes(posteNom) && /température/i.test(e.nom || "")
  );
  if (releves.length === 0) return <div className="text-sm text-[#9a7060] py-2">Pas de relevé aujourd&apos;hui</div>;
  return (
    <div className="space-y-2">
      {releves.map((e) => (
        <div key={e.id} className="flex items-center justify-between text-sm">
          <span className="font-semibold text-[#2c1a10]">{e.nom.split("—").pop().trim()}</span>
          <span className="font-black text-[#2c1a10]">{e.valeurTemperature}°C</span>
        </div>
      ))}
    </div>
  );
}

function TachesList({ taches }) {
  if (taches.length === 0) return <div className="text-sm text-[#9a7060] py-2">Aucune tâche pour le moment</div>;
  return (
    <div className="space-y-2">
      {taches.map((t) => (
        <div key={t.id} className="flex items-center justify-between">
          <span className="text-sm font-bold text-[#2c1a10]">{t.nom}</span>
          <span className="text-[10px] text-[#9a7060] font-semibold">{t.frequence}</span>
        </div>
      ))}
    </div>
  );
}

// Section 4 (Bar/Cuisine/Salle) — résumé compact Urgentes/À faire/Faites,
// même logique de calcul que /taches (priorité Critique/Haute = urgente,
// "fait" = une exécution existe pour cette tâche aujourd'hui).
function ResumeTachesCard({ zoneTaches, executions }) {
  const doneIds = useMemo(() => new Set(executions.map((e) => e.tacheId).filter(Boolean)), [executions]);
  const { urgentes, aFaire, faites } = useMemo(() => {
    const done = [];
    const urgent = [];
    const normal = [];
    zoneTaches.forEach((t) => {
      if (doneIds.has(t.id)) { done.push(t); return; }
      if (t.priorite === "Critique" || t.priorite === "Haute") urgent.push(t);
      else normal.push(t);
    });
    return { urgentes: urgent, aFaire: normal, faites: done };
  }, [zoneTaches, doneIds]);

  return (
    <Link
      href="/taches"
      className="rounded-2xl border border-[#e5d5c5] bg-white p-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-4 text-sm font-black text-[#2c1a10]">
        <span>🔴 {urgentes.length}</span>
        <span>🟠 {aFaire.length}</span>
        <span>✅ {faites.length}</span>
      </div>
      <span className="text-[#9a7060]">→</span>
    </Link>
  );
}

// Section 1 (Bar/Cuisine) — carte évidence, ouvre directement le receiveModal.
function LivraisonOrangeCard({ order, onOpen }) {
  if (!order) return null;
  const produitsCount = parseOrderProducts(order).length || 1;
  return (
    <div
      className="bg-[#d97706] rounded-2xl p-4 text-white mb-4 cursor-pointer active:scale-[0.98] transition-all"
      onClick={onOpen}
    >
      <div className="text-xs font-black opacity-75 uppercase tracking-wide">Livraison attendue aujourd&apos;hui</div>
      <div className="text-lg font-black mt-1">
        🚚 {order.fournisseur} · {produitsCount} produit{produitsCount !== 1 ? "s" : ""}
      </div>
      <div className="text-sm opacity-80 mt-1">Appuyer pour confirmer les quantités reçues →</div>
    </div>
  );
}

// Section 2 (Bar/Cuisine/Salle) — statut ouvert/fermé, persisté en
// localStorage (voir posteStatus.js), déclenché par le workflow correspondant.
function PosteStatusCard({ poste, status }) {
  const { ouverture, fermeture } = WORKFLOW_IDS_BY_POSTE[poste];
  const isOpen = status?.status === "open";

  if (isOpen) {
    return (
      <div className="rounded-2xl p-4 mb-4" style={{ background: "#f0f7e5", border: "1px solid #cde3ab" }}>
        <div className="font-black text-sm text-[#3f5a1c]">
          {poste} ouvert ✓{status?.at ? ` depuis ${formatHeureSXM(status.at)}` : ""}
        </div>
        <Link href={`/workflows/${fermeture}`} className="inline-block mt-3 text-xs font-black text-[#b91c1c] cursor-pointer">
          Fermer le {poste}
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 mb-4" style={{ background: "#fdecea", border: "1px solid #f3b9b0" }}>
      <div className="font-black text-sm text-[#8a1c14]">{poste} fermé</div>
      <Link
        href={`/workflows/${ouverture}`}
        className="flex items-center justify-center mt-3 w-full h-11 rounded-xl bg-[#5a7828] text-white text-sm font-black cursor-pointer"
      >
        ▶ Ouvrir le {poste}
      </Link>
    </div>
  );
}

// Section 3 (Bar/Cuisine) — produits en statut critique/stock bas.
function StocksBasCard({ items }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">📦 Stocks à commander</div>
      {items.length === 0 ? (
        <div className="text-sm text-[#9a7060]">Tout est OK ✓</div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex justify-between items-center py-2 border-b border-[#f5ede0] last:border-0">
            <div>
              <div className="font-bold text-sm text-[#2c1a10]">{item.name}</div>
              <div className="text-[10px] text-[#a97862]">{item.statut}</div>
            </div>
            <span
              className={`text-xs font-black px-2 py-1 rounded-full shrink-0 ${
                item.statut.includes("Critique") ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
              }`}
            >
              {item.quantiteStock} {item.uniteStock}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

function LivraisonDetailModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">{order.produit}</h2>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[#9a7060]">Fournisseur</span><span className="font-bold text-[#2c1a10]">{order.fournisseur}</span></div>
          <div className="flex justify-between"><span className="text-[#9a7060]">Quantité</span><span className="font-bold text-[#2c1a10]">{order.quantite} {order.unite}</span></div>
          <div className="flex justify-between"><span className="text-[#9a7060]">Statut</span><span className="font-bold text-[#2c1a10]">{order.statut}</span></div>
          <div className="flex justify-between"><span className="text-[#9a7060]">Date</span><span className="font-bold text-[#2c1a10]">{order.date?.slice(0, 10)}</span></div>
        </div>
        <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Fermer
        </button>
      </div>
    </div>
  );
}

// Section 7 (Bar/Cuisine) — les 3 dernières livraisons reçues.
function LivraisonsHistorySection({ orders }) {
  const [detailOrder, setDetailOrder] = useState(null);

  const historique = useMemo(
    () => orders
      .filter((o) => o.statut === "Reçu")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3),
    [orders]
  );

  return (
    <SectionCard title="🚚 Livraisons — Historique">
      {historique.length === 0 ? (
        <div className="text-sm text-[#9a7060] py-2">Aucune livraison reçue récemment</div>
      ) : (
        <div className="space-y-2">
          {historique.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setDetailOrder(o)}
              className="w-full flex items-center justify-between rounded-xl border border-[#e5d5c5] bg-white p-3 text-left cursor-pointer"
            >
              <div>
                <div className="text-sm font-bold text-[#2c1a10]">{o.fournisseur}</div>
                <div className="text-[11px] text-[#9a7060]">{o.produit} · {o.date?.slice(0, 10)}</div>
              </div>
              <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-[#f0f7e5] text-[#5a7828] shrink-0">✅ Reçu</span>
            </button>
          ))}
        </div>
      )}

      {detailOrder && <LivraisonDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
    </SectionCard>
  );
}

export default function PostePage() {
  const { poste, setSplashDone, canOrderPad, canLivraisons } = useStaffContext();
  const { taches, zonesPhysiques, preps, stockLive, supplierOrders, refreshSupplierOrders } = useAppContext();

  const [now, setNow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [toast, setToast] = useState(null);
  const [posteStatus, setPosteStatusState] = useState(null);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const closeToastFiredRef = useRef(null); // date (YYYY-MM-DD) où le toast 15h a déjà été montré

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { hour, minute } = now ? getSXMParts(now) : { hour: 12, minute: 0 };
  const todaySXM = now ? new Intl.DateTimeFormat("en-CA", { timeZone: SXM_TZ }).format(now) : null;

  // Statut ouvert/fermé du poste — lu depuis localStorage au montage (jamais
  // dans l'initializer de useState, voir StaffContext pour la même précaution
  // anti-hydratation) ; se rafraîchit aussi au retour d'un workflow puisque
  // /workflows/[id] → /poste est une vraie navigation qui remonte ce composant.
  useEffect(() => {
    if (!poste) return;
    setPosteStatusState(getPosteStatus(poste));
  }, [poste]);

  useEffect(() => {
    if (hour !== 15 || minute !== 0) return;
    if (closeToastFiredRef.current === todaySXM) return;
    closeToastFiredRef.current = todaySXM;
    setToast({ text: "⏰ 15h — Pensez à fermer le poste", type: "warning" });
  }, [hour, minute, todaySXM]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!poste) return;
    fetch("/api/executions-taches")
      .then((r) => r.json())
      .then((data) => setExecutions(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[PostePage] executions fetch failed", error));
  }, [poste]);

  useEffect(() => {
    if (poste !== "Bar" || recettes.length > 0) return;
    fetch("/api/recipes/sold-products")
      .then((r) => r.json())
      .then((data) => setRecettes(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[PostePage] recipes fetch failed", error));
  }, [poste, recettes.length]);

  const zoneId = useMemo(() => zonesPhysiques.find((z) => z.nom === poste)?.id || null, [zonesPhysiques, poste]);
  const zoneTaches = useMemo(() => taches.filter((t) => t.zoneId === zoneId), [taches, zoneId]);

  const prepasUrgentes = useMemo(
    () => preps.filter((p) => {
      const s = String(p.status || "").toLowerCase();
      return !s.includes("fait") && !s.includes("terminé");
    }),
    [preps]
  );

  const recettesPoste = useMemo(
    () => recettes.filter((r) => String(r.category || "").toLowerCase() === "bar"),
    [recettes]
  );

  const orderDuJour = useMemo(
    () => (canLivraisons ? supplierOrders.find((o) => o.dateLivraisonPrevue?.slice(0, 10) === todaySXM && o.statut !== "Reçu") : null),
    [supplierOrders, todaySXM, canLivraisons]
  );

  const stockBasBar = useMemo(
    () => stockLive.filter((item) => (isBarProduct(item) || isFruitVegProduct(item)) && isStockLow(item)),
    [stockLive]
  );
  const stockBasCuisine = useMemo(
    () => stockLive.filter((item) => (isCuisineProduct(item) || isFruitVegProduct(item)) && isStockLow(item)),
    [stockLive]
  );

  // "Changer de poste" ramène le SplashScreen (poste-first, voir Sprint 12)
  // au lieu de son propre picker local — la sélection poste+staff vit
  // maintenant au niveau AppShell, avant que cette page ne soit atteignable.
  const handleChangerPoste = () => setSplashDone(false);

  const handleSessionToggle = () => {
    const next = posteStatus?.status === "open" ? "closed" : "open";
    setPosteStatus("Plonge", next);
    setPosteStatusState(getPosteStatus("Plonge"));
  };

  if (!poste) {
    // Cas bord : mode admin débloqué via le PIN du splash sans jamais passer
    // par la sélection poste+staff (voir SplashScreen.jsx) — /poste n'est de
    // toute façon pas dans AdminNav, mais reste défensif en cas d'URL directe.
    return (
      <div className="min-h-dvh flex items-center justify-center text-center px-4" style={{ background: "#f7efe4" }}>
        <p className="text-sm text-[#9a7060] font-semibold">Aucun poste sélectionné.</p>
      </div>
    );
  }

  const posteInfo = POSTES.find((p) => p.key === poste);

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em]">Mon Poste</div>
          <h1 className="text-xl font-black text-[#2c1a10]">{posteInfo?.emoji} {posteInfo?.nom}</h1>
        </div>
        <button type="button" onClick={handleChangerPoste} className="text-xs font-bold text-[#9a7060] underline cursor-pointer shrink-0">
          Changer de poste
        </button>
      </div>

      <ClosingBanner hour={hour} minute={minute} />

      {toast && (
        <div className="rounded-2xl p-3 text-sm font-bold text-white text-center" style={{ background: "#d97706" }}>
          {toast.text}
        </div>
      )}

      {canOrderPad && (
        <a
          href="/"
          className="flex items-center justify-center gap-2 w-full h-11 rounded-2xl bg-white border border-[#e5d5c5] text-[#2c1a10] text-sm font-black cursor-pointer"
        >
          📋 OrderPad
        </a>
      )}

      {poste === "Bar" && (
        <>
          <LivraisonOrangeCard order={orderDuJour} onOpen={() => setReceivingOrder(orderDuJour)} />
          <PosteStatusCard poste="Bar" status={posteStatus} />
          <StocksBasCard items={stockBasBar} />
          <ResumeTachesCard zoneTaches={zoneTaches} executions={executions} />
          <SectionCard title="Recettes Bar">
            {recettesPoste.length === 0 ? (
              <div className="text-sm text-[#9a7060] py-2">Aucune recette classée « Bar » pour l&apos;instant</div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
                {recettesPoste.map((r) => (
                  <div
                    key={r.id}
                    className="shrink-0 w-32 rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-3 snap-start"
                  >
                    <div className="text-xl mb-1">☕</div>
                    <div className="font-black text-sm text-[#2c1a10] leading-tight">{r.name}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Bar" /></SectionCard>
          {canLivraisons && <LivraisonsHistorySection orders={supplierOrders} />}
        </>
      )}

      {poste === "Cuisine" && (
        <>
          <LivraisonOrangeCard order={orderDuJour} onOpen={() => setReceivingOrder(orderDuJour)} />
          <PosteStatusCard poste="Cuisine" status={posteStatus} />
          <StocksBasCard items={stockBasCuisine} />
          <ResumeTachesCard zoneTaches={zoneTaches} executions={executions} />
          <SectionCard title="Prépas urgentes">
            {prepasUrgentes.length === 0 ? (
              <div className="text-sm text-[#9a7060] py-2">Aucune prépa urgente</div>
            ) : (
              <div className="space-y-2">
                {prepasUrgentes.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="font-bold text-[#2c1a10]">{p.name}</span>
                    <span className="text-[10px] text-[#9a7060] font-semibold">{p.priority}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Cuisine" /></SectionCard>
          {canLivraisons && <LivraisonsHistorySection orders={supplierOrders} />}
        </>
      )}

      {poste === "Salle" && (
        <>
          <ResumeTachesCard zoneTaches={zoneTaches} executions={executions} />
          <SectionCard title="Tâches mise en place"><TachesList taches={zoneTaches} /></SectionCard>
          <PosteStatusCard poste="Salle" status={posteStatus} />
        </>
      )}

      {poste === "Plonge" && (
        <>
          <SectionCard title="Tâches du jour"><TachesList taches={zoneTaches} /></SectionCard>
          <button
            type="button"
            onClick={handleSessionToggle}
            className="w-full h-12 rounded-2xl text-white text-sm font-black cursor-pointer active:scale-[0.98] transition-all"
            style={{ background: posteStatus?.status === "open" ? "#b91c1c" : "#5a7828" }}
          >
            {posteStatus?.status === "open" ? "Terminer ma session" : "▶ Démarrer ma session"}
          </button>
        </>
      )}

      {receivingOrder && (
        <ReceiveModal
          order={receivingOrder}
          onClose={() => setReceivingOrder(null)}
          onReceived={() => { setReceivingOrder(null); refreshSupplierOrders(); }}
        />
      )}
    </div>
  );
}
