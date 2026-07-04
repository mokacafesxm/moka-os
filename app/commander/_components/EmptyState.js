import { MOKA } from "../_lib/theme";

export default function EmptyState({ icon: Icon, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-24">
      <Icon className="w-14 h-14 mb-4" style={{ color: MOKA.brownLight }} strokeWidth={1.5} />
      <p className="font-bold text-lg" style={{ color: MOKA.brown }}>
        {message}
      </p>
      {actionLabel && (
        <button
          onClick={onAction}
          className="mt-5 px-6 py-3 rounded-2xl font-bold text-white cursor-pointer min-h-[44px] focus:ring-2 focus:ring-offset-2 focus:ring-[#587F25]"
          style={{ backgroundColor: MOKA.coral }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
