"use client";

import { MOKA } from "../_lib/theme";

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
    </svg>
  );
}
function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function HeartIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 20.3s-7.5-4.6-9.8-9.1C.8 8 2.2 4.6 5.4 3.7c2-.55 4 .2 5 1.9 1-1.7 3-2.45 5-1.9 3.2.9 4.6 4.3 3.2 7.5-2.3 4.5-9.8 9.1-9.8 9.1Z" />
    </svg>
  );
}
function UserIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

function NavButton({ Icon, active, onClick }) {
  return (
    <button onClick={onClick} className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer shrink-0">
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center"
        style={active ? { backgroundColor: "white" } : undefined}
      >
        <Icon className="w-5 h-5" style={{ color: MOKA.brown }} />
      </span>
    </button>
  );
}

export default function BottomNav({ activeTab, onHome, onSearch, onFavorites, onAccount }) {
  return (
    <nav
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1.5 rounded-full shadow-lg"
      style={{ backgroundColor: MOKA.navBg }}
    >
      <NavButton Icon={HomeIcon} active={activeTab === "home"} onClick={onHome} />
      <NavButton Icon={SearchIcon} active={activeTab === "search"} onClick={onSearch} />
      <NavButton Icon={HeartIcon} active={activeTab === "favorites"} onClick={onFavorites} />
      <NavButton Icon={UserIcon} active={activeTab === "account"} onClick={onAccount} />
    </nav>
  );
}
