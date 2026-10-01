"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Armchair,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  DoorOpen,
  ExternalLink,
  Grid3X3,
  Heart,
  Home,
  Layers3,
  LayoutGrid,
  ListChecks,
  Maximize2,
  Menu,
  Minimize2,
  Minus,
  PackagePlus,
  PanelLeftClose,
  Redo2,
  RotateCcw,
  Ruler,
  Search,
  Share2,
  ShoppingBag,
  SlidersHorizontal,
  Shapes,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  View,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CameraView } from "./room-scene";
import { formatKes, products, type ProductCategory } from "@/data/products";
import { getRoomArea, matchRoomPreset, roomPresets } from "@/data/room-presets";
import {
  decodeSharedDesign,
  encodeSharedDesign,
  getItemPlacementBounds,
  usePlannerStore,
  type DoorConfig,
  type WindowConfig,
} from "@/stores/planner-store";
import { useAuth } from "@/components/auth-provider";
import { AuthModal } from "@/components/auth-modal";
import { saveDesignToCloud } from "@/lib/design-storage";

const RoomScene = dynamic(
  () => import("./room-scene").then((module) => module.RoomScene),
  {
    ssr: false,
    loading: () => (
      <div className="scene-loading">
        <div className="scene-loading-mark" />
        <span>Preparing your room</span>
      </div>
    ),
  },
);

const categories: Array<"All" | ProductCategory> = ["All", "Seating", "Tables", "Storage", "Bedroom"];

const placementSpots: Array<[number, number, number]> = [
  [1.3, 0, 0.4],
  [2.8, 0, 1.8],
  [0.2, 0, -1.8],
  [3.3, 0, -1.5],
];

const wallColors = ["#f3f0e9", "#e4ded2", "#cbdcdc", "#b7b2a8"];

const floorFinishes = [
  { name: "Natural oak", color: "#d8b78e" },
  { name: "Light ash", color: "#c8b79f" },
  { name: "Warm walnut", color: "#8d6746" },
];

