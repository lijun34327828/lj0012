import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListTodo,
  LayoutGrid,
  List,
  RefreshCw,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Download,
  CheckSquare,
  Square,
  GripVertical,
  Loader2,
  ArrowUpDown,
  Filter,
  ChevronDown,
  MoreHorizontal,
  ClipboardList,
  Eye,
  Edit3,
} from 'lucide-react';
import { TaskQueue } from '@/components/task/TaskQueue';
import { TaskCard } from '@/components/task/TaskCard';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useTaskPolling } from '@/hooks/useTaskPolling';
import { useTaskStore } from '@/stores/taskStore';
import { useUserPrefStore } from '@/stores/userPrefStore';
import {
  listTasks,
  pauseTask,
  resumeTask,
  retryTask,
  deleteTask,
  batchDeleteTasks,
  batchPauseTasks,
  batchResumeTasks,
  batchRetryTasks,
  batchExportTasks,
  getTaskStatus,
} from '@/utils/api';
import { toast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import type { OCRTask, TaskStatus, FileCategory, TaskPriority } from '@shared/types';
import { STATUS_LABELS, CATEGORY_LABELS } from '@shared/types';

type CenterViewMode = 'list' | 'grid';

const STATUS_OPTIONS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'queued', label: STATUS_LABELS.queued },
  { value: 'preprocessing', label: STATUS_LABELS.preprocessing },
  { value: 'ocr_running', label: STATUS_LABELS.ocr_running },
  { value: 'layout_restoring', label: STATUS_LABELS.layout_restoring },
  { value: 'completed', label: STATUS_LABELS.completed },
  { value: 'failed', label: STATUS_LABELS.failed },
  { value: 'paused', label: STATUS_LABELS.paused },
];

const CATEGORY_OPTIONS: { value: FileCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部分类' },
  { value: 'exam', label: CATEGORY_LABELS.exam },
  { value: 'note', label: CATEGORY_LABELS.note },
  { value: 'receipt', label: CATEGORY_LABELS.receipt },
  { value: 'custom', label: CATEGORY_LABELS.custom },
];

const TIME_OPTIONS = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
];

const RUNNING_STATUSES: TaskStatus[] = ['queued', 'preprocessing', 'ocr_running', 'layout_restoring'];

