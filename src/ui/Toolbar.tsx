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

  const [openSection, setOpenSection] = useState<ToolbarSection>(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("ui.toolbar.openSection") : null;
    return saved === "history" || saved === "view" || saved === "grid" || saved === "snap"
      ? saved
      : "view";
  });

  const historyRef = useRef<HTMLButtonElement | null>(null);
  const viewRef = useRef<HTMLButtonElement | null>(null);
  const gridRef = useRef<HTMLInputElement | null>(null);
  const snapRef = useRef<HTMLInputElement | null>(null);
  const viewPanelRef = useRef<HTMLDivElement | null>(null);
  const [viewWheelTarget, setViewWheelTarget] = useState<ViewWheelTarget>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("ui.toolbar.openSection", openSection);
    window.requestAnimationFrame(() => {
      if (openSection === "history") historyRef.current?.focus();
      if (openSection === "view") viewRef.current?.focus();
      if (openSection === "grid") gridRef.current?.focus();
      if (openSection === "snap") snapRef.current?.focus();
    });
  }, [openSection]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const node = viewPanelRef.current;
      if (!node) return;
      if (node.contains(event.target as Node)) return;
      setViewWheelTarget(null);
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
    if (!viewWheelTarget) {
      return;
    }
    if (viewWheelTarget === "zoom") applyZoomWheel(deltaY);
    if (viewWheelTarget === "width") applyWidthWheel(deltaY, shift);
    if (viewWheelTarget === "height") applyHeightWheel(deltaY, shift);
  }, [viewWheelTarget, applyZoomWheel, applyWidthWheel, applyHeightWheel]);

  useEffect(() => {
    if (!viewWheelTarget) {
      return;
    }
    const onWindowWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      applyViewWheelDelta(event.deltaY, event.shiftKey);
    };
    window.addEventListener("wheel", onWindowWheel, { passive: false, capture: true });
    return () => window.removeEventListener("wheel", onWindowWheel, { capture: true });
  }, [viewWheelTarget, applyViewWheelDelta]);

  const sectionHeader = (label: string, section: ToolbarSection, icon: string) => (
    <button
      type="button"
      aria-expanded={openSection === section}
      aria-controls={`toolbar-${section}`}
      className={[
        "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold transition",
        openSection === section
          ? "bg-sky-50 text-sky-700 dark:bg-slate-800 dark:text-sky-300"
          : "text-slate-600 dark:text-slate-200"
      ].join(" ")}
      onClick={() => setOpenSection(section)}
    >
      <span>{icon} {label}</span>
      <span className={`transition-transform duration-200 ${openSection === section ? "rotate-180" : "rotate-0"}`}>▾</span>
    </button>
  );

  return (
    <div
      className="rounded-2xl bg-white px-4 py-3 shadow-soft dark:bg-slate-900/80"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setOpenSection("view");
        }
      }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {sectionHeader("History", "history", "↺")}
          <div id="toolbar-history" className={`grid overflow-hidden transition-all duration-200 ${openSection === "history" ? "mt-2 max-h-44 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="grid gap-2">
              <button ref={historyRef} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100" onClick={undo}>Отменить</button>
              <button className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100" onClick={redo}>Повторить</button>
              <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" onClick={pushHistory} title="Добавить текущий state в историю для Undo/Redo">Снимок истории</button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {sectionHeader("View", "view", "👁️")}
          <div id="toolbar-view" className={`grid overflow-hidden transition-all duration-200 ${openSection === "view" ? "mt-2 max-h-80 opacity-100" : "max-h-0 opacity-0"}`}>
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
              <button
                type="button"
                className="text-left text-xs text-slate-600 dark:text-slate-200"
                onClick={() => {
                  setViewWheelTarget("zoom");
                }}
                onPointerEnter={() => {
                  setViewWheelTarget("zoom");
                }}
              >Масштаб: {Math.round(zoom * 100)}%</button>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={zoom}
                onFocus={() => { setViewWheelTarget("zoom"); }}
                onBlur={() => { setViewWheelTarget(null); }}
                onPointerEnter={() => { setViewWheelTarget("zoom"); }}
                onPointerLeave={() => { setViewWheelTarget(null); }}
                onChange={(event) => setZoom(Number(event.target.value))}
                onWheel={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  applyZoomWheel(event.deltaY);
                }}
              />
              <button ref={viewRef} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" onClick={() => setZoom(1)}>Центр · 100%</button>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-300">
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      setViewWheelTarget("width");
                    }}
                    onPointerEnter={() => {
                      setViewWheelTarget("width");
                    }}
                    onPointerLeave={() => {
                      setViewWheelTarget(null);
                    }}
                  >Card Width (mm)</button>
                  <input
                    type="number"
                    min={50}
                    max={400}
                    step={1}
                    value={layout.widthMm}
                    onFocus={() => { setViewWheelTarget("width"); }}
                    onBlur={() => { setViewWheelTarget(null); }}
                    onPointerEnter={() => { setViewWheelTarget("width"); }}
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
                  <button
                    type="button"
                    className="text-left"
                    onClick={() => {
                      setViewWheelTarget("height");
                    }}
                    onPointerEnter={() => {
                      setViewWheelTarget("height");
                    }}
                    onPointerLeave={() => {
                      setViewWheelTarget(null);
                    }}
                  >Card Height (mm)</button>
                  <input
                    type="number"
                    min={50}
                    max={400}
                    step={1}
                    value={layout.heightMm}
                    onFocus={() => { setViewWheelTarget("height"); }}
                    onBlur={() => { setViewWheelTarget(null); }}
                    onPointerEnter={() => { setViewWheelTarget("height"); }}
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
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {sectionHeader("Grid & Rulers", "grid", "📏")}
          <div id="toolbar-grid" className={`grid overflow-hidden transition-all duration-200 ${openSection === "grid" ? "mt-2 max-h-80 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input ref={gridRef} type="checkbox" checked={gridEnabled} onChange={toggleGrid} />Сетка</label>
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
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          {sectionHeader("Snap & Debug", "snap", "🧲")}
          <div id="toolbar-snap" className={`grid overflow-hidden transition-all duration-200 ${openSection === "snap" ? "mt-2 max-h-44 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="grid gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input ref={snapRef} type="checkbox" checked={snapEnabled} onChange={toggleSnap} />Привязка</label>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-200"><input type="checkbox" checked={debugOverlays} onChange={toggleDebugOverlays} />Отладка</label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