export function PlannerShell() {
  const [activePanel, setActivePanel] = useState<"products" | "room" | "design">("products");
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [query, setQuery] = useState("");
  const [cameraView, setCameraView] = useState<CameraView>("perspective");
  const [showGrid, setShowGrid] = useState(false);
  const [zoomRequest, setZoomRequest] = useState<{ id: number; direction: "in" | "out" }>({
    id: 0,
    direction: "in",
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const { user, isConfigured: isAuthConfigured } = useAuth();
  const {
    design,
    selectedId,
    history,
    future,
    hydrated,
    setHydrated,
    selectItem,
    loadDesign,
    renameDesign,
    updateRoom,
    applyRoomPreset,
    addItem,
    removeItem,
    rotateItem,
    moveItem,
    undo,
    redo,
  } = usePlannerStore();
  const placedItems = design.items;
  const roomArea = getRoomArea(design.room);
  const activeRoomPreset = matchRoomPreset(design.room);
  const openingCount = Number(design.room.door.enabled) + Number(design.room.window.enabled);
  const nextItemNumber = useRef(10);
  const sceneStageRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = activeCategory === "All" || product.category === activeCategory;
        const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase());
        return matchesCategory && matchesQuery;
      }),
    [activeCategory, query],
  );

  const total = useMemo(
    () =>
      placedItems.reduce((sum, item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return sum + (product?.price ?? 0);
      }, 0),
    [placedItems],
  );

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2400);
  };

  const requestZoom = (direction: "in" | "out") => {
    setZoomRequest((current) => ({ id: current.id + 1, direction }));
  };

  const shareDesign = async () => {
    const shareUrl = new URL(window.location.href);
    shareUrl.hash = new URLSearchParams({ design: encodeSharedDesign(design) }).toString();
    const shareData = {
      title: `${design.title} | FurnitureRama Room Planner`,
      text: `View my ${design.title} room design from FurnitureRama.`,
      url: shareUrl.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        notify("Design shared");
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      notify("Share link copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify("This browser could not share the design");
    }
  };

  const toggleFullscreen = async () => {
    const stage = sceneStageRef.current;
    if (!stage || !document.fullscreenEnabled) {
      notify("Fullscreen is unavailable in this browser");
      return;
    }

    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      notify("Fullscreen could not be opened");
    }
  };

  const handleSaveToCloud = async () => {
    if (!isAuthConfigured) {
      notify("Cloud saves are not configured");
      return;
    }

    if (!user) {
      setAuthModalOpen(true);
      return;
    }

    setSavingToCloud(true);
    try {
      await saveDesignToCloud(user.id, design);
      notify("Design saved to cloud");
    } catch (error) {
      console.error("Failed to save design:", error);
      notify("Failed to save design to cloud");
    } finally {
      setSavingToCloud(false);
    }
  };

  const addProduct = (productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    const itemCount = placedItems.filter((item) => item.productId === productId).length;
    let id = `${productId}-${nextItemNumber.current++}`;
    while (placedItems.some((item) => item.id === id)) {
      id = `${productId}-${nextItemNumber.current++}`;
    }
    const spot = placementSpots[placedItems.length % placementSpots.length];
    const kind = product.kind;
    const { maxX, maxZ } = getItemPlacementBounds(design.room, kind);
    addItem({
      id,
      productId,
      kind,
      position: [
        Math.max(-maxX, Math.min(maxX, spot[0] + itemCount * 0.28)),
        0,
        Math.max(-maxZ, Math.min(maxZ, spot[2] + itemCount * 0.2)),
      ],
      rotation: [0, 0, 0],
    });
    notify("Added to your room");
  };

  const removeSelected = () => {
    if (!selectedId) return;
    removeItem(selectedId);
    notify("Item removed");
  };

  const moveSelected = useCallback((deltaX: number, deltaZ: number) => {
    if (!selectedId) return;
    const item = placedItems.find((candidate) => candidate.id === selectedId);
    if (!item) return;
    const { maxX, maxZ } = getItemPlacementBounds(design.room, item.kind);
    moveItem(selectedId, [
      Math.max(-maxX, Math.min(maxX, item.position[0] + deltaX)),
      0,
      Math.max(-maxZ, Math.min(maxZ, item.position[2] + deltaZ)),
    ]);
  }, [design.room, moveItem, placedItems, selectedId]);

  const selectRoomPreset = (presetId: string) => {
    const preset = roomPresets.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    applyRoomPreset(presetId);
    notify(`${preset.name} loaded`);
  };

  const updateRoomDimension = (key: "width" | "depth" | "height", value: number) => {
    if (!Number.isFinite(value)) return;
    const limits = key === "height" ? [2.2, 4.5] : [2.5, 12];
    updateRoom({ [key]: Math.min(limits[1], Math.max(limits[0], value)) });
  };

  const updateDoorSetting = (door: Partial<DoorConfig>) => {
    updateRoom({ door: { ...design.room.door, ...door } });
  };

  const updateWindowSetting = (window: Partial<WindowConfig>) => {
    updateRoom({ window: { ...design.room.window, ...window } });
  };

  const updateOpeningNumber = (
    opening: "door" | "window",
    key: "width" | "position" | "sillHeight",
    value: number,
    min: number,
    max: number,
  ) => {
    if (!Number.isFinite(value)) return;
    const nextValue = Math.min(max, Math.max(min, value));
    if (opening === "door") {
      updateDoorSetting({ [key]: nextValue });
      return;
    }
    updateWindowSetting({ [key]: nextValue });
  };

  useEffect(() => {
    let mounted = true;
    void Promise.resolve(usePlannerStore.persist.rehydrate()).then(() => {
      if (mounted) setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, [setHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const payload = new URLSearchParams(window.location.hash.slice(1)).get("design");
    if (!payload) return;

    let noticeTimer: number | undefined;
    const importFrame = window.requestAnimationFrame(() => {
      const sharedDesign = decodeSharedDesign(payload);
      setNotice(sharedDesign ? "Shared design opened" : "This share link is invalid");
      if (sharedDesign) loadDesign(sharedDesign);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
      noticeTimer = window.setTimeout(() => setNotice(null), 2400);
    });

    return () => {
      window.cancelAnimationFrame(importFrame);
      if (noticeTimer) window.clearTimeout(noticeTimer);
    };
  }, [hydrated, loadDesign]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === sceneStageRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, [contenteditable='true']")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        event.preventDefault();
        removeItem(selectedId);
        return;
      }
      const movements: Record<string, [number, number]> = {
        ArrowLeft: [-0.1, 0],
        ArrowRight: [0.1, 0],
        ArrowUp: [0, -0.1],
        ArrowDown: [0, 0.1],
      };
      const movement = movements[event.key];
      if (movement && selectedId) {
        event.preventDefault();
        moveSelected(...movement);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveSelected, removeItem, selectedId]);

  return (
    <main className="planner-app">
      <div className="store-strip">
        <span>Countrywide delivery</span>
        <span className="store-strip-divider" />
        <span>Assembly by certified professionals</span>
        <a href="tel:+254726855355">Call 0726 855 355</a>
      </div>

      <header className="planner-header">
        <div className="header-brand-group">
          <button className="icon-button mobile-menu" aria-label="Open menu">
            <Menu size={21} />
          </button>
          <Image
            src="/furniturerama-logo.png"
            width={619}
            height={152}
            alt="FurnitureRama — the furniture people"
            className="brand-logo"
            priority
          />
          <span className="planner-badge">ROOM PLANNER</span>
        </div>

        <div className="design-title">
          <span className="save-status"><span />{hydrated ? "Saved locally" : "Opening design"}</span>
          {editingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(event) => setTitleInput(event.currentTarget.value)}
              onBlur={() => {
                if (titleInput.trim() && titleInput !== design.title) {
                  renameDesign(titleInput.trim());
                }
                setEditingTitle(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  setEditingTitle(false);
                }
              }}
              autoFocus
              className="design-title-input"
            />
          ) : (
            <button type="button" onClick={() => {
              setTitleInput(design.title);
              setEditingTitle(true);
            }}>
              {design.title} <ChevronDown size={15} />
            </button>
          )}
        </div>

        <div className="header-actions">
          <button className="header-text-button" onClick={shareDesign}>
            <Share2 size={17} /> <span>Share</span>
          </button>
          <button className="header-text-button" onClick={handleSaveToCloud} disabled={savingToCloud}>
            <Box size={17} /> <span>{savingToCloud ? "Saving..." : "Save"}</span>
          </button>
          <button className="icon-button" aria-label="Help"><CircleHelp size={20} /></button>
          <button className="icon-button" aria-label="Account" onClick={() => setAuthModalOpen(true)}>
            <UserRound size={20} />
          </button>
        </div>
      </header>

      <section className={`planner-workspace ${panelOpen ? "" : "panel-collapsed"}`}>
        <aside className={`catalog-panel ${panelOpen ? "is-open" : ""}`}>
          <nav className="panel-tabs" aria-label="Planner tools">
            <button className={activePanel === "products" ? "active" : ""} onClick={() => setActivePanel("products")}>
              <PackagePlus size={20} /><span>Products</span>
            </button>
            <button className={activePanel === "room" ? "active" : ""} onClick={() => setActivePanel("room")}>
              <Home size={20} /><span>Room</span>
            </button>
            <button className={activePanel === "design" ? "active" : ""} onClick={() => setActivePanel("design")}>
              <ListChecks size={20} /><span>My design</span>
            </button>
          </nav>

          {activePanel === "products" && (
            <div className="panel-content">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">FurnitureRama collection</span>
                  <h1>Add products</h1>
                </div>
                <button className="icon-button close-panel" onClick={() => setPanelOpen(false)} aria-label="Close products panel"><X size={19} /></button>
              </div>

              <label className="catalog-search">
                <Search size={19} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search furniture" />
                <button aria-label="Filters"><SlidersHorizontal size={18} /></button>
              </label>

              <div className="category-list" aria-label="Product categories">
                {categories.map((category) => (
                  <button
                    key={category}
                    className={activeCategory === category ? "active" : ""}
                    onClick={() => setActiveCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="catalog-result-heading">
                <span>{filteredProducts.length} planner-ready products</span>
                <button><LayoutGrid size={16} /> Grid</button>
              </div>

              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <article className="product-card" key={product.id}>
                    <div className="product-image-wrap">
                      <Image src={product.image} width={500} height={500} alt={product.name} className="product-image" />
                      <button className="favorite-button" aria-label={`Save ${product.name}`}><Heart size={17} /></button>
                      <span className="model-ready">3D READY</span>
                    </div>
                    <div className="product-card-body">
                      <span className="product-category">{product.category}</span>
                      <h2>{product.name}</h2>
                      <span className="product-dimensions">{product.dimensions}</span>
                      <div className="product-card-footer">
                        <strong>{formatKes(product.price)}</strong>
                        <button onClick={() => addProduct(product.id)} aria-label={`Add ${product.name} to room`}>
                          <PackagePlus size={18} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activePanel === "room" && (
            <div className="panel-content">
              <div className="panel-heading">
                <div><span className="eyebrow">Room settings</span><h1>Customize room</h1></div>
              </div>
              <div className="setting-stack">
                <section className="dimension-card">
                  <div className="dimension-card-heading">
                    <Shapes size={21} />
                    <span><strong>Start from a room</strong><small>Ready-made sizes, adjustable after</small></span>
                  </div>
                  <div className="room-preset-grid" role="group" aria-label="Room templates">
                    {roomPresets.map((preset) => {
                      const selected = activeRoomPreset?.id === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className={`room-preset ${selected ? "selected" : ""}`}
                          onClick={() => selectRoomPreset(preset.id)}
                          aria-pressed={selected}
                        >
                          <i style={{ background: preset.wallColor, borderColor: preset.floorColor }}>
                            <b style={{ background: preset.floorColor }} />
                          </i>
                          <span>
                            <strong>{preset.name}</strong>
                            <small>{preset.width.toFixed(1)} × {preset.depth.toFixed(1)} m · {getRoomArea(preset).toFixed(1)} m²</small>
                          </span>
                          {selected && <Check size={15} />}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="dimension-card">
                  <div className="dimension-card-heading">
                    <Ruler size={21} />
                    <span>
                      <strong>{activeRoomPreset ? activeRoomPreset.name : "Custom room"}</strong>
                      <small>Measurements in metres</small>
                    </span>
                  </div>
                  <p className="resize-instruction">Drag the teal handles on the room edges to pull or push the walls. Use the fields below for exact sizes.</p>
                  <div className="dimension-fields">
                    <label>Width<input type="number" min="2.5" max="12" step="0.1" value={design.room.width} onChange={(event) => updateRoomDimension("width", event.currentTarget.valueAsNumber)} /></label>
                    <label>Depth<input type="number" min="2.5" max="12" step="0.1" value={design.room.depth} onChange={(event) => updateRoomDimension("depth", event.currentTarget.valueAsNumber)} /></label>
                    <label>Height<input type="number" min="2.2" max="4.5" step="0.1" value={design.room.height} onChange={(event) => updateRoomDimension("height", event.currentTarget.valueAsNumber)} /></label>
                  </div>
                </section>
                <section className="openings-card">
                  <div className="dimension-card-heading">
                    <DoorOpen size={21} />
                    <span><strong>Doors & windows</strong><small>{openingCount} architectural {openingCount === 1 ? "element" : "elements"}</small></span>
                  </div>
                  <div className="opening-section">
                    <div className="opening-row">
                      <span><strong>Door</strong><small>Left wall</small></span>
                      <label className="toggle-control">
                        <input type="checkbox" checked={design.room.door.enabled} onChange={(event) => updateDoorSetting({ enabled: event.currentTarget.checked })} />
                        <i />
                        <b>{design.room.door.enabled ? "On" : "Off"}</b>
                      </label>
                    </div>
                    {design.room.door.enabled && (
                      <div className="opening-fields">
                        <label>Width<input type="number" min="0.7" max="1.4" step="0.1" value={design.room.door.width} onChange={(event) => updateOpeningNumber("door", "width", event.currentTarget.valueAsNumber, 0.7, 1.4)} /></label>
                        <label>Position<input type="range" min="-0.35" max="0.35" step="0.05" value={design.room.door.position} onChange={(event) => updateOpeningNumber("door", "position", event.currentTarget.valueAsNumber, -0.35, 0.35)} /></label>
                      </div>
                    )}
                  </div>
                  <div className="opening-section">
                    <div className="opening-row">
                      <span><strong>Window</strong><small>Back wall</small></span>
                      <label className="toggle-control">
                        <input type="checkbox" checked={design.room.window.enabled} onChange={(event) => updateWindowSetting({ enabled: event.currentTarget.checked })} />
                        <i />
                        <b>{design.room.window.enabled ? "On" : "Off"}</b>
                      </label>
                    </div>
                    {design.room.window.enabled && (
                      <div className="opening-fields">
                        <label>Width<input type="number" min="0.8" max="2.4" step="0.1" value={design.room.window.width} onChange={(event) => updateOpeningNumber("window", "width", event.currentTarget.valueAsNumber, 0.8, 2.4)} /></label>
                        <label>Sill height<input type="number" min="0.5" max="1.4" step="0.1" value={design.room.window.sillHeight} onChange={(event) => updateOpeningNumber("window", "sillHeight", event.currentTarget.valueAsNumber, 0.5, 1.4)} /></label>
                        <label className="opening-position">Position<input type="range" min="-0.35" max="0.35" step="0.05" value={design.room.window.position} onChange={(event) => updateOpeningNumber("window", "position", event.currentTarget.valueAsNumber, -0.35, 0.35)} /></label>
                      </div>
                    )}
                  </div>
                </section>
                <div className="finish-section">
                  <span>Floor finish</span>
                  <div className="floor-options">
                    {floorFinishes.map((finish) => (
                      <button
                        key={finish.name}
                        className={design.room.floorName === finish.name ? "selected" : ""}
                        onClick={() => updateRoom({ floorName: finish.name, floorColor: finish.color })}
                      >
                        <i style={{ background: finish.color }} />
                        <span>{finish.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="finish-section">
                  <span>Wall colour</span>
                  <div className="swatches">
                    {wallColors.map((color) => (
                      <button
                        key={color}
                        className={design.room.wallColor === color ? "selected" : ""}
                        style={{ background: color }}
                        onClick={() => updateRoom({ wallColor: color })}
                        aria-label={`Set wall colour to ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activePanel === "design" && (
            <div className="panel-content">
              <div className="panel-heading"><div><span className="eyebrow">Project overview</span><h1>My design</h1></div></div>
              <div className="design-list">
                {placedItems.map((item) => {
                  const product = products.find((candidate) => candidate.id === item.productId);
                  if (!product) return null;
                  return (
                    <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => selectItem(item.id)}>
                      <Image src={product.image} alt="" width={56} height={56} />
                      <span><strong>{product.name}</strong><small>{formatKes(product.price)}</small></span>
                      <ChevronDown size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <div ref={sceneStageRef} className="scene-stage">
          <RoomScene
            cameraView={cameraView}
            showGrid={showGrid}
            zoomRequest={zoomRequest}
            room={design.room}
            placedItems={placedItems}
            selectedId={selectedId}
            onSelect={selectItem}
            onMove={moveItem}
            onResize={(dimension, value) => updateRoom({ [dimension]: value })}
          />

          {!panelOpen && (
            <button className="reopen-panel" onClick={() => setPanelOpen(true)}><PanelLeftClose size={19} /> Browse products</button>
          )}

          <div className="scene-topbar">
            <div className="history-controls">
              <button aria-label="Undo" onClick={undo} disabled={history.length === 0}><Undo2 size={18} /></button>
              <button aria-label="Redo" onClick={redo} disabled={future.length === 0}><Redo2 size={18} /></button>
            </div>
            <div className="room-metadata"><span>{activeRoomPreset ? activeRoomPreset.name : "Custom room"}</span><i />{design.room.width.toFixed(1)} × {design.room.depth.toFixed(1)} m</div>
            <button
              className="fullscreen-button"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              aria-pressed={isFullscreen}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>

          {selectedId && (
            <div className="selection-toolbar">
              <span>Move</span>
              <div className="selection-move-controls" aria-label="Move selected item">
                <button onClick={() => moveSelected(-0.1, 0)} aria-label="Move left"><ArrowLeft size={15} /></button>
                <button onClick={() => moveSelected(0, -0.1)} aria-label="Move forward"><ArrowUp size={15} /></button>
                <button onClick={() => moveSelected(0, 0.1)} aria-label="Move backward"><ArrowDown size={15} /></button>
                <button onClick={() => moveSelected(0.1, 0)} aria-label="Move right"><ArrowRight size={15} /></button>
              </div>
              <button onClick={() => rotateItem(selectedId)}><RotateCcw size={17} /> Rotate</button>
              <button onClick={removeSelected} className="danger"><Trash2 size={17} /> Remove</button>
            </div>
          )}

          <div className="view-toolbar">
            <button className={cameraView === "perspective" ? "active" : ""} onClick={() => setCameraView("perspective")}><View size={18} /><span>3D view</span></button>
            <button className={cameraView === "top" ? "active" : ""} onClick={() => setCameraView("top")}><Layers3 size={18} /><span>Top view</span></button>
            <button className={cameraView === "front" ? "active" : ""} onClick={() => setCameraView("front")}><Armchair size={18} /><span>Front</span></button>
            <span className="toolbar-divider" />
            <button className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)}><Grid3X3 size={18} /><span>Grid</span></button>
          </div>

          <div className="zoom-controls">
            <button aria-label="Zoom in" onClick={() => requestZoom("in")}><span>+</span></button>
            <button aria-label="Zoom out" onClick={() => requestZoom("out")}><Minus size={17} /></button>
          </div>

          <button className="inspiration-button"><Sparkles size={17} /> Design ideas</button>
        </div>
      </section>

      <footer className="planner-summary-bar">
        <div className="summary-caption"><span>{placedItems.length} items</span><small>Prices include VAT</small></div>
        <div className="summary-total"><span>Estimated total</span><strong>{formatKes(total)}</strong></div>
        <button className="summary-button" onClick={() => setSummaryOpen(true)}><ShoppingBag size={18} /> View summary</button>
      </footer>

      {summaryOpen && (
        <div className="summary-overlay" role="dialog" aria-modal="true" aria-label="Design summary">
          <button className="overlay-backdrop" onClick={() => setSummaryOpen(false)} aria-label="Close summary" />
          <section className="summary-drawer">
            <div className="summary-drawer-head"><div><span className="eyebrow">Ready when you are</span><h2>Design summary</h2></div><button className="icon-button" onClick={() => setSummaryOpen(false)}><X size={20} /></button></div>
            <div className="summary-room-card"><Home size={21} /><span><strong>{design.title}</strong><small>{placedItems.length} products · {roomArea.toFixed(1)} m²</small></span></div>
            <div className="summary-products">
              {placedItems.map((item) => {
                const product = products.find((candidate) => candidate.id === item.productId);
                return product ? (
                  <div key={item.id}>
                    <Image src={product.image} alt="" width={64} height={64} />
                    <span><strong>{product.name}</strong><small>{product.dimensions}</small></span>
                    <span className="summary-product-commerce">
                      <b>{formatKes(product.price)}</b>
                      <a href={product.productUrl} target="_blank" rel="noreferrer" aria-label={`View ${product.name} on FurnitureRama`}>
                        View product <ExternalLink size={12} />
                      </a>
                    </span>
                  </div>
                ) : null;
              })}
            </div>
            <div className="drawer-total">
              <span><small>Estimated total</small><strong>{formatKes(total)}</strong></span>
              <a href="https://furniturerama.co.ke/index.php?route=checkout/cart" target="_blank" rel="noreferrer">
                Open store cart <ShoppingBag size={18} />
              </a>
            </div>
          </section>
        </div>
      )}

      {notice && <div className="toast" role="status"><span />{notice}</div>}

      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </main>
  );
}
