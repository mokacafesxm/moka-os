"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStaffContext } from "../../contexts/StaffContext";
import { useAppContext } from "../../contexts/AppContext";

const POSTES = [
  { key: "Bar", nom: "Bar", emoji: "☕" },
  { key: "Cuisine", nom: "Cuisine", emoji: "👨‍🍳" },
  { key: "Salle", nom: "Salle", emoji: "🛋" },
  { key: "Plonge", nom: "Plonge", emoji: "🚿" },
];

const OUVERTURE_WORKFLOW_BY_POSTE = { Bar: "ouverture-bar", Cuisine: "ouverture-cuisine" };
const FERMETURE_WORKFLOW_BY_POSTE = { Bar: "fermeture-bar" };

const SXM_TZ = "America/Puerto_Rico";
const CLOSE_HOUR = 15;
const OPEN_HOUR = 6;

function getSXMParts(date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: SXM_TZ, hour: "numeric", hour12: false }).format(date));
  const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: SXM_TZ, minute: "numeric" }).format(date));
  return { hour, minute };
}

function momentForHour(hour) {
  if (hour < 10) return "Ouverture";
  if (hour < 14.5) return "Pendant service";
  return "Fermeture";
}

function groupBy(list, key) {
  const groups = {};
  for (const item of list) {
    const k = item[key] || "—";
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

function LivraisonReceiveModal({ group, fournisseur, onClose, onDone }) {
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(group.map((o) => [o.id, o.quantite ?? 0]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await Promise.all(
        group.map((o) =>
          fetch("/api/supplier-orders/receive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: o.id,
              isFinal: true,
              lines: [{
                name: o.produit,
                quantity: Number(quantities[o.id]) || 0,
                unite: o.unite,
                notionProductId: o.produitId,
              }],
            }),
          }).then((r) => r.json()).then((data) => {
            if (data.error) throw new Error(data.error);
          })
        )
      );
      onDone();
    } catch (err) {
      setError("Erreur réception : " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-3xl bg-[#f5ede0] p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-black text-[#2c1a10]">🚚 Réceptionner — {fournisseur}</h2>
        {error && <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-bold text-red-500">{error}</div>}
        <div className="space-y-2.5">
          {group.map((o) => (
            <div key={o.id} className="rounded-xl border border-[#e5d5c5] bg-white p-3">
              <div className="text-sm font-bold text-[#2c1a10] mb-1.5">{o.produit}</div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={quantities[o.id]}
                  onChange={(e) => setQuantities((q) => ({ ...q, [o.id]: e.target.value }))}
                  className="h-10 px-3 rounded-xl border border-[#e5d5c5] bg-[#faf5ef] text-sm font-bold text-[#2c1a10] outline-none focus:border-[#5a7828] w-24"
                />
                <span className="text-xs font-semibold text-[#9a7060]">{o.unite}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-2xl text-[#9a7060] font-bold text-sm cursor-pointer">
            Annuler
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-[#5a7828] text-white font-black text-sm cursor-pointer disabled:opacity-50"
          >
            {saving ? "Envoi…" : "Confirmer la réception"}
          </button>
        </div>
      </div>
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

function LivraisonsSection({ orders, todaySXM, refreshSupplierOrders }) {
  const [receivingGroup, setReceivingGroup] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);

  const today = useMemo(
    () => orders.filter((o) => o.dateLivraisonPrevue?.slice(0, 10) === todaySXM && o.statut !== "Reçu"),
    [orders, todaySXM]
  );
  const grouped = useMemo(() => groupBy(today, "fournisseur"), [today]);

  const historique = useMemo(
    () => orders
      .filter((o) => o.statut === "Reçu")
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5),
    [orders]
  );

  return (
    <SectionCard title="🚚 Livraisons">
      <div className="space-y-4">
        <div>
          <div className="text-xs font-black text-[#2c1a10] uppercase tracking-wide mb-2">Prévues aujourd&apos;hui</div>
          {Object.keys(grouped).length === 0 ? (
            <div className="text-sm text-[#9a7060] py-2">Aucune livraison prévue aujourd&apos;hui</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(grouped).map(([fournisseur, group]) => (
                <div key={fournisseur} className="rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-3.5">
                  <div className="font-black text-sm text-[#2c1a10]">{fournisseur}</div>
                  <div className="text-[11px] text-[#9a7060] font-semibold mt-0.5 mb-2.5">
                    {group.map((o) => o.produit).join(", ")}
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceivingGroup({ fournisseur, group })}
                    className="w-full h-10 rounded-xl bg-[#2c1a10] text-white text-xs font-black cursor-pointer"
                  >
                    ✅ Réceptionner
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-black text-[#2c1a10] uppercase tracking-wide mb-2">Historique</div>
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
        </div>
      </div>

      {receivingGroup && (
        <LivraisonReceiveModal
          group={receivingGroup.group}
          fournisseur={receivingGroup.fournisseur}
          onClose={() => setReceivingGroup(null)}
          onDone={() => { setReceivingGroup(null); refreshSupplierOrders(); }}
        />
      )}
      {detailOrder && <LivraisonDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
    </SectionCard>
  );
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

function WorkflowButton({ posteKey, hourFrac }) {
  const ouvertureId = OUVERTURE_WORKFLOW_BY_POSTE[posteKey];
  const fermetureId = FERMETURE_WORKFLOW_BY_POSTE[posteKey];
  const workflowId = hourFrac < 10 ? ouvertureId : hourFrac >= 14.5 ? fermetureId : null;
  if (!workflowId) return null;
  const label = hourFrac < 10 ? "Ouverture" : "Fermeture";
  return (
    <a
      href={`/workflows/${workflowId}`}
      className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-[#2c1a10] text-white text-sm font-black cursor-pointer"
    >
      ▶ {label} {posteKey}
    </a>
  );
}

export default function PostePage() {
  const { poste, setSplashDone, canOrderPad, canLivraisons } = useStaffContext();
  const { taches, zonesPhysiques, preps, supplierOrders, refreshSupplierOrders } = useAppContext();

  const [now, setNow] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [recettes, setRecettes] = useState([]);
  const [toast, setToast] = useState(null);
  const closeToastFiredRef = useRef(null); // date (YYYY-MM-DD) où le toast 15h a déjà été montré

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { hour, minute } = now ? getSXMParts(now) : { hour: 12, minute: 0 };
  const todaySXM = now ? new Intl.DateTimeFormat("en-CA", { timeZone: SXM_TZ }).format(now) : null;

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
  const hourFrac = hour + minute / 60;
  const currentMoment = momentForHour(hourFrac);
  const zoneTaches = useMemo(
    () => taches.filter((t) => t.zoneId === zoneId && (t.moment === currentMoment || !t.moment)),
    [taches, zoneId, currentMoment]
  );

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

  const isOuvert = hour >= OPEN_HOUR && hour < CLOSE_HOUR;

  // "Changer de poste" ramène le SplashScreen (poste-first, voir Sprint 12)
  // au lieu de son propre picker local — la sélection poste+staff vit
  // maintenant au niveau AppShell, avant que cette page ne soit atteignable.
  const handleChangerPoste = () => setSplashDone(false);

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-[#2c1a10]">{posteInfo?.emoji} {posteInfo?.nom}</h1>
            <span
              className="text-[10px] font-black px-2 py-1 rounded-lg"
              style={{ color: isOuvert ? "#5a7828" : "#9a7060", background: isOuvert ? "#f0f7e5" : "#f0e8dc" }}
            >
              {isOuvert ? "Ouvert" : "Fermé"}
            </span>
          </div>
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
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Recettes Bar">
            {recettesPoste.length === 0 ? (
              <div className="text-sm text-[#9a7060] py-2">Aucune recette classée « Bar » pour l&apos;instant</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recettesPoste.map((r) => (
                  <div key={r.id} className="rounded-2xl border border-[#e5d5c5] bg-[#faf5ef] p-3">
                    <div className="font-black text-sm text-[#2c1a10]">{r.name}</div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Bar" /></SectionCard>
          <WorkflowButton posteKey="Bar" hourFrac={hourFrac} />
          {canLivraisons && (
            <div id="livraisons">
              <LivraisonsSection
                orders={supplierOrders}
                todaySXM={todaySXM}
                refreshSupplierOrders={refreshSupplierOrders}
              />
            </div>
          )}
        </>
      )}

      {poste === "Cuisine" && (
        <>
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
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Températures"><TempsList executions={executions} posteNom="Cuisine" /></SectionCard>
          <WorkflowButton posteKey="Cuisine" hourFrac={hourFrac} />
        </>
      )}

      {poste === "Salle" && (
        <>
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Tables">
            <div className="text-sm text-[#9a7060] py-2">Statut de service non configuré pour l&apos;instant</div>
          </SectionCard>
          <SectionCard title="Ménage & mise en place">
            <TachesList taches={zoneTaches.filter((t) => /ménage|nettoy|mise en place/i.test(t.nom))} />
          </SectionCard>
        </>
      )}

      {poste === "Plonge" && (
        <>
          <SectionCard title="Tâches du moment"><TachesList taches={zoneTaches} /></SectionCard>
          <SectionCard title="Checklist nettoyage">
            <TachesList taches={zoneTaches.filter((t) => /nettoy|plonge|vaisselle/i.test(t.nom))} />
          </SectionCard>
        </>
      )}
    </div>
  );
}
