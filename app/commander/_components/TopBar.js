import { MOKA } from "../_lib/theme";
import { SOCIAL_ICONS } from "./SocialIcons";

// Static — no real i18n/currency logic, just matching mokacafe.co's layout.
export default function TopBar() {
  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-1.5 text-white text-xs"
      style={{ backgroundColor: MOKA.green }}
    >
      <div className="flex items-center gap-2.5 shrink-0">
        {SOCIAL_ICONS.map((Icon, i) => (
          <Icon key={i} className="w-3.5 h-3.5 opacity-90" />
        ))}
      </div>

      <div className="font-bold tracking-wide whitespace-nowrap text-[11px] truncate">
        ORDER TAKEAWAY ONLINE!
      </div>

      <button className="shrink-0 font-semibold text-[11px] flex items-center gap-1 cursor-default">
        EN <span className="opacity-70">€</span>
      </button>
    </div>
  );
}
