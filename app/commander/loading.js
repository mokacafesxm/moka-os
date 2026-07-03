import { MOKA } from "./_lib/theme";

export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse" style={{ backgroundColor: MOKA.cream }}>
      <div className="flex gap-4 overflow-hidden px-4 py-3 border-b" style={{ borderColor: MOKA.borderMuted }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="w-14 h-14 rounded-full shrink-0" style={{ backgroundColor: MOKA.border }} />
        ))}
      </div>

      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} className="py-4">
          <div className="h-5 w-32 rounded mx-4 mb-3" style={{ backgroundColor: MOKA.border }} />
          <div className="flex gap-3 px-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="w-40 h-52 rounded-2xl shrink-0" style={{ backgroundColor: "white" }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
