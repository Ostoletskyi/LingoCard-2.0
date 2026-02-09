import { useAppStore } from "../state/store";

type ThemeMode = "light" | "dark";

type ToolbarProps = {
  theme: ThemeMode;
  onToggleTheme: () => void;
};

export const Toolbar = ({ theme, onToggleTheme }: ToolbarProps) => {
  const zoom = useAppStore((state) => state.zoom);
  const setZoom = useAppStore((state) => state.setZoom);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const pushHistory = useAppStore((state) => state.pushHistory);
  const gridEnabled = useAppStore((state) => state.gridEnabled);
  const rulersEnabled = useAppStore((state) => state.rulersEnabled);
  const snapEnabled = useAppStore((state) => state.snapEnabled);
  const gridIntensity = useAppStore((state) => state.gridIntensity);
  const showOnlyCmLines = useAppStore((state) => state.showOnlyCmLines);
  const debugOverlays = useAppStore((state) => state.debugOverlays);
  const toggleGrid = useAppStore((state) => state.toggleGrid);
  const toggleRulers = useAppStore((state) => state.toggleRulers);
  const toggleSnap = useAppStore((state) => state.toggleSnap);
  const setGridIntensity = useAppStore((state) => state.setGridIntensity);
  const toggleOnlyCmLines = useAppStore((state) => state.toggleOnlyCmLines);
  const toggleDebugOverlays = useAppStore((state) => state.toggleDebugOverlays);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 shadow-soft dark:bg-slate-900/80">
      <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-800">
        <span className="text-xs font-semibold text-slate-500">История</span>
        <button
          className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={undo}
        >
          Отменить
        </button>
        <button
          className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={redo}
        >
          Повторить
        </button>
      </div>
      <div className="flex items-center gap-3 rounded-full bg-slate-50 px-3 py-2 dark:bg-slate-800">
        <span className="text-xs font-semibold text-slate-500">Вид</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Масштаб</span>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <span className="text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
        </div>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={gridEnabled} onChange={toggleGrid} />
          Сетка
        </label>
        <select
          value={gridIntensity}
          onChange={(event) => setGridIntensity(event.target.value as "low" | "medium" | "high")}
          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <option value="low">Сетка: Низкая</option>
          <option value="medium">Сетка: Средняя</option>
          <option value="high">Сетка: Высокая</option>
        </select>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={showOnlyCmLines} onChange={toggleOnlyCmLines} />
          Только см
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={rulersEnabled} onChange={toggleRulers} />
          Линейки
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} />
          Привязка
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={debugOverlays} onChange={toggleDebugOverlays} />
          Отладка
        </label>
        <button
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
          onClick={() => setZoom(1)}
        >
          Центр · 100%
        </button>
      </div>
      <div className="flex items-center gap-2 border-l border-slate-100 pl-3 dark:border-slate-700">
        <button
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300"
          onClick={pushHistory}
        >
          Снимок
        </button>
      </div>
      <div className="flex items-center gap-2 border-l border-slate-100 pl-3 dark:border-slate-700">
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
        >
          <span>{theme === "light" ? "☀️" : "🌙"}</span>
          {theme === "light" ? "Светлая" : "Тёмная"}
        </button>
      </div>
    </div>
  );
};
