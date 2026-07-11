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

export function useScrollDownCommit(outerRef, zone1Ref, zone2Ref, enabled) {
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

      // The category rail is its own scroll region (position:sticky + its
      // own max-h-screen overflow-y-auto), independent of both the outer
      // snap position and Zone 2's own scroll — landing at scrollTop 0 on
      // both left it starting ~50px down (below the search bar, so its
      // sticky pin hadn't engaged yet) *and* short by however much its own
      // content (all 10 categories) overflows its capped box, so the last
      // entry ("Sides") was cut off on both counts. Scroll Zone 2 by
      // exactly that top gap (engages the rail's sticky pin, recovering the
      // lost space) and the rail's own overflow to its end (reveals its
      // last entry) — so it lands already showing the bottom of the list,
      // not just closer to it.
      const zone2 = zone2Ref?.current;
      const rail = zone2?.querySelector("aside");
      if (zone2 && rail) {
        const gap = rail.getBoundingClientRect().top - zone2.getBoundingClientRect().top;
        if (gap > 0) zone2.scrollTo({ top: gap, behavior: "smooth" });
        const railMaxScroll = rail.scrollHeight - rail.clientHeight;
        if (railMaxScroll > 0) rail.scrollTo({ top: railMaxScroll, behavior: "smooth" });
      }
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
  }, [outerRef, zone1Ref, zone2Ref, enabled]);
}
