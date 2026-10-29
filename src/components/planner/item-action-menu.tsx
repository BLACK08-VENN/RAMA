"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Copy,
  FlipHorizontal2,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

export type ItemActionMenuProps = {
  title: string;
  wallMounted: boolean;
  flipped: boolean;
  /** Anchor point in stage pixels, where the piece was clicked. */
  x: number;
  y: number;
  onDuplicate: () => void;
  onRotate: () => void;
  onFlip: () => void;
  onToggleWall: () => void;
  onMove: (deltaX: number, deltaZ: number) => void;
  onRemove: () => void;
};

const MENU_MARGIN = 10;
const MENU_GAP = 14;

export function ItemActionMenu({
  title,
  wallMounted,
  flipped,
  x,
  y,
  onDuplicate,
  onRotate,
  onFlip,
  onToggleWall,
  onMove,
  onRemove,
}: ItemActionMenuProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ x, y, above: true });

  // The menu is anchored to the click, but it still has to stay on the stage, so it
  // flips below the piece when there is no room above it.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const stage = anchorRef.current?.parentElement;
    if (!panel || !stage) return;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const stageBox = stage.getBoundingClientRect();
    const above = y - height - MENU_GAP >= MENU_MARGIN;
    const lowest = above ? height + MENU_GAP + MENU_MARGIN : MENU_MARGIN;
    const highest = above
      ? stageBox.height - MENU_GAP + MENU_MARGIN
      : stageBox.height - height - MENU_GAP - MENU_MARGIN;
    setLayout({
      x: Math.max(width / 2 + MENU_MARGIN, Math.min(stageBox.width - width / 2 - MENU_MARGIN, x)),
      y: Math.max(lowest, Math.min(highest, y)),
      above,
    });
  }, [x, y]);

  return (
    <div ref={anchorRef} className="item-action-menu" style={{ left: layout.x, top: layout.y }}>
      <div
        ref={panelRef}
        className="item-action-panel"
        role="menu"
        aria-label={`Actions for ${title}`}
        style={{
          transform: layout.above
            ? `translate(-50%, calc(-100% - ${MENU_GAP}px))`
            : `translate(-50%, ${MENU_GAP}px)`,
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="item-action-title">{title}</header>

        <div className="item-action-grid">
          <button type="button" role="menuitem" onClick={onDuplicate}>
            <Copy size={16} />
            <span>Duplicate</span>
          </button>
          <button type="button" role="menuitem" onClick={onRotate}>
            {wallMounted ? <RefreshCw size={16} /> : <RotateCcw size={16} />}
            <span>{wallMounted ? "Next wall" : "Rotate"}</span>
          </button>
          {wallMounted && (
            <button type="button" role="menuitem" onClick={onFlip} className={flipped ? "active" : ""}>
              <FlipHorizontal2 size={16} />
              <span>Flip</span>
            </button>
          )}
          {wallMounted && (
            <button type="button" role="menuitem" onClick={onToggleWall}>
              <ArrowLeftRight size={16} />
              <span>Other wall</span>
            </button>
          )}
        </div>

        <div className="item-action-move" role="group" aria-label="Move selected item">
          <button type="button" onClick={() => onMove(0, -0.1)} aria-label={wallMounted ? "Move up" : "Move forward"}>
            <ArrowUp size={16} />
          </button>
          <button type="button" onClick={() => onMove(-0.1, 0)} aria-label="Move left">
            <ArrowLeft size={16} />
          </button>
          <button type="button" onClick={() => onMove(0.1, 0)} aria-label="Move right">
            <ArrowRight size={16} />
          </button>
          <button type="button" onClick={() => onMove(0, 0.1)} aria-label={wallMounted ? "Move down" : "Move backward"}>
            <ArrowDown size={16} />
          </button>
        </div>

        <button type="button" role="menuitem" className="item-action-remove" onClick={onRemove}>
          <Trash2 size={16} />
          <span>Remove</span>
        </button>
      </div>
    </div>
  );
}
