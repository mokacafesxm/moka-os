"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";
import ReceiveModal, { parseOrderProducts } from "../../components/shared/ReceiveModal";
import { getPosteStatus, setPosteStatus } from "../../components/shared/posteStatus";
import CommandeClientModal from "../../components/shared/CommandeClientModal";

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
// Une prépa (ex: "Sauce maison — Prépa") vit dans stockLive comme n'importe
// quel ingrédient mais ne doit jamais apparaître dans "Ingrédients à
// commander" — sa pénurie se résout en la refaisant (voir "Prépas à faire"
// ci-dessous), pas en la commandant à un fournisseur.
function isPrepStock(item) {
  const cat = String(item.category || item.categorie || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .trim();
  return cat.includes("PREPA");
}
function isPrepPending(prep) {
  const s = String(prep.status || "").toLowerCase();
  return !s.includes("fait") && !s.includes("termine") && !s.includes("terminé");
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

// Section 3 (Bar/Cuisine) — ingrédients bruts (jamais de prépas, voir
// isPrepStock) en statut critique/stock bas.
function StocksBasCard({ items }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">🛒 Ingrédients à commander</div>
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

// Section 3bis (Bar/Cuisine) — aperçu compact des prépas à faire, zone-filtré
// (Bar → Station "Bar", Cuisine → tout le reste). Volontairement tronqué à 3
// items : la liste complète vit dans /taches, pas dupliquée ici.
function PrepasAFaireCard({ preps }) {
  const apercu = preps.slice(0, 3);
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white p-4">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-[0.3em] mb-3">🍳 Prépas à faire</div>
      {apercu.length === 0 ? (
        <div className="text-sm text-[#9a7060]">Aucune prépa en attente ✓</div>
      ) : (
        <div className="space-y-2">
          {apercu.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 py-1">
              <span className="font-bold text-sm text-[#2c1a10]">{p.name}</span>
              <span className="text-[10px] text-[#9a7060] font-semibold shrink-0">
                {p.quantity} {p.unit} · {p.priority}
              </span>
            </div>
          ))}
        </div>
      )}
      <Link href="/taches" className="mt-3 inline-block text-xs font-black text-[#9a7060] underline cursor-pointer">
        Voir toutes les prépas →
      </Link>
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

function RecettePhotoModal({ recette, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white text-xl flex items-center justify-center cursor-pointer"
      >
        ×
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={recette.photoUrl}
        alt={recette.name}
        className="max-w-full max-h-full rounded-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function RecetteCard({ recette, emoji, onZoom }) {
  return (
    <div
      className={`shrink-0 w-32 rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-3 snap-start ${recette.photoUrl ? "cursor-pointer active:scale-[0.97] transition-transform" : ""}`}
      onClick={() => recette.photoUrl && onZoom(recette)}
    >
      {recette.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={recette.photoUrl} alt={recette.name} className="w-full h-16 object-cover rounded-xl mb-1.5" />
      ) : (
        <div className="text-xl mb-1">{emoji}</div>
      )}
      <div className="font-black text-sm text-[#2c1a10] leading-tight">{recette.name}</div>
      {recette.targetTimeMin > 0 && (
        <div className="text-[10px] text-[#9a7060] font-semibold mt-0.5">⏱ {recette.targetTimeMin} min</div>
      )}
    </div>
  );
}

// Section Recettes (Bar/Cuisine) — carrousel horizontal, photo tap-to-zoom
// quand disponible (recette.photoUrl, absent tant que la propriété Notion
// "photo" n'est pas renseignée — voir sold-products-service.js).
function RecettesSection({ title, recettes, emoji, emptyLabel }) {
  const [zoomed, setZoomed] = useState(null);
  return (
    <SectionCard title={title}>
      {recettes.length === 0 ? (
        <div className="text-sm text-[#9a7060] py-2">{emptyLabel}</div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
          {recettes.map((r) => (
            <RecetteCard key={r.id} recette={r} emoji={emoji} onZoom={setZoomed} />
          ))}
        </div>
      )}
      {zoomed && <RecettePhotoModal recette={zoomed} onClose={() => setZoomed(null)} />}
    </SectionCard>
  );
}

// Fêtes françaises (les principales) — clé "MM-DD" en heure SXM. Table
// volontairement partielle ("les principales", pas un calendrier exhaustif
// des saints) : un jour absent de la table masque juste la ligne 🎉.
const FETES_FR = {
  "01-01": "Jour de l'An", "01-06": "Mélaine", "01-19": "Marius", "01-20": "Sébastien",
  "01-21": "Agnès", "01-22": "Vincent", "01-24": "François", "01-25": "Paul", "01-31": "Marcelle",
  "02-02": "Chandeleur", "02-03": "Blaise", "02-05": "Agathe", "02-06": "Gaston", "02-08": "Jacqueline",
  "02-11": "Adolphe", "02-14": "Valentin", "02-22": "Isabelle", "02-27": "Nestor",
  "03-01": "Aubin", "03-07": "Félicité", "03-08": "Jean de Dieu", "03-17": "Patrick", "03-19": "Joseph",
  "03-20": "Alexandra", "03-25": "Marie", "03-27": "Habib",
  "04-01": "Hugues", "04-05": "Irène", "04-14": "Maxime", "04-23": "Georges", "04-24": "Fidèle",
  "04-25": "Marc", "04-29": "Catherine",
  "05-01": "Fête du Travail", "05-03": "Philippe", "05-08": "Victoire 1945", "05-10": "Solange",
  "05-13": "Rolande", "05-19": "Yves", "05-22": "Émile", "05-25": "Sophie", "05-30": "Ferdinand",
  "06-02": "Blandine", "06-05": "Igor", "06-09": "Diane", "06-11": "Barnabé", "06-13": "Antoine de Padoue",
  "06-19": "Romuald", "06-21": "Rodolphe", "06-24": "Jean-Baptiste", "06-29": "Pierre et Paul",
  "07-03": "Thomas", "07-06": "Mariette", "07-11": "Benoît", "07-14": "Fête Nationale",
  "07-17": "Charlotte", "07-22": "Marie-Madeleine", "07-25": "Jacques", "07-26": "Anne et Joachim",
  "07-28": "Samson", "07-29": "Marthe", "07-31": "Ignace de Loyola",
  "08-04": "Jean-Marie Vianney", "08-08": "Dominique", "08-10": "Laurent", "08-11": "Claire",
  "08-15": "Marie (Assomption)", "08-24": "Barthélémy", "08-25": "Louis", "08-28": "Augustin",
  "09-01": "Gilles", "09-08": "Nativité de Marie", "09-09": "Alain", "09-21": "Matthieu",
  "09-24": "Thècle", "09-27": "Vincent de Paul", "09-29": "Michel, Gabriel et Raphaël",
  "10-01": "Thérèse de l'Enfant Jésus", "10-04": "François d'Assise", "10-09": "Denis",
  "10-15": "Thérèse d'Ávila", "10-18": "Luc", "10-22": "Élodie", "10-28": "Simon et Jude",
  "11-01": "Toussaint", "11-02": "Défunts", "11-03": "Hubert", "11-11": "Armistice 1918",
  "11-15": "Albert", "11-19": "Tanguy", "11-22": "Cécile", "11-25": "Catherine", "11-30": "André",
  "12-04": "Barbara", "12-06": "Nicolas", "12-08": "Immaculée Conception", "12-13": "Lucie",
  "12-21": "Pierre Canisius", "12-24": "Adèle", "12-25": "Noël", "12-26": "Étienne", "12-27": "Jean",
  "12-31": "Sylvestre",
};

function getFeteduJour() {
  const monthDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: SXM_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).slice(5);
  return FETES_FR[monthDay] || null;
}

// Bouton pointage compact (haut droite Mon Poste) + bottom sheet — remplace
// ClockBar sur cet écran (voir AppShell), même logique clock (StaffContext),
// jamais réécrite ici.
function ClockSheet({ status, clockSending, onClose, onClockIn, onStartBreak, onEndBreak, onClockOut }) {
  const isOnBreak = status === "pause";
  const isClockedIn = status === "present" || status === "pause";

  const actions = !isClockedIn
    ? [{ label: "✅ Arrivée", onClick: onClockIn, style: "bg-[#5a7828] text-white" }]
    : isOnBreak
    ? [
        { label: "▶ Retour pause", onClick: onEndBreak, style: "bg-[#5a7828] text-white" },
        { label: "🔴 Fin de service", onClick: onClockOut, style: "bg-[#b91c1c] text-white" },
      ]
    : [
        { label: "☕ Début pause", onClick: onStartBreak, style: "bg-white border border-[#e5d5c5] text-[#2c1a10]" },
        { label: "🔴 Fin de service", onClick: onClockOut, style: "bg-[#b91c1c] text-white" },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm rounded-t-3xl bg-[#f7efe4] border-t border-[#e5d5c5] shadow-2xl p-5 pb-8 space-y-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-[#e5d5c5] mx-auto mb-2" />
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={clockSending}
            onClick={async () => { await a.onClick(); onClose(); }}
            className={`w-full h-12 rounded-2xl font-black text-sm disabled:opacity-50 cursor-pointer active:scale-[0.98] transition-transform ${a.style}`}
          >
            {a.label}
          </button>
        ))}
        <button type="button" onClick={onClose} className="w-full h-11 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
          Annuler
        </button>
      </div>
    </div>
  );
}

