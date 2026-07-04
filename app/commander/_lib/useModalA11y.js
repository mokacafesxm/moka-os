"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

// Shared modal accessibility: traps Tab focus inside the dialog, closes on
// Escape, and returns focus to whatever triggered it once it closes.
// `isOpen` defaults to true for modals that mount/unmount on open/close
// (e.g. ProductPopup); pass the real open flag for modals that stay mounted
// and toggle their own rendered output instead (e.g. LocationSheet).
export function useModalA11y(onClose, isOpen = true) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const triggerEl = document.activeElement;
    const container = containerRef.current;
    const focusables = container ? Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) : [];
    (focusables[0] || container)?.focus();

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !container) return;

      const items = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      triggerEl?.focus?.();
    };
  }, [isOpen, onClose]);

  return containerRef;
}
