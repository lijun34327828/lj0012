import type {
  ApiResponse,
  ExportFormat,
  FileCategory,
  HistoryRecord,
  LayoutResult,
  OCRTask,
  PaginatedResponse,
  PreprocessConfig,
  TaskProgress,
  UploadFile,
} from '@shared/types';

const baseURL = '/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  timeout?: number;
}

export async function request<T = any>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, timeout = 30000, headers, body, ...rest } = options;

  let fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(fullUrl, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: body instanceof FormData || body instanceof Blob
        ? body
        : body && typeof body === 'object'
        ? JSON.stringify(body)
        : body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data: ApiResponse<T>;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = text ? JSON.parse(text) : { success: response.ok };
      } catch {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
        }
        return undefined as unknown as T;
      }
    }

    if (!response.ok || !data.success) {
      const errorMsg = data.error?.message || data.message || `请求失败 (${response.status})`;
      const error = new Error(errorMsg) as Error & { code?: string };
      error.code = data.error?.code;
      throw error;
    }

    return data.data as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    throw error;
  }
}

export const get = <T = any>(url: string, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'GET' });

export const post = <T = any>(url: string, body?: any, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'POST', body });

export const put = <T = any>(url: string, body?: any, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'PUT', body });

export const del = <T = any>(url: string, options?: RequestOptions) =>
  request<T>(url, { ...options, method: 'DELETE' });

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

const CHUNK_THRESHOLD = 10 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

export async function uploadFile(
  file: File,
  category: FileCategory,
  onProgress?: UploadProgressCallback
): Promise<UploadFile> {
  if (file.size > CHUNK_THRESHOLD) {
    return chunkUpload(file, category, onProgress);
  }
  return singleUpload(file, category, onProgress);
}

function createXhrPromise<T>(
  url: string,
  formData: FormData,
  method: string = 'POST',
  onProgress?: UploadProgressCallback
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText) as ApiResponse<T>;
        if (xhr.status >= 200 && xhr.status < 300 && data.success) {
          resolve(data.data as T);
        } else {
          reject(new Error(data.error?.message || data.message || '上传失败'));
        }
      } catch (e) {
        reject(new Error('响应解析失败'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误')));
    xhr.addEventListener('abort', () => reject(new Error('上传已取消')));

    xhr.open(method, url.startsWith('http') ? url : `${baseURL}${url}`);
    xhr.send(formData);
  });
}

export async function initChunkUpload(
  fileName: string,
  fileSize: number,
  mimeType: string,
  category: FileCategory,
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<{ uploadId: string; totalChunks: number; chunkSize: number }> {
  return post('/upload/chunk/init', {
    fileName,
    fileSize,
    mimeType,
    category,
    chunkSize,
  });
}

export async function uploadChunk(
  uploadId: string,
  chunkIndex: number,
  chunk: Blob,
  onProgress?: UploadProgressCallback
): Promise<{ uploaded: boolean }> {
  const formData = new FormData();
  formData.append('uploadId', uploadId);
  formData.append('chunkIndex', String(chunkIndex));
  formData.append('chunk', chunk);
  return createXhrPromise('/upload/chunk', formData, 'POST', onProgress);
}

export async function mergeChunks(
  uploadId: string,
  totalChunks: number,
  fileHash?: string
): Promise<UploadFile> {
  return post('/upload/chunk/merge', {
    uploadId,
    totalChunks,
    fileHash,
  });
}

export async function singleUpload(
  file: File,
  category: FileCategory,
  onProgress?: UploadProgressCallback
): Promise<UploadFile> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  return createXhrPromise('/upload/single', formData, 'POST', onProgress);
}

async function chunkUpload(
  file: File,
  category: FileCategory,
  onProgress?: UploadProgressCallback
): Promise<UploadFile> {
  const chunkSize = DEFAULT_CHUNK_SIZE;
  const totalChunks = Math.ceil(file.size / chunkSize);

  const initResult = await initChunkUpload(
    file.name,
    file.size,
    file.type,
    category,
    chunkSize
  );

  const { uploadId } = initResult;
  let uploadedBytes = 0;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    await uploadChunk(uploadId, i, chunk, (chunkProgress) => {
      const totalLoaded = uploadedBytes + chunkProgress.loaded;
      if (onProgress) {
        onProgress({
          loaded: totalLoaded,
          total: file.size,
          percent: Math.round((totalLoaded / file.size) * 100),
        });
      }
    });

    uploadedBytes += chunk.size;
  }

  return mergeChunks(uploadId, totalChunks);
}

export function getImageMeta(fileId: string): Promise<{
  width: number;
  height: number;
  format: string;
  fileSize: number;
}> {
  return get(`/image/${fileId}/meta`);
}

export function preprocessImage(config: PreprocessConfig): Promise<{
  fileId: string;
  url: string;
  operations: string[];
}> {
  return post('/image/preprocess', config);
}

