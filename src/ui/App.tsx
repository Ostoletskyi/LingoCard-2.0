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
      return "Выберите карточку для редактирования";
    }
    return `Активная карточка: ${selectedId} (${selectedSide})`;
  }, [selectedId, selectedSide]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-5">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">LingoCard 2.0</h1>
          <p className="text-sm text-slate-500">
            Дневной редактор карточек немецких глаголов
          </p>
        </div>
        <div className="rounded-full bg-white px-4 py-2 text-xs text-slate-500 shadow-soft">
          {headline}
        </div>
      </header>
      <div className="grid grid-cols-[300px_1fr_300px] gap-6">
        <CardListPanel side="A" />
        <div className="flex flex-col gap-6">
          <Toolbar />
          <div className="rounded-2xl bg-white p-5 shadow-soft">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Рабочая область</h2>
                <p className="text-sm text-slate-500">
                  Настройте расположение элементов карточки
                </p>
              </div>
            </div>
            <EditorCanvas />
          </div>
          <AiControlPanel />
        </div>
        <CardListPanel side="B" />
      </div>
    </div>
  );
};
