import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MoreVertical,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Edit3,
  FileImage,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OCRTask } from '@shared/types';
import { CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS } from '@shared/types';
import { Tag } from '@/components/ui/Tag';
import { ProgressBar } from './ProgressBar';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { formatProgress } from '@/utils/format';
import { toast } from '@/utils/toast';

export interface TaskCardProps {
  task: OCRTask;
  viewMode?: 'list' | 'grid';
  selected?: boolean;
  onSelect?: (taskId: string, selected: boolean) => void;
  onDelete?: (taskId: string) => void;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
  className?: string;
}

function StatusBadge({ status }: { status: OCRTask['status'] }) {
  const statusColors: Record<OCRTask['status'], string> = {
    queued: 'bg-slate-100 text-slate-600',
    preprocessing: 'bg-info-50 text-info-600',
    ocr_running: 'bg-brand-50 text-brand-600',
    layout_restoring: 'bg-violet-50 text-violet-600',
    paused: 'bg-amber-50 text-amber-600',
    completed: 'bg-emerald-50 text-emerald-600',
    failed: 'bg-red-50 text-red-600',
  };

  const statusIcons: Record<OCRTask['status'], typeof Clock> = {
    queued: Clock,
    preprocessing: Loader2,
    ocr_running: Loader2,
    layout_restoring: Loader2,
    paused: Pause,
    completed: CheckCircle2,
    failed: AlertCircle,
  };

  const Icon = statusIcons[status];
  const isLoading = status === 'preprocessing' || status === 'ocr_running' || status === 'layout_restoring';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
        statusColors[status]
      )}
    >
      <Icon className={cn(isLoading && 'animate-spin-slow')} size={14} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`;

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TaskCard({
  task,
  viewMode = 'grid',
  selected = false,
  onSelect,
  onDelete,
  onPause,
  onResume,
  onRetry,
  onEdit,
  className,
}: TaskCardProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { status, progress, currentStage, stageDetail } = useTaskPolling(task.id);

  const displayProgress = status !== null ? progress : task.progress;
  const displayStatus = status || task.status;
  const displayStage = currentStage || task.currentStage;

  const displayStageProgress = task.stageProgress;

  const isRunning = ['queued', 'preprocessing', 'ocr_running', 'layout_restoring'].includes(displayStatus);
  const isPaused = displayStatus === 'paused';
  const isFailed = displayStatus === 'failed';
  const isCompleted = displayStatus === 'completed';

  useEffect(() => {
    if (status && status !== task.status) {
    }
  }, [status, task.status]);

  const handleClick = () => {
    if (onSelect) return;
    navigate(`/result/${task.id}`);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(task.id, e.target.checked);
  };

  const handleAction = (action: 'pause' | 'resume' | 'retry' | 'delete' | 'edit') => {
    setMenuOpen(false);
    switch (action) {
      case 'pause':
        toast.info('任务已暂停');
        onPause?.(task.id);
        break;
      case 'resume':
        toast.info('任务已恢复');
        onResume?.(task.id);
        break;
      case 'retry':
        toast.success('正在重新处理任务');
        onRetry?.(task.id);
        break;
      case 'delete':
        toast.warning('任务已删除');
        onDelete?.(task.id);
        break;
      case 'edit':
        toast.info('编辑任务');
        onEdit?.(task.id);
        break;
    }
  };

  const thumbnailUrl = task.result?.pages
    ? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"><rect width="120" height="160" fill="#faf8f5"/><line x1="15" y1="30" x2="105" y2="30" stroke="#cbd5e1" stroke-width="1.5"/><line x1="15" y1="50" x2="105" y2="50" stroke="#cbd5e1" stroke-width="1.5"/><line x1="15" y1="70" x2="90" y2="70" stroke="#cbd5e1" stroke-width="1.5"/><line x1="15" y1="90" x2="100" y2="90" stroke="#cbd5e1" stroke-width="1.5"/><line x1="15" y1="110" x2="85" y2="110" stroke="#cbd5e1" stroke-width="1.5"/></svg>`
      )}`
    : undefined;

  if (viewMode === 'list') {
    return (
      <div
        className={cn(
          'card-base p-4 flex items-center gap-4 cursor-pointer group',
          selected && 'ring-2 ring-brand-500 ring-offset-2 bg-brand-50/50',
          className
        )}
        onClick={handleClick}
      >
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={handleCheckboxChange}
            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0 cursor-pointer"
          />
        )}

        <div className="w-16 h-20 rounded-lg bg-paper-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <FileImage className="w-7 h-7 text-slate-300" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-slate-800 truncate">{task.name}</h4>
            <Tag variant="primary" size="sm">
              {CATEGORY_LABELS[task.category]}
            </Tag>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <StatusBadge status={displayStatus} />
            {stageDetail && isRunning && (
              <span className="text-xs text-slate-500 truncate">{stageDetail}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-xs">
              <ProgressBar
                percent={displayProgress}
                color={isCompleted ? 'success' : isFailed ? 'danger' : isPaused ? 'warning' : 'primary'}
                showPercent={false}
                striped={isRunning}
                animated={isRunning}
                size="sm"
              />
            </div>
            <span className="text-xs font-mono text-slate-500 min-w-[3rem]">
              {formatProgress(displayProgress)}
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
              <Clock size={12} />
              {formatDateTime(task.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <MoreVertical size={18} />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-card border border-slate-100 py-1.5 z-20 animate-fade-in">
                  {(isRunning || isPaused) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(isPaused ? 'resume' : 'pause');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {isPaused ? <Play size={16} /> : <Pause size={16} />}
                      {isPaused ? '继续任务' : '暂停任务'}
                    </button>
                  )}
                  {isFailed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction('retry');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <RotateCcw size={16} />
                      重试任务
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('edit');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 size={16} />
                    编辑信息
                  </button>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('delete');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                    删除任务
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'card-base p-5 cursor-pointer group flex flex-col h-full',
        selected && 'ring-2 ring-brand-500 ring-offset-2 bg-brand-50/50',
        className
      )}
      onClick={handleClick}
    >
      <div className="flex items-start gap-3 mb-4">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={handleCheckboxChange}
            className="w-4 h-4 mt-1 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0 cursor-pointer"
          />
        )}

        <div className="flex-1 w-24 h-32 rounded-xl bg-paper-100 border border-slate-200 overflow-hidden shrink-0 mb-4">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <FileImage className="w-10 h-10 text-slate-300" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-slate-800 line-clamp-1 flex-1">{task.name}</h4>
          <Tag variant="primary" size="sm">
            {CATEGORY_LABELS[task.category]}
          </Tag>
        </div>

        <div className="flex items-center justify-between gap-2 mb-4">
          <StatusBadge status={displayStatus} />
          <span className="text-xs font-mono text-slate-500">
            {formatProgress(displayProgress)}
          </span>
        </div>

        <ProgressBar
          percent={displayProgress}
          color={isCompleted ? 'success' : isFailed ? 'danger' : isPaused ? 'warning' : 'primary'}
          showPercent={false}
          striped={isRunning}
          animated={isRunning}
          size="sm"
          className="mb-4"
        />

        {stageDetail && isRunning && (
          <p className="text-xs text-slate-500 mb-3 truncate">{stageDetail}</p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock size={12} />
            {formatDateTime(task.createdAt)}
          </span>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-card border border-slate-100 py-1.5 z-20 animate-fade-in">
                  {(isRunning || isPaused) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction(isPaused ? 'resume' : 'pause');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {isPaused ? <Play size={14} /> : <Pause size={14} />}
                      {isPaused ? '继续' : '暂停'}
                    </button>
                  )}
                  {isFailed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAction('retry');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <RotateCcw size={14} />
                      重试
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('edit');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 size={14} />
                    编辑
                  </button>
                  <div className="my-1 h-px bg-slate-100" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction('delete');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskCard;
