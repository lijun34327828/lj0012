import { create } from 'zustand';
import type { FileCategory } from '@shared/types';

const STORAGE_KEY = 'user_prefs';

interface PersistedPrefs {
  viewMode?: 'grid' | 'list';
  taskCenterViewMode?: 'grid' | 'list';
  historyViewMode?: 'grid' | 'list';
  editorZoom?: number;
  sidebarCollapsed?: boolean;
  lastCategory?: FileCategory;
}

function loadFromStorage(): PersistedPrefs {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToStorage(prefs: PersistedPrefs): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

interface UserPrefStoreState {
  viewMode: 'grid' | 'list';
  taskCenterViewMode: 'grid' | 'list';
  historyViewMode: 'grid' | 'list';
  editorZoom: number;
  sidebarCollapsed: boolean;
  lastCategory: FileCategory;
}

interface UserPrefStoreActions {
  toggleViewMode: () => void;
  setTaskCenterViewMode: (mode: 'grid' | 'list') => void;
  setHistoryViewMode: (mode: 'grid' | 'list') => void;
  setEditorZoom: (n: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setLastCategory: (c: FileCategory) => void;
  resetAll: () => void;
}

export type UserPrefStore = UserPrefStoreState & UserPrefStoreActions;

const DEFAULTS: UserPrefStoreState = {
  viewMode: 'list',
  taskCenterViewMode: 'list',
  historyViewMode: 'grid',
  editorZoom: 1,
  sidebarCollapsed: false,
  lastCategory: 'custom',
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

function clampZoom(n: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(n * 100) / 100));
}

function persist(state: UserPrefStoreState): void {
  saveToStorage({
    viewMode: state.viewMode,
    taskCenterViewMode: state.taskCenterViewMode,
    historyViewMode: state.historyViewMode,
    editorZoom: state.editorZoom,
    sidebarCollapsed: state.sidebarCollapsed,
    lastCategory: state.lastCategory,
  });
}

export const useUserPrefStore = create<UserPrefStore>((set, get) => {
  const stored = loadFromStorage();

  const initial: UserPrefStoreState = {
    ...DEFAULTS,
    ...stored,
    viewMode: stored.viewMode === 'grid' || stored.viewMode === 'list'
      ? stored.viewMode
      : DEFAULTS.viewMode,
    taskCenterViewMode: stored.taskCenterViewMode === 'grid' || stored.taskCenterViewMode === 'list'
      ? stored.taskCenterViewMode
      : DEFAULTS.taskCenterViewMode,
    historyViewMode: stored.historyViewMode === 'grid' || stored.historyViewMode === 'list'
      ? stored.historyViewMode
      : DEFAULTS.historyViewMode,
    editorZoom: stored.editorZoom ? clampZoom(stored.editorZoom) : DEFAULTS.editorZoom,
    sidebarCollapsed: stored.sidebarCollapsed ?? DEFAULTS.sidebarCollapsed,
    lastCategory: stored.lastCategory || DEFAULTS.lastCategory,
  };

  return {
    ...initial,

    toggleViewMode: () =>
      set((state) => {
        const next: UserPrefStoreState = {
          ...state,
          viewMode: state.viewMode === 'grid' ? 'list' : 'grid',
        };
        persist(next);
        return next;
      }),

    setTaskCenterViewMode: (mode) =>
      set((state) => {
        const next: UserPrefStoreState = {
          ...state,
          taskCenterViewMode: mode,
        };
        persist(next);
        return next;
      }),

    setHistoryViewMode: (mode) =>
      set((state) => {
        const next: UserPrefStoreState = {
          ...state,
          historyViewMode: mode,
        };
        persist(next);
        return next;
      }),

    setEditorZoom: (n) =>
      set((state) => {
        const next: UserPrefStoreState = {
          ...state,
          editorZoom: clampZoom(n),
        };
        persist(next);
        return next;
      }),

    zoomIn: () => get().setEditorZoom(get().editorZoom + ZOOM_STEP),

    zoomOut: () => get().setEditorZoom(get().editorZoom - ZOOM_STEP),

    resetZoom: () => get().setEditorZoom(1),

    toggleSidebar: () =>
      set((state) => {
        const next: UserPrefStoreState = {
          ...state,
          sidebarCollapsed: !state.sidebarCollapsed,
        };
        persist(next);
        return next;
      }),

    setSidebarCollapsed: (collapsed) =>
      set((state) => {
        const next: UserPrefStoreState = {
          ...state,
          sidebarCollapsed: collapsed,
        };
        persist(next);
        return next;
      }),

    setLastCategory: (c) =>
      set((state) => {
        const next: UserPrefStoreState = {
          ...state,
          lastCategory: c,
        };
        persist(next);
        return next;
      }),

    resetAll: () => {
      persist(DEFAULTS);
      set({ ...DEFAULTS });
    },
  };
});
