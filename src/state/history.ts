export const HISTORY_LIMIT = 50;
export const BOOKMARK_LIMIT = 50;
export const CHANGE_LOG_LIMIT = 50;

type ChangeLogEntry = {
  id: string;
  at: string;
  action: string;
};

type HistoryBookmark<TSnapshot> = {
  id: string;
  createdAt: string;
  action: string;
  snapshot: TSnapshot;
};

type HistoryShape<TSnapshot> = {
  past: TSnapshot[];
  future: TSnapshot[];
  historyBookmarks: HistoryBookmark<TSnapshot>[];
  changeLog: ChangeLogEntry[];
};

export const recordHistory = <TSnapshot>(state: HistoryShape<TSnapshot>, snapshot: TSnapshot) => {
  state.past.push(snapshot);
  if (state.past.length > HISTORY_LIMIT) {
    state.past.shift();
  }
  state.future = [];
};

export const appendHistoryBookmark = <TSnapshot>(
  state: HistoryShape<TSnapshot>,
  current: TSnapshot,
  action: string
) => {
  const createdAt = new Date().toISOString();
  state.historyBookmarks.push({
    id: crypto.randomUUID(),
    createdAt,
    action,
    snapshot: current
  });
  if (state.historyBookmarks.length > BOOKMARK_LIMIT) {
    state.historyBookmarks.shift();
  }
};

export const appendChange = <TSnapshot>(state: HistoryShape<TSnapshot>, action: string) => {
  state.changeLog.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    action
  });
  if (state.changeLog.length > CHANGE_LOG_LIMIT) {
    state.changeLog.shift();
  }
};

export const trackStateEvent = <TSnapshot>(
  state: HistoryShape<TSnapshot>,
  current: TSnapshot,
  action: string,
  options?: { undoable?: boolean }
) => {
  const undoable = options?.undoable ?? true;
  if (undoable) {
    recordHistory(state, current);
  }
  appendChange(state, action);
  appendHistoryBookmark(state, current, action);
};
