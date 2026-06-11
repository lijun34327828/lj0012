import { create } from 'zustand';
import type { LayoutResult, OCRTask } from '@shared/types';

interface ResultStoreState {
  currentTask: OCRTask | null;
  currentResult: LayoutResult | null;
  editedBlocks: Map<string, string>;
  lastSaved: number;
  isDirty: boolean;
}

interface ResultStoreActions {
  setTask: (task: OCRTask | null) => void;
  setResult: (result: LayoutResult | null) => void;
  editBlock: (blockId: string, content: string) => void;
  getBlockContent: (blockId: string) => string | undefined;
  collectEdits: () => Record<string, string>;
  clearAll: () => void;
  markSaved: () => void;
  save: () => void;
}

export type ResultStore = ResultStoreState & ResultStoreActions;

export const useResultStore = create<ResultStore>((set, get) => ({
  currentTask: null,
  currentResult: null,
  editedBlocks: new Map(),
  lastSaved: 0,
  isDirty: false,

  setTask: (task) =>
    set({
      currentTask: task,
      currentResult: task?.result || null,
      editedBlocks: new Map(),
      isDirty: false,
    }),

  setResult: (result) =>
    set({
      currentResult: result,
    }),

  editBlock: (blockId, content) =>
    set((state) => {
      const next = new Map(state.editedBlocks);
      const result = state.currentResult;

      let original = '';
      if (result) {
        for (const block of result.blocks) {
          for (const text of block.texts) {
            if (text.id === blockId) {
              original = text.content;
              break;
            }
          }
        }
      }

      if (content === original) {
        next.delete(blockId);
      } else {
        next.set(blockId, content);
      }

      return {
        editedBlocks: next,
        isDirty: next.size > 0,
      };
    }),

  getBlockContent: (blockId) => {
    const state = get();
    if (state.editedBlocks.has(blockId)) {
      return state.editedBlocks.get(blockId);
    }
    const result = state.currentResult;
    if (result) {
      for (const block of result.blocks) {
        for (const text of block.texts) {
          if (text.id === blockId) {
            return text.content;
          }
        }
      }
    }
    return undefined;
  },

  collectEdits: () => {
    const map = get().editedBlocks;
    const obj: Record<string, string> = {};
    map.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  },

  clearAll: () =>
    set({
      currentTask: null,
      currentResult: null,
      editedBlocks: new Map(),
      lastSaved: 0,
      isDirty: false,
    }),

  markSaved: () =>
    set({
      lastSaved: Date.now(),
      isDirty: false,
    }),

  save: () => {
    set({
      lastSaved: Date.now(),
      isDirty: false,
    });
  },
}));
