import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "../state/store";

type ThemeMode = "light" | "dark";
type ToolbarSection = "history" | "view" | "grid" | "snap";
type ViewWheelTarget = "zoom" | "width" | "height" | null;

type ToolbarProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

const clampMm = (value: number) => Math.min(400, Math.max(50, value));
const clampZoom = (value: number) => Math.min(2, Math.max(0.25, value));

export const Toolbar = ({ theme, onToggleTheme }: ToolbarProps) => {
  const zoom = useAppStore((state) => state.zoom);
  const layout = useAppStore((state) => state.layout);
  const setZoom = useAppStore((state) => state.setZoom);
  const setCardSizeMm = useAppStore((state) => state.setCardSizeMm);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const pushHistory = useAppStore((state) => state.pushHistory);
  const jumpToHistoryBookmark = useAppStore((state) => state.jumpToHistoryBookmark);
  const deleteHistoryBookmark = useAppStore((state) => state.deleteHistoryBookmark);
  const historyBookmarks = useAppStore((state) => state.historyBookmarks);
  const pastCount = useAppStore((state) => state.past.length);
  const futureCount = useAppStore((state) => state.future.length);
  const gridEnabled = useAppStore((state) => state.gridEnabled);
  const rulersEnabled = useAppStore((state) => state.rulersEnabled);
  const snapEnabled = useAppStore((state) => state.snapEnabled);
  const gridIntensity = useAppStore((state) => state.gridIntensity);
  const showOnlyCmLines = useAppStore((state) => state.showOnlyCmLines);
  const debugOverlays = useAppStore((state) => state.debugOverlays);
  const rulersPlacement = useAppStore((state) => state.rulersPlacement);
  const toggleGrid = useAppStore((state) => state.toggleGrid);
  const toggleRulers = useAppStore((state) => state.toggleRulers);
  const toggleSnap = useAppStore((state) => state.toggleSnap);
  const setGridIntensity = useAppStore((state) => state.setGridIntensity);
  const toggleOnlyCmLines = useAppStore((state) => state.toggleOnlyCmLines);
  const toggleDebugOverlays = useAppStore((state) => state.toggleDebugOverlays);
  const setRulersPlacement = useAppStore((state) => state.setRulersPlacement);

  const [openSection, setOpenSection] = useState<ToolbarSection | null>(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("ui.toolbar.openSection") : null;
    return saved === "history" || saved === "view" || saved === "grid" || saved === "snap"
      ? saved
      : null;
  });
  const [viewWheelTarget, setViewWheelTarget] = useState<ViewWheelTarget>(null);
  const [selectedBookmarkId, setSelectedBookmarkId] = useState<string>("");
  const viewPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!historyBookmarks.length) {
      setSelectedBookmarkId("");
      return;
    }
    if (!historyBookmarks.some((bookmark) => bookmark.id === selectedBookmarkId)) {
      setSelectedBookmarkId(historyBookmarks[historyBookmarks.length - 1]?.id ?? "");
    }
  }, [historyBookmarks, selectedBookmarkId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (openSection) {
      window.localStorage.setItem("ui.toolbar.openSection", openSection);
    } else {
      window.localStorage.removeItem("ui.toolbar.openSection");
    }
  }, [openSection]);

  useEffect(() => {
    if (openSection !== "view") {
      setViewWheelTarget(null);
    }
  }, [openSection]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const node = viewPanelRef.current;
      if (!node || !node.contains(event.target as Node)) {
        setViewWheelTarget(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const applyZoomWheel = useCallback((deltaY: number) => {
    const direction = deltaY > 0 ? -1 : 1;
    setZoom(clampZoom(zoom + direction * 0.05));
  }, [zoom, setZoom]);

  const applyWidthWheel = useCallback((deltaY: number, shift: boolean) => {
    const direction = deltaY > 0 ? -1 : 1;
    const step = shift ? 10 : 1;
    setCardSizeMm(clampMm(layout.widthMm + direction * step), layout.heightMm);
  }, [layout.widthMm, layout.heightMm, setCardSizeMm]);

  const applyHeightWheel = useCallback((deltaY: number, shift: boolean) => {
    const direction = deltaY > 0 ? -1 : 1;
    const step = shift ? 10 : 1;
    setCardSizeMm(layout.widthMm, clampMm(layout.heightMm + direction * step));
  }, [layout.widthMm, layout.heightMm, setCardSizeMm]);

  const applyViewWheelDelta = useCallback((deltaY: number, shift: boolean) => {
    if (!viewWheelTarget) return;
    if (viewWheelTarget === "zoom") applyZoomWheel(deltaY);
    if (viewWheelTarget === "width") applyWidthWheel(deltaY, shift);
    if (viewWheelTarget === "height") applyHeightWheel(deltaY, shift);
  }, [viewWheelTarget, applyZoomWheel, applyWidthWheel, applyHeightWheel]);

  useEffect(() => {
    if (!viewWheelTarget) return;
    const onWindowWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      applyViewWheelDelta(event.deltaY, event.shiftKey);
    };
    window.addEventListener("wheel", onWindowWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWindowWheel, { capture: true });
  }, [viewWheelTarget, applyViewWheelDelta]);

  const toggleSection = (section: ToolbarSection) => {
    setOpenSection((prev) => (prev === section ? null : section));
  };

  const sectionButton = (section: ToolbarSection, label: string, icon: string) => (
    <button
      key={section}
      type="button"
      onClick={() => toggleSection(section)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        openSection === section
          ? "bg-sky-100 text-sky-800 dark:bg-slate-800 dark:text-sky-300"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800/70 dark:text-slate-200"
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2 shadow-soft dark:border-slate-800 dark:bg-slate-900/85">
      <div className="flex items-center gap-2">
        {sectionButton("history", "History", "↺")}
        {sectionButton("view", "View", "👁️")}
        {sectionButton("grid", "Grid & Rulers", "📏")}
        {sectionButton("snap", "Snap & Debug", "🧲")}
        <button
          type="button"
          onClick={() => setOpenSection(null)}
          className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
        >
          Свернуть всё
        </button>
      </div>

      <div className={`grid transition-all duration-200 ease-[cubic-bezier(.2,.8,.2,1)] ${openSection ? "mt-2 max-h-[340px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="overflow-hidden rounded-lg border border-slate-100 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/60">
          {openSection === "history" && (
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100"
                  onClick={undo}
                  disabled={pastCount === 0}
                  title="Отменить"
                  aria-label="Отменить"
                >
                  ↶
                </button>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-100"
                  onClick={redo}
                  disabled={futureCount === 0}
                  title="Повторить"
                  aria-label="Повторить"
                >
                  ↷
                </button>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200"
                  onClick={pushHistory}
                  title="Снимок истории"
                  aria-label="Снимок истории"
                >
                  📸
                </button>
                <div className="ml-1 text-[11px] text-slate-500 dark:text-slate-300">
                  События: {historyBookmarks.length}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                <div className="mb-1 text-[11px] text-slate-500 dark:text-slate-300">
                  ID снимка (по времени):
                </div>
                <select
                  size={Math.min(5, Math.max(2, historyBookmarks.length || 2))}
                  value={selectedBookmarkId}
                  onChange={(event) => setSelectedBookmarkId(event.target.value)}
                  className="h-24 w-full rounded border border-slate-200 bg-white p-1 text-[11px] dark:border-slate-700 dark:bg-slate-900"
                >
                  {historyBookmarks.map((bookmark, index) => (
                    <option key={bookmark.id} value={bookmark.id}>
                      #{index + 1} · {new Date(bookmark.createdAt).toLocaleString()} · {bookmark.action}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex gap-2">
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-xs text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
                    title="Перейти к состоянию проекта"
                    aria-label="Перейти к состоянию проекта"
                    disabled={!selectedBookmarkId}
                    onClick={() => {
                      if (selectedBookmarkId) {
                        jumpToHistoryBookmark(selectedBookmarkId);
                      }
                    }}
                  >
                    ⏪
                  </button>
                  <button
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-rose-200 text-xs text-rose-600 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300"
                    title="Удалить снимок"
                    aria-label="Удалить снимок"
                    disabled={!selectedBookmarkId}
                    onClick={() => {
                      if (selectedBookmarkId) {
                        deleteHistoryBookmark(selectedBookmarkId);
                      }
                    }}
                  >
                    🗑
                  </button>
                  <span className="self-center text-[11px] text-slate-400 dark:text-slate-500">
                    Выберите ID и примените действие
                  </span>
                </div>
              </div>
            </div>
          )}

          {openSection === "view" && (
            <div
              ref={viewPanelRef}
              className="grid gap-2"
              onWheelCapture={(event) => {
                if (!viewWheelTarget) return;
                event.preventDefault();
                event.stopPropagation();
              }}
              onWheel={(event) => {
                if (!viewWheelTarget) return;
                event.preventDefault();
                event.stopPropagation();
                applyViewWheelDelta(event.deltaY, event.shiftKey);
              }}
            >
              <button type="button" className="text-left text-xs text-slate-600 dark:text-slate-200" onClick={() => setViewWheelTarget("zoom")}>Масштаб: {Math.round(zoom * 100)}%</button>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={zoom}
                onFocus={() => setViewWheelTarget("zoom")}
                onBlur={() => setViewWheelTarget(null)}
                onPointerEnter={() => setViewWheelTarget("zoom")}
                onChange={(event) => setZoom(Number(event.target.value))}
                onWheel={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  applyZoomWheel(event.deltaY);
                }}
              />
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" onClick={() => setZoom(1)}>Центр · 100%</button>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-300">
                  <button type="button" className="text-left" onClick={() => setViewWheelTarget("width")}>Card Width (mm)</button>
                  <input
                    type="number"
                    min={50}
                    max={400}
                    step={1}
                    value={layout.widthMm}
                    onFocus={() => setViewWheelTarget("width")}
                    onBlur={() => setViewWheelTarget(null)}
                    onPointerEnter={() => setViewWheelTarget("width")}
                    onChange={(event) => setCardSizeMm(clampMm(Number(event.target.value)), layout.heightMm)}
                    onWheel={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      applyWidthWheel(event.deltaY, event.shiftKey);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <label className="text-[11px] text-slate-500 dark:text-slate-300">
                  <button type="button" className="text-left" onClick={() => setViewWheelTarget("height")}>Card Height (mm)</button>
                  <input
                    type="number"
                    min={50}
                    max={400}
                    step={1}
                    value={layout.heightMm}
                    onFocus={() => setViewWheelTarget("height")}
                    onBlur={() => setViewWheelTarget(null)}
                    onPointerEnter={() => setViewWheelTarget("height")}
                    onChange={(event) => setCardSizeMm(layout.widthMm, clampMm(Number(event.target.value)))}
                    onWheel={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      applyHeightWheel(event.deltaY, event.shiftKey);
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
              </div>
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" onClick={onToggleTheme}>
                {theme === "light" ? "☀️ Светлая" : "🌙 Тёмная"}
              </button>
            </div>
          )}

          {openSection === "grid" && (
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input type="checkbox" checked={gridEnabled} onChange={toggleGrid} />Сетка</label>
              <select value={gridIntensity} onChange={(event) => setGridIntensity(event.target.value as "low" | "medium" | "high")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value="low">Сетка: Мягкая</option>
                <option value="medium">Сетка: Нормальная</option>
                <option value="high">Сетка: Контрастная</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input type="checkbox" checked={showOnlyCmLines} onChange={toggleOnlyCmLines} />Только см</label>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input type="checkbox" checked={rulersEnabled} onChange={toggleRulers} />Линейки</label>
              <select value={rulersPlacement} onChange={(event) => setRulersPlacement(event.target.value as "outside" | "inside")} className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900">
                <option value="outside">Линейки: Снаружи</option>
                <option value="inside">Линейки: Внутри</option>
              </select>
            </div>
          )}

          {openSection === "snap" && (
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input type="checkbox" checked={snapEnabled} onChange={toggleSnap} />Привязка</label>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input type="checkbox" checked={debugOverlays} onChange={toggleDebugOverlays} />Отладка</label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
