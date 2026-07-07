"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Gift, Clock } from "lucide-react";
import { MOKA } from "../_lib/theme";

function formatRemaining(expiresAt, now) {
  const ms = new Date(expiresAt) - now;
  if (ms <= 0) return "Expirée";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return `Expire dans ${h}h${String(m).padStart(2, "0")}`;
  return `Expire dans ${m} min`;
}

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const STATUS_LABEL = { used: "Utilisée", expired: "Expirée" };

export default function AccountPromos({ onBack, onOpenWheel }) {
  const [data, setData] = useState(null); // { active, history }
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/rewards")
      .then((res) => res.json())
      .then((d) => {
        if (!cancelled && !d.error) setData({ active: d.active || null, history: d.history || [] });
      })
      .catch(() => {
        if (!cancelled) setData({ active: null, history: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Live-ticking clock so the active reward's countdown updates each minute.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const active = data?.active;
  const history = data?.history || [];

  return (
    <div className="px-4 pt-4 pb-12">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold mb-4 cursor-pointer -ml-1" style={{ color: MOKA.brown }}>
        <ChevronLeft className="w-4 h-4" />
        Retour
      </button>
      <h2 className="text-lg font-black mb-4" style={{ color: MOKA.brown }}>
        Mes promos
      </h2>

      {data === null ? (
        <p className="text-sm" style={{ color: MOKA.brownLight }}>
          Chargement…
        </p>
      ) : active ? (
        <>
          <div className="rounded-2xl p-4 text-white" style={{ backgroundColor: MOKA.green }}>
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              <span className="font-black">{active.reward}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-sm font-semibold opacity-95">
              <Clock className="w-4 h-4" />
              {formatRemaining(active.expiresAt, now)}
            </div>
            {active.code && <p className="text-xs mt-1 opacity-80">Code {active.code}</p>}
          </div>
          <p className="text-xs mt-2" style={{ color: MOKA.brownLight }}>
            Ta récompense s&apos;applique automatiquement au paiement, si ton panier remplit les conditions.
          </p>
        </>
      ) : (
        <div className="rounded-2xl bg-white p-6 text-center">
          <Gift className="w-8 h-8 mx-auto mb-2" style={{ color: MOKA.brownLight }} />
          <p className="font-semibold" style={{ color: MOKA.brown }}>
            Aucune promo active
          </p>
          <p className="text-sm mt-1 mb-4" style={{ color: MOKA.brownLight }}>
            Tourne la roue pour en gagner une !
          </p>
          <button
            onClick={onOpenWheel}
            className="w-full py-3 rounded-full font-bold text-white cursor-pointer min-h-[44px]"
            style={{ backgroundColor: MOKA.coral }}
          >
            Ouvrir la Roue de la chance
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-black uppercase tracking-wide mb-2" style={{ color: MOKA.brownLight }}>
            Historique
          </h3>
          <div className="space-y-2">
            {history.map((r, i) => (
              <div key={i} className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: MOKA.brown }}>
                    {r.reward}
                  </p>
                  <p className="text-xs" style={{ color: MOKA.brownLight }}>
                    Gagnée le {formatDate(r.wonAt)}
                  </p>
                </div>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ml-2"
                  style={{
                    color: r.status === "used" ? MOKA.green : MOKA.brownLight,
                    backgroundColor: r.status === "used" ? `${MOKA.green}1a` : MOKA.placeholderTan,
                  }}
                >
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
