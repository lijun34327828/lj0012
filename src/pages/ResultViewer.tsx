import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit3,
  Download,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  PanelRightOpen,
  SplitSquareVertical,
  Grid3X3,
  Sparkles,
} from 'lucide-react';
import { CompareView } from '@/components/result/CompareView';
import { LayoutView } from '@/components/result/LayoutView';
import { ConfidencePanel } from '@/components/result/ConfidencePanel';
import { StatisticsPanel } from '@/components/result/StatisticsPanel';
import { ExportModal } from '@/components/export/ExportModal';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Tabs } from '@/components/ui/Tabs';
import type { TabItem } from '@/components/ui/Tabs';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { useTaskStore } from '@/stores/taskStore';
import { useUploadStore } from '@/stores/uploadStore';
import { getTaskResult, cancelTask, retryTask, getTaskStatus } from '@/utils/api';
import { toast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import type { OCRTask, LayoutResult, STATUS_COLORS } from '@shared/types';
import { STATUS_LABELS, CATEGORY_LABELS } from '@shared/types';

type ViewMode = 'compare' | 'layout';

export function ResultViewer() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const { tasks, updateTask, removeTask, addTask, startPolling, stopPolling } = useTaskStore();
  const { files: uploadedFiles } = useUploadStore();

  const [task, setTask] = useState<OCRTask | null>(null);
  const [result, setResult] = useState<LayoutResult | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('compare');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [loadingResult, setLoadingResult] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const polling = useTaskPolling(task?.id || null, (progress) => {});

  useEffect(() => {
    if (!taskId) return;
    const existing = tasks.find((t) => t.id === taskId);
    if (existing) {
      setTask(existing);
    }
    loadResult(taskId);
  }, [taskId]);

  useEffect(() => {
    if (task && polling.status && polling.status !== task.status) {
      const updated: OCRTask = {
        ...task,
        status: polling.status,
        progress: polling.progress ?? task.progress,
        currentStage: (polling.currentStage as OCRTask['currentStage']) ?? task.currentStage,
        stageProgress: task.stageProgress,
        retryCount: task.retryCount,
        error: polling.error
          ? { code: 'TASK_ERROR', message: polling.error }
          : task.error,
      };
      setTask(updated);
      updateTask(task.id, updated);

      if (polling.status === 'completed' && !result) {
        loadResult(task.id);
      }
    }
  }, [polling.status, polling.progress, polling.currentStage, polling.stageDetail, polling.error]);

  const loadResult = useCallback(async (id: string) => {
    setLoadingResult(true);
    try {
      const res = await getTaskResult(id);
      setResult(res.result!);
      const updated: OCRTask = {
        ...task,
        id,
        status: res.status,
        result: res.result,
        stageProgress: task?.stageProgress ?? { preprocess: 0, ocr: 0, layout: 0 },
        retryCount: task?.retryCount ?? 0,
      } as OCRTask;
      if (task) {
        setTask(updated);
        updateTask(id, updated);
      }
    } catch (e: any) {
      if (!task || task.status !== 'failed') {
        // ignore
      }
    } finally {
      setLoadingResult(false);
    }
  }, [task, updateTask]);

  const imageFile = useMemo(() => {
    if (!task?.fileIds || task.fileIds.length === 0) return null;
    return uploadedFiles.find((f) => f.id === task.fileIds![0]) || null;
  }, [task?.fileIds, uploadedFiles]);

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!confirm('确定要删除此识别任务吗？此操作不可恢复。')) return;
    setDeleting(true);
    try {
      await cancelTask(task.id);
      removeTask(task.id);
      toast.success('任务已删除');
      navigate('/tasks');
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  }, [task, removeTask, navigate]);

  const handleRetry = useCallback(async () => {
    if (!task) return;
    setRetrying(true);
    try {
      const newTask = await retryTask(task.id);
      addTask(newTask);
      startPolling(newTask.id, getTaskStatus);
      toast.success('已重新提交识别');
      navigate(`/result/${newTask.id}`);
    } catch (e: any) {
      toast.error(e.message || '重试失败');
    } finally {
      setRetrying(false);
    }
  }, [task, addTask, startPolling, navigate]);

  const isRunning = useMemo(() => {
    if (!task) return false;
    return ['queued', 'preprocessing', 'ocr_running', 'layout_restoring'].includes(task.status);
  }, [task]);

  if (!taskId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        无效的任务ID
      </div>
    );
  }

  if (!task && loadingResult) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin-slow" />
        正在加载任务信息...
      </div>
    );
  }

  const displayProgress = polling.progress ?? task?.progress ?? 0;
  const displayStage = polling.currentStage ?? task?.currentStage;
  const displayStageDetail = polling.stageDetail ?? task?.stageDetail;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col -mx-6 -my-6">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-2 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg font-semibold text-slate-800 truncate">
                {task?.name || '未命名任务'}
              </h1>
              {task && (
                <Tag
                  size="sm"
                  variant={task.status === 'completed' ? 'success' :
                    task.status === 'failed' ? 'danger' :
                    task.status === 'paused' ? 'warning' : 'primary'}
                >
                  {STATUS_LABELS[task.status]}
                </Tag>
              )}
              {task?.category && (
                <Tag size="sm" variant="default">
                  {CATEGORY_LABELS[task.category]}
                </Tag>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {result?.statistics?.totalChars !== undefined && (
                <span className="flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" />
                  {result.statistics.totalChars.toLocaleString()} 字
                </span>
              )}
              {task && task.updatedAt && task.createdAt && task.updatedAt > task.createdAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  耗时 {((task.updatedAt - task.createdAt) / 1000).toFixed(1)}s
                </span>
              )}
              {task && (
                <span>
                  创建于 {new Date(task.createdAt).toLocaleString('zh-CN', {
                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Edit3 className="w-4 h-4" />}
              onClick={() => task && navigate(`/edit/${task.id}`)}
              disabled={!task || task.status !== 'completed'}
            >
              编辑
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => setShowExportModal(true)}
              disabled={!task || task.status !== 'completed'}
            >
              导出
            </Button>
            {task && task.status === 'failed' && (
              <Button
                variant="success"
                size="sm"
                icon={retrying ? <Loader2 className="w-4 h-4 animate-spin-slow" /> : <RotateCcw className="w-4 h-4" />}
                onClick={handleRetry}
                disabled={retrying}
              >
                {retrying ? '重试中...' : '重试'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<Trash2 className="w-4 h-4 text-red-500" />}
              onClick={handleDelete}
              disabled={deleting}
            />
          </div>
        </div>

        {isRunning && (
          <div className="px-6 py-3 bg-brand-50 border-t border-brand-100">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand-600 animate-spin-slow" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-brand-700">
                    {displayStage ? `正在${displayStage}...` : '处理中...'}
                  </span>
                  <span className="text-xs font-mono text-brand-600 font-medium">
                    {Math.round(displayProgress)}%
                  </span>
                </div>
                <div className="h-2 bg-brand-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500"
                    style={{ width: `${displayProgress}%` }}
                  />
                </div>
                {displayStageDetail && (
                  <p className="text-xs text-brand-500 mt-1.5 truncate">
                    {displayStageDetail}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {task?.status === 'failed' ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">识别失败</h2>
            <p className="text-slate-500 text-sm mb-5 leading-relaxed">
              {task.error?.message || '在识别过程中出现了未预期的错误'}
            </p>
            <div className="space-y-3 text-left mb-7 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-medium text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                建议尝试以下方案
              </p>
              <ul className="text-xs text-amber-600 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>更换清晰度更高的图片</li>
                <li>在图片编辑器中裁剪掉无关区域</li>
                <li>适当旋转图片使其保持水平</li>
                <li>对于暗弱内容可先使用图像增强</li>
              </ul>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                icon={<ArrowLeft className="w-4 h-4" />}
                onClick={() => navigate('/')}
              >
                返回工作台
              </Button>
              <Button
                variant="primary"
                icon={retrying ? <Loader2 className="w-4 h-4 animate-spin-slow" /> : <RotateCcw className="w-4 h-4" />}
                onClick={handleRetry}
                disabled={retrying}
              >
                {retrying ? '重试中...' : '重新识别'}
              </Button>
            </div>
          </div>
        </div>
      ) : !result ? (
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 overflow-y-auto">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-brand-50 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-brand-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {isRunning ? '正在识别中...' : '准备识别结果'}
            </h2>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              {isRunning
                ? '我们正在处理您的手写内容，请稍候片刻，通常需要 5-30 秒'
                : '正在获取识别结果...'}
            </p>
            <div className="space-y-2.5">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500 animate-pulse"
                  style={{ width: `${displayProgress || 30}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 font-mono">
                进度 {Math.round(displayProgress)}%
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
            <div className="shrink-0 px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
              <Tabs
                tabs={[
                  { key: 'compare', label: '左右对照', icon: <SplitSquareVertical className="w-4 h-4" /> },
                  { key: 'layout', label: '排版还原', icon: <Grid3X3 className="w-4 h-4" /> },
                ]}
                activeKey={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
                variant="card"
                size="sm"
              />

              <Button
                variant="ghost"
                size="sm"
                icon={<PanelRightOpen className={cn('w-4 h-4', !drawerOpen && 'rotate-180')} />}
                onClick={() => setDrawerOpen((v) => !v)}
              >
                {drawerOpen ? '收起面板' : '展开面板'}
              </Button>
            </div>

            <div className="flex-1 overflow-hidden">
              {viewMode === 'compare' && (
                <CompareView
                  imageUrl={imageFile?.url}
                  imageFile={imageFile}
                />
              )}
              {viewMode === 'layout' && (
                <LayoutView result={result} />
              )}
            </div>
          </div>

          <div
            className={cn(
              'shrink-0 border-l border-slate-200 bg-white overflow-hidden flex flex-col transition-all duration-300',
              drawerOpen ? 'w-[380px]' : 'w-0 border-l-0',
            )}
          >
            {drawerOpen && (
              <>
                <div className="shrink-0 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700">分析面板</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <div className="p-5 space-y-8">
                    <StatisticsPanel />
                    <ConfidencePanel />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}

export default ResultViewer;
