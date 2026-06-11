import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Undo2,
  Redo2,
  Download,
  Eye,
  PanelLeftOpen,
  FileText,
  PenTool,
  BadgePercent,
  Clock,
  AlertCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { RichEditor } from '@/components/result/RichEditor';
import { ConfidencePanel } from '@/components/result/ConfidencePanel';
import { ExportModal } from '@/components/export/ExportModal';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { useResultStore } from '@/stores/resultStore';
import { useTaskStore } from '@/stores/taskStore';
import { getTaskResult, saveResult as saveResultApi, getTaskStatus } from '@/utils/api';
import { toast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import type { LayoutResult, TextBlock } from '@shared/types';
import { CATEGORY_LABELS } from '@shared/types';

export function ResultEditor() {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const {
    setTask,
    setResult,
    isDirty,
    currentTask,
    currentResult,
    editedBlocks,
    collectEdits,
    markSaved,
    clearAll,
  } = useResultStore();
  const { updateTask } = useTaskStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  useEffect(() => {
    return () => clearAll();
  }, [clearAll]);

  useEffect(() => {
    if (!taskId) return;
    load(taskId);
  }, [taskId]);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await getTaskResult(id);
      setResult(res.result || null);
      setTask(res);
    } catch (e: any) {
      toast.error(e.message || '加载结果失败');
    } finally {
      setLoading(false);
    }
  }, [setResult, setTask]);

  const handleSave = useCallback(async () => {
    if (!taskId || !currentResult) return;
    setSaving(true);
    try {
      const edits = collectEdits();
      await saveResultApi(taskId, edits);
      markSaved();
      setLastSavedAt(Date.now());
      toast.success('已保存修改');
    } catch (e: any) {
      toast.error(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }, [taskId, currentResult, collectEdits, markSaved]);

  const handleSaveAndView = useCallback(async () => {
    if (isDirty) {
      await handleSave();
    }
    if (taskId) navigate(`/result/${taskId}`);
  }, [isDirty, handleSave, taskId, navigate]);

  const stats = useMemo(() => {
    if (!currentResult) return { totalChars: 0, handwrittenChars: 0, avgConfidence: 0 };
    let total = 0;
    let hand = 0;
    let confSum = 0;
    let confCount = 0;
    (currentResult.blocks || []).forEach((b) => {
      b.texts.forEach((tb) => {
        const len = tb.content.length;
        total += len;
        if (tb.type === 'handwritten') hand += len;
        if (typeof tb.confidence === 'number') {
          confSum += tb.confidence * len;
          confCount += len;
        }
      });
    });
    return {
      totalChars: total,
      handwrittenChars: hand,
      avgConfidence: confCount > 0 ? confSum / confCount : 0,
    };
  }, [currentResult]);

  if (!taskId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        无效的任务ID
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin-slow" />
        正在加载识别结果...
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col -mx-6 -my-6">
      <div className="shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4 px-6 py-3">
          <button
            onClick={() => {
              if (isDirty && !confirm('您有未保存的修改，确认离开？')) return;
              navigate(-1);
            }}
            className="flex items-center gap-1.5 px-2 py-1 text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-base font-semibold text-slate-800 truncate">
                编辑 - {currentTask?.name || '未命名'}
              </h1>
              {currentTask?.category && (
                <Tag size="sm" variant="default">
                  {CATEGORY_LABELS[currentTask.category]}
                </Tag>
              )}
              {isDirty && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  未保存
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => setShowExportModal(true)}
              disabled={saving}
            >
              导出
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Eye className="w-4 h-4" />}
              onClick={() => taskId && window.open(`#/result/${taskId}`, '_blank')}
              disabled={saving}
            >
              预览排版
            </Button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <Button
              variant="secondary"
              size="sm"
              icon={saving ? <Loader2 className="w-4 h-4 animate-spin-slow" /> : <Save className="w-4 h-4" />}
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={isDirty ? <Sparkles className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              onClick={handleSaveAndView}
              disabled={saving}
            >
              保存并查看
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 bg-slate-50">
        <div
          className={cn(
            'shrink-0 border-r border-slate-200 bg-white overflow-hidden flex flex-col transition-all duration-300',
            leftPanelOpen ? 'w-[340px]' : 'w-0 border-r-0',
          )}
        >
          {leftPanelOpen && (
            <>
              <div className="shrink-0 px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700 text-sm">低置信度审查</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<PanelLeftOpen className={cn('w-4 h-4', !leftPanelOpen && 'rotate-180')} />}
                  onClick={() => setLeftPanelOpen(false)}
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {currentResult ? (
                  <div className="p-4">
                    <ConfidencePanel
                      threshold={0.85}
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {!leftPanelOpen && (
          <div className="shrink-0 p-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<PanelLeftOpen className="w-4 h-4" />}
              onClick={() => setLeftPanelOpen(true)}
              title="展开置信度面板"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
            {currentResult ? (
              <div className="max-w-4xl mx-auto py-8 px-6">
                <RichEditor />
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur px-6 py-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  字数统计：
                  <span className="font-mono font-medium text-slate-700">
                    {stats.totalChars.toLocaleString()}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-slate-400" />
                  手写占比：
                  <span className="font-mono font-medium text-slate-700">
                    {stats.totalChars > 0
                      ? Math.round((stats.handwrittenChars / stats.totalChars) * 100)
                      : 0}%
                  </span>
                  <span className="text-slate-400">
                    ({stats.handwrittenChars.toLocaleString()}/{stats.totalChars.toLocaleString()})
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <BadgePercent className="w-3.5 h-3.5 text-slate-400" />
                  平均置信度：
                  <span className={cn(
                    'font-mono font-medium',
                    stats.avgConfidence >= 0.9 ? 'text-emerald-600' :
                    stats.avgConfidence >= 0.75 ? 'text-amber-600' : 'text-red-600',
                  )}>
                    {(stats.avgConfidence * 100).toFixed(1)}%
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-5">
                {lastSavedAt !== null && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    上次保存：
                    <span className="font-mono text-slate-600">
                      {new Date(lastSavedAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </span>
                  </span>
                )}
                {isDirty ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium border border-amber-200">
                    <AlertCircle className="w-3 h-3" />
                    有未保存的修改
                  </span>
                ) : lastSavedAt !== null ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" />
                    已保存
                  </span>
                ) : (
                  <span className="text-slate-400">尚未修改</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExportModal
        open={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
}

export default ResultEditor;