export default function PostePage() {
  const { poste, setSplashDone, canOrderPad, canLivraisons, selectedStaffName, status, isClockedIn, clockSending, clockIn, clockOut, startBreak, endBreak } = useStaffContext();
  const { zonesPhysiques, preps, stockLive, supplierOrders, refreshSupplierOrders } = useAppContext();

  const [now, setNow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [zoneTaches, setZoneTaches] = useState([]);
  const [toast, setToast] = useState(null);
  const [posteStatus, setPosteStatusState] = useState(null);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [showCommandeClient, setShowCommandeClient] = useState(false);
  const [showClockSheet, setShowClockSheet] = useState(false);
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
    if ((poste !== "Bar" && poste !== "Cuisine") || recettes.length > 0) return;
    fetch("/api/recipes/sold-products")
      .then((r) => r.json())
      .then((data) => setRecettes(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[PostePage] recipes fetch failed", error));
  }, [poste, recettes.length]);

  const zoneId = useMemo(() => zonesPhysiques.find((z) => z.nom === poste)?.id || null, [zonesPhysiques, poste]);

  // Tâches filtrées côté serveur par zone (voir /api/taches?zone=), plutôt
  // que le AppContext.taches global filtré côté client — Jeanne (Salle) ne
  // doit recevoir que Zone=Salle, jamais toutes les tâches de tous les postes.
  useEffect(() => {
    if (!zoneId) { setZoneTaches([]); return; }
    fetch(`/api/taches?zone=${zoneId}`)
      .then((r) => r.json())
      .then((data) => setZoneTaches(Array.isArray(data) ? data : []))
      .catch((error) => console.error("[PostePage] taches fetch failed", error));
  }, [zoneId]);

  const prepasBar = useMemo(
    () => preps.filter((p) => isPrepPending(p) && String(p.station || "").toLowerCase() === "bar"),
    [preps]
  );
  const prepasCuisine = useMemo(
    () => preps.filter((p) => isPrepPending(p) && String(p.station || "").toLowerCase() !== "bar"),
    [preps]
  );

  const recettesBar = useMemo(
    () => recettes.filter((r) => String(r.category || "").toLowerCase() === "bar"),
    [recettes]
  );
  const recettesCuisine = useMemo(
    () => recettes.filter((r) => ["cuisine", "food"].includes(String(r.category || "").toLowerCase())),
    [recettes]
  );

  const orderDuJour = useMemo(
    () => (canLivraisons ? supplierOrders.find((o) => o.dateLivraisonPrevue?.slice(0, 10) === todaySXM && o.statut !== "Reçu") : null),
    [supplierOrders, todaySXM, canLivraisons]
  );

  const stockBasBar = useMemo(
    () => stockLive.filter((item) => (isBarProduct(item) || isFruitVegProduct(item)) && isStockLow(item) && !isPrepStock(item)),
    [stockLive]
  );
  const stockBasCuisine = useMemo(
    () => stockLive.filter((item) => (isCuisineProduct(item) || isFruitVegProduct(item)) && isStockLow(item) && !isPrepStock(item)),
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
  const staffName = selectedStaffName || "👋";
  const isOnBreak = status === "pause";
  const clockLabel = isClockedIn ? (isOnBreak ? "Reprendre" : "Pause / Fin") : "Arriver";
  const feteDuJour = getFeteduJour();

  return (
    <div className="min-h-dvh px-4 py-4 space-y-4" style={{ background: "#f7efe4" }}>
      <div className="px-4 pt-4 pb-2 -mx-4 -mt-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-black text-[#2c1a10]">Bonjour {staffName} 👋</div>
          <div className="text-sm text-[#9a7060] mt-1">
            {new Intl.DateTimeFormat("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
              timeZone: SXM_TZ,
            }).format(now || new Date())}
          </div>
          {feteDuJour && (
            <div className="text-xs text-[#a97862] mt-0.5">🎉 Bonne fête aux {feteDuJour} !</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowClockSheet(true)}
          className="rounded-xl bg-[#2c1a10] text-white px-4 py-2 text-sm font-black flex items-center gap-2 cursor-pointer shrink-0 active:scale-[0.98] transition-transform"
        >
          <span className={`w-2 h-2 rounded-full ${isClockedIn ? "bg-green-400" : "bg-[#9a7060]"}`} />
          {clockLabel}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-sm font-black text-[#9a7060] uppercase tracking-wide">{posteInfo?.emoji} {posteInfo?.nom}</h1>
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
          <PrepasAFaireCard preps={prepasBar} />
          <ResumeTachesCard zoneTaches={zoneTaches} executions={executions} />
          <RecettesSection
            title="Recettes Bar"
            recettes={recettesBar}
            emoji="☕"
            emptyLabel="Aucune recette classée « Bar » pour l'instant"
          />
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Bar" /></SectionCard>
          {canLivraisons && <LivraisonsHistorySection orders={supplierOrders} />}
        </>
      )}

      {poste === "Cuisine" && (
        <>
          <LivraisonOrangeCard order={orderDuJour} onOpen={() => setReceivingOrder(orderDuJour)} />
          <PosteStatusCard poste="Cuisine" status={posteStatus} />
          <StocksBasCard items={stockBasCuisine} />
          <PrepasAFaireCard preps={prepasCuisine} />
          <ResumeTachesCard zoneTaches={zoneTaches} executions={executions} />
          <RecettesSection
            title="Recettes"
            recettes={recettesCuisine}
            emoji="👨‍🍳"
            emptyLabel="Aucune recette classée « Cuisine » pour l'instant"
          />
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Cuisine" /></SectionCard>
          {canLivraisons && <LivraisonsHistorySection orders={supplierOrders} />}
        </>
      )}

      {poste === "Salle" && (
        <>
          <button
            type="button"
            onClick={() => setShowCommandeClient(true)}
            className="bg-[#2c1a10] text-white rounded-2xl py-4 w-full font-black cursor-pointer active:scale-[0.98] transition-all"
          >
            🛎 Nouvelle commande client →
          </button>
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

      {showCommandeClient && <CommandeClientModal onClose={() => setShowCommandeClient(false)} />}

      {showClockSheet && (
        <ClockSheet
          status={status}
          clockSending={clockSending}
          onClose={() => setShowClockSheet(false)}
          onClockIn={clockIn}
          onStartBreak={startBreak}
          onEndBreak={endBreak}
          onClockOut={clockOut}
        />
      )}
    </div>
  );
}
