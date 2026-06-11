import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  History,
  ListTodo,
  Send,
  AlertTriangle,
  Loader2,
  FileWarning,
} from 'lucide-react';
import { CategorySelector } from '@/components/upload/CategorySelector';
import { DropZone } from '@/components/upload/DropZone';
import { FileList, PendingFileItem } from '@/components/upload/FileList';
import { ChunkUploader } from '@/components/upload/ChunkUploader';
import { TaskCard } from '@/components/task/TaskCard';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useUploadStore } from '@/stores/uploadStore';
import { useTaskStore } from '@/stores/taskStore';
import { listTasks, submitOCR, getTaskStatus } from '@/utils/api';
import { toast } from '@/utils/toast';
import { formatFileSize } from '@/utils/file';
import { cn } from '@/lib/utils';
import type { OCRTask, TaskStatus, UploadFile } from '@shared/types';
import { STATUS_LABELS } from '@shared/types';

const BOARD_COLUMNS: { key: TaskStatus[]; label: string; color: string }[] = [
  { key: ['queued'], label: '等待中', color: 'bg-slate-50 border-slate-200' },
  { key: ['preprocessing', 'ocr_running', 'layout_restoring'], label: '进行中', color: 'bg-brand-50 border-brand-200' },
  { key: ['completed'], label: '已完成', color: 'bg-emerald-50 border-emerald-200' },
  { key: ['failed', 'paused'], label: '失败/暂停', color: 'bg-red-50 border-red-200' },
];

const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024;

