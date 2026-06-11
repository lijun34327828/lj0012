import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileCategory, UploadFile } from '@shared/types';
import {
  initChunkUpload,
  mergeChunks,
  singleUpload,
  uploadChunk,
  UploadProgress,
} from '@/utils/api';

export type ChunkUploadStatus =
  | 'idle'
  | 'preparing'
  | 'uploading'
  | 'merging'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'error';

export interface UseChunkUploadOptions {
  chunkSize?: number;
  autoStart?: boolean;
  parallelChunks?: number;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (file: UploadFile) => void;
  onError?: (error: Error) => void;
}

export interface UseChunkUploadResult {
  progress: number;
  status: ChunkUploadStatus;
  error?: string;
  uploadedBytes: number;
  totalBytes: number;
  fileId?: string;
  result?: UploadFile;
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  retry: () => void;
}

const CHUNK_THRESHOLD = 10 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

export function useChunkUpload(
  file: File | undefined | null,
  category: FileCategory,
  options: UseChunkUploadOptions = {}
): UseChunkUploadResult {
  const {
    chunkSize = DEFAULT_CHUNK_SIZE,
    autoStart = true,
    parallelChunks = 1,
    onProgress,
    onComplete,
    onError,
  } = options;

  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<ChunkUploadStatus>('idle');
  const [error, setError] = useState<string | undefined>();
  const [uploadedBytes, setUploadedBytes] = useState<number>(0);
  const [fileId, setFileId] = useState<string | undefined>();
  const [result, setResult] = useState<UploadFile | undefined>();

  const totalBytes = file?.size || 0;

  const uploadIdRef = useRef<string | null>(null);
  const totalChunksRef = useRef<number>(0);
  const uploadedChunksRef = useRef<Set<number>>(new Set());
  const currentChunkRef = useRef<number>(0);
  const pausedRef = useRef<boolean>(false);
  const cancelledRef = useRef<boolean>(false);
  const xhrRefs = useRef<Map<number, XMLHttpRequest>>(new Map());
  const categoryRef = useRef(category);
  const onProgressRef = useRef(onProgress);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    categoryRef.current = category;
  }, [category]);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const reportProgress = useCallback(() => {
    if (!file) return;
    const percent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
    setProgress(percent);
    onProgressRef.current?.({
      loaded: uploadedBytes,
      total: totalBytes,
      percent,
    });
  }, [file, uploadedBytes, totalBytes]);

  useEffect(() => {
    reportProgress();
  }, [uploadedBytes, reportProgress]);

  const cleanupXhrs = useCallback(() => {
    xhrRefs.current.forEach((xhr) => {
      try {
        xhr.abort();
      } catch {
        // ignore
      }
    });
    xhrRefs.current.clear();
  }, []);

  const uploadSingleChunk = useCallback(
    (index: number, chunk: Blob): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!uploadIdRef.current) {
          reject(new Error('uploadId 未初始化'));
          return;
        }

        const xhr = new XMLHttpRequest();
        xhrRefs.current.set(index, xhr);

        const formData = new FormData();
        formData.append('uploadId', uploadIdRef.current);
        formData.append('chunkIndex', String(index));
        formData.append('chunk', chunk);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const sizePerChunk = chunkSize;
            let base = 0;
            uploadedChunksRef.current.forEach((ci) => {
              if (ci < index) {
                base += sizePerChunk;
              }
            });
            const actualLoaded = Math.min(base + e.loaded, totalBytes);
            setUploadedBytes(actualLoaded);
          }
        });

        xhr.addEventListener('load', () => {
          xhrRefs.current.delete(index);
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300 && data.success) {
              uploadedChunksRef.current.add(index);
              resolve();
            } else {
              reject(new Error(data.error?.message || data.message || `分片 ${index} 上传失败`));
            }
          } catch (e) {
            reject(new Error(`分片 ${index} 响应解析失败`));
          }
        });

        xhr.addEventListener('error', () => {
          xhrRefs.current.delete(index);
          reject(new Error(`分片 ${index} 网络错误`));
        });

        xhr.addEventListener('abort', () => {
          xhrRefs.current.delete(index);
          reject(new Error('上传已取消'));
        });

        xhr.open('POST', '/api/upload/chunk');
        xhr.send(formData);
      });
    },
    [chunkSize, totalBytes]
  );

  const runChunkedUpload = useCallback(async (targetFile: File) => {
    const totalChunks = Math.ceil(targetFile.size / chunkSize);
    totalChunksRef.current = totalChunks;
    currentChunkRef.current = 0;
    uploadedChunksRef.current = new Set();

    setStatus('preparing');
    try {
      const initResult = await initChunkUpload(
        targetFile.name,
        targetFile.size,
        targetFile.type,
        categoryRef.current,
        chunkSize
      );
      uploadIdRef.current = initResult.uploadId;
    } catch (e: any) {
      setStatus('error');
      setError(e.message || '初始化分片上传失败');
      onErrorRef.current?.(e);
      return;
    }

    if (cancelledRef.current) return;
    if (pausedRef.current) {
      setStatus('paused');
      return;
    }

    setStatus('uploading');

    const runSequential = async () => {
      while (currentChunkRef.current < totalChunks) {
        if (cancelledRef.current) throw new Error('上传已取消');
        if (pausedRef.current) {
          setStatus('paused');
          return;
        }

        const index = currentChunkRef.current;
        if (!uploadedChunksRef.current.has(index)) {
          const start = index * chunkSize;
          const end = Math.min(start + chunkSize, targetFile.size);
          const chunk = targetFile.slice(start, end);

          try {
            await uploadSingleChunk(index, chunk);
          } catch (e: any) {
            if (cancelledRef.current) {
              throw e;
            }
            if (pausedRef.current) {
              setStatus('paused');
              return;
            }
            throw e;
          }
        }
        currentChunkRef.current++;
      }
    };

    try {
      await runSequential();

      if (cancelledRef.current) return;
      if (pausedRef.current) return;

      setStatus('merging');
      const merged = await mergeChunks(uploadIdRef.current!, totalChunks);

      if (cancelledRef.current) return;

      setUploadedBytes(totalBytes);
      setProgress(100);
      setFileId(merged.id);
      setResult(merged);
      setStatus('completed');
      onCompleteRef.current?.(merged);
    } catch (e: any) {
      if (cancelledRef.current) {
        setStatus('cancelled');
      } else if (pausedRef.current) {
        setStatus('paused');
      } else {
        setStatus('error');
        setError(e.message || '上传失败');
        onErrorRef.current?.(e);
      }
    }
  }, [chunkSize, totalBytes, uploadSingleChunk]);

  const runSingleUpload = useCallback(async (targetFile: File) => {
    setStatus('uploading');
    setUploadedBytes(0);

    try {
      const uploaded = await singleUpload(targetFile, categoryRef.current, (p) => {
        setUploadedBytes(p.loaded);
      });

      if (cancelledRef.current) {
        setStatus('cancelled');
        return;
      }

      setProgress(100);
      setFileId(uploaded.id);
      setResult(uploaded);
      setStatus('completed');
      onCompleteRef.current?.(uploaded);
    } catch (e: any) {
      if (cancelledRef.current) {
        setStatus('cancelled');
      } else {
        setStatus('error');
        setError(e.message || '上传失败');
        onErrorRef.current?.(e);
      }
    }
  }, []);

  const start = useCallback(() => {
    if (!file) return;
    if (status === 'uploading' || status === 'preparing' || status === 'merging') return;

    pausedRef.current = false;
    cancelledRef.current = false;
    setError(undefined);

    const useChunked = file.size > CHUNK_THRESHOLD;

    if (useChunked) {
      runChunkedUpload(file);
    } else {
      runSingleUpload(file);
    }
  }, [file, status, runChunkedUpload, runSingleUpload]);

  const pause = useCallback(() => {
    if (status !== 'uploading' && status !== 'preparing') return;
    pausedRef.current = true;
    cleanupXhrs();
    setStatus('paused');
  }, [status, cleanupXhrs]);

  const resume = useCallback(() => {
    if (status !== 'paused') return;
    pausedRef.current = false;
    cancelledRef.current = false;
    setError(undefined);

    if (!file) return;

    if (!uploadIdRef.current) {
      start();
      return;
    }

    setStatus('uploading');
    runChunkedUpload(file);
  }, [status, file, start, runChunkedUpload]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    pausedRef.current = false;
    cleanupXhrs();
    setStatus('cancelled');
  }, [cleanupXhrs]);

  const retry = useCallback(() => {
    uploadIdRef.current = null;
    totalChunksRef.current = 0;
    uploadedChunksRef.current = new Set();
    currentChunkRef.current = 0;
    setProgress(0);
    setUploadedBytes(0);
    setError(undefined);
    setFileId(undefined);
    setResult(undefined);
    pausedRef.current = false;
    cancelledRef.current = false;
    start();
  }, [start]);

  useEffect(() => {
    uploadIdRef.current = null;
    totalChunksRef.current = 0;
    uploadedChunksRef.current = new Set();
    currentChunkRef.current = 0;
    pausedRef.current = false;
    cancelledRef.current = false;
    cleanupXhrs();

    setProgress(0);
    setUploadedBytes(0);
    setError(undefined);
    setFileId(undefined);
    setResult(undefined);
    setStatus('idle');

    if (file && autoStart) {
      start();
    }

    return () => {
      cancelledRef.current = true;
      cleanupXhrs();
    };
  }, [file, autoStart]);

  return {
    progress,
    status,
    error,
    uploadedBytes,
    totalBytes,
    fileId,
    result,
    start,
    pause,
    resume,
    cancel,
    retry,
  };
}
