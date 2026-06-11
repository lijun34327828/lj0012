import { useMemo, useState } from 'react';
import { LayoutGrid, List, Square, CheckSquare, Trash2, Play, Pause, RotateCcw, Download, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OCRTask, TaskStatus, FileCategory } from '@shared/types';
import { CATEGORY_LABELS, STATUS_LABELS } from '@shared/types';
import { TaskCard } from './TaskCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { useUserPrefStore } from '@/stores/userPrefStore';
import { toast } from '@/utils/toast';

export interface TaskQueueProps {
  tasks: OCRTask[];
  loading?: boolean;
  onTaskClick?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskPause?: (taskId: string) => void;
  onTaskRetry?: (taskId: string) => void;
  onTaskEdit?: (taskId: string) => void;
  onBatchDelete?: (taskIds: string[]) => void;
  onBatchPause?: (taskIds: string[]) => void;
  onBatchResume?: (taskIds: string[]) => void;
  onBatchRetry?: (taskIds: string[]) => void;
  onBatchExport?: (taskIds: string[]) => void;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const statusFilterOptions: { key: TaskStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'queued', label: '等待中' },
  { key: 'preprocessing', label: '预处理中' },
  { key: 'ocr_running', label: '识别中' },
  { key: 'layout_restoring', label: '排版中' },
  { key: 'paused', label: '已暂停' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' },
];

const categoryFilterOptions: { key: FileCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部分类' },
  { key: 'exam', label: '试卷' },
  { key: 'note', label: '笔记' },
  { key: 'receipt', label: '单据' },
  { key: 'custom', label: '自定义' },
];

export function TaskQueue({
  tasks,
  loading = false,
  onTaskDelete,
  onTaskPause,
  onTaskRetry,
  onTaskEdit,
  onBatchDelete,
  onBatchPause,
  onBatchResume,
  onBatchRetry,
  onBatchExport,
  className,
  emptyTitle = '暂无任务',
  emptyDescription = '上传图片开始识别，创建您的第一个 OCR 任务',
}: TaskQueueProps) {
  const viewMode = useUserPrefStore((s) => s.viewMode);
  const toggleViewMode = useUserPrefStore((s) => s.toggleViewMode);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchText && !task.name.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && task.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, searchText, statusFilter, categoryFilter]);

  const allSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id));
  const hasSelection = selectedIds.size > 0;

  const handleToggleSelect = (taskId: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(taskId);
      } else {
        next.delete(taskId);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  const handleEnterSelectMode = () => {
    setSelectMode(true);
  };

  const handleExitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = () => {
    const ids = Array.from(selectedIds);
    toast.warning(`已删除 ${ids.length} 个任务`);
    onBatchDelete?.(ids);
    handleExitSelectMode();
  };

  const handleBatchPause = () => {
    const ids = Array.from(selectedIds);
    toast.info(`已暂停 ${ids.length} 个任务`);
    onBatchPause?.(ids);
  };

  const handleBatchResume = () => {
    const ids = Array.from(selectedIds);
    toast.success(`已恢复 ${ids.length} 个任务`);
    onBatchResume?.(ids);
  };

  const handleBatchRetry = () => {
    const ids = Array.from(selectedIds);
    toast.success(`正在重试 ${ids.length} 个任务`);
    onBatchRetry?.(ids);
  };

  const handleBatchExport = () => {
    const ids = Array.from(selectedIds);
    toast.info(`正在导出 ${ids.length} 个任务`);
    onBatchExport?.(ids);
  };

  if (tasks.length === 0 && !loading) {
    return (
      <div className={className}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          size="lg"
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-md min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="搜索任务名称..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300
                     placeholder:text-slate-400 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              showFilters || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'bg-brand-50 text-brand-600 border border-brand-200'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            )}
          >
            <Filter size={16} />
            筛选
          </button>

          {!selectMode ? (
            <button
              onClick={handleEnterSelectMode}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                       bg-white text-slate-600 border border-slate-200 hover:border-slate-300 transition-all"
            >
              <Square size={16} />
              多选
            </button>
          ) : (
            <button
              onClick={handleExitSelectMode}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                       bg-brand-50 text-brand-600 border border-brand-200 transition-all"
            >
              取消
            </button>
          )}

          <div className="inline-flex bg-slate-100 rounded-xl p-1">
            <button
              onClick={toggleViewMode}
              className={cn(
                'p-2 rounded-lg transition-all',
                viewMode === 'grid'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              title="网格视图"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={toggleViewMode}
              className={cn(
                'p-2 rounded-lg transition-all',
                viewMode === 'list'
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              title="列表视图"
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 p-4 mb-5 bg-white rounded-2xl border border-slate-100 shadow-sm animate-slide-down">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">状态：</span>
            <div className="flex flex-wrap gap-1.5">
              {statusFilterOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setStatusFilter(opt.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    statusFilter === opt.key
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-2 hidden md:block" />

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 font-medium">分类：</span>
            <div className="flex flex-wrap gap-1.5">
              {categoryFilterOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setCategoryFilter(opt.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    categoryFilter === opt.key
                      ? 'bg-brand-500 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectMode && (
        <div className={cn(
          'flex flex-wrap items-center justify-between gap-4 p-4 mb-5 rounded-2xl border transition-all',
          hasSelection
            ? 'bg-brand-50 border-brand-200'
            : 'bg-white border-slate-200'
        )}>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAll}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                       bg-white border border-slate-200 hover:bg-slate-50 transition-all"
            >
              {allSelected ? (
                <CheckSquare size={16} className="text-brand-600" />
              ) : (
                <Square size={16} className="text-slate-400" />
              )}
              {allSelected ? '取消全选' : '全选'}
            </button>
            <span className={cn(
              'text-sm font-medium',
              hasSelection ? 'text-brand-600' : 'text-slate-500'
            )}>
              已选择 <span className="font-bold">{selectedIds.size}</span> / {filteredTasks.length} 项
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Pause size={16} />}
              disabled={!hasSelection}
              onClick={handleBatchPause}
            >
              暂停
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Play size={16} />}
              disabled={!hasSelection}
              onClick={handleBatchPause}
            >
              继续
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={16} />}
              disabled={!hasSelection}
              onClick={handleBatchRetry}
            >
              重试
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={16} />}
              disabled={!hasSelection}
              onClick={handleBatchExport}
            >
              导出
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={16} />}
              disabled={!hasSelection}
              onClick={handleBatchDelete}
            >
              删除
            </Button>
          </div>
        </div>
      )}

      {(statusFilter !== 'all' || categoryFilter !== 'all' || searchText) && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-slate-500">筛选结果：</span>
          <Tag variant="primary" size="sm" closable onClose={() => setSearchText('')}>
            搜索: {searchText || '-'}
          </Tag>
          {statusFilter !== 'all' && (
            <Tag variant="info" size="sm" closable onClose={() => setStatusFilter('all')}>
              状态: {STATUS_LABELS[statusFilter as TaskStatus]}
            </Tag>
          )}
          {categoryFilter !== 'all' && (
            <Tag variant="success" size="sm" closable onClose={() => setCategoryFilter('all')}>
              分类: {CATEGORY_LABELS[categoryFilter as FileCategory]}
            </Tag>
          )}
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <EmptyState
          title="未找到匹配的任务"
          description="尝试调整筛选条件或搜索关键词"
          size="md"
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              viewMode="grid"
              selected={selectedIds.has(task.id)}
              onSelect={selectMode ? handleToggleSelect : undefined}
              onDelete={onTaskDelete}
              onPause={onTaskPause}
              onRetry={onTaskRetry}
              onEdit={onTaskEdit}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              viewMode="list"
              selected={selectedIds.has(task.id)}
              onSelect={selectMode ? handleToggleSelect : undefined}
              onDelete={onTaskDelete}
              onPause={onTaskPause}
              onRetry={onTaskRetry}
              onEdit={onTaskEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TaskQueue;
