import { useMemo, useState } from "react";
import type React from "react";
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
  const selectedId = useAppStore((state) => state.selectedId);
  const selectedSide = useAppStore((state) => state.selectedSide);

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

  const handleCreate = () => {
    addCard({ inf: "" }, side);
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
    <div className="rounded-2xl bg-white p-4 shadow-soft flex flex-col gap-3 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Коллекция {side}
          </p>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Карточки</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">{cards.length} карточек</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          Список {side}
        </span>
      </div>
      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Поиск"
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900/60"
      />
      <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
        <button
          onClick={handleCreate}
          className="px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          + Новая карточка
        </button>
        <label className="cursor-pointer">
          <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          <span className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition">
            Импорт JSON
          </span>
        </label>
        <button
          onClick={handleTextImport}
          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition"
        >
          Импорт TXT
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition"
        >
          Экспорт
        </button>
      </div>
      <div className="flex-1 overflow-auto rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-sm space-y-3 dark:border-slate-800 dark:bg-slate-900/60">
        {filtered.map((card) => (
          <div
            key={card.id}
            className={[
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition",
              selectedId === card.id && selectedSide === side
                ? "border-sky-200 bg-sky-50 shadow-sm dark:border-sky-700 dark:bg-slate-800"
                : "border-transparent bg-white hover:border-slate-100 hover:shadow-sm dark:bg-slate-900 dark:hover:border-slate-700"
            ].join(" ")}
          >
            <button
              onClick={() => selectCard(card.id, side)}
              className="flex-1 text-left"
            >
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {card.inf || "(без названия)"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {card.tr_1_ru || "Перевод пока пуст"}
              </div>
            </button>
            <button
              onClick={() => moveCard(card.id, side)}
              title="Перенести в другой список"
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              →
            </button>
          </div>
        ))}
        {!filtered.length && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
            <div className="text-lg">📘</div>
            <div className="mt-2 font-semibold text-slate-600 dark:text-slate-200">
              Коллекция пока пуста
            </div>
            <div className="mt-1">
              Импортируйте JSON/TXT или нажмите «Новая карточка».
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Поддерживаются форматы: JSON, TXT (по одному инфинитиву в строке).
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
