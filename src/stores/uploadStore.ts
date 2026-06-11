import { create } from 'zustand';
import type { FileCategory, UploadFile } from '@shared/types';

interface PendingFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  addedAt: number;
}

interface UploadStoreState {
  files: UploadFile[];
  pendingFiles: PendingFile[];
  selectedCategory: FileCategory;
  uploadProgress: Map<string, number>;
  isUploading: boolean;
}

interface UploadStoreActions {
  addPendingFiles: (files: File[]) => void;
  removePendingFile: (id: string) => void;
  clearPendingFiles: () => void;
  addFiles: (files: UploadFile[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  setCategory: (category: FileCategory) => void;
  updateProgress: (id: string, progress: number) => void;
  setUploading: (isUploading: boolean) => void;
  addUploadedFile: (file: UploadFile) => void;
}

export type UploadStore = UploadStoreState & UploadStoreActions;

function generateId(): string {
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useUploadStore = create<UploadStore>((set) => ({
  files: [],
  pendingFiles: [],
  selectedCategory: 'custom',
  uploadProgress: new Map(),
  isUploading: false,

  addPendingFiles: (files) =>
    set((state) => ({
      pendingFiles: [
        ...state.pendingFiles,
        ...files.map((file) => ({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          addedAt: Date.now(),
        })),
      ],
    })),

  removePendingFile: (id) =>
    set((state) => ({
      pendingFiles: state.pendingFiles.filter((f) => f.id !== id),
      uploadProgress: (() => {
        const next = new Map(state.uploadProgress);
        next.delete(id);
        return next;
      })(),
    })),

  clearPendingFiles: () =>
    set({
      pendingFiles: [],
      uploadProgress: new Map(),
      isUploading: false,
    }),

  addFiles: (files) =>
    set((state) => ({
      files: [...state.files, ...files],
    })),

  removeFile: (id) =>
    set((state) => ({
      files: state.files.filter((f) => f.id !== id),
    })),

  clearFiles: () => set({ files: [] }),

  setCategory: (category) => set({ selectedCategory: category }),

  updateProgress: (id, progress) =>
    set((state) => {
      const next = new Map(state.uploadProgress);
      next.set(id, Math.max(0, Math.min(100, progress)));
      return { uploadProgress: next };
    }),

  setUploading: (isUploading) => set({ isUploading }),

  addUploadedFile: (file) =>
    set((state) => ({
      files: [...state.files, file],
    })),
}));
