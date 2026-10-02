// Mirrors PREP_STATUSES from app/api/orders/_shared.js — duplicated as a
// plain constant rather than imported, since that module pulls in
// server-only Notion client code that has no business in a client bundle.
const PREP_STATUSES = ["Nouvelle", "En préparation", "Prête", "Récupérée"];

const inputClass =
  "h-10 px-3 rounded-xl border border-[#e5d5c5] text-sm text-[#2c1a10] outline-none focus:border-[#2c1a10] bg-white";

export default function OrdersFilterBar({ filters, onChange }) {
  function set(key, value) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        type="date"
        value={filters.from}
        onChange={(e) => set("from", e.target.value)}
        className={inputClass}
        aria-label="Du"
      />
      <input
        type="date"
        value={filters.to}
        onChange={(e) => set("to", e.target.value)}
        className={inputClass}
        aria-label="Au"
      />
      <select value={filters.status} onChange={(e) => set("status", e.target.value)} className={`${inputClass} pr-8`}>
        <option value="">Tous les statuts</option>
        {PREP_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={filters.q}
        onChange={(e) => set("q", e.target.value)}
        placeholder="Téléphone, nom ou code commande…"
        className={`${inputClass} flex-1 min-w-[200px]`}
      />
    </div>
  );
}
