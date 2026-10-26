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
  Copy,
  RefreshCw,
  PanelsTopLeft,
  CircleHelp,
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
  Search,
  Sun,
  Moon,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
  View,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CameraView } from "./room-scene";
import { formatKes, products, registerUploadedTrialProduct, unregisterUploadedTrialProduct, type ProductCategory } from "@/data/products";
import { ProductCardImage } from "./product-card-image";
import { getRoomArea, matchRoomPreset, roomPresets } from "@/data/room-presets";
import { getConferenceScreen, type ConferenceScreenConfig } from "@/lib/conference-screen";
import {
  decodeSharedDesign,
  encodeSharedDesign,
  clampItemPosition,
  isBedroomRoom,
  getStoragePlacement,
  getRotatedStorage,
  usePlannerStore,
  type DoorConfig,
  type WindowConfig,
  type WallSide,
} from "@/stores/planner-store";
import type { DecorGroup } from "@/data/decor-catalog";
import { useAuth } from "@/components/auth-provider";
import { AuthModal } from "@/components/auth-modal";
import { RoomSwitchPrompt } from "./room-switch-prompt";
import { readSavedRooms, saveRoomSnapshot, deleteRoomSnapshot, type SavedRoom } from "@/lib/saved-rooms";
import { saveDesignToCloud } from "@/lib/design-storage";
import { addUploadedTrialModel, listUploadedTrialModels, removeUploadedTrialModel, readTrialModel, saveTrialModel, verifyGlb, trialModelIds, type TrialModelId } from "@/lib/trial-model-storage";
import { inspectUploadedTrialGlb } from "@/lib/trial-glb-import";

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
function modelIdFromFilename(name: string): TrialModelId | null {
  const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (nameKey.includes("officechair")) return "trial-office-chair";
  if (nameKey.includes("conferencetable") || nameKey.includes("confrencetable")) return "trial-conference-table";
  if (nameKey.includes("diningtable")) return "trial-dining-table";
  if (nameKey.includes("whiteseat")) return "trial-white-seat";
  if (nameKey.includes("couch")) return "trial-couch";
  if (nameKey.includes("seat")) return "trial-seat";
  return null;
}

const decorGroups: Array<"All" | DecorGroup> = ["All", "Trial furniture", "Floor plants", "Hanging plants", "Table plants", "Wall art", "Mirrors", "Rugs", "Vases"];

const placementSpots: Array<[number, number, number]> = [
  [1.3, 0, 0.4],
  [2.8, 0, 1.8],
  [0.2, 0, -1.8],
  [3.3, 0, -1.5],
];

const wallColors = ["#f3f0e9", "#e4ded2", "#cbdcdc", "#b7b2a8"];

const conferenceFloors = [
  { name: "Conference Fabric026", color: "#817c76", label: "Fabric026" },
  { name: "Conference Carpet004", color: "#85827d", label: "Carpet004" },
  { name: "Conference Fabric027", color: "#a29c94", label: "Fabric027" },
  { name: "Conference Carpet005", color: "#6f6a66", label: "Carpet005" },
  { name: "Conference Fabric022", color: "#99918b", label: "Fabric022" },
];

const floorFinishes = [
  { name: "Natural oak", color: "#d8b78e", label: "WoodFloor051" },
  { name: "Light ash", color: "#c8b79f", label: "WoodFloor070" },
  { name: "Warm walnut", color: "#8d6746", label: "WoodFloor052" },
  { name: "Charcoal slate tiles", color: "#525653", label: "Tiles140" },
  { name: "Black onyx", color: "#292a2c", label: "Onyx010" },
  { name: "Fabric floor", color: "#a49d94", label: "Fabric081C" },
];

function RoomSettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return <details className="room-setting" name="rama-room-settings" defaultOpen={title === "Room size"}>
    <summary>{title}<ChevronDown size={17} aria-hidden="true" /></summary>
    <div className="room-setting-content">{children}</div>
  </details>;
}

/** Exact measurement field: decimal touch keyboard, no edits until Enter/blur. */
function DimensionInput({ label, value, min, max, onCommit, unit = "m" }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  unit?: "m" | "°" | "%";
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);

  const commit = (text: string) => {
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(String(value));
      setEditing(false);
      return;
    }
    const input = text.trim();
    const parsed = Number(input);
    if (input !== "" && Number.isFinite(parsed)) {
      const next = Math.max(min, Math.min(max, parsed));
      if (next !== value) onCommit(next);
      setDraft(String(next));
    } else {
      setDraft(String(value));
    }
    setEditing(false);
  };

  return <label className="exact-measurement-field">
    <span>{label} ({unit})</span>
    <input type="number" inputMode="decimal" min={min} max={max} step="any"
      value={draft}
      onFocus={event => { cancelled.current = false; setEditing(true); event.currentTarget.select(); }}
      onChange={event => setDraft(event.currentTarget.value)}
      onBlur={event => commit(event.currentTarget.value)}
      onKeyDown={event => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelled.current = true;
          event.currentTarget.blur();
        }
      }}
      aria-label={`${label} in ${unit === "m" ? "metres" : unit === "°" ? "degrees" : "percent"}`}
      title={`Type a value between ${min} and ${max}, then press Enter or tap outside.`}
    />
  </label>;
}

