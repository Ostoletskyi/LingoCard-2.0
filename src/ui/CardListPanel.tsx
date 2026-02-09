import { useMemo, useState } from "react";
import { useAppStore, type ListSide } from "../state/store";
import { exportCardsToJson, importCardsFromJson, importInfinitivesText } from "../io/importExport";

type Props = {
  side: ListSide;
};

export const CardListPanel = ({ side }: Props) => {
  const [filter, setFilter] = useState("");
  const cards = useAppStore((state) => (side === "A" ? state.cardsA : state.cardsB));
  const selectCard = useAppStore((state) => state.selectCard);
  const addCard = useAppStore((state) => state.addCard);
  const moveCard = useAppStore((state) => state.moveCard);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return cards;
    return cards.filter((card) => {
      const haystack = [
        card.inf,
        card.tr_1_ru,
        card.tr_2_ru,
        card.tr_3_ru,
        card.tr_4_ru,
        ...card.tags
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [cards, filter]);

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = importCardsFromJson(text);
    if (imported.cards.length) {
      imported.cards.forEach((card) => addCard(card, side));
    }
    event.target.value = "";
  };

  const handleTextImport = async () => {
    const text = prompt("Введите инфинитивы через новую строку");
    if (!text) return;
    const cardsFromText = importInfinitivesText(text);
    cardsFromText.forEach((card) => addCard(card, side));
  };

  const handleExport = () => {
    const blob = exportCardsToJson(cards);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cards_${side}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="rounded-lg bg-white p-3 shadow flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">List {side}</h2>
        <span className="text-xs text-slate-500">{cards.length} cards</span>
      </div>
      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Поиск"
        className="border rounded px-2 py-1 text-sm"
      />
      <div className="flex flex-wrap gap-2 text-xs">
        <label className="cursor-pointer">
          <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          <span className="px-2 py-1 rounded bg-slate-200">Import JSON</span>
        </label>
        <button onClick={handleTextImport} className="px-2 py-1 rounded bg-slate-200">
          Import TXT
        </button>
        <button onClick={handleExport} className="px-2 py-1 rounded bg-slate-200">
          Export
        </button>
      </div>
      <div className="flex-1 overflow-auto border rounded p-2 text-sm space-y-2">
        {filtered.map((card) => (
          <div
            key={card.id}
            className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-slate-50"
          >
            <button
              onClick={() => selectCard(card.id, side)}
              className="flex-1 text-left"
            >
              <div className="font-medium">{card.inf || "(без названия)"}</div>
              <div className="text-xs text-slate-500">{card.tr_1_ru}</div>
            </button>
            <button
              onClick={() => moveCard(card.id, side)}
              className="text-xs text-blue-600"
            >
              →
            </button>
          </div>
        ))}
        {!filtered.length && <p className="text-xs text-slate-400">Нет карточек</p>}
      </div>
    </div>
  );
};
