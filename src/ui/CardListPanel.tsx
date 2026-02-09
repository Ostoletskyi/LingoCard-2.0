import { useMemo, useState } from "react";
import type React from "react";
import { useAppStore, type ListSide } from "../state/store";
import {
  exportCardsToJson,
  importInfinitivesText,
  validateCardsImport,
  type ImportErrorLog
} from "../io/importExport";
import { normalizeCard } from "../model/cardSchema";
import { exportCardsToPdf } from "../pdf/exportPdf";

type Props = {
  side: ListSide;
};

export const CardListPanel = ({ side }: Props) => {
  const [filter, setFilter] = useState("");
  const cards = useAppStore((state) => (side === "A" ? state.cardsA : state.cardsB));
  const selectCard = useAppStore((state) => state.selectCard);
  const addCard = useAppStore((state) => state.addCard);
  const moveCard = useAppStore((state) => state.moveCard);
  const startExport = useAppStore((state) => state.startExport);
  const finishExport = useAppStore((state) => state.finishExport);
  const isExporting = useAppStore((state) => state.isExporting);
  const selectedId = useAppStore((state) => state.selectedId);
  const selectedSide = useAppStore((state) => state.selectedSide);
  const selectedCardIds = useAppStore((state) =>
    side === "A" ? state.selectedCardIdsA : state.selectedCardIdsB
  );
  const selectedCardIdsSet = useMemo(() => new Set(selectedCardIds), [selectedCardIds]);
  const toggleCardSelection = useAppStore((state) => state.toggleCardSelection);
  const selectAllCards = useAppStore((state) => state.selectAllCards);
  const clearCardSelection = useAppStore((state) => state.clearCardSelection);
  const layout = useAppStore((state) => state.layout);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importErrorLog, setImportErrorLog] = useState<ImportErrorLog | null>(null);
  const [importModalType, setImportModalType] = useState<"error" | "warning" | null>(null);

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
    startExport("Импорт...");
    const text = await file.text();
    const validation = validateCardsImport(text, { fileName: file.name, size: file.size });
    if (validation.status === "error") {
      finishExport();
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
    finishExport();
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

  const handlePdfExport = (mode: "current" | "selected" | "all") => {
    const list = cards;
    let exportCards = list;
    let suffix = "all";
    if (mode === "current") {
      const active = list.find((card) => card.id === selectedId);
      if (!active) return;
      exportCards = [active];
      suffix = `current_${active.id}`;
    }
    if (mode === "selected") {
      const selected = list.filter((card) => selectedCardIdsSet.has(card.id));
      if (!selected.length) return;
      exportCards = selected;
      suffix = `selected_${selected.length}`;
    }
    const fileName = `LingoCard_${side}_${suffix}.pdf`;
    startExport("Экспорт PDF");
    exportCardsToPdf(exportCards, layout, {
      cardsPerRow: 1,
      cardsPerColumn: 1,
      marginMm: 5
    }, fileName);
    finishExport();
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

  const downloadSample = () => {
    const sample = normalizeCard({
      inf: "machen",
      tr_1_ru: "делать",
      tags: ["praesens"]
    });
    const blob = new Blob([JSON.stringify({ cards: [sample] }, null, 2)], {
      type: "application/json"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lingocard_sample.json";
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
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          + Новая карточка
        </button>
        <label className="cursor-pointer">
          <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
          <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition">
            Импорт JSON
          </span>
        </label>
        <button
          onClick={downloadSample}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:text-slate-700"
        >
          Пример файла
        </button>
        <button
          onClick={handleTextImport}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition"
        >
          Импорт TXT
        </button>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition disabled:opacity-50"
        >
          Экспорт
        </button>
        <button
          onClick={() => handlePdfExport("current")}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:text-slate-700"
        >
          PDF: Текущая
        </button>
        <button
          onClick={() => handlePdfExport("selected")}
          disabled={selectedCardIds.length === 0}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:text-slate-700 disabled:opacity-50"
        >
          PDF: Выбранные
        </button>
        <button
          onClick={() => handlePdfExport("all")}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border border-slate-200 text-slate-500 hover:text-slate-700"
        >
          PDF: Все
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <button
          onClick={() => selectAllCards(side)}
          className="inline-flex items-center justify-center px-2 py-1 rounded-full border border-slate-200"
        >
          Выделить всё
        </button>
        <button
          onClick={() => clearCardSelection(side)}
          className="inline-flex items-center justify-center px-2 py-1 rounded-full border border-slate-200"
        >
          Снять выделение
        </button>
      </div>
      <div className="flex-1 overflow-auto rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-sm space-y-3 dark:border-slate-800 dark:bg-slate-900/60">
        {importNotice && (
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span>{importNotice}</span>
              {importWarnings.length > 0 && (
                <button
                  onClick={() => {
                    setImportModalType("warning");
                    setImportErrorLog({
                      timestamp: new Date().toISOString(),
                      errorCode: "INVALID_FORMAT",
                      humanSummary: "Есть предупреждения по импортированным карточкам.",
                      technicalDetails: importWarnings.join("; ")
                    });
                  }}
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500"
                >
                  Подробнее
                </button>
              )}
            </div>
          </div>
        )}
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
            <input
              type="checkbox"
              checked={selectedCardIdsSet.has(card.id)}
              onChange={() => toggleCardSelection(card.id, side)}
              className="h-4 w-4"
            />
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