export function autoCorrectImage(fileId: string): Promise<{
  fileId: string;
  url: string;
  corrections: string[];
}> {
  return post(`/image/auto-correct/${fileId}`);
}

export function submitOCR(fileIds: string[], category: FileCategory, options?: {
  textType?: 'handwritten' | 'printed' | 'mixed';
  enableLayout?: boolean;
  enhanceImage?: boolean;
}): Promise<OCRTask> {
  return post('/ocr/submit', {
    fileIds,
    category,
    ...(options || {}),
  });
}

export function getTaskStatus(taskId: string): Promise<TaskProgress> {
  return get(`/ocr/tasks/${taskId}/status`);
}

export function getTaskResult(taskId: string): Promise<OCRTask> {
  return get(`/ocr/tasks/${taskId}/result`);
}

export function listTasks(params?: {
  page?: number;
  pageSize?: number;
  status?: string;
  category?: FileCategory;
}): Promise<PaginatedResponse<OCRTask>> {
  return get('/ocr/tasks', { params });
}

export function pauseTask(taskId: string): Promise<{ success: boolean }> {
  return post(`/ocr/tasks/${taskId}/pause`);
}

export function resumeTask(taskId: string): Promise<{ success: boolean }> {
  return post(`/ocr/tasks/${taskId}/resume`);
}

export function retryTask(taskId: string): Promise<OCRTask> {
  return post(`/ocr/tasks/${taskId}/retry`);
}

export function cancelTask(taskId: string): Promise<{ success: boolean }> {
  return post(`/ocr/tasks/${taskId}/cancel`);
}

export function deleteTask(taskId: string): Promise<{ success: boolean }> {
  return del(`/tasks/${taskId}`);
}

export function batchDeleteTasks(ids: string[]): Promise<{ deleted: number }> {
  return del('/tasks/batch', {
    body: JSON.stringify({ ids }) as unknown as BodyInit,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function batchPauseTasks(ids: string[]): Promise<{ updated: number }> {
  return post('/tasks/batch-pause', { ids });
}

export function batchResumeTasks(ids: string[]): Promise<{ updated: number }> {
  return post('/tasks/batch-resume', { ids });
}

export function batchRetryTasks(ids: string[]): Promise<{ updated: number }> {
  return post('/tasks/batch-retry', { ids });
}

export function batchExportTasks(ids: string[], format: ExportFormat): Promise<{
  exportId: string;
  status: 'processing' | 'ready';
}> {
  return post('/export/batch', { ids, format });
}

export function saveResult(taskId: string, editedBlocks: Record<string, string>): Promise<{
  saved: boolean;
  updatedAt: number;
}> {
  return post(`/results/${taskId}/save`, { editedBlocks });
}

export function listHistory(params?: {
  page?: number;
  pageSize?: number;
  category?: FileCategory;
  keyword?: string;
  tags?: string[];
}): Promise<PaginatedResponse<HistoryRecord>> {
  return get('/history', { params });
}

export function updateHistoryCategory(
  historyIds: string[],
  category: FileCategory
): Promise<{ updated: number }> {
  return put('/history/category', { historyIds, category });
}

export function deleteHistoryBatch(historyIds: string[]): Promise<{ deleted: number }> {
  return del('/history/batch', {
    body: JSON.stringify({ historyIds }) as unknown as BodyInit,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function generateExport(request: {
  taskId: string;
  format: 'docx' | 'pdf' | 'markdown' | 'txt' | 'json';
  options?: {
    includeImages?: boolean;
    preserveLayout?: boolean;
    watermark?: string;
    filename?: string;
  };
}): Promise<{
  exportId: string;
  status: 'processing' | 'ready';
}> {
  return post('/export/generate', request);
}

export function deleteHistoryItem(id: string): Promise<{ deleted: boolean }> {
  return deleteHistoryBatch([id]).then((r) => ({ deleted: r.deleted > 0 }));
}

export function batchDeleteHistory(ids: string[]): Promise<{ deleted: number }> {
  return deleteHistoryBatch(ids);
}

export function batchMoveCategory(ids: string[], category: FileCategory): Promise<{ updated: number }> {
  return updateHistoryCategory(ids, category);
}

export async function batchExportHistory(ids: string[], format: 'docx' | 'pdf' | 'markdown' | 'txt' | 'json'): Promise<{ exportIds: string[] }> {
  const results = await Promise.all(
    ids.map((taskId) => generateExport({ taskId, format }))
  );
  return { exportIds: results.map((r) => r.exportId) };
}

export function downloadExport(exportId: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    fetch(`${baseURL}/export/download/${exportId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`下载失败 (${res.status})`);
        }
        return res.blob();
      })
      .then(resolve)
      .catch(reject);
  });
}