export function Workbench() {
  const navigate = useNavigate();
  const {
    files,
    pendingFiles,
    selectedCategory,
    addPendingFiles,
    removePendingFile,
    clearPendingFiles,
    removeFile,
    addUploadedFile,
    updateProgress,
    setUploading,
  } = useUploadStore();
  const { tasks, setTasks, addTask, startPolling, stopAllPolling } = useTaskStore();

  const [submitting, setSubmitting] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const largeFiles = useMemo(() => {
    return pendingFiles.filter((pf) => pf.size > LARGE_FILE_THRESHOLD);
  }, [pendingFiles]);

  const pendingItems: PendingFileItem[] = useMemo(() => {
    return pendingFiles.map((pf) => ({
      ...pf,
      status: 'pending',
    }));
  }, [pendingFiles]);

  const boardTasks = useMemo(() => {
    const columns = new Map<string, OCRTask[]>();
    BOARD_COLUMNS.forEach((col) => {
      columns.set(col.label, []);
    });
    tasks.forEach((task) => {
      const col = BOARD_COLUMNS.find((c) => c.key.includes(task.status));
      if (col) {
        columns.get(col.label)?.push(task);
      }
    });
    return columns;
  }, [tasks]);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const res = await listTasks({ pageSize: 50 });
        setTasks(res.items);
        res.items.forEach((task) => {
          if (['queued', 'preprocessing', 'ocr_running', 'layout_restoring'].includes(task.status)) {
            startPolling(task.id, getTaskStatus);
          }
        });
      } catch (e: any) {
        toast.error(e.message || '加载任务列表失败');
      } finally {
        setLoadingTasks(false);
      }
    };
    loadTasks();
    return () => {
      stopAllPolling();
    };
  }, []);

  const handleFilesAdded = useCallback((files: File[]) => {
    addPendingFiles(files);
  }, [addPendingFiles]);

  const handleUploadComplete = useCallback((pendingId: string, file: UploadFile) => {
    addUploadedFile(file);
    removePendingFile(pendingId);
  }, [addUploadedFile, removePendingFile]);

  const handleUploadProgress = useCallback((id: string, progress: number) => {
    updateProgress(id, progress);
  }, [updateProgress]);

  const handleUploadError = useCallback((id: string, error: string) => {
    toast.error(`上传失败: ${error}`);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (files.length === 0) {
      toast.warning('请先上传至少一个文件');
      return;
    }
    if (pendingFiles.length > 0) {
      toast.warning('请等待所有文件上传完成');
      return;
    }
    setSubmitting(true);
    setUploading(true);
    try {
      const fileIds = files.map((f) => f.id);
      const task = await submitOCR(fileIds, selectedCategory);
      addTask(task);
      startPolling(task.id, getTaskStatus);
      toast.success('识别任务已提交');
      navigate(`/result/${task.id}`);
    } catch (e: any) {
      toast.error(e.message || '提交识别失败');
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  }, [files, pendingFiles, selectedCategory, addTask, startPolling, navigate, setUploading]);

  const handleTaskDragStart = useCallback((taskId: string) => {
    setDraggedTaskId(taskId);
  }, []);

  const handleTaskDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent, columnLabel: string) => {
    e.preventDefault();
    setDragOverColumn(columnLabel);
  }, []);

  const handleColumnDrop = useCallback((e: React.DragEvent, columnLabel: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggedTaskId(null);
    toast.info(`已移动到「${columnLabel}」`);
  }, []);

  const canSubmit = files.length > 0 && pendingFiles.length === 0 && !submitting;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 p-8 md:p-12 text-white shadow-xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl" />
        </div>
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 backdrop-blur-sm rounded-full text-sm font-medium mb-6 border border-white/20">
            <Sparkles className="w-4 h-4" />
            <span>AI 驱动的智能识别引擎</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight">
            手写内容智能识别
          </h1>
          <p className="text-lg md:text-xl text-brand-50/90 mb-8 leading-relaxed">
            让每一页手写字迹都能数字化留存
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-brand-100/80">
              <Tag variant="success" size="sm" className="bg-white/20 text-white border-white/30">
                支持 50+ 种手写字体
              </Tag>
              <Tag variant="info" size="sm" className="bg-white/20 text-white border-white/30">
                平均识别率 98%
              </Tag>
              <Tag variant="warning" size="sm" className="bg-white/20 text-white border-white/30">
                本地加密处理
              </Tag>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <CategorySelector />
      </section>

      {largeFiles.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <FileWarning className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-amber-800 mb-1">检测到大文件</h4>
            <p className="text-sm text-amber-700">
              以下文件超过 {formatFileSize(LARGE_FILE_THRESHOLD)}，建议先在编辑器中裁剪以提升识别速度：
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {largeFiles.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-xs text-amber-700">
                  {f.name} <span className="text-amber-500">({formatFileSize(f.size)})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <DropZone onFilesAdded={handleFilesAdded} />
      </section>

      {(pendingFiles.length > 0 || files.length > 0) && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <FileList
            pendingFiles={pendingItems}
            uploadedFiles={files}
            onRemovePending={removePendingFile}
            onRemoveUploaded={removeFile}
            onClearAllPending={clearPendingFiles}
          />

          {pendingFiles.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin-slow text-brand-500" />
                上传进度
              </h3>
              <div className="space-y-2">
                {pendingFiles.map((pf) => (
                  <ChunkUploader
                    key={pf.id}
                    file={pf.file}
                    fileId={pf.id}
                    category={selectedCategory}
                    onUploadComplete={(_, uploaded) => handleUploadComplete(pf.id, uploaded)}
                    onUploadProgress={(_, p) => handleUploadProgress(pf.id, p)}
                    onUploadError={(_, err) => handleUploadError(pf.id, err)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>
                已上传 <strong className="text-slate-700">{files.length}</strong> 个文件
              </span>
              {pendingFiles.length > 0 && (
                <span>
                  待上传 <strong className="text-amber-600">{pendingFiles.length}</strong> 个
                </span>
              )}
            </div>
            <Button
              variant="primary"
              size="lg"
              icon={submitting ? <Loader2 className="w-5 h-5 animate-spin-slow" /> : <Send className="w-5 h-5" />}
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? '提交中...' : '提交识别'}
            </Button>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">任务看板</h3>
            <p className="text-sm text-slate-500 mt-0.5">实时查看所有识别任务的状态</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<ListTodo className="w-4 h-4" />}
              onClick={() => navigate('/tasks')}
            >
              查看全部任务
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="md"
              icon={<History className="w-4 h-4" />}
              onClick={() => navigate('/history')}
            >
              历史记录
            </Button>
          </div>
        </div>

        <div className="p-6">
          {loadingTasks ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin-slow text-brand-500" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">暂无任务</p>
              <p className="text-xs mt-1">上传图片并提交识别后，任务将显示在这里</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {BOARD_COLUMNS.map((col) => {
                const columnTasks = boardTasks.get(col.label) || [];
                const isDragOver = dragOverColumn === col.label;
                return (
                  <div
                    key={col.label}
                    className={cn(
                      'rounded-2xl border-2 p-4 min-h-[400px] transition-all duration-200',
                      col.color,
                      isDragOver && 'ring-4 ring-brand-400/30 scale-[1.01]'
                    )}
                    onDragOver={(e) => handleColumnDragOver(e, col.label)}
                    onDragLeave={() => setDragOverColumn(null)}
                    onDrop={(e) => handleColumnDrop(e, col.label)}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                        {col.label}
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/80 border border-slate-200 text-slate-600">
                          {columnTasks.length}
                        </span>
                      </h4>
                    </div>
                    <div className="space-y-3">
                      {columnTasks.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          暂无任务
                        </div>
                      ) : (
                        columnTasks.slice(0, 3).map((task) => (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={() => handleTaskDragStart(task.id)}
                            onDragEnd={handleTaskDragEnd}
                            className={cn(
                              'cursor-grab active:cursor-grabbing transition-transform',
                              draggedTaskId === task.id && 'opacity-50 scale-95'
                            )}
                          >
                            <TaskCard task={task} viewMode="grid" />
                          </div>
                        ))
                      )}
                      {columnTasks.length > 3 && (
                        <button
                          onClick={() => navigate('/tasks')}
                          className="w-full py-2 text-xs text-slate-500 hover:text-brand-600 hover:bg-white/50 rounded-lg transition-colors"
                        >
                          还有 {columnTasks.length - 3} 个任务 →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Workbench;
