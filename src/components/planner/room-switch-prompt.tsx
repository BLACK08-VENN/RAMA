"use client";

import { useEffect, useRef } from "react";
import { Box, ArrowRight, X } from "lucide-react";

export function RoomSwitchPrompt({ target, error, onSave, onDiscard, onCancel }: {
  target: string;
  error: string | null;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("keydown", keyboard, true); previous?.focus(); };
  }, [onCancel]);

  return <div className="room-switch-overlay">
    <section ref={dialog} tabIndex={-1} className="room-switch-dialog" role="dialog" aria-modal="true" aria-labelledby="room-switch-title" aria-describedby="room-switch-description">
      <button className="room-switch-close" aria-label="Keep decorating" onClick={onCancel}><X size={22} /></button>
      <span className="room-switch-icon"><Box size={28} /></span>
      <h2 id="room-switch-title">Save your room before switching?</h2>
      <p id="room-switch-description">You’re about to open <strong>{target}</strong>. Save your current design to return to it later, or discard your current changes.</p>
      {error && <p className="room-switch-error" role="alert">{error}</p>}
      <div className="room-switch-actions">
        <button className="room-switch-save" onClick={onSave}><Box size={18} /> Save and switch <ArrowRight size={18} /></button>
        <button className="room-switch-discard" onClick={onDiscard}>Discard and switch</button>
        <button className="room-switch-cancel" onClick={onCancel}>Keep decorating</button>
      </div>
      <small>Saved designs stay in this browser on this device.</small>
    </section>
  </div>;
}
