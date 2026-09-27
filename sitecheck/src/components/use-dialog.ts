"use client";

import { useEffect, type RefObject } from "react";

/** Focuses the dialog, traps Tab inside it, closes on Escape and restores focus when it closes. */
export function useDialog(
  open: boolean,
  panel: RefObject<HTMLElement | null>,
  initialFocus: RefObject<HTMLElement | null>,
  close: () => void,
  suppressRestore?: RefObject<boolean>,
) {
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFocus.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>("h2, button, a[href], input, label")];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const skip = suppressRestore?.current;
      if (suppressRestore) suppressRestore.current = false;
      if (!skip && previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, panel, initialFocus, close, suppressRestore]);
}
