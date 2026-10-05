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
  Leaf,
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
  clampItemPosition,
  isBedroomRoom,
  getStoragePlacement,
  usePlannerStore,
  type DoorConfig,
  type WindowConfig,
  type WallSide,
} from "@/stores/planner-store";
import type { DecorGroup } from "@/data/decor-catalog";
import { useAuth } from "@/components/auth-provider";
import { AuthModal } from "@/components/auth-modal";
import { readSavedRooms, saveRoomSnapshot, deleteRoomSnapshot, type SavedRoom } from "@/lib/saved-rooms";
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
const decorGroups: Array<"All" | DecorGroup> = ["All", "Floor plants", "Hanging plants", "Table plants", "Wall art", "Mirrors", "Rugs", "Vases"];

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
  { name: "Large ivory porcelain tiles", color: "#ece7dd" },
  { name: "Large greige porcelain tiles", color: "#ccc5b9" },
  { name: "Ivory porcelain tiles", color: "#e6e0d5" },
  { name: "Marble white tiles", color: "#f1f0eb" },
  { name: "Charcoal slate tiles", color: "#525653" },
  { name: "Sand terrazzo tiles", color: "#d9cbbb" },
];

export function PlannerShell({ onWelcome }: { onWelcome?: () => void } = {}) {
  const [activePanel, setActivePanel] = useState<"products" | "decor" | "room" | "design">("decor");
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [activeDecorGroup, setActiveDecorGroup] = useState<(typeof decorGroups)[number]>("All");
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
  const [isPhone, setIsPhone] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)");
    const update = () => { setIsPhone(media.matches); setPanelOpen(!media.matches); setEditMode(!media.matches); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!isPhone || !panelOpen) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
        document.querySelector<HTMLButtonElement>(".mobile-menu")?.focus();
      }
    };
    window.addEventListener("keydown", dismiss);
    return () => window.removeEventListener("keydown", dismiss);
  }, [isPhone, panelOpen]);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setSavedRooms(readSavedRooms(window.localStorage)); } catch { /* Saving remains available if storage becomes accessible later. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
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
    setItemWall,
    moveItem,
    undo,
    redo,
  } = usePlannerStore();
  const placedItems = design.items;
  const selectedItem = placedItems.find(item => item.id === selectedId);
  const selectedDecor = products.find(product => product.id === selectedItem?.productId)?.decor;
  const roomArea = getRoomArea(design.room);
  const activeRoomPreset = matchRoomPreset(design.room);
  const openingCount = Number(design.room.door.enabled) + Number(design.room.window.enabled);
  const nextItemNumber = useRef(10);
  const sceneStageRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = activePanel === "decor"
          ? Boolean(product.decorative) && (activeDecorGroup === "All" || product.decor?.group === activeDecorGroup)
          : !product.decorative && (activeCategory === "All" || product.category === activeCategory);
        const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase());
        return matchesCategory && matchesQuery;
      }),
    [activePanel, activeCategory, activeDecorGroup, query],
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
    if (focusMode) { setFocusMode(false); return; }
    const stage = sceneStageRef.current;
    if (!stage || !document.fullscreenEnabled) {
      setFocusMode(true);
      return;
    }

    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      setFocusMode(true);
    }
  };

  const saveDecoratedRoom = () => {
    try {
      setSavedRooms(saveRoomSnapshot(window.localStorage, design));
      notify("Room saved on this device. Open My design to return to it.");
    } catch {
      notify("Could not save. Your browser storage may be full or unavailable.");
    }
  };

  const openSavedRoom = (saved: SavedRoom) => {
    const room = decodeSharedDesign(saved.payload);
    if (!room) { notify("This saved room could not be opened"); return; }
    loadDesign(room);
    if (isPhone) setPanelOpen(false);
    notify(`${saved.title} opened`);
  };

  const deleteSavedRoom = (id: string) => {
    try { setSavedRooms(deleteRoomSnapshot(window.localStorage, id)); notify("Saved copy removed"); }
    catch { notify("Could not remove this saved copy"); }
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
    if (!product.decorative) { notify("Furniture coming soon. Explore Décor to style your room now."); return; }
    const spec = product.decor;
    if (spec && (spec.mount === "wall" || spec.mount === "ceiling") && design.room.spaceType && design.room.spaceType !== "indoor") {
      notify("Choose an indoor room for wall and ceiling décor"); return;
    }
    if (spec?.mount === "floor" && (spec.width > design.room.width || spec.depth > design.room.depth)) {
      notify("Choose a smaller size or enlarge the room first"); return;
    }
    const itemCount = placedItems.filter((item) => item.productId === productId).length;
    let id = `${productId}-${nextItemNumber.current++}`;
    while (placedItems.some((item) => item.id === id)) {
      id = `${productId}-${nextItemNumber.current++}`;
    }
    const spot = placementSpots[placedItems.length % placementSpots.length];
    const kind = product.kind;
    const wall = spec?.mount === "wall" ? "back" as const : undefined;
    addItem({
      id, productId, kind, wall,
      position: clampItemPosition(design.room, kind, [
        spec?.mount === "wall" ? 0 : spot[0] + itemCount * .28,
        spec?.mount === "wall" ? 1.55 : spec?.mount === "table" ? .8 : 0,
        spot[2] + itemCount * .2,
      ], productId, wall),
      rotation: [0, 0, 0],
    });
    if (isPhone) { setPanelOpen(false); setEditMode(true); }
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
    const position: [number, number, number] = [...item.position];
    const mounted = products.find(product => product.id === item.productId)?.decor?.mount === "wall";
    if (mounted) {
      position[item.wall === "left" || item.wall === "right" ? 2 : 0] += deltaX;
      position[1] -= deltaZ;
    } else { position[0] += deltaX; position[2] += deltaZ; }
    moveItem(item.id, position);
  }, [moveItem, placedItems, selectedId]);

  const selectRoomPreset = (presetId: string) => {
    const preset = roomPresets.find(candidate => candidate.id === presetId);
    if (!preset) return;
    applyRoomPreset(presetId);
    if (preset.empty) selectItem(null);
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
          <button className="icon-button mobile-menu" aria-label={panelOpen ? "Close menu" : "Open menu"} aria-controls="planner-menu" aria-expanded={panelOpen} onClick={() => setPanelOpen(value => !value)}>
            <Menu size={21} />
          </button>
          <button className="planner-brand-home" onClick={onWelcome} aria-label="Back to welcome">
          <Image
            src="/furniturerama-logo.png"
            width={619}
            height={152}
            alt="FurnitureRama — the furniture people"
            className="brand-logo"
            priority
          />
          </button>
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
          <button className="header-text-button" onClick={shareDesign} aria-label="Share design">
            <Share2 size={17} /> <span>Share</span>
          </button>
          <button className="header-text-button" aria-label="Save design" onClick={saveDecoratedRoom}>
            <Box size={17} /> <span>Save</span>
          </button>
          <button className="icon-button" aria-label="Help"><CircleHelp size={20} /></button>
          <button className="icon-button" aria-label="Account" onClick={() => setAuthModalOpen(true)}>
            <UserRound size={20} />
          </button>
        </div>
      </header>

      <section className={`planner-workspace ${panelOpen ? "" : "panel-collapsed"}`}>
        {isPhone && panelOpen && <button className="mobile-menu-backdrop" aria-label="Close menu" onClick={() => setPanelOpen(false)} />}
        <aside id="planner-menu" className={`catalog-panel ${panelOpen ? "is-open" : ""}`} inert={!panelOpen} aria-label="Planner menu">
          <div className="mobile-drawer-header">
            <strong>Menu</strong>
            <button onClick={() => setPanelOpen(false)} aria-label="Close menu"><X size={20} /></button>
          </div>
          <nav className="panel-tabs" aria-label="Planner tools">
            <button aria-label="Products" className={activePanel === "products" ? "active" : ""} onClick={() => setActivePanel("products")}>
              <PackagePlus size={20} /><span>Products</span>
            </button>
            <button className={activePanel === "decor" ? "active" : ""} onClick={() => { setActivePanel("decor"); setQuery(""); }} aria-label="Décor">
              <Leaf size={20} /><span>Décor</span>
            </button>
            <button aria-label="Room" className={activePanel === "room" ? "active" : ""} onClick={() => setActivePanel("room")}>
              <Home size={20} /><span>Room</span>
            </button>
            <button aria-label="My design" className={activePanel === "design" ? "active" : ""} onClick={() => setActivePanel("design")}>
              <ListChecks size={20} /><span>My design</span>
            </button>
          </nav>

          {(activePanel === "products" || activePanel === "decor") && (
            <div className="panel-content">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">FurnitureRama collection</span>
                  <h1>{activePanel === "decor" ? "Style your room" : "Furniture coming soon"}</h1>
                </div>
                <button className="icon-button close-panel" onClick={() => setPanelOpen(false)} aria-label="Close products panel"><X size={19} /></button>
              </div>

              <label className="catalog-search">
                <Search size={19} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activePanel === "decor" ? "Search décor" : "Search furniture"} />
                <button aria-label="Filters"><SlidersHorizontal size={18} /></button>
              </label>

              <div className="category-list" aria-label={activePanel === "decor" ? "Décor categories" : "Product categories"}>
                {(activePanel === "decor" ? decorGroups : categories).map((category) => (
                  <button
                    key={category}
                    className={(activePanel === "decor" ? activeDecorGroup : activeCategory) === category ? "active" : ""}
                    onClick={() => activePanel === "decor" ? setActiveDecorGroup(category as (typeof decorGroups)[number]) : setActiveCategory(category as (typeof categories)[number])}
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="catalog-result-heading">
                <span>{filteredProducts.length} {activePanel === "decor" ? "styling accessories" : "products · coming soon"}</span>
                <button><LayoutGrid size={16} /> Grid</button>
              </div>

              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <article className={`product-card ${product.decorative ? "" : "coming-soon-card"}`} key={product.id}>
                    {!product.decorative && <button className="coming-soon-trigger" onClick={() => addProduct(product.id)} aria-label={`${product.name} — coming soon`} />}
                    <div className="product-image-wrap">
                      <Image src={product.image} width={500} height={500} sizes="(max-width: 640px) 42vw, 160px" alt={product.name} className="product-image" />
                      <button className="favorite-button" tabIndex={product.decorative ? 0 : -1} aria-label={`Save ${product.name}`}><Heart size={17} /></button>
                      <span className="model-ready">{product.decor ? product.decor.mount === "wall" ? "WALL" : product.decor.mount === "ceiling" ? "HANGING" : "3D DÉCOR" : "COMING SOON"}</span>
                    </div>
                    <div className="product-card-body">
                      <span className="product-category">{product.decor?.group ?? product.category}</span>
                      <h2>{product.name}</h2>
                      <span className="product-dimensions">{product.dimensions}</span>
                      <div className="product-card-footer">
                        <strong>{(product.decorative ? "Styling accessory" : formatKes(product.price))}</strong>
                        <button tabIndex={product.decorative ? 0 : -1} onClick={() => addProduct(product.id)} aria-label={product.decorative ? `Add ${product.name} to room` : `${product.name} — coming soon`}>
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
                    <span><strong>Start from a room</strong><small>Empty designer shells and everyday room sizes</small></span>
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
                            <small>{preset.description}</small>
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
                {(!design.room.spaceType || design.room.spaceType === "indoor") && <>
                <section className="dimension-card">
                  <div className="dimension-card-heading"><span><strong>Outdoor spaces</strong><small>Drag furniture onto the deck or lawn</small></span></div>
                  {(["balcony", "yard"] as const).map(area => {
                    const value = design.room[area] ?? { enabled: false, width: design.room.width, depth: area === "balcony" ? 2.4 : 4 };
                    return <div className="opening-section" key={area}>
                      <div className="opening-row"><strong>{area === "balcony" ? "Balcony deck" : "Grassy front yard"}</strong><label className="toggle-control"><input type="checkbox" checked={value.enabled} onChange={event => updateRoom({ [area]: { ...value, enabled: event.currentTarget.checked } })} /><i /><b>{value.enabled ? "On" : "Off"}</b></label></div>
                      {value.enabled && <div className="dimension-fields">{(["width", "depth"] as const).map(dimension => <label key={dimension}>{dimension === "width" ? "Width (m)" : "Depth (m)"}<input type="number" min={dimension === "width" ? 2.5 : 1.5} max="12" step="0.1" value={value[dimension]} onChange={event => { const next = event.currentTarget.valueAsNumber; if (Number.isFinite(next)) updateRoom({ [area]: { ...value, [dimension]: Math.max(dimension === "width" ? 2.5 : 1.5, Math.min(12, next)) } }); }} /></label>)}</div>}
                    </div>;
                  })}
                </section>
                {isBedroomRoom(design.room) && <section className="dimension-card">
                  <div className="opening-row"><span><strong>Built-in wardrobe & drawers</strong><small>Drag to move in any direction; adjust its angle below</small></span><label className="toggle-control"><input type="checkbox" checked={design.room.builtInStorage?.enabled ?? false} onChange={event => updateRoom({ builtInStorage: { ...design.room.builtInStorage, width: design.room.builtInStorage?.width ?? 2, enabled: event.currentTarget.checked } })} /><i /><b>{design.room.builtInStorage?.enabled ? "On" : "Off"}</b></label></div>
                  {design.room.builtInStorage?.enabled && <div className="dimension-fields"><label>Width (m)<input type="number" min="1" max="4" step="0.1" value={design.room.builtInStorage.width} onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) updateRoom({ builtInStorage: { ...design.room.builtInStorage, enabled: true, width: Math.max(1, Math.min(4, value)) } }); }} /></label></div>}
                  {design.room.builtInStorage?.enabled && <>
                    <div className="dimension-fields"><label>Rotation (°)<input type="number" min="0" max="360" step="5" value={((design.room.builtInStorage.rotation ?? -90) % 360 + 360) % 360} onChange={event => {
                      const value = event.currentTarget.valueAsNumber;
                      if (!Number.isFinite(value)) return;
                      const storage = { ...design.room.builtInStorage!, rotation: Math.max(0, Math.min(360, value)) };
                      storage.position = getStoragePlacement({ ...design.room, builtInStorage: storage });
                      updateRoom({ builtInStorage: storage });
                    }} /></label></div>
                    <div className="dimension-fields">{(["Left / right (m)", "Front / back (m)"] as const).map((label, axis) => <label key={label}>{label}<input type="number" step="0.1" value={Number(getStoragePlacement(design.room)[axis].toFixed(2))} onChange={event => {
                      const value = event.currentTarget.valueAsNumber;
                      if (!Number.isFinite(value)) return;
                      const position = getStoragePlacement(design.room);
                      position[axis] = value;
                      updateRoom({ builtInStorage: { ...design.room.builtInStorage!, position: getStoragePlacement(design.room, position) } });
                    }} /></label>)}</div>
                  </>}

                </section>}
                <section className="dimension-card"><div className="opening-row"><span><strong>Dining corner sink</strong><small>Compact basin, tap and cupboard</small></span><label className="toggle-control"><input type="checkbox" checked={design.room.diningSink ?? false} onChange={event => updateRoom({ diningSink: event.currentTarget.checked })} /><i /><b>{design.room.diningSink ? "On" : "Off"}</b></label></div></section>
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
                        <label className="opening-position">Door style<select value={design.room.door.style ?? "hinged"} onChange={(event) => updateDoorSetting({ style: event.currentTarget.value as DoorConfig["style"] })}><option value="hinged">Modern panel door</option><option value="sliding">Sliding glass doors</option></select></label>
                        <label>Width<input type="number" min="0.7" max="3.6" step="0.1" value={design.room.door.width} onChange={(event) => updateOpeningNumber("door", "width", event.currentTarget.valueAsNumber, 0.7, 3.6)} /></label>
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
                        <label className="opening-position">Window style<select value={design.room.window.style ?? "picture"} onChange={(event) => updateWindowSetting({ style: event.currentTarget.value as WindowConfig["style"] })}><option value="picture">Classic picture window</option><option value="panoramic">Panoramic glass</option><option value="arched">Sculptural arch</option></select></label>
                        <label>Width<input type="number" min="0.8" max="5.5" step="0.1" value={design.room.window.width} onChange={(event) => updateOpeningNumber("window", "width", event.currentTarget.valueAsNumber, 0.8, 5.5)} /></label>
                        <label>Sill height<input type="number" min="0.15" max="1.4" step="0.1" value={design.room.window.sillHeight} onChange={(event) => updateOpeningNumber("window", "sillHeight", event.currentTarget.valueAsNumber, 0.15, 1.4)} /></label>
                        <label className="opening-position">Position<input type="range" min="-0.35" max="0.35" step="0.05" value={design.room.window.position} onChange={(event) => updateOpeningNumber("window", "position", event.currentTarget.valueAsNumber, -0.35, 0.35)} /></label>
                      </div>
                    )}
                  </div>
                </section>
                <section className="dimension-card">
                  <div className="dimension-card-heading"><span><strong>Statement lighting</strong><small>Choose a chandelier for your room</small></span></div>
                  <div className="opening-fields"><label className="opening-position">Chandelier<select value={design.room.chandelier ?? "none"} onChange={(event) => updateRoom({ chandelier: event.currentTarget.value as "none" | "rings" | "globes" })}><option value="none">No chandelier</option><option value="rings">Floating luminous rings</option><option value="globes">Brass & opal globes</option></select></label></div>
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
                </>}
              </div>
            </div>
          )}

          {activePanel === "design" && (
            <div className="panel-content">
              <div className="panel-heading"><div><span className="eyebrow">Project overview</span><h1>My design</h1></div></div>
              <section className="saved-rooms-section" aria-label="Saved rooms">
                <strong>Save your decorated room</strong>
                <p>Saved rooms stay in this browser on this device. Rename your room to save another version.</p>
                <button className="saved-room-save" onClick={saveDecoratedRoom}><Box size={17} /> Save this room</button>
                {isAuthConfigured && <button className="saved-room-account" onClick={handleSaveToCloud} disabled={savingToCloud}>{savingToCloud ? "Saving…" : user ? "Save to my account" : "Sign in to save to my account"}</button>}
                {savedRooms.length > 0 && <div className="saved-room-list">
                  <strong>Your saved rooms</strong>
                  {savedRooms.map(saved => <div className="saved-room-row" key={saved.id}>
                    <button onClick={() => openSavedRoom(saved)} aria-label={`Open saved room ${saved.title}`}><span>{saved.title}</span><small>{new Date(saved.updatedAt).toLocaleDateString()}</small></button>
                    <button onClick={() => deleteSavedRoom(saved.id)} aria-label={`Delete saved copy of ${saved.title}`}><Trash2 size={16} /></button>
                  </div>)}
                </div>}
              </section>
              {selectedItem && selectedDecor && <div className="opening-card decor-placement">
                <strong>{products.find(product => product.id === selectedItem.productId)?.name}</strong>
                {selectedDecor.mount === "wall" && <label>Wall<select aria-label="Décor wall" value={selectedItem.wall ?? "back"} onChange={event => setItemWall(selectedItem.id, event.currentTarget.value as WallSide)}>
                  <option value="back">Back wall</option><option value="left">Left wall</option><option value="right">Right wall</option><option value="front">Front wall</option>
                </select></label>}
                {(selectedDecor.mount === "wall" || selectedDecor.mount === "table") && <label>{selectedDecor.mount === "wall" ? "Centre height (m)" : "Height above floor (m)"}<input type="number" step="0.1" min="0" max={design.room.height} value={Number(selectedItem.position[1].toFixed(2))} onChange={event => {
                  const height = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(height)) moveItem(selectedItem.id, [selectedItem.position[0], height, selectedItem.position[2]]);
                }} /></label>}
                <small>{selectedDecor.mount === "table" ? "Set the height to match your tabletop." : selectedDecor.mount === "wall" ? "Drag onto another visible wall to move it there. Orbit the room to reach every wall." : selectedDecor.mount === "ceiling" ? "Suspended from the ceiling; drag to reposition." : "Drag to move, or use the arrows and rotation controls."}</small>
              </div>}
              <div className="design-list">
                {placedItems.map((item) => {
                  const product = products.find((candidate) => candidate.id === item.productId);
                  if (!product) return null;
                  return (
                    <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => selectItem(item.id)}>
                      <Image src={product.image} alt="" width={56} height={56} />
                      <span><strong>{product.name}</strong><small>{(product.decorative ? "Styling accessory" : formatKes(product.price))}</small></span>
                      <ChevronDown size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <div ref={sceneStageRef} className={`scene-stage ${focusMode ? "is-focused" : ""}`}>
          <RoomScene
            cameraView={cameraView}
            editMode={editMode}
            showGrid={showGrid}
            zoomRequest={zoomRequest}
            room={design.room}
            placedItems={placedItems}
            selectedId={selectedId}
            onSelect={selectItem}
            onMove={moveItem}
            onStorageMove={position => updateRoom({ builtInStorage: { ...design.room.builtInStorage, enabled: true, width: design.room.builtInStorage?.width ?? 2, position } })}
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
              aria-label={isFullscreen || focusMode ? "Exit fullscreen" : "Enter fullscreen"}
              aria-pressed={isFullscreen || focusMode}
              onClick={toggleFullscreen}
            >
              {isFullscreen || focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>

          {selectedId && (
            <div className={`selection-toolbar ${isPhone && panelOpen ? "behind-menu" : ""}`}>
              {selectedDecor?.mount !== "wall" && (design.room.balcony?.enabled || design.room.yard?.enabled) && <select aria-label="Place selected furniture in area" value={(() => { const z = placedItems.find(item => item.id === selectedId)?.position[2] ?? 0; return z <= design.room.depth / 2 ? "room" : design.room.balcony?.enabled && z < design.room.depth / 2 + design.room.balcony.depth ? "balcony" : "yard"; })()} onChange={event => {
                const item = placedItems.find(item => item.id === selectedId); if (!item) return;
                const area = event.currentTarget.value;
                const balconyDepth = design.room.balcony?.enabled ? design.room.balcony.depth : 0;
                const z = area === "room" ? 0 : area === "balcony" ? design.room.depth / 2 + balconyDepth / 2 : design.room.depth / 2 + balconyDepth + (design.room.yard?.depth ?? 4) / 2;
                moveItem(item.id, [0, item.position[1], z]);
              }}><option value="room">Inside room</option>{design.room.balcony?.enabled && <option value="balcony">Balcony</option>}{design.room.yard?.enabled && <option value="yard">Front yard</option>}</select>}
              <span>Move</span>
              <div className="selection-move-controls" aria-label="Move selected item">
                <button onClick={() => moveSelected(-0.1, 0)} aria-label="Move left"><ArrowLeft size={15} /></button>
                <button onClick={() => moveSelected(0, -0.1)} aria-label={selectedDecor?.mount === "wall" ? "Move up" : "Move forward"}><ArrowUp size={15} /></button>
                <button onClick={() => moveSelected(0, 0.1)} aria-label={selectedDecor?.mount === "wall" ? "Move down" : "Move backward"}><ArrowDown size={15} /></button>
                <button onClick={() => moveSelected(0.1, 0)} aria-label="Move right"><ArrowRight size={15} /></button>
              </div>
              <button aria-label={selectedDecor?.mount === "wall" ? "Move to next wall" : "Rotate selected item"} onClick={() => rotateItem(selectedId)}><RotateCcw size={17} /><span className="selection-action-label">{selectedDecor?.mount === "wall" ? "Next wall" : "Rotate"}</span></button>
              <button aria-label="Remove selected item" onClick={removeSelected} className="danger"><Trash2 size={17} /><span className="selection-action-label">Remove</span></button>
            </div>
          )}

          {isPhone && !panelOpen && <div className="mobile-gesture-hint">{editMode ? "Drag items and floor handles to adjust" : "One finger to rotate · Pinch to zoom"}</div>}
          <div className="view-toolbar">
            {isPhone && <button className={editMode ? "active" : ""} aria-label={editMode ? "Switch to room navigation" : "Switch to moving items"} aria-pressed={editMode} onClick={() => setEditMode(value => !value)}><Armchair size={17} /><b className="mobile-mode-label">{editMode ? "Move" : "Orbit"}</b></button>}
            <button aria-label="3D view" className={cameraView === "perspective" ? "active" : ""} onClick={() => setCameraView("perspective")}><View size={18} /><span>3D view</span></button>
            <button aria-label="Top view" className={cameraView === "top" ? "active" : ""} onClick={() => setCameraView("top")}><Layers3 size={18} /><span>Top view</span></button>
            <button aria-label="Front view" className={cameraView === "front" ? "active" : ""} onClick={() => setCameraView("front")}><Armchair size={18} /><span>Front</span></button>
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
                      <b>{(product.decorative ? "Styling accessory" : formatKes(product.price))}</b>
                      {!product.decorative && <a href={product.productUrl} target="_blank" rel="noreferrer" aria-label={`View ${product.name} on FurnitureRama`}>
                        View product <ExternalLink size={12} />
                      </a>}
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
