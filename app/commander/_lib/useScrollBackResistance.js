"use client";

import { useEffect } from "react";

// Scroll-snap gives the down direction its "one swipe jumps straight to the
// order screen" behavior for free (mandatory snap always resolves to the
// nearest point). Going back UP needs to feel harder than that single swipe —
// a plain reversed scroll-snap would release just as eagerly in both
// directions, so the asymmetry has to be built by hand:
//
//   1. `overscroll-behavior-y: contain` on the inner (Zone 2) scroller — set
//      via className where this hook is used — stops the browser's own
//      scroll-chaining from ever bleeding a fast fling straight through to
//      the outer snap container. Reaching the top of Zone 2 only ever stops
//      there; it never leaks into a jump back to Zone 1 on its own.
//   2. This hook adds the deliberate "second gesture" on top: release only
//      fires for a pull that STARTS while already at the inner top — a long
//      single swipe that merely scrolls through the list and carries past 0
//      in one continuous motion does not count, however far it travels.
//      Reaching 0 ends that gesture's contribution; only a fresh press
//      (finger lifted and placed down again, or a new wheel burst) while
//      already docked at the top can accumulate toward release. That's what
//      makes it feel like two swipes are needed, not one long one.
const PULL_THRESHOLD = 70;
const WHEEL_THRESHOLD = 120;
const WHEEL_GESTURE_GAP_MS = 200; // idle gap that marks a new wheel "gesture"

export function useScrollBackResistance(innerRef, outerRef, enabled) {
  useEffect(() => {
    if (!enabled) return;
    const inner = innerRef.current;
    const outer = outerRef.current;
    if (!inner || !outer) return;

    let gestureStartedAtTop = false;
    let pullStartY = null;
    let wheelAccum = 0;
    let lastWheelAt = 0;
    let released = false;

    function release() {
      if (released) return;
      released = true;
      outer.scrollTo({ top: 0, behavior: "smooth" });
    }

    function handleTouchStart(e) {
      gestureStartedAtTop = inner.scrollTop <= 0;
      pullStartY = gestureStartedAtTop ? e.touches[0].clientY : null;
    }

    function handleTouchMove(e) {
      if (released || !gestureStartedAtTop || pullStartY == null) return;
      const y = e.touches[0].clientY;
      if (y - pullStartY > PULL_THRESHOLD) release();
    }

    function handleTouchEnd() {
      gestureStartedAtTop = false;
      pullStartY = null;
      released = false;
    }

    function handleWheel(e) {
      const now = Date.now();
      const isNewGesture = now - lastWheelAt > WHEEL_GESTURE_GAP_MS;
      lastWheelAt = now;

      if (inner.scrollTop > 0 || e.deltaY > 0) {
        wheelAccum = 0;
        released = false;
        return;
      }
      // Only a burst that STARTS while already at the top counts — one that
      // merely arrived at 0 moments ago (same continuous scroll) doesn't.
      if (isNewGesture) wheelAccum = 0;
      if (released) return;
      wheelAccum += -e.deltaY;
      if (wheelAccum > WHEEL_THRESHOLD) {
        release();
        wheelAccum = 0;
      }
    }

    inner.addEventListener("touchstart", handleTouchStart, { passive: true });
    inner.addEventListener("touchmove", handleTouchMove, { passive: true });
    inner.addEventListener("touchend", handleTouchEnd, { passive: true });
    inner.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      inner.removeEventListener("touchstart", handleTouchStart);
      inner.removeEventListener("touchmove", handleTouchMove);
      inner.removeEventListener("touchend", handleTouchEnd);
      inner.removeEventListener("wheel", handleWheel);
    };
  }, [innerRef, outerRef, enabled]);
}
