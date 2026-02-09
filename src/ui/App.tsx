import { useMemo } from "react";
import { useAppStore } from "../state/store";
import { CardListPanel } from "./CardListPanel";
import { EditorCanvas } from "./EditorCanvas";
import { Toolbar } from "./Toolbar";
import { AiControlPanel } from "./AiControlPanel";

export const App = () => {
  const { selectedId, selectedSide } = useAppStore();

  const headline = useMemo(() => {
    if (!selectedId) {
      return "Выберите карточку";
    }
    return `Активная карточка: ${selectedId} (${selectedSide})`;
  }, [selectedId, selectedSide]);

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl font-semibold mb-4">LingoCard 2.0</h1>
      <div className="grid grid-cols-[280px_1fr_280px] gap-4">
        <CardListPanel side="A" />
        <div className="flex flex-col gap-4">
          <Toolbar />
          <div className="rounded-lg bg-white p-3 shadow">
            <p className="text-sm text-slate-500">{headline}</p>
            <EditorCanvas />
          </div>
          <AiControlPanel />
        </div>
        <CardListPanel side="B" />
      </div>
    </div>
  );
};