export function TaskCenter() {
  const navigate = useNavigate();
  const {
    tasks,
    setTasks,
    addTask,
    updateTask,
    removeTask,
    startPolling,
    stopPolling,
  } = useTaskStore();
  const { taskCenterViewMode, setTaskCenterViewMode } = useUserPrefStore();

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'all'>('all');
  const [timeFilter, setTimeFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);
  const [priorityMenu, setPriorityMenu] = useState<{ x: number; y: number; taskId: string } | null>(null);

  useEffect(() => {
    loadTasks();
    return () => {
      tasks.forEach((t) => stopPolling(t.id));
    };
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listTasks({ pageSize: 200 });
      const list = response.items;
      setTasks(list);
      list.forEach((t) => {
        if (RUNNING_STATUSES.includes(t.status)) {
          startPolling(t.id, getTaskStatus);
        }
      });
    } catch (e: any) {
      toast.error(e.message || '加载任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [setTasks, startPolling, stopPolling]);

  const timeFilterStart = useMemo(() => {
    const now = Date.now();
    switch (timeFilter) {
      case 'today':
        return new Date().setHours(0, 0, 0, 0);
      case '7d':
        return now - 7 * 24 * 60 * 60 * 1000;
      case '30d':
        return now - 30 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }, [timeFilter]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => (statusFilter === 'all' ? true : t.status === statusFilter))
      .filter((t) => (categoryFilter === 'all' ? true : t.category === categoryFilter))
      .filter((t) => t.createdAt >= timeFilterStart)
      .filter((t) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tasks, statusFilter, categoryFilter, timeFilterStart, searchQuery]);

  const allSelected = filteredTasks.length > 0 && filteredTasks.every((t) => selectedIds.has(t.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  }, [allSelected, filteredTasks]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确定删除该任务？')) return;
    try {
      await deleteTask(id);
      removeTask(id);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast.success('已删除');
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  }, [removeTask]);

  const handlePause = useCallback(async (id: string) => {
    try {
      const result = await pauseTask(id);
      if (result) {
        updateTask(id, { status: 'paused' });
        stopPolling(id);
        toast.success('已暂停');
      }
    } catch (e: any) {
      toast.error(e.message || '暂停失败');
    }
  }, [updateTask, stopPolling]);

  const handleResume = useCallback(async (id: string) => {
    try {
      const result = await resumeTask(id);
      if (result) {
        updateTask(id, { status: 'queued' });
        startPolling(id, getTaskStatus);
        toast.success('已恢复');
      }
    } catch (e: any) {
      toast.error(e.message || '恢复失败');
    }
  }, [updateTask, startPolling]);

  const handleRetry = useCallback(async (id: string) => {
    try {
      const newTask = await retryTask(id);
      addTask(newTask);
      startPolling(newTask.id, getTaskStatus);
      removeTask(id);
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast.success('已重新提交');
    } catch (e: any) {
      toast.error(e.message || '重试失败');
    }
  }, [addTask, removeTask, startPolling]);

  const handleEdit = useCallback((id: string) => navigate(`/edit/${id}`), [navigate]);
  const handleView = useCallback((id: string) => navigate(`/result/${id}`), [navigate]);

  const selectedArr = Array.from(selectedIds);

  const handleBatchPause = useCallback(async () => {
    if (selectedArr.length === 0) return;
    try {
      await batchPauseTasks(selectedArr);
      selectedArr.forEach((id) => {
        updateTask(id, { status: 'paused' });
        stopPolling(id);
      });
      toast.success(`已暂停 ${selectedArr.length} 个任务`);
    } catch (e: any) {
      toast.error(e.message || '批量暂停失败');
    }
  }, [selectedArr, updateTask, stopPolling]);

  const handleBatchResume = useCallback(async () => {
    if (selectedArr.length === 0) return;
    try {
      await batchResumeTasks(selectedArr);
      selectedArr.forEach((id) => {
        updateTask(id, { status: 'queued' });
        startPolling(id, getTaskStatus);
      });
      toast.success(`已恢复 ${selectedArr.length} 个任务`);
    } catch (e: any) {
      toast.error(e.message || '批量恢复失败');
    }
  }, [selectedArr, updateTask, startPolling]);

  const handleBatchRetry = useCallback(async () => {
    if (selectedArr.length === 0) return;
    try {
      const result = await batchRetryTasks(selectedArr);
      const count = result.updated || selectedArr.length;
      selectedArr.forEach((id) => {
        updateTask(id, { status: 'queued' });
        startPolling(id, getTaskStatus);
      });
      setSelectedIds(new Set());
      toast.success(`已重试 ${count} 个任务`);
    } catch (e: any) {
      toast.error(e.message || '批量重试失败');
    }
  }, [selectedArr, updateTask, startPolling]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedArr.length === 0) return;
    if (!confirm(`确定删除 ${selectedArr.length} 个任务？`)) return;
    try {
      await batchDeleteTasks(selectedArr);
      selectedArr.forEach((id) => removeTask(id));
      setSelectedIds(new Set());
      toast.success('批量删除完成');
    } catch (e: any) {
      toast.error(e.message || '批量删除失败');
    }
  }, [selectedArr, removeTask]);

  const handleBatchExport = useCallback(async () => {
    if (selectedArr.length === 0) return;
    try {
      await batchExportTasks(selectedArr, 'docx');
      toast.success('已生成导出，请在下载中查看');
    } catch (e: any) {
      toast.error(e.message || '批量导出失败');
    }
  }, [selectedArr]);

  const counts = useMemo(() => {
    const all = tasks.length;
    const running = tasks.filter((t) => RUNNING_STATUSES.includes(t.status)).length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const failed = tasks.filter((t) => t.status === 'failed').length;
    return { all, running, completed, failed };
  }, [tasks]);

  const viewMode: CenterViewMode = (taskCenterViewMode as CenterViewMode) || 'list';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ListTodo className="w-6 h-6 text-brand-500" />
            <h1 className="text-2xl font-bold text-slate-800">任务中心</h1>
          </div>
          <p className="text-sm text-slate-500">
            查看和管理所有识别任务的执行状态
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-slate-500 flex items-center gap-1">
            <span>共</span>
            <span className="font-semibold text-slate-700 font-mono">{counts.all}</span>
            <span>个任务</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin-slow')} />}
            onClick={loadTasks}
          >
            刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div onClick={() => setStatusFilter('all')} className={cn(
          'cursor-pointer rounded-xl border p-4 transition-all',
          statusFilter === 'all'
            ? 'border-brand-500 bg-brand-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300',
        )}>
          <div className="text-xs text-slate-500 mb-1">全部任务</div>
          <div className="text-2xl font-bold text-slate-800 font-mono">{counts.all}</div>
        </div>
        <div onClick={() => setStatusFilter('preprocessing')} className={cn(
          'cursor-pointer rounded-xl border p-4 transition-all',
          RUNNING_STATUSES.includes(statusFilter as TaskStatus)
            ? 'border-blue-500 bg-blue-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300',
        )}>
          <div className="text-xs text-slate-500 mb-1">进行中</div>
          <div className="text-2xl font-bold text-blue-600 font-mono">{counts.running}</div>
        </div>
        <div onClick={() => setStatusFilter('completed')} className={cn(
          'cursor-pointer rounded-xl border p-4 transition-all',
          statusFilter === 'completed'
            ? 'border-emerald-500 bg-emerald-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300',
        )}>
          <div className="text-xs text-slate-500 mb-1">已完成</div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">{counts.completed}</div>
        </div>
        <div onClick={() => setStatusFilter('failed')} className={cn(
          'cursor-pointer rounded-xl border p-4 transition-all',
          statusFilter === 'failed'
            ? 'border-red-500 bg-red-50/60 shadow-sm'
            : 'border-slate-200 bg-white hover:border-slate-300',
        )}>
          <div className="text-xs text-slate-500 mb-1">失败</div>
          <div className="text-2xl font-bold text-red-600 font-mono">{counts.failed}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <ClipboardList className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索任务名称或ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
              className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as FileCategory | 'all')}
              className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition"
            >
              {TIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setTaskCenterViewMode('list')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  viewMode === 'list'
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
                title="列表视图"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTaskCenterViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  viewMode === 'grid'
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700',
                )}
                title="网格视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800"
            >
              {allSelected ? (
                <CheckSquare className="w-4 h-4 text-brand-500" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              <span>全选</span>
            </button>

            {selectedIds.size > 0 && (
              <>
                <span className="text-sm text-slate-400">|</span>
                <span className="text-sm text-slate-600">
                  已选 <span className="font-semibold font-mono text-brand-600">{selectedIds.size}</span> 个
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <Button size="sm" variant="ghost" icon={<Pause className="w-4 h-4 text-slate-500" />} onClick={handleBatchPause}>
                    暂停
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Play className="w-4 h-4 text-slate-500" />} onClick={handleBatchResume}>
                    继续
                  </Button>
                  <Button size="sm" variant="ghost" icon={<RotateCcw className="w-4 h-4 text-slate-500" />} onClick={handleBatchRetry}>
                    重试
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4 text-slate-500" />} onClick={handleBatchExport}>
                    导出
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 className="w-4 h-4 text-red-500" />} onClick={handleBatchDelete}>
                    删除
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {loading && filteredTasks.length === 0 ? (
          <div className="py-20 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin-slow" />
            正在加载任务...
          </div>
        ) : viewMode === 'list' ? (
          <TaskQueue
            tasks={filteredTasks}
            loading={loading}
            onTaskDelete={handleDelete}
            onTaskPause={handlePause}
            onTaskResume={handleResume}
            onTaskRetry={handleRetry}
            onTaskEdit={handleEdit}
            onBatchDelete={handleBatchDelete}
            onBatchPause={handleBatchPause}
            onBatchResume={handleBatchResume}
            onBatchRetry={handleBatchRetry}
            onBatchExport={handleBatchExport}
          />
        ) : (
          <div className="p-4">
            {filteredTasks.length === 0 ? (
              <div className="py-16 text-center">
                <ListTodo className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 mb-2">暂无匹配的任务</p>
                <p className="text-sm text-slate-400">尝试调整筛选条件或在工作台创建新任务</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => handleView(task.id)}
                    className="group cursor-pointer"
                  >
                    <TaskCard
                      task={task}
                      viewMode="grid"
                      selected={selectedIds.has(task.id)}
                      onSelect={(id: string, selected: boolean) => {
                        toggleSelect(id);
                      }}
                      onDelete={(id: string) => {
                        handleDelete(id);
                      }}
                      onPause={(id: string) => {
                        handlePause(id);
                      }}
                      onResume={(id: string) => {
                        handleResume(id);
                      }}
                      onRetry={(id: string) => {
                        handleRetry(id);
                      }}
                      onEdit={(id: string) => {
                        handleEdit(id);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TaskCenter;
