import { useMemo, useState } from "react";
import type React from "react";
import { useAppStore, type ListSide } from "../state/store";
import {
  exportCardsToJson,
  importCardsFromJson,
  importInfinitivesText,
  validateCardsImport,
  type ImportErrorLog
} from "../io/importExport";

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
    const validation = validateCardsImport(text, { fileName: file.name, size: file.size });
    if (validation.status === "error") {
      setImportModalType("error");
      setImportErrorLog(validation.errorLog ?? null);
      event.target.value = "";
      return;
    }
    setImportErrorLog(null);
    setImportModalType(null);
    validation.cards.forEach((card) => addCard(card, side));
    setImportWarnings(validation.warnings);
    setImportNotice(
      validation.status === "warning"
        ? `Импортировано: ${validation.cards.length}. Есть предупреждения.`
        : `Импортировано: ${validation.cards.length} карточек.`
    );
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
    startExport("Экспорт JSON");
    const blob = exportCardsToJson(cards);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cards_${side}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setTimeout(() => {
      finishExport();
      setImportNotice("Экспорт завершён.");
    }, 600);
  };

  const downloadImportLog = () => {
    if (!importErrorLog) return;
    const blob = new Blob([JSON.stringify(importErrorLog, null, 2)], {
      type: "application/json"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "import_error_log.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-soft flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">List {side}</h2>
          <p className="text-xs text-slate-400">{cards.length} карточек</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
          Коллекция {side}
        </span>
      </div>
      <input
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Поиск"
        className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
      <div className="flex flex-wrap gap-2 text-xs text-slate-600">
        <label className="cursor-pointer">
          <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          <span className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition">
            Import JSON
          </span>
        </label>
        <button
          onClick={handleTextImport}
          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition"
        >
          Import TXT
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition"
        >
          Export
        </button>
      </div>
      <div className="flex-1 overflow-auto rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-sm space-y-3">
        {filtered.map((card) => (
          <div
            key={card.id}
            className={[
              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition",
              selectedId === card.id && selectedSide === side
                ? "border-sky-200 bg-sky-50 shadow-sm"
                : "border-transparent bg-white hover:border-slate-100 hover:shadow-sm"
            ].join(" ")}
          >
            <button
              onClick={() => selectCard(card.id, side)}
              className="flex-1 text-left"
            >
              <div className="text-sm font-semibold text-slate-800">
                {card.inf || "(без названия)"}
              </div>
              <div className="text-xs text-slate-500">{card.tr_1_ru || "Перевод пока пуст"}</div>
            </button>
            <button
              onClick={() => moveCard(card.id, side)}
              title="Перенести в другой список"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              →
            </button>
          </div>
        ))}
        {!filtered.length && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-slate-400">
            Карточек пока нет. Импортируйте список или создайте новую.
          </div>
        )}
      </div>
      {importErrorLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {importModalType === "warning"
                ? "Импорт завершён с предупреждениями"
                : "Не удалось импортировать файл"}
            </h3>
            <div className="mt-3 text-sm text-slate-500 dark:text-slate-300">
              <div>Файл: {importErrorLog.fileName ?? "неизвестно"}</div>
              {importErrorLog.size ? <div>Размер: {importErrorLog.size} bytes</div> : null}
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-200">
              {importErrorLog.humanSummary}
            </div>
            {importErrorLog.technicalDetails && (
              <div className="mt-3 text-xs text-slate-400">
                Детали: {importErrorLog.technicalDetails}
              </div>
            )}
            <div className="mt-3 text-xs text-slate-400">
              Проверьте, что файл содержит массив карточек или объект с ключом cards.
            </div>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={downloadImportLog}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                Скачать лог
              </button>
              <button
                onClick={() => {
                  setImportErrorLog(null);
                  setImportModalType(null);
                }}
                className="rounded-full bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
