"use client";

import { useRef } from "react";

const LONG_PRESS_MS = 500;
const SWIPE_THRESHOLD_PX = 60;

export function useMessageGestures(onLongPress: () => void, onSwipeReply: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startXRef = useRef(0);
  const firedRef = useRef(false);

  function handleTouchStart(e: React.TouchEvent) {
    firedRef.current = false;
    startXRef.current = e.touches[0].clientX;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startXRef.current;
    if (Math.abs(dx) > 10 && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const dx = e.changedTouches[0].clientX - startXRef.current;
    if (!firedRef.current && Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      onSwipeReply();
    }
  }

  function handleMouseDown() {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }
  function handleMouseUp() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseUp
  };
}
