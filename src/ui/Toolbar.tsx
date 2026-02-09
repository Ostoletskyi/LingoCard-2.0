import { useAppStore } from "../state/store";

export const Toolbar = () => {
  const zoom = useAppStore((state) => state.zoom);
  const setZoom = useAppStore((state) => state.setZoom);
  const undo = useAppStore((state) => state.undo);
  const redo = useAppStore((state) => state.redo);
  const pushHistory = useAppStore((state) => state.pushHistory);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white p-3 shadow">
      <button className="px-2 py-1 rounded bg-slate-200" onClick={undo}>
        Undo
      </button>
      <button className="px-2 py-1 rounded bg-slate-200" onClick={redo}>
        Redo
      </button>
      <div className="flex items-center gap-2">
        <label className="text-sm">Zoom</label>
        <input
          type="range"
          min={0.25}
          max={2}
          step={0.05}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
        />
        <span className="text-sm">{Math.round(zoom * 100)}%</span>
      </div>
      <button
        className="px-2 py-1 rounded bg-slate-200"
        onClick={pushHistory}
      >
        Snapshot
      </button>
    </div>
  );
};
