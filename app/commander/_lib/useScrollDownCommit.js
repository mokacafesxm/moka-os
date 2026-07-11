"use client";

import { useEffect, useRef } from "react";

// CSS `scroll-snap-type: mandatory` turns out to reject (not just "snap back
// after") any scrollTop that isn't already snap-aligned — a light wheel tick
// or a slow swipe can get silently swallowed before a single 'scroll' event
// with a meaningful delta ever fires, so reacting to scroll position after
// the fact doesn't work here. This hook intercepts the gesture itself
// instead: the moment Zone 1 (docked at scrollTop 0) sees ANY downward wheel
// tick or upward touch movement, it prevents the native attempt and drives
// the transition to Zone 2 explicitly via scrollTo. That's what makes "even
// a light swipe" commit fully rather than getting rejected or partially
// scrolling and snapping back.
const TOUCH_EPSILON = 4;

export function useScrollDownCommit(outerRef, zone1Ref, enabled) {
  const atZone1Ref = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    const outer = outerRef.current;
    const zone1 = zone1Ref.current;
    if (!outer || !zone1) return;

    atZone1Ref.current = true;
    let touchStartY = null;

    function commitToZone2() {
      if (!atZone1Ref.current) return;
      atZone1Ref.current = false;
      outer.scrollTo({ top: zone1.offsetHeight, behavior: "smooth" });
    }

    function handleWheel(e) {
      if (atZone1Ref.current && e.deltaY > 0) {
        e.preventDefault();
        commitToZone2();
      }
    }

    function handleTouchStart(e) {
      touchStartY = e.touches[0].clientY;
    }

    function handleTouchMove(e) {
      if (!atZone1Ref.current || touchStartY == null) return;
      const movedUp = touchStartY - e.touches[0].clientY; // finger moving up = scrolling content down
      if (movedUp > TOUCH_EPSILON) {
        e.preventDefault();
        commitToZone2();
      }
    }

    // Re-arms once fully back at Zone 1 (e.g. after the up-resistance release
    // in useScrollBackResistance finishes its scrollTo(0)).
    function handleScroll() {
      if (outer.scrollTop <= 0) atZone1Ref.current = true;
    }

    outer.addEventListener("wheel", handleWheel, { passive: false });
    outer.addEventListener("touchstart", handleTouchStart, { passive: true });
    outer.addEventListener("touchmove", handleTouchMove, { passive: false });
    outer.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      outer.removeEventListener("wheel", handleWheel);
      outer.removeEventListener("touchstart", handleTouchStart);
      outer.removeEventListener("touchmove", handleTouchMove);
      outer.removeEventListener("scroll", handleScroll);
    };
  }, [outerRef, zone1Ref, enabled]);
}