export function PlannerShell({ onWelcome }: { onWelcome?: () => void } = {}) {
  const [activePanel, setActivePanel] = useState<"products" | "decor" | "room" | "design">("decor");
  const [activeCategory, setActiveCategory] = useState<(typeof categories)[number]>("All");
  const [activeDecorGroup, setActiveDecorGroup] = useState<(typeof decorGroups)[number]>("All");
  const [query, setQuery] = useState("");
  const [trialModelUrls, setTrialModelUrls] = useState<Record<string, string>>({});
  const trialUrlsRef = useRef<Record<string, string>>({});
  const [trialImportingId, setTrialImportingId] = useState<string | null>(null);
  const [addingTrials, setAddingTrials] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  useEffect(() => {
    let active = true;
    const restore = async () => {
      for (const id of trialModelIds) {
        try {
          const stored = await readTrialModel(id);
          if (!stored || !active) continue;
          const url = URL.createObjectURL(stored);
          trialUrlsRef.current[id] = url;
          setTrialModelUrls({ ...trialUrlsRef.current });
        } catch (error) {
          console.warn("Trial asset could not be restored", id, error);
        }
      }
      try {
        const uploaded = await listUploadedTrialModels();
        for (const record of uploaded) {
          if (!active) return;
          const blob = await readTrialModel(record.id);
          if (!blob || !active) continue;
          registerUploadedTrialProduct(record);
          const url = URL.createObjectURL(blob);
          trialUrlsRef.current[record.id] = url;
          setTrialModelUrls({ ...trialUrlsRef.current });
        }
        if (active) setCatalogVersion(value => value + 1);
      } catch (error) {
        console.warn("Could not restore additional trial furniture", error);
      }
    };
    void restore();
    return () => {
      active = false;
      Object.values(trialUrlsRef.current).forEach(url => URL.revokeObjectURL(url));
      trialUrlsRef.current = {};
    };
  }, []);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("rama-favorite-product-ids") ?? "[]");
      if (Array.isArray(saved)) setFavoriteIds(saved.filter((id): id is string => typeof id === "string").slice(0, 200));
    } catch { /* Missing or disabled storage must not affect room design. */ }
  }, []);
  const toggleFavorite = (id: string) => {
    const next = favoriteIds.includes(id) ? favoriteIds.filter(value => value !== id) : [...favoriteIds, id];
    setFavoriteIds(next);
    try { window.localStorage.setItem("rama-favorite-product-ids", JSON.stringify(next)); } catch { /* Optional preference. */ }
  };
  const [cameraView, setCameraView] = useState<CameraView>("perspective");
  const [showGrid, setShowGrid] = useState(false);
  const [zoomRequest, setZoomRequest] = useState<{ id: number; direction: "in" | "out" }>({
    id: 0,
    direction: "in",
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [showExactItem, setShowExactItem] = useState(false);
  const [lightingMode, setLightingMode] = useState<"day" | "evening">("day");
  const [isPhone, setIsPhone] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)");
    const touch = window.matchMedia("(any-pointer: coarse)");
    const updateLayout = () => { setIsPhone(media.matches); setPanelOpen(!media.matches); };
    const updateTouch = () => { setIsTouch(touch.matches); setEditMode(!touch.matches); };
    const update = () => { updateLayout(); updateTouch(); };
    update();
    media.addEventListener("change", updateLayout);
    touch.addEventListener("change", updateTouch);
    return () => { media.removeEventListener("change", updateLayout); touch.removeEventListener("change", updateTouch); };
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
  useEffect(() => {
    const container = summaryOpen ? document.querySelector<HTMLElement>(".summary-drawer")
      : isPhone && panelOpen ? document.querySelector<HTMLElement>("#planner-menu") : null;
    if (!container) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex='0']"))
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      const modal = document.activeElement instanceof Element ? document.activeElement.closest("[aria-modal='true']") : null;
      if (event.defaultPrevented || (modal && !modal.contains(container))) return;
      if (event.key === "Escape" && summaryOpen) { event.preventDefault(); setSummaryOpen(false); }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0], last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !container.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, [isPhone, panelOpen, summaryOpen]);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [savingToCloud, setSavingToCloud] = useState(false);
  const [savedRooms, setSavedRooms] = useState<SavedRoom[]>([]);
  const [pendingRoom, setPendingRoom] = useState<{ kind: "preset"; id: string; name: string } | { kind: "saved"; saved: SavedRoom; name: string } | null>(null);
  const [roomSwitchError, setRoomSwitchError] = useState<string | null>(null);
  const cancelRoomSwitch = useCallback(() => { setPendingRoom(null); setRoomSwitchError(null); }, []);
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
    resizeItem,
    undo,
    redo,
  } = usePlannerStore();
  const placedItems = design.items;
  const selectedItem = placedItems.find(item => item.id === selectedId);
  const selectedDecor = products.find(product => product.id === selectedItem?.productId)?.decor;
  const roomArea = getRoomArea(design.room);
  const activeRoomPreset = matchRoomPreset(design.room);
  const conferenceScreen = getConferenceScreen(design.room);
  const changeConferenceScreen = (change: Partial<ConferenceScreenConfig>) => {
    updateRoom({ conferenceScreen: getConferenceScreen(design.room, change) });
  };

  const nextItemNumber = useRef(10);
  const sceneStageRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = activePanel === "decor"
          ? Boolean(product.decorative) && (activeDecorGroup === "All" || product.decor?.group === activeDecorGroup)
          : !product.decorative && (activeCategory === "All" || product.category === activeCategory);
        const searchTerms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        const searchText = [product.name, product.category, product.decor?.group, product.kind, product.dimensions, product.id].filter(Boolean).join(" ").toLocaleLowerCase();
        const matchesQuery = searchTerms.every(term => searchText.includes(term));
        return matchesCategory && matchesQuery;
      }),
    [activePanel, activeCategory, activeDecorGroup, query, catalogVersion],
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
      return true;
    } catch {
      notify("Could not save. Your browser storage may be full or unavailable.");
      return false;
    }
  };

  const performRoomSwitch = (target: NonNullable<typeof pendingRoom>) => {
    if (target.kind === "preset") {
      applyRoomPreset(target.id);
      setActivePanel("decor");
      setQuery("");
      setEditMode(!isPhone);
    } else {
      const room = decodeSharedDesign(target.saved.payload);
      if (!room) { notify("This saved room could not be opened"); return; }
      loadDesign(room);
    }
    if (isPhone) setPanelOpen(false);
    setPendingRoom(null);
    setRoomSwitchError(null);
    notify(`${target.name} opened`);
  };

  const requestRoomSwitch = (target: NonNullable<typeof pendingRoom>) => {
    if (design.items.length > 0 || history.length > 0) {
      setRoomSwitchError(null);
      setPendingRoom(target);
    } else performRoomSwitch(target);
  };

  const openSavedRoom = (saved: SavedRoom) => requestRoomSwitch({ kind: "saved", saved, name: saved.title });

  const saveAndSwitchRoom = () => {
    if (!pendingRoom) return;
    if (!saveDecoratedRoom()) {
      setRoomSwitchError("Your room could not be saved. Free some browser storage and try again, or keep decorating.");
      return;
    }
    performRoomSwitch(pendingRoom);
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

  const importTrialModel = async (id: TrialModelId, file?: File, quiet = false): Promise<boolean> => {
    if (!file) return false;
    setTrialImportingId(id);
    try {
      if (!(await verifyGlb(file))) {
        if (!quiet) notify("Please choose a valid GLB 2.0 model under 100 MB");
        return false;
      }
      let stored = true;
      try { await saveTrialModel(id, file); }
      catch (error) {
        stored = false;
        console.warn("Browser cannot persist trial model", error);
      }
      const nextUrl = URL.createObjectURL(file);
      const previous = trialUrlsRef.current[id];
      trialUrlsRef.current[id] = nextUrl;
      setTrialModelUrls({ ...trialUrlsRef.current });
      if (previous) URL.revokeObjectURL(previous);
      if (!quiet) notify(stored ? "3D model imported. Tap Add to furnish your room." : "3D model loaded for this session. Browser storage is unavailable.");
      return true;
    } catch (error) {
      console.error("Unable to import GLB model", error);
      if (!quiet) notify("Unable to import this GLB file");
      return false;
    } finally {
      setTrialImportingId(null);
    }
  };

  const importAllTrialModels = async (files: File[]) => {
    if (files.length === 0) return;
    let imported = 0;
    for (const file of files) {
      const id = modelIdFromFilename(file.name);
      if (id && await importTrialModel(id, file, true)) imported++;
    }
    notify(imported ? `${imported} trial model${imported === 1 ? "" : "s"} imported. Tap Add to furnish your room.` : "No matching trial models. Select the six named GLB files, not the ZIP.");
  };

  const importNewTrialFurniture = async (files: File[]) => {
    if (!files.length || addingTrials) return;
    setAddingTrials(true);
    let added = 0;
    const failed: string[] = [];
    try {
      for (const file of files.slice(0, 12)) {
        try {
          const record = await inspectUploadedTrialGlb(file);
          await addUploadedTrialModel(record, file);
          registerUploadedTrialProduct(record);
          const url = URL.createObjectURL(file);
          trialUrlsRef.current[record.id] = url;
          setTrialModelUrls({ ...trialUrlsRef.current });
          added++;
        } catch (error) {
          failed.push(`${file.name}: ${error instanceof Error ? error.message : "Import failed"}`);
          console.warn("Trial GLB rejected", file.name, error);
        }
      }
      setCatalogVersion(value => value + 1);
      setActivePanel("decor");
      setActiveDecorGroup("Trial furniture");
      setQuery("");
      if (added) notify(`${added} new trial item${added !== 1 ? "s" : ""} ready. Tap Add to place in your room.`);
      else notify(failed[0] ?? "No files could be imported.");
      if (failed.length) console.warn("Some trial GLBs were not imported:", failed);
      if (files.length > 12) console.warn("Select additional GLBs in another batch (12 per import).");
    } finally {
      setAddingTrials(false);
    }
  };

  const removeNewTrialFurniture = async (id: string) => {
    if (placedItems.some(item => item.productId === id)) {
      notify("Remove the furniture from your room before deleting its model.");
      return;
    }
    if (!window.confirm("Remove this model from this browser? Saved rooms using it may no longer display it.")) return;
    try {
      await removeUploadedTrialModel(id);
      const url = trialUrlsRef.current[id];
      if (url) URL.revokeObjectURL(url);
      delete trialUrlsRef.current[id];
      setTrialModelUrls({ ...trialUrlsRef.current });
      unregisterUploadedTrialProduct(id);
      setCatalogVersion(value => value + 1);
      notify("Trial model removed from this browser.");
    } catch (error) {
      console.error("Unable to remove trial model", error);
      notify("Could not remove this trial model.");
    }
  };

  const addProduct = (productId: string) => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    if (!product.decorative) { notify("Furniture coming soon. Explore Décor to style your room now."); return; }
    if (product.id.startsWith("trial-") && !trialModelUrls[product.id]) { notify("Import the matching 3D model first, then tap Add."); return; }
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
    if (isPhone) setPanelOpen(false);
    if (isTouch) setEditMode(true);
    notify("Added to your room");
  };

  const copySelected = () => {
    if (!selectedItem) return;
    let id = `${selectedItem.productId}-${nextItemNumber.current++}`;
    while (placedItems.some(item => item.id === id)) id = `${selectedItem.productId}-${nextItemNumber.current++}`;
    const offset: [number, number, number] = [selectedItem.position[0] + 0.35, selectedItem.position[1], selectedItem.position[2] + 0.25];
    addItem({
      ...selectedItem,
      id,
      position: clampItemPosition(design.room, selectedItem.kind, offset, selectedItem.productId, selectedItem.wall, selectedItem.rotation[1]),
      rotation: [...selectedItem.rotation] as [number, number, number],
    });
    selectItem(id);
    notify("Copy added to room");
  };

  const browseFromSelected = (replace: boolean) => {
    if (!selectedItem) return;
    setActivePanel("decor");
    setActiveDecorGroup("All");
    setQuery(replace ? (products.find(product => product.id === selectedItem.productId)?.name ?? "") : "");
    setPanelOpen(true);
    notify(replace ? "Choose a replacement; remove the original when ready" : "Browse décor to complement this item");
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
    if (!preset || design.room.presetId === presetId) return;
    requestRoomSwitch({ kind: "preset", id: presetId, name: preset.name });
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
    key: "width" | "height" | "position" | "sillHeight",
    value: number,
    min: number,
    max: number,
  ) => {
    if (!Number.isFinite(value)) return;
    const physicalMax = key === "width" ? (opening === "door" ? design.room.depth - .7 : design.room.width - .7) : key === "height" ? (opening === "door" ? design.room.height - .08 : design.room.height - design.room.window.sillHeight - .15) : key === "sillHeight" ? design.room.height - design.room.window.height - .15 : max;
    const nextValue = Math.min(max, Math.max(min, Math.min(physicalMax, value)));
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
      if (pendingRoom) return;
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
  }, [moveSelected, removeItem, selectedId, pendingRoom]);

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
                <button type="button" aria-label="Clear search and category filters" title="Clear filters" onClick={() => { setQuery(""); setActiveCategory("All"); setActiveDecorGroup("All"); }}><X size={18} /></button>
              </label>

              {activePanel === "decor" && (
                <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9,padding:"12px 14px",borderRadius:12,background:"#384843",color:"white",fontWeight:650,fontSize:13,cursor:addingTrials?"progress":"pointer",margin:"8px 0 12px"}}>
                  <PackagePlus size={18} /> {addingTrials ? "Adding trial furniture…" : "Upload new trial furniture (.glb)"}
                  <input type="file" accept=".glb,model/gltf-binary" multiple disabled={addingTrials} aria-label="Upload any new furniture GLB files"
                    style={{position:"absolute",width:1,height:1,opacity:0}}
                    onChange={event => {
                      const uploads = Array.from(event.currentTarget.files ?? []);
                      event.currentTarget.value = "";
                      void importNewTrialFurniture(uploads);
                    }} />
                </label>
              )}
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

              {activePanel === "decor" && activeDecorGroup === "Trial furniture" && (
                <p style={{fontSize:13,lineHeight:1.5,padding:"6px 2px"}}>Trial furniture is stored in this browser. Upload any GLB using the button above and it appears here automatically; tap Add to furnish your room. The original six items can also be imported individually.</p>
              )}
              {activePanel === "decor" && activeDecorGroup === "Trial furniture" && (
                <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,borderRadius:10,padding:"11px 14px",background:"#394744",color:"#ffffff",fontSize:14,cursor:"pointer",fontWeight:650}}>
                  <PackagePlus size={18}/> Import all six GLBs
                  <input type="file" multiple accept=".glb,model/gltf-binary"
                    aria-label="Import all trial furniture GLB models"
                    style={{position:"absolute",opacity:0,width:1,height:1}}
                    onChange={event => {
                      const files = Array.from(event.currentTarget.files ?? []);
                      event.currentTarget.value = "";
                      void importAllTrialModels(files);
                    }}
                  />
                </label>
              )}
              <div className="catalog-result-heading">
                <span>{filteredProducts.length} {activePanel === "decor" ? "styling accessories" : "products · coming soon"}</span>
                <span aria-label="Grid view"><LayoutGrid size={16} /> Grid</span>
              </div>

              {filteredProducts.length === 0 && (
                <div role="status" className="opening-card">
                  <strong>No matching products</strong>
                  <p>Try a product name, material, category or another keyword.</p>
                  <button type="button" onClick={() => { setQuery(""); setActiveCategory("All"); setActiveDecorGroup("All"); }}>Show all in this collection</button>
                </div>
              )}
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <article className={`product-card ${product.decorative ? "" : "coming-soon-card"}`} key={product.id}>
                    {!product.decorative && <button className="coming-soon-trigger" onClick={() => addProduct(product.id)} aria-label={`${product.name} — coming soon`} />}
                    <div className="product-image-wrap">
                      {product.id.startsWith("trial-")
                        ? <div aria-label={`${product.name}, trial model`} style={{height:"100%",width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:9,background:"linear-gradient(145deg,#e8e4dc,#cfcdc7)",color:"#3b4645"}}>
                            <Armchair size={43} strokeWidth={1.3} />
                            <span style={{fontSize:12,fontWeight:650,letterSpacing:".07em"}}>{trialModelUrls[product.id] ? "3D MODEL READY" : "IMPORT 3D MODEL"}</span>
                          </div>
                        : <ProductCardImage src={product.image} fallback={product.decorative ? `/decor/${product.id}.svg` : product.image} alt={product.name} />}
                      {product.decorative && !product.id.startsWith("trial-") && <button type="button" className="decor-image-add" onClick={() => addProduct(product.id)} aria-label={`Add ${product.name} to room`} />}
                      <button type="button" className="favorite-button" tabIndex={product.decorative ? 0 : -1} aria-label={`${favoriteIds.includes(product.id) ? "Unsave" : "Save"} ${product.name}`} aria-pressed={favoriteIds.includes(product.id)} onClick={() => toggleFavorite(product.id)}><Heart size={17} fill={favoriteIds.includes(product.id) ? "currentColor" : "none"} /></button>
                      <span className="model-ready">{product.id.startsWith("trial-") ? "TRIAL GLB" : product.decor ? product.decor.mount === "wall" ? "WALL" : product.decor.mount === "ceiling" ? "HANGING" : "3D DÉCOR" : "COMING SOON"}</span>
                    </div>
                    <div className="product-card-body">
                      <span className="product-category">{product.decor?.group ?? product.category}</span>
                      <h2>{product.name}</h2>
                      <span className="product-dimensions">{product.dimensions}</span>
                      {product.id.startsWith("trial-") && !product.id.startsWith("trial-upload-") && <label style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,margin:"8px 0",padding:"10px",border:"1px solid #a9aaa7",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600}}>
                        <PackagePlus size={16}/>
                        {trialImportingId === product.id ? "Importing…" : trialModelUrls[product.id] ? "Replace GLB" : "Import GLB"}
                        <input type="file" accept=".glb,model/gltf-binary" style={{position:"absolute",opacity:0,width:1,height:1}} disabled={trialImportingId !== null}
                          aria-label={`Import model for ${product.name}`}
                          onChange={event => {
                            const selected = event.currentTarget.files?.[0];
                            event.currentTarget.value = "";
                            void importTrialModel(product.id as TrialModelId, selected);
                          }} />
                      </label>}
                      {product.id.startsWith("trial-upload-") && <button type="button"
                        style={{display:"block",width:"100%",margin:"8px 0",padding:"8px",border:"1px solid #d1c5c0",borderRadius:7,color:"#865346",fontSize:12}}
                        onClick={() => void removeNewTrialFurniture(product.id)} aria-label={`Remove ${product.name} from trial library`}>
                        Remove from trial library
                      </button>}
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
                <RoomSettingsSection title="Choose room">

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
                </RoomSettingsSection>
                <RoomSettingsSection title="Room size">

                  <p className="resize-instruction">Type exact measurements in metres (for example 3.275). Press Enter or tap away to apply. Teal drag handles remain available.</p>
                  <div className="dimension-fields">
                    <DimensionInput label="Width" value={design.room.width} min={2.5} max={12} onCommit={value => updateRoomDimension("width", value)} />
                    <DimensionInput label="Depth" value={design.room.depth} min={2.5} max={12} onCommit={value => updateRoomDimension("depth", value)} />
                    <DimensionInput label="Height" value={design.room.height} min={2.2} max={4.5} onCommit={value => updateRoomDimension("height", value)} />
                  </div>
                </RoomSettingsSection>
                {(!design.room.spaceType || design.room.spaceType === "indoor") && <>
                <RoomSettingsSection title="Outdoor spaces">

                  {(["balcony", "yard"] as const).map(area => {
                    const value = design.room[area] ?? { enabled: false, width: design.room.width, depth: area === "balcony" ? 2.4 : 4 };
                    return <div className="opening-section" key={area}>
                      <div className="opening-row"><strong>{area === "balcony" ? "Balcony deck" : "Grassy front yard"}</strong><label className="toggle-control"><input type="checkbox" checked={value.enabled} onChange={event => updateRoom({ [area]: { ...value, enabled: event.currentTarget.checked } })} /><i /><b>{value.enabled ? "On" : "Off"}</b></label></div>
                      {value.enabled && <div className="dimension-fields">{(["width", "depth"] as const).map(dimension => <DimensionInput key={`${area}-${dimension}`} label={dimension === "width" ? "Width" : "Depth"} value={value[dimension]} min={dimension === "width" ? 2.5 : 1.5} max={12} onCommit={next => updateRoom({ [area]: { ...value, [dimension]: next } })}/>)}</div>}
                    </div>;
                  })}
                </RoomSettingsSection>
                {isBedroomRoom(design.room) && <RoomSettingsSection title="Built-in storage">
                  <div className="opening-row"><span><strong>Built-in wardrobe & drawers</strong><small>Drag to move; use the buttons to rotate</small></span><label className="toggle-control"><input type="checkbox" checked={design.room.builtInStorage?.enabled ?? false} onChange={event => updateRoom({ builtInStorage: { ...design.room.builtInStorage, width: design.room.builtInStorage?.width ?? 2, enabled: event.currentTarget.checked } })} /><i /><b>{design.room.builtInStorage?.enabled ? "On" : "Off"}</b></label></div>
                  {design.room.builtInStorage?.enabled && <div className="dimension-fields"><DimensionInput label="Wardrobe width" min={1} max={4} value={design.room.builtInStorage.width} onCommit={width => updateRoom({ builtInStorage: { ...design.room.builtInStorage, enabled: true, width } })}/></div>}
                  {design.room.builtInStorage?.enabled && <>
                    <div className="storage-rotation-controls">
                      <button aria-label="Rotate drawers left" onClick={() => updateRoom({ builtInStorage: getRotatedStorage(design.room, -45) })}><RotateCcw size={18} /> Left</button>
                      <button aria-label="Rotate drawers right" onClick={() => updateRoom({ builtInStorage: getRotatedStorage(design.room, 45) })}>Right <RotateCcw size={18} style={{ transform: "scaleX(-1)" }} /></button>
                    </div>
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

                </RoomSettingsSection>}
                <RoomSettingsSection title="Dining sink"><div className="opening-row"><span><strong>Dining corner sink</strong><small>Compact basin, tap and cupboard</small></span><label className="toggle-control"><input type="checkbox" checked={design.room.diningSink ?? false} onChange={event => updateRoom({ diningSink: event.currentTarget.checked })} /><i /><b>{design.room.diningSink ? "On" : "Off"}</b></label></div></RoomSettingsSection>
                <RoomSettingsSection title="Doors"><div className="opening-section">
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
                        <DimensionInput label="Door width" value={design.room.door.width} min={.7} max={Math.min(3.6, design.room.depth - .7)} onCommit={value => updateOpeningNumber("door", "width", value, .7, 3.6)}/>
                        <DimensionInput label="Door height" value={design.room.door.height} min={1.8} max={Math.min(2.5, design.room.height - .08)} onCommit={value => updateOpeningNumber("door", "height", value, 1.8, 2.5)}/>
                        <label>Position<input type="range" min="-0.35" max="0.35" step="0.05" value={design.room.door.position} onChange={(event) => updateOpeningNumber("door", "position", event.currentTarget.valueAsNumber, -0.35, 0.35)} /></label>
                        <DimensionInput label="Door offset from centre" value={-design.room.door.position * (design.room.depth - design.room.door.width)} min={-.35 * (design.room.depth - design.room.door.width)} max={.35 * (design.room.depth - design.room.door.width)} onCommit={offset => updateOpeningNumber("door", "position", -offset / (design.room.depth - design.room.door.width), -.35, .35)}/>
                      </div>
                    )}
                  </div></RoomSettingsSection>
                <RoomSettingsSection title="Windows"><div className="opening-section">
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
                        <label className="opening-position">Window style<select value={design.room.window.style ?? "picture"} onChange={(event) => updateWindowSetting({ style: event.currentTarget.value as WindowConfig["style"] })}><option value="picture">Classic picture window</option><option value="panoramic">Panoramic glass</option><option value="arched">Sculptural arch</option><option value="grid-slider">White grid sliding window</option></select></label>
                        {design.room.window.style === "grid-slider" && <>
                          <label className="opening-position">Frame finish
                            <select value={design.room.window.frameColor ?? "white"} onChange={event => updateWindowSetting({ frameColor: event.currentTarget.value as WindowConfig["frameColor"] })}>
                              <option value="white">White</option><option value="black">Matte black</option><option value="wood">Natural wood</option>
                            </select>
                          </label>
                          <label className="opening-position">Slide open ({Math.round((design.room.window.openAmount ?? 0) * 100)}%)
                            <input type="range" min="0" max="1" step="0.05" value={design.room.window.openAmount ?? 0} onChange={event => updateWindowSetting({ openAmount: Number(event.currentTarget.value) })} />
                          </label>
                        </>}
                        <label className="opening-position">Window covering
                          <select value={design.room.window.blinds ? "blinds" : design.room.window.curtains ? "curtains" : "none"}
                            onChange={event => updateWindowSetting({ curtains: event.currentTarget.value === "curtains", blinds: event.currentTarget.value === "blinds" })}>
                            <option value="none">None</option><option value="curtains">Soft curtains</option><option value="blinds">Roller blinds</option>
                          </select>
                        </label>
                        <DimensionInput label="Window width" value={design.room.window.width} min={.8} max={Math.min(5.5, design.room.width - .7)} onCommit={value => updateOpeningNumber("window", "width", value, .8, 5.5)}/>
                        <DimensionInput label="Window height" value={design.room.window.height} min={.6} max={Math.max(.6, Math.min(2.4, design.room.height - design.room.window.sillHeight - .15))} onCommit={value => updateOpeningNumber("window", "height", value, .6, 2.4)}/>
                        <DimensionInput label="Sill height" value={design.room.window.sillHeight} min={.15} max={Math.max(.15, Math.min(1.4, design.room.height - design.room.window.height - .15))} onCommit={value => updateOpeningNumber("window", "sillHeight", value, .15, 1.4)}/>
                        <label className="opening-position">Position<input type="range" min="-0.35" max="0.35" step="0.05" value={design.room.window.position} onChange={(event) => updateOpeningNumber("window", "position", event.currentTarget.valueAsNumber, -0.35, 0.35)} /></label>
                        <DimensionInput label="Window offset from centre" value={design.room.window.position * (design.room.width - design.room.window.width)} min={-.35 * (design.room.width - design.room.window.width)} max={.35 * (design.room.width - design.room.window.width)} onCommit={offset => updateOpeningNumber("window", "position", offset / (design.room.width - design.room.window.width), -.35, .35)}/>
                      </div>
                    )}
                  </div></RoomSettingsSection>
                <RoomSettingsSection title="Lighting">

                  <div className="opening-fields"><label className="opening-position">Chandelier<select value={design.room.chandelier ?? "none"} onChange={(event) => updateRoom({ chandelier: event.currentTarget.value as "none" | "rings" | "globes" })}><option value="none">No chandelier</option><option value="rings">Floating luminous rings</option><option value="globes">Brass & opal globes</option></select></label></div>
                {design.room.presetId === "conference-room" && <div className="opening-fields">{([["conferenceRecessedLights", "Recessed ceiling lights"],["conferenceCeilingBulkhead", "Ceiling bulkhead"]] as const).map(([key, label]) => <label className="opening-position" key={key}>{label}<select value={design.room[key] ? "yes" : "no"} onChange={event => updateRoom({ [key]: event.currentTarget.value === "yes" })}><option value="yes">Enabled</option><option value="no">Disabled</option></select></label>)}</div>}
                </RoomSettingsSection>
                {design.room.presetId !== "conference-room" && <>
                <RoomSettingsSection title="Floors">

                  <div className="floor-options">
                    {floorFinishes.map((finish) => (
                      <button
                        key={finish.name}
                        className={design.room.floorName === finish.name ? "selected" : ""}
                        onClick={() => updateRoom({ floorName: finish.name, floorColor: finish.color })}
                      >
                        <i style={{ backgroundColor: finish.color, backgroundImage: `url(/materials/ambientcg/${finish.label}/Color.jpg)`, backgroundSize: "cover", backgroundPosition: "center" }} />
                        <span>{finish.label}</span>
                      </button>
                    ))}
                  </div>
                </RoomSettingsSection>
                </>}
                <RoomSettingsSection title="Walls">{design.room.presetId === "conference-room" && <div className="opening-fields">{([["conferenceGlassWalls", "Glass partition walls"],["conferenceAcousticPanels", "Acoustic wall panels"]] as const).map(([key, label]) => <label className="opening-position" key={key}>{label}<select value={design.room[key] ? "yes" : "no"} onChange={event => updateRoom({ [key]: event.currentTarget.value === "yes" })}><option value="yes">Enabled</option><option value="no">Disabled</option></select></label>)}</div>}<div className="finish-section">
                  <span>Wall finish</span>
                  <div className="floor-options">
                    <button type="button"
                      className={!design.room.wallFinish || design.room.wallFinish === "paint" ? "selected" : ""}
                      aria-pressed={!design.room.wallFinish || design.room.wallFinish === "paint"}
                      onClick={() => updateRoom({ wallFinish: "paint" })}>Painted wall</button>
                    <button type="button"
                      className={design.room.wallFinish === "Bricks025" ? "selected" : ""}
                      aria-pressed={design.room.wallFinish === "Bricks025"}
                      onClick={() => updateRoom({ wallFinish: "Bricks025" })}>Real brick · Bricks025</button>
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
                </div></RoomSettingsSection>

                {design.room.presetId === "conference-room" && <>
                  <RoomSettingsSection title="Presentation screen">
                    <div className="opening-fields">{([["conferencePresentationWall", "Presentation screen"]] as const).map(([key, label]) => <label className="opening-position" key={key}>{label}<select value={design.room[key] ? "yes" : "no"} onChange={event => updateRoom({ [key]: event.currentTarget.value === "yes" })}><option value="yes">Enabled</option><option value="no">Disabled</option></select></label>)}</div>
                    {design.room.conferencePresentationWall && <>
                      <p className="resize-instruction">Enter the precise screen dimensions or use the stretch handles. Measurements are in metres.</p>
                      <div className="dimension-fields">
                        <DimensionInput label="Screen width" value={conferenceScreen.width} min={.8} max={screenLimits(design.room, conferenceScreen.width, conferenceScreen.height, conferenceScreen.wall).widthMax} onCommit={width => changeConferenceScreen({ width })}/>
                        <DimensionInput label="Screen height" value={conferenceScreen.height} min={.5} max={screenLimits(design.room, conferenceScreen.width, conferenceScreen.height, conferenceScreen.wall).heightMax} onCommit={height => changeConferenceScreen({ height })}/>
                        <DimensionInput label="Horizontal offset" value={conferenceScreen.x} min={-screenLimits(design.room, conferenceScreen.width, conferenceScreen.height, conferenceScreen.wall).xLimit} max={screenLimits(design.room, conferenceScreen.width, conferenceScreen.height, conferenceScreen.wall).xLimit} onCommit={x => changeConferenceScreen({ x })}/>
                        <DimensionInput label="Centre height" value={conferenceScreen.y} min={screenLimits(design.room, conferenceScreen.width, conferenceScreen.height, conferenceScreen.wall).yMin} max={screenLimits(design.room, conferenceScreen.width, conferenceScreen.height, conferenceScreen.wall).yMax} onCommit={y => changeConferenceScreen({ y })}/>
                      </div>
                    </>}
                  </RoomSettingsSection>
                  <RoomSettingsSection title="Floors">
                  <div className="finish-section"><span>Conference flooring</span>
                    <div className="floor-options">{conferenceFloors.map(finish => <button type="button" key={finish.name} className={design.room.floorName === finish.name ? "selected" : ""} onClick={() => updateRoom({ floorName: finish.name, floorColor: finish.color })}><i style={{ backgroundColor: finish.color, backgroundImage: `url(/materials/ambientcg/${finish.label}/Color.jpg)`, backgroundSize: "cover", backgroundPosition: "center" }}/><span>{finish.label}</span></button>)}</div>
                  </div>
                  </RoomSettingsSection>
                </>}
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
                    <button key={item.id} className={selectedId === item.id ? "active" : ""} onClick={() => { selectItem(item.id); if (isTouch) setEditMode(true); if (isPhone) setPanelOpen(false); }}>
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

        <div ref={sceneStageRef} className={`scene-stage ${isTouch ? "touch-scene" : ""} ${focusMode ? "is-focused" : ""}`}>
          <RoomScene
            cameraView={cameraView}
            lightingMode={lightingMode}
            editMode={editMode}
            showGrid={showGrid}
            zoomRequest={zoomRequest}
            room={design.room}
            placedItems={placedItems}
            trialModelUrls={trialModelUrls}
            selectedId={selectedId}
            onSelect={selectItem}
            onMove={moveItem}
            onStorageMove={position => updateRoom({ builtInStorage: { ...design.room.builtInStorage, enabled: true, width: design.room.builtInStorage?.width ?? 2, position } })}
            onScreenChange={changeConferenceScreen}
            onResize={(dimension, value) => updateRoom({ [dimension]: value })}
          />

          {design.room.presetId === "conference-room" && design.room.conferencePresentationWall && (
            <div className={`conference-screen-controls ${isPhone && panelOpen ? "behind-menu" : ""}`} role="group" aria-label="Screen stretch and wall controls">
              <div className="conference-screen-actions">
                <button type="button" onClick={() => { selectItem(null); setEditMode(true); setCameraView(`screen-${conferenceScreen.wall ?? "back"}`); }}><Maximize2 size={16} /> Stretch screen</button>
                <button type="button" onClick={() => {
                  const walls: WallSide[] = ["back", "right", "front", "left"];
                  const wall = walls[(walls.indexOf(conferenceScreen.wall ?? "back") + 1) % walls.length];
                  changeConferenceScreen({ wall, x: 0 });
                  selectItem(null); setEditMode(true); setCameraView(`screen-${wall}`);
                }}><RefreshCw size={16} /> Change wall</button>
              </div>
              <p>Pull a screen corner to stretch. Drag the screen to move.</p>
            </div>
          )}

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
              {selectedDecor?.mount === "floor" && <button type="button" className={showExactItem ? "active" : ""} aria-label="Type exact furniture dimensions" aria-expanded={showExactItem} onClick={() => setShowExactItem(open => !open)}><Ruler size={16}/><span className="selection-action-label">Exact size</span></button>}
              <div className="selection-move-controls" aria-label="Move selected item">
                <button onClick={() => moveSelected(-0.1, 0)} aria-label="Move left"><ArrowLeft size={15} /></button>
                <button onClick={() => moveSelected(0, -0.1)} aria-label={selectedDecor?.mount === "wall" ? "Move up" : "Move forward"}><ArrowUp size={15} /></button>
                <button onClick={() => moveSelected(0, 0.1)} aria-label={selectedDecor?.mount === "wall" ? "Move down" : "Move backward"}><ArrowDown size={15} /></button>
                <button onClick={() => moveSelected(0.1, 0)} aria-label="Move right"><ArrowRight size={15} /></button>
              </div>
              <button aria-label="Make copy of selected item" onClick={copySelected}><Copy size={17} /><span className="selection-action-label">Make copy</span></button>
              <button aria-label="Browse replacement items" onClick={() => browseFromSelected(true)}><RefreshCw size={17} /><span className="selection-action-label">Replace</span></button>
              <button aria-label="Browse complementary décor" onClick={() => browseFromSelected(false)}><PanelsTopLeft size={17} /><span className="selection-action-label">Goes with</span></button>
              <button aria-label={selectedDecor?.mount === "wall" ? "Move to next wall" : "Rotate selected item"} onClick={() => rotateItem(selectedId)}><RotateCcw size={17} /><span className="selection-action-label">{selectedDecor?.mount === "wall" ? "Next wall" : "Rotate"}</span></button>
              <button aria-label="Remove selected item" onClick={removeSelected} className="danger"><Trash2 size={17} /><span className="selection-action-label">Remove</span></button>
            </div>
          )}

          {showExactItem && selectedItem && selectedDecor?.mount === "floor" && (!isPhone || !panelOpen) && (
            <section className="exact-item-popover" aria-label="Exact furniture measurements">
              <div className="exact-item-heading">
                <strong>Exact measurements</strong>
                <button type="button" onClick={() => setShowExactItem(false)} aria-label="Close exact measurements"><X size={18}/></button>
              </div>
              <p>Type the measurements in metres. Changes apply on Enter or when you tap outside.</p>
              <div className="exact-item-fields">
                <DimensionInput key={selectedItem.id + "-width"} label="Width" value={selectedItem.size?.[0] ?? selectedDecor.width} min={.1} max={design.room.width} onCommit={width => resizeItem(selectedItem.id, [width, selectedItem.size?.[1] ?? selectedDecor.height, selectedItem.size?.[2] ?? selectedDecor.depth])}/>
                <DimensionInput key={selectedItem.id + "-depth"} label="Depth" value={selectedItem.size?.[2] ?? selectedDecor.depth} min={.1} max={design.room.depth} onCommit={depth => resizeItem(selectedItem.id, [selectedItem.size?.[0] ?? selectedDecor.width, selectedItem.size?.[1] ?? selectedDecor.height, depth])}/>
                <DimensionInput key={selectedItem.id + "-height"} label="Height" value={selectedItem.size?.[1] ?? selectedDecor.height} min={.1} max={design.room.height} onCommit={height => resizeItem(selectedItem.id, [selectedItem.size?.[0] ?? selectedDecor.width, height, selectedItem.size?.[2] ?? selectedDecor.depth])}/>
                <DimensionInput key={selectedItem.id + "-x"} label="Left / right" value={selectedItem.position[0]} min={-design.room.width / 2} max={design.room.width / 2} onCommit={x => moveItem(selectedItem.id, [x, selectedItem.position[1], selectedItem.position[2]])}/>
                <DimensionInput key={selectedItem.id + "-z"} label="Front / back" value={selectedItem.position[2]} min={-design.room.depth / 2} max={design.room.depth / 2 + (design.room.balcony?.enabled ? design.room.balcony.depth : 0) + (design.room.yard?.enabled ? design.room.yard.depth : 0)} onCommit={z => moveItem(selectedItem.id, [selectedItem.position[0], selectedItem.position[1], z])}/>
                <DimensionInput key={selectedItem.id + "-rotation"} label="Rotation" value={Number((selectedItem.rotation[1] * 180 / Math.PI).toFixed(3))} min={-360} max={360} unit="°" onCommit={degrees => rotateItem(selectedItem.id, degrees * Math.PI / 180 - selectedItem.rotation[1])}/>
              </div>
              <small>The model is resized proportionally along each dimension. The room boundaries automatically limit placement.</small>
            </section>
          )}

          {isTouch && !panelOpen && <div className="mobile-gesture-hint">{editMode ? "Drag items and floor handles to adjust" : "One finger to rotate · Pinch to zoom"}</div>}
          <div className="view-toolbar">
            {isTouch && <button className={editMode ? "active" : ""} aria-label={editMode ? "Switch to room navigation" : "Switch to moving items"} aria-pressed={editMode} onClick={() => setEditMode(value => !value)}><Armchair size={17} /><b className="mobile-mode-label">{editMode ? "Move" : "Orbit"}</b></button>}
            <button aria-label="3D view" className={cameraView === "perspective" ? "active" : ""} onClick={() => setCameraView("perspective")}><View size={18} /><span>3D view</span></button>
            <button aria-label="Top view" className={cameraView === "top" ? "active" : ""} onClick={() => setCameraView("top")}><Layers3 size={18} /><span>Top view</span></button>
            <button aria-label="Front view" className={cameraView === "front" ? "active" : ""} onClick={() => setCameraView("front")}><Armchair size={18} /><span>Front</span></button>
            <span className="toolbar-divider" />
            <button className={showGrid ? "active" : ""} onClick={() => setShowGrid((value) => !value)}><Grid3X3 size={18} /><span>Grid</span></button>
          </div>

          <div className="scene-lighting-control" role="group" aria-label="Room lighting preview" style={{position:"absolute",right:12,top:64,zIndex:5,display:"flex",gap:6,padding:5,borderRadius:12,background:"rgba(255,255,255,.94)",boxShadow:"0 2px 12px rgba(0,0,0,.09)"}}>
            <button type="button" aria-label="Preview daylight lighting" aria-pressed={lightingMode === "day"} onClick={() => setLightingMode("day")} style={{padding:"8px 12px",borderRadius:8,background:lightingMode==="day"?"#ddd9ca":"transparent",color:"#262626",minHeight:42}}><Sun size={16} style={{display:"inline-block",verticalAlign:"middle",marginRight:4}}/>Day</button>
            <button type="button" aria-label="Preview evening lighting" aria-pressed={lightingMode === "evening"} onClick={() => setLightingMode("evening")} style={{padding:"8px 12px",borderRadius:8,background:lightingMode==="evening"?"#ddd9ca":"transparent",color:"#262626",minHeight:42}}><Moon size={16} style={{display:"inline-block",verticalAlign:"middle",marginRight:4}}/>Evening</button>
          </div>
          <div className="zoom-controls">
            <button aria-label="Zoom in" onClick={() => requestZoom("in")}><span>+</span></button>
            <button aria-label="Zoom out" onClick={() => requestZoom("out")}><Minus size={17} /></button>
          </div>

          <button className="inspiration-button" onClick={() => { setActivePanel("decor"); setActiveDecorGroup("All"); setQuery(""); setPanelOpen(true); }}><Sparkles size={17} /> Design ideas</button>
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

      {pendingRoom && <RoomSwitchPrompt target={pendingRoom.name} error={roomSwitchError} onSave={saveAndSwitchRoom} onDiscard={() => performRoomSwitch(pendingRoom)} onCancel={cancelRoomSwitch} />}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
    </main>
  );
}
