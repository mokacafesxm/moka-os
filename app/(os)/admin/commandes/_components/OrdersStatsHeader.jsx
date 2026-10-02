function formatEuros(n) {
  return `${(n || 0).toFixed(2).replace(".", ",")}€`;
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[#e5d5c5] bg-white px-4 py-3 min-w-0">
      <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide truncate">{label}</div>
      <div className="text-lg font-black text-[#2c1a10] truncate">{value}</div>
    </div>
  );
}

// caJour/semaine/mois sont un instantané fixe (toujours "aujourd'hui" /
// "cette semaine" / "ce mois"), indépendant des filtres actifs — nb
// commandes/panier moyen/top 5 reflètent la période filtrée par
// OrdersFilterBar. Voir le commentaire de /api/admin/orders pour le détail.
export default function OrdersStatsHeader({ stats }) {
  if (!stats) return null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="CA aujourd'hui" value={formatEuros(stats.caJour)} />
        <StatCard label="CA semaine" value={formatEuros(stats.caSemaine)} />
        <StatCard label="CA mois" value={formatEuros(stats.caMois)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Commandes (période)" value={stats.nbCommandes} />
        <StatCard label="Panier moyen (période)" value={formatEuros(stats.panierMoyen)} />
      </div>
      {stats.top5?.length > 0 && (
        <div className="rounded-2xl border border-[#e5d5c5] bg-white px-4 py-3">
          <div className="text-[10px] font-black text-[#9a7060] uppercase tracking-wide mb-1.5">
            Top 5 produits (période)
          </div>
          <div className="space-y-1">
            {stats.top5.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <span className="text-[#2c1a10] font-semibold truncate">
                  {i + 1}. {p.name}
                </span>
                <span className="text-[#9a7060] font-black shrink-0 ml-2">{p.qty}x</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
