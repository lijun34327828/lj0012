import { create } from 'zustand';
import type { OCRTask, TaskProgress } from '@shared/types';

interface TaskStoreState {
  tasks: OCRTask[];
  activeTaskIds: string[];
  pollMap: Map<string, boolean>;
  pollTimers: Map<string, ReturnType<typeof setInterval>>;
}

interface TaskStoreActions {
  addTask: (task: OCRTask) => void;
  updateTask: (id: string, partial: Partial<OCRTask>) => void;
  applyProgress: (id: string, progress: TaskProgress) => void;
  removeTask: (id: string) => void;
  setTasks: (list: OCRTask[]) => void;
  startPolling: (
    id: string,
    fetchFn: (id: string) => Promise<TaskProgress>,
    onUpdate?: (progress: TaskProgress) => void,
    interval?: number
  ) => void;
  stopPolling: (id: string) => void;
  stopAllPolling: () => void;
}

export type TaskStore = TaskStoreState & TaskStoreActions;

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'paused', 'cancelled']);

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  activeTaskIds: [],
  pollMap: new Map(),
  pollTimers: new Map(),

  addTask: (task) =>
    set((state) => ({
      tasks: [task, ...state.tasks.filter((t) => t.id !== task.id)],
      activeTaskIds: state.activeTaskIds.includes(task.id)
        ? state.activeTaskIds
        : [...state.activeTaskIds, task.id],
    })),

  updateTask: (id, partial) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...partial, updatedAt: Date.now() } : t
      ),
    })),

  applyProgress: (id, progress) =>
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          status: progress.status,
          progress: progress.progress,
          currentStage: (progress.currentStage as any) || t.currentStage,
          updatedAt: Date.now(),
        };
      }),
    })),

  removeTask: (id) => {
    const state = get();
    const timer = state.pollTimers.get(id);
    if (timer) {
      clearInterval(timer);
    }
    set({
      tasks: state.tasks.filter((t) => t.id !== id),
      activeTaskIds: state.activeTaskIds.filter((tid) => tid !== id),
      pollMap: (() => {
        const next = new Map(state.pollMap);
        next.delete(id);
        return next;
      })(),
      pollTimers: (() => {
        const next = new Map(state.pollTimers);
        next.delete(id);
        return next;
      })(),
    });
  },

  setTasks: (list) =>
    set({
      tasks: [...list],
    }),

  startPolling: (id, fetchFn, onUpdate, interval = 3000) => {
    const state = get();
    if (state.pollMap.get(id)) return;

    const poll = async () => {
      try {
        const progress = await fetchFn(id);
        get().applyProgress(id, progress);
        onUpdate?.(progress);

        if (TERMINAL_STATUSES.has(progress.status)) {
          get().stopPolling(id);
        }
      } catch (e) {
        // silently ignore poll errors
      }
    };

    poll();

    const timer = setInterval(poll, interval);

    set({
      pollMap: (() => {
        const next = new Map(get().pollMap);
        next.set(id, true);
        return next;
      })(),
      pollTimers: (() => {
        const next = new Map(get().pollTimers);
        next.set(id, timer);
        return next;
      })(),
    });
  },

  stopPolling: (id) => {
    const state = get();
    const timer = state.pollTimers.get(id);
    if (timer) {
      clearInterval(timer);
    }
    set({
      pollMap: (() => {
        const next = new Map(state.pollMap);
        next.delete(id);
        return next;
      })(),
      pollTimers: (() => {
        const next = new Map(state.pollTimers);
        next.delete(id);
        return next;
      })(),
    });
  },

  stopAllPolling: () => {
    const state = get();
    state.pollTimers.forEach((timer) => clearInterval(timer));
    set({
      pollMap: new Map(),
      pollTimers: new Map(),
    });
  },
}));
