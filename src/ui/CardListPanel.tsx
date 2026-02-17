import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useAppStore, type ListSide } from "../state/store";
import {
  exportCardsToJson,
  importInfinitivesText,
  validateCardsImport,
  type ImportErrorLog
} from "../io/importExport";
import { exportCardsToPdf } from "../pdf/exportPdf";

type Props = {
  side: ListSide;
};

export const CardListPanel = ({ side }: Props) => {
  type SidebarSection = "data" | "selection" | "export";
  const [filter, setFilter] = useState("");
  const storageKey = side === "A" ? "ui.sidebarA.openSection" : "ui.sidebarB.openSection";
  const cardsCollapsedKey = side === "A" ? "ui.cardsPanel.collapsed.left" : "ui.cardsPanel.collapsed.right";
  const [openSection, setOpenSection] = useState<SidebarSection>(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;
    return saved === "data" || saved === "selection" || saved === "export" ? saved : "data";
  });
  const [cardsPanelCollapsed, setCardsPanelCollapsed] = useState<boolean>(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(cardsCollapsedKey) : null;
    return saved === "true";
  });
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
  const autoLayoutAllCards = useAppStore((state) => state.autoLayoutAllCards);
  const addBlockToCard = useAppStore((state) => state.addBlockToCard);
  const removeSelectedBoxFromCard = useAppStore((state) => state.removeSelectedBoxFromCard);
  const applyCardFormattingToCards = useAppStore((state) => state.applyCardFormattingToCards);
  const applyAutoHeightToCards = useAppStore((state) => state.applyAutoHeightToCards);
  const layout = useAppStore((state) => state.layout);
  const selectedBoxId = useAppStore((state) => state.selectedBoxId);
  const editModeEnabled = useAppStore((state) => state.editModeEnabled);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importErrorLog, setImportErrorLog] = useState<ImportErrorLog | null>(null);
  const [importModalType, setImportModalType] = useState<"error" | "warning" | null>(null);
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const blockMenuRef = useRef<HTMLDivElement | null>(null);
  const buttonBase =
    "lc-btnOutline inline-flex items-center justify-center text-center rounded-lg px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-sky-200";
  const buttonSolid =
    "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200";
  const buttonLight =
    "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";
  const buttonGhost =
    "border border-slate-200 text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:text-white";
  const buttonDark =
    "bg-slate-700 text-white hover:bg-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600";
  const firstDataButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstSelectionButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstExportButtonRef = useRef<HTMLButtonElement | null>(null);

  const cardsBeaconClass = cardsPanelCollapsed
    ? side === "A"
      ? "lc-cardsBeacon lc-cardsBeacon--left-collapsed"
      : "lc-cardsBeacon lc-cardsBeacon--right-collapsed"
    : side === "A"
      ? "lc-cardsBeacon lc-cardsBeacon--left-expanded"
      : "lc-cardsBeacon lc-cardsBeacon--right-expanded";

  const toggleSection = (section: SidebarSection) => {
    setOpenSection((prev) => (prev === section ? prev : section));
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, openSection);
      window.requestAnimationFrame(() => {
        if (openSection === "data") firstDataButtonRef.current?.focus();
        if (openSection === "selection") firstSelectionButtonRef.current?.focus();
        if (openSection === "export") firstExportButtonRef.current?.focus();
      });
    }
  }, [openSection, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(cardsCollapsedKey, String(cardsPanelCollapsed));
  }, [cardsCollapsedKey, cardsPanelCollapsed]);


  useEffect(() => {
    if (!blockMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (blockMenuRef.current?.contains(target)) return;
      setBlockMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setBlockMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, [blockMenuOpen]);

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
    if (!editModeEnabled) return;
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
    console.info(`[Import] Коллекция ${side}: импортировано карточек ${validation.cards.length}`);
    const first = validation.cards[0];
    if (first) {
      const boxIds = (first.boxes ?? []).map((box) => box.id).join(", ");
      console.info(`[Import] Активная карточка boxes=${first.boxes?.length ?? 0}; ids=[${boxIds}]`);
    }
    setImportWarnings(validation.warnings);
    setImportNotice(
      validation.status === "warning"
        ? `Импортировано: ${validation.cards.length}. Есть предупреждения.`
        : `Импортировано: ${validation.cards.length} карточек.`
    );
    if (validation.cards.length >= 50) {
      setCardsPanelCollapsed(true);
    }
    finishExport();
    event.target.value = "";
  };

  const handleTextImport = async () => {
    if (!editModeEnabled) return;
    const text = prompt("Введите инфинитивы через новую строку");
    if (!text) return;
    const cardsFromText = importInfinitivesText(text);
    cardsFromText.forEach((card) => addCard(card, side));
  };

  const handleCreate = () => {
    if (!editModeEnabled) return;
    addCard({ inf: "" }, side);
  };

  const activeCardId = selectedSide === side ? selectedId : null;

  const handleAddBlock = (
    kind: "inf" | "freq" | "forms_rek" | "synonyms" | "examples" | "simple"
  ) => {
    if (!editModeEnabled) {
      setImportNotice("Включите режим редактирования в шапке.");
      return;
    }
    if (!activeCardId) {
      setImportNotice("Сначала выберите активную карточку в этой колонке.");
      return;
    }
    addBlockToCard(side, activeCardId, kind);
    setBlockMenuOpen(false);
  };

  const handleDeleteSelectedBlock = () => {
    if (!editModeEnabled) {
      setImportNotice("Включите режим редактирования в шапке.");
      return;
    }
    if (!activeCardId) {
      setImportNotice("Сначала выберите активную карточку в этой колонке.");
      return;
    }
    if (!selectedBoxId) {
      setImportNotice("Выделите блок (синий), затем удалите.");
      return;
    }
    removeSelectedBoxFromCard(side, activeCardId);
  };

  const handleApplyFormattingToCards = (mode: "all" | "selected") => {
    if (!editModeEnabled) {
      setImportNotice("Включите режим редактирования в шапке.");
      return;
    }
    if (!activeCardId) {
      setImportNotice("Сначала выберите активную карточку в этой колонке.");
      return;
    }
    if (mode === "selected" && selectedCardIds.length === 0) {
      setImportNotice("Сначала выделите карточки для применения форматирования.");
      return;
    }
    applyCardFormattingToCards({ side, sourceCardId: activeCardId, mode });
    setImportNotice(
      mode === "all"
        ? "Форматирование активной карточки применено ко всем карточкам списка."
        : "Форматирование активной карточки применено к выделенным карточкам."
    );
  };

  const handleApplyAutoHToCards = (mode: "all" | "selected") => {
    if (!editModeEnabled) {
      setImportNotice("Включите режим редактирования в шапке.");
      return;
    }
    if (mode === "selected" && selectedCardIds.length === 0) {
      setImportNotice("Сначала выделите карточки для авто-подстройки высоты.");
      return;
    }
    applyAutoHeightToCards({ side, mode });
    setImportNotice(
      mode === "all"
        ? "AutoHeight применён ко всем карточкам списка."
        : "AutoHeight применён к выделенным карточкам."
    );
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
      marginMm: 0
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
    const sample = [
      {
        id: "ablehnen",
        frequency: 5,
        infinitive: "ablehnen",
        translations: ["отклонять", "отказываться", "не принимать"],
        forms: {
          praesens_3: "lehnt ab",
          praeteritum: "lehnte ab",
          partizip_2: "abgelehnt",
          auxiliary: "hat",
          service: "ablehnen — lehnt ab — lehnte ab — hat abgelehnt",
          perfekt_full: "hat abgelehnt"
        },
        examples: {
          praesens: {
            de: "Ich lehne das Angebot ab, weil es невыгодно.",
            ru: "Я отказываюсь от предложения, потому что оно невыгодно."
          },
          modal: {
            modalVerb: "können",
            de: "Man kann ablehnen, ohne unhöflich zu sein.",
            ru: "Можно отказать, не будучи грубым."
          },
          praeteritum: {
            de: "Er lehnte jede Diskussion ab.",
            ru: "Он отказался от любой дискуссии."
          },
          perfekt: {
            de: "Die Behörde hat den Antrag abgelehnt.",
            ru: "Ведомство отклонило заявление."
          }
        },
        synonyms: [
          { word: "zurückweisen", translation: "отклонять" },
          { word: "verweigern", translation: "отказывать" },
          { word: "verwerfen", translation: "отвергать" }
        ],
        prefixes: ["отделяемые: ab-"],
        raw: {
          freq_raw: "TOP = 5",
          blockStartRow: 8430,
          blockEndRow: 8459
        },
        quality: {
          hasAllRequired: true,
          missing: []
        }
      }
    ];

    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: "application/json"
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "lingocard_sample.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleAutoLayoutAll = () => {
    startExport("Авто-компоновка...");
    window.setTimeout(() => {
      autoLayoutAllCards(side);
      finishExport();
      setImportNotice(`Авто-компоновка выполнена: ${cards.length} карточек (${side}).`);
      console.info(`[AutoLayout] Коллекция ${side}: обработано карточек ${cards.length}`);
    }, 0);
  };


  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-2xl bg-white p-4 shadow-soft dark:bg-slate-900/80">
      <div className="shrink-0 space-y-3 bg-white/95 pb-1 dark:bg-slate-900/95">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Коллекция {side}
            </p>
            <button
              type="button"
              onClick={() => setCardsPanelCollapsed((prev) => !prev)}
              className={`inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-lg font-semibold text-slate-800 dark:text-slate-100 ${cardsBeaconClass}`}
              aria-expanded={!cardsPanelCollapsed}
            >
              Карточки
              <span className={`text-xs transition-transform ${cardsPanelCollapsed ? "-rotate-90" : "rotate-0"}`}>▾</span>
            </button>
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
      </div>
      {!cardsPanelCollapsed && (
      <div
        className="shrink-0 space-y-3 overflow-y-auto pr-1 text-xs text-slate-600 dark:text-slate-300"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpenSection("data");
          }
        }}
      >
        <div className="rounded-xl border border-slate-100 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            aria-expanded={openSection === "data"}
            aria-controls={`section-data-${side}`}
            className={`lc-btnOutline flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold transition ${openSection === "data" ? "lc-btnOutlineActive bg-sky-50 text-sky-700 dark:bg-slate-800 dark:text-sky-300" : "text-slate-600 dark:text-slate-200"}`}
            onClick={() => toggleSection("data")}
          >
            <span>📁 Данные</span>
            <span className={`transition-transform duration-200 ${openSection === "data" ? "rotate-180" : "rotate-0"}`}>▾</span>
          </button>
          <div
            id={`section-data-${side}`}
            className={`grid transition-all duration-200 ${openSection === "data" ? (blockMenuOpen ? "mt-2 max-h-[44rem] opacity-100 overflow-visible" : "mt-2 max-h-[44rem] opacity-100 overflow-y-auto overflow-x-hidden pr-1") : "max-h-0 opacity-0 overflow-hidden"}`}
          >
            <div className="grid gap-2">
            <button ref={firstDataButtonRef} onClick={handleCreate} disabled={!editModeEnabled} className={`${buttonBase} ${buttonSolid} disabled:opacity-50`}>
              + Новая карточка
            </button>
            <div ref={blockMenuRef} className="relative">
              <button
                onClick={() => setBlockMenuOpen((prev) => !prev)}
                disabled={!editModeEnabled}
                aria-expanded={blockMenuOpen}
                aria-haspopup="menu"
                className={`${buttonBase} ${buttonDark} relative w-full pr-8 disabled:opacity-50`}
              >
                Создать блок
                <span className={`absolute right-3 transition-transform ${blockMenuOpen ? "rotate-180" : "rotate-0"}`}>▾</span>
              </button>
              {blockMenuOpen && (
                <div role="menu" className="absolute z-20 mt-1 w-full max-h-[40vh] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:ring-slate-800">
                  {/*
                    IMPORTANT: buttonBase sets justify-center/text-center.
                    For the dropdown menu we want strict left alignment,
                    so we use Tailwind's ! modifier to override reliably.
                  */}
                  <button onClick={() => handleAddBlock("inf")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50 w-full !justify-start !text-left pl-3`}>1. Инфинитив</button>
                  <button onClick={() => handleAddBlock("freq")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50 w-full !justify-start !text-left pl-3`}>2. Частотность</button>
                  <button onClick={() => handleAddBlock("forms_rek")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50 w-full !justify-start !text-left pl-3`}>3. Три времени + рекция</button>
                  <button onClick={() => handleAddBlock("synonyms")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50 w-full !justify-start !text-left pl-3`}>4. Синонимы</button>
                  <button onClick={() => handleAddBlock("examples")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50 w-full !justify-start !text-left pl-3`}>5. Примеры</button>
                  <button onClick={() => handleAddBlock("simple")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50 w-full !justify-start !text-left pl-3`}>6. Простой блок</button>
                </div>
              )}
            </div>
            <button onClick={handleDeleteSelectedBlock} disabled={!editModeEnabled} className={`${buttonBase} ${buttonDark} disabled:opacity-50`}>
              Удалить блок
            </button>
            <button onClick={() => handleApplyFormattingToCards("all")} disabled={!editModeEnabled || !activeCardId} className={`${buttonBase} ${buttonDark} disabled:opacity-50`}>
              Применить форматирование ко всем
            </button>
            <button onClick={() => handleApplyFormattingToCards("selected")} disabled={!editModeEnabled || !activeCardId} className={`${buttonBase} ${buttonLight} disabled:opacity-50`}>
              Применить форматирование к выбранным
            </button>
            <button onClick={() => handleApplyAutoHToCards("all")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonDark} disabled:opacity-50`}>
              Apply autoH ко всем
            </button>
            <button onClick={() => handleApplyAutoHToCards("selected")} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50`}>
              Apply autoH к выбранным
            </button>
            <label className={editModeEnabled ? "cursor-pointer" : "cursor-not-allowed"}>
              <input type="file" accept="application/json" onChange={handleImport} disabled={!editModeEnabled} className="hidden" />
              <span className={`${buttonBase} ${buttonLight} w-full ${editModeEnabled ? "" : "opacity-50"}`}>Импорт JSON</span>
            </label>
            <button onClick={handleTextImport} disabled={!editModeEnabled} className={`${buttonBase} ${buttonLight} disabled:opacity-50`}>
              Импорт TXT
            </button>
            <button onClick={downloadSample} className={`${buttonBase} ${buttonGhost}`}>
              Пример файла
            </button>
            <button onClick={handleAutoLayoutAll} disabled={!editModeEnabled} className={`${buttonBase} ${buttonGhost} disabled:opacity-50`}>
              Авто-компоновка всех
            </button>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            aria-expanded={openSection === "selection"}
            aria-controls={`section-selection-${side}`}
            className={`lc-btnOutline flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold transition ${openSection === "selection" ? "lc-btnOutlineActive bg-sky-50 text-sky-700 dark:bg-slate-800 dark:text-sky-300" : "text-slate-600 dark:text-slate-200"}`}
            onClick={() => toggleSection("selection")}
          >
            <span>☑️ Выбор</span>
            <span className={`transition-transform duration-200 ${openSection === "selection" ? "rotate-180" : "rotate-0"}`}>▾</span>
          </button>
          <div
            id={`section-selection-${side}`}
            className={`grid overflow-hidden transition-all duration-200 ${openSection === "selection" ? "mt-2 max-h-48 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="grid gap-2">
            <button ref={firstSelectionButtonRef} onClick={() => selectAllCards(side)} className={`${buttonBase} ${buttonLight}`}>
              Выделить всё
            </button>
            <button onClick={() => clearCardSelection(side)} className={`${buttonBase} ${buttonGhost}`}>
              Снять выделение
            </button>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white/70 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <button
            type="button"
            aria-expanded={openSection === "export"}
            aria-controls={`section-export-${side}`}
            className={`lc-btnOutline flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold transition ${openSection === "export" ? "lc-btnOutlineActive bg-sky-50 text-sky-700 dark:bg-slate-800 dark:text-sky-300" : "text-slate-600 dark:text-slate-200"}`}
            onClick={() => toggleSection("export")}
          >
            <span>📤 Экспорт</span>
            <span className={`transition-transform duration-200 ${openSection === "export" ? "rotate-180" : "rotate-0"}`}>▾</span>
          </button>
          <div
            id={`section-export-${side}`}
            className={`grid overflow-hidden transition-all duration-200 ${openSection === "export" ? "mt-2 max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <div className="grid gap-2">
            <button
              ref={firstExportButtonRef}
              onClick={handleExport}
              disabled={isExporting}
              className={`${buttonBase} ${buttonLight} disabled:opacity-50`}
            >
              Экспорт JSON
            </button>
            <button onClick={() => handlePdfExport("current")} className={`${buttonBase} ${buttonGhost}`}>
              PDF: Текущая
            </button>
            <button
              onClick={() => handlePdfExport("selected")}
              disabled={selectedCardIds.length === 0}
              className={`${buttonBase} ${buttonGhost} disabled:opacity-50`}
            >
              PDF: Выбранные
            </button>
            <button onClick={() => handlePdfExport("all")} className={`${buttonBase} ${buttonGhost}`}>
              PDF: Все
            </button>
            </div>
          </div>
        </div>
      </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-auto rounded-xl border border-slate-100 bg-slate-50/40 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/60">
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
        {filtered.map((card, index) => (
          <div
            key={`${card.id}-${side}-${index}`}
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
                {card.title || card.inf || "(без названия)"}
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
