import { useAppStore } from "../state/store";

export const Toolbar = () => {
  const zoom = useAppStore((state) => state.zoom);
  const setZoom = useAppStore((state) => state.setZoom);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const pushHistory = useAppStore((state) => state.pushHistory);
  const gridEnabled = useAppStore((state) => state.gridEnabled);
  const rulersEnabled = useAppStore((state) => state.rulersEnabled);
  const snapEnabled = useAppStore((state) => state.snapEnabled);
  const toggleGrid = useAppStore((state) => state.toggleGrid);
  const toggleRulers = useAppStore((state) => state.toggleRulers);
  const toggleSnap = useAppStore((state) => state.toggleSnap);

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">История</span>
        <button
          className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-100"
          onClick={undo}
        >
          Undo
        </button>
        <button
          className="rounded-full bg-white px-3 py-1 text-xs text-slate-700 shadow-sm hover:bg-slate-100"
          onClick={redo}
        >
          Redo
        </button>
      </div>
      <div className="flex items-center gap-3 rounded-full bg-slate-50 px-3 py-2">
        <span className="text-xs font-semibold text-slate-500">Вид</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Zoom</span>
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
          Grid
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={rulersEnabled} onChange={toggleRulers} />
          Rulers
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} />
          Snap
        </label>
      </div>
      <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
        <button
          className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
          onClick={pushHistory}
        >
          Snapshot
        </button>
      </div>
    </div>
  );
};
