import { MOKA } from "../_lib/theme";

export default function Toast({ message }) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-40 left-1/2 z-40 px-4 py-3 rounded-2xl shadow-lg text-white text-sm font-semibold animate-toast-in whitespace-nowrap"
      style={{ backgroundColor: MOKA.brown }}
    >
      {message}
    </div>
  );
}
