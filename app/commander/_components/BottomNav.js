"use client";

import { useEffect, useRef, useState } from "react";
import { MOKA } from "../_lib/theme";

function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9h12v-9" />
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
function CartIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L20 8H6" />
      <circle cx="9.5" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="20" r="1.3" fill="currentColor" stroke="none" />
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

function NavButton({ Icon, label, active, onClick, badge }) {
  const prevBadge = useRef(badge);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    if (badge > (prevBadge.current || 0)) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 350);
      prevBadge.current = badge;
      return () => clearTimeout(t);
    }
    prevBadge.current = badge;
  }, [badge]);

  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "true" : undefined}
      className="relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer shrink-0"
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
        style={active ? { backgroundColor: "rgba(255,255,255,0.9)" } : undefined}
      >
        {/* Drop shadow keeps the icon legible over busy/light photos scrolling behind the glass. */}
        <Icon className="w-5 h-5" style={{ color: MOKA.brown, filter: `drop-shadow(0 1px 1.5px ${MOKA.iconDropShadow})` }} />
      </span>
      {badge > 0 && (
        <span
          className={`absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[0.625rem] font-bold flex items-center justify-center ${
            bump ? "animate-bump" : ""
          }`}
          style={{ backgroundColor: MOKA.coral }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

export default function BottomNav({ activeTab, cartCount, onHome, onFavorites, onCart, onAccount }) {
  const [scrolling, setScrolling] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let ticking = false;
    function handleScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          setScrolling(true);
          ticking = false;
        });
      }
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setScrolling(false), 300);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <nav
      className="fixed bottom-4 left-1/2 z-30 flex items-center gap-1 px-2 py-1.5 rounded-full transition-transform duration-300 ease-out"
      style={{
        backgroundColor: "rgba(250,243,235,0.7)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        border: "1px solid rgba(255,255,255,0.35)",
        boxShadow: `0 8px 30px ${MOKA.navShadow}`,
        transform: `translateX(-50%) scale(${scrolling ? 0.92 : 1})`,
      }}
    >
      <NavButton Icon={HomeIcon} label="Accueil" active={activeTab === "home"} onClick={onHome} />
      <NavButton Icon={HeartIcon} label="Favoris" active={activeTab === "favorites"} onClick={onFavorites} />
      <NavButton Icon={CartIcon} label="Panier" active={activeTab === "cart"} onClick={onCart} badge={cartCount} />
      <NavButton Icon={UserIcon} label="Compte" active={activeTab === "account"} onClick={onAccount} />
    </nav>
  );
}
