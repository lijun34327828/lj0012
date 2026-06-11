export type FileCategory = 'exam' | 'note' | 'receipt' | 'custom';
export type TaskStatus = 'queued' | 'preprocessing' | 'ocr_running' | 'layout_restoring' | 'paused' | 'completed' | 'failed';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStage = 'pending' | 'preprocess' | 'ocr' | 'layout' | 'done';
export type TextType = 'handwritten' | 'printed' | 'mixed';
export type ExportFormat = 'docx' | 'pdf' | 'markdown' | 'txt' | 'json';

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  exam: '试卷',
  note: '笔记',
  receipt: '单据',
  custom: '自定义',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  queued: '等待中',
  preprocessing: '预处理中',
  ocr_running: '识别中',
  layout_restoring: '排版还原中',
  paused: '已暂停',
  completed: '已完成',
  failed: '失败',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  queued: 'bg-slate-400',
  preprocessing: 'bg-info-500',
  ocr_running: 'bg-brand-500',
  layout_restoring: 'bg-info-500',
  paused: 'bg-warning-500',
  completed: 'bg-success-500',
  failed: 'bg-danger-500',
};

export interface UploadFile {
  id: string;
  originalName: string;
  storedName: string;
  path: string;
  url: string;
  size: number;
  mimeType: string;
  category: FileCategory;
  width?: number;
  height?: number;
  uploadedAt: number;
  chunks?: { total: number; uploaded: number };
}

export interface ImageOperation {
  type: 'crop' | 'rotate' | 'flip' | 'enhance' | 'denoise' | 'binarize';
  params: Record<string, any>;
}

export interface PreprocessConfig {
  fileId: string;
  operations: ImageOperation[];
}

export interface TextBlock {
  id: string;
  type: TextType;
  content: string;
  confidence: number;
  candidates?: string[];
  boundingBox?: { x: number; y: number; w: number; h: number };
  pageIndex?: number;
  lineIndex?: number;
}

export interface ParagraphBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'table' | 'list';
  texts: TextBlock[];
  indent?: number;
  alignment?: 'left' | 'center' | 'right';
  tableData?: string[][];
}

export interface LayoutResult {
  pages: number;
  blocks: ParagraphBlock[];
  statistics: {
    totalChars: number;
    handwrittenChars: number;
    printedChars: number;
    avgConfidence: number;
  };
}

export interface OCRTask {
  id: string;
  name: string;
  category: FileCategory;
  fileIds: string[];
  status: TaskStatus;
  progress: number;
  currentStage: TaskStage;
  stageProgress: { preprocess: number; ocr: number; layout: number };
  retryCount: number;
  priority?: TaskPriority;
  durationMs?: number;
  wordCount?: number;
  stageDetail?: string;
  error?: { code: string; message: string };
  result?: LayoutResult;
  createdAt: number;
  updatedAt: number;
  pausedAt?: number;
}

export interface HistoryRecord {
  id: string;
  taskId: string;
  name: string;
  category: FileCategory;
  thumbnail: string;
  summary: string;
  charCount: number;
  status: TaskStatus;
  tags: string[];
  createdAt: number;
  lastViewedAt: number;
  taskSnapshot: Partial<OCRTask>;
}

export interface ExportRequest {
  taskId: string;
  format: ExportFormat;
  options: {
    includeImages?: boolean;
    preserveLayout?: boolean;
    watermark?: string;
    password?: string;
    filename?: string;
  };
}

export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  progress: number;
  currentStage: string;
  stageDetail?: string;
  etaSeconds?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
