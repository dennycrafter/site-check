"use client";

import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useDialog } from "./use-dialog";

export const SAFETY_TIP = "Safety first: never remove covers or touch wires.";

export function HelpButton({ onClick, ref }: { onClick: () => void; ref?: RefObject<HTMLButtonElement | null> }) {
  return (
    <button ref={ref} type="button" className="sc-help-btn" aria-label="Need a hand?" aria-haspopup="dialog" onClick={onClick}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9.2 9.1a2.9 2.9 0 0 1 5.6 1c0 1.9-2.8 2.5-2.8 4.4"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="18.2" r="1.3" fill="currentColor" />
      </svg>
    </button>
  );
}

/**
 * Bottom sheet with tips for the current screen. Extra buttons go in children.
 * The page behind is inert while the sheet is open, so focus goes back to returnFocus on close.
 */
export function HelpSheet({
  tips,
  onClose,
  returnFocus,
  children,
}: {
  tips: string[];
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
  children?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const close = useCallback(() => {
    onCloseRef.current();
    window.setTimeout(() => {
      if (returnFocus?.current?.isConnected) returnFocus.current.focus();
    }, 0);
  }, [returnFocus]);
  useDialog(true, panel, heading, close);

  return (
    <div
      className="sc-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sc-sheet" role="dialog" aria-modal="true" aria-labelledby="help-sheet-title" ref={panel}>
        <div className="sc-sheet-head">
          <h2 id="help-sheet-title" ref={heading} tabIndex={-1}>
            Need a hand?
          </h2>
          <button type="button" className="sc-sheet-close" aria-label="Close" onClick={close}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <ul className="sc-sheet-tips">
          {tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p className="sc-sheet-safety">{SAFETY_TIP}</p>
        {children ? <div className="sc-sheet-actions">{children}</div> : null}
      </div>
    </div>
  );
}
