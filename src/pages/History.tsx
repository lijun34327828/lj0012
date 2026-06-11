import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History as HistoryIcon,
  Search,
  LayoutGrid,
  List,
  Calendar,
  ArrowUpDown,
  FileText,
  Eye,
  Edit3,
  Download,
  Folders,
  Trash2,
  Square,
  CheckSquare,
  MoreHorizontal,
  Upload,
  Clock,
  FileImage,
  ChevronDown,
  FolderOpen,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';
import { ExportModal } from '@/components/export/ExportModal';
import { useUserPrefStore } from '@/stores/userPrefStore';
import { useUploadStore } from '@/stores/uploadStore';
import {
  listHistory,
  deleteHistoryItem,
  batchDeleteHistory,
  batchMoveCategory,
  batchExportHistory,
} from '@/utils/api';
import { toast } from '@/utils/toast';
import { cn } from '@/lib/utils';
import type { HistoryRecord, FileCategory } from '@shared/types';
import { CATEGORY_LABELS } from '@shared/types';

type HistoryViewMode = 'grid' | 'list';
type SortKey = 'createdAt' | 'lastViewedAt' | 'charCount';

const CATEGORY_TABS: { value: FileCategory | 'all'; label: string; key: FileCategory | 'all' }[] = [
  { value: 'all', label: '全部', key: 'all' },
  { value: 'exam', label: CATEGORY_LABELS.exam, key: 'exam' },
  { value: 'note', label: CATEGORY_LABELS.note, key: 'note' },
  { value: 'receipt', label: CATEGORY_LABELS.receipt, key: 'receipt' },
  { value: 'custom', label: CATEGORY_LABELS.custom, key: 'custom' },
];

const FILE_CATEGORIES: FileCategory[] = ['exam', 'note', 'receipt', 'custom'];

const TIME_RANGES = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'custom', label: '自定义' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'lastViewedAt', label: '查看时间' },
  { value: 'charCount', label: '字数' },
];

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) {
    return `昨天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function History() {
  const navigate = useNavigate();
  const { historyViewMode, setHistoryViewMode } = useUserPrefStore();
  const { files: uploadedFiles } = useUploadStore();

  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<FileCategory | 'all'>('all');
  const [activeTime, setActiveTime] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [currentExportTaskId, setCurrentExportTaskId] = useState<string | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveTargetCategory, setMoveTargetCategory] = useState<FileCategory>('note');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');

  useEffect(() => {
    load();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await listHistory({ pageSize: 500 });
      setRecords(resp.items);
    } catch (e: any) {
      toast.error(e.message || '加载历史记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { all: records.length };
    records.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + 1;
    });
    return map;
  }, [records]);

  const timeRangeStart = useMemo(() => {
    if (activeTime === 'custom') {
      return dateStart ? new Date(dateStart).getTime() : 0;
    }
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    switch (activeTime) {
      case 'today':
        return today.getTime();
      case 'week':
        return now - 7 * 24 * 60 * 60 * 1000;
      case 'month':
        return now - 30 * 24 * 60 * 60 * 1000;
      default:
        return 0;
    }
  }, [activeTime, dateStart]);

  const timeRangeEnd = useMemo(() => {
    if (activeTime === 'custom') {
      return dateEnd ? new Date(dateEnd).getTime() + 24 * 60 * 60 * 1000 : Infinity;
    }
    return Infinity;
  }, [activeTime, dateEnd]);

  const filteredRecords = useMemo(() => {
    let list = records.filter((r) =>
      activeCategory === 'all' ? true : r.category === activeCategory,
    );
    list = list.filter(
      (r) => r.createdAt >= timeRangeStart && r.createdAt <= timeRangeEnd,
    );
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.summary || '').toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortDesc ? bv - av : av - bv;
    });
    return list;
  }, [records, activeCategory, timeRangeStart, timeRangeEnd, searchQuery, sortKey, sortDesc]);

  const toggleSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allSelected = filteredRecords.length > 0 && filteredRecords.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  }, [allSelected, filteredRecords]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定删除该记录？')) return;
    try {
      await deleteHistoryItem(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setSelectedIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      toast.success('已删除');
    } catch (e: any) {
      toast.error(e.message || '删除失败');
    }
  }, []);

  const selectedArr = Array.from(selectedIds);

  const handleBatchDelete = useCallback(async () => {
    if (selectedArr.length === 0) return;
    if (!confirm(`确定删除 ${selectedArr.length} 条记录？`)) return;
    try {
      await batchDeleteHistory(selectedArr);
      setRecords((prev) => prev.filter((r) => !selectedArr.includes(r.id)));
      setSelectedIds(new Set());
      toast.success('批量删除完成');
    } catch (e: any) {
      toast.error(e.message || '批量删除失败');
    }
  }, [selectedArr]);

  const handleBatchMove = useCallback(async () => {
    if (selectedArr.length === 0) return;
    try {
      await batchMoveCategory(selectedArr, moveTargetCategory);
      setRecords((prev) =>
        prev.map((r) =>
          selectedArr.includes(r.id) ? { ...r, category: moveTargetCategory } : r,
        ),
      );
      toast.success(`已移动至「${CATEGORY_LABELS[moveTargetCategory]}」`);
      setShowMoveDialog(false);
    } catch (e: any) {
      toast.error(e.message || '批量移动失败');
    }
  }, [selectedArr, moveTargetCategory]);

  const handleBatchExport = useCallback(async () => {
    if (selectedArr.length === 0) return;
    try {
      const resp = await listHistory({ pageSize: 500 });
      const taskIds = resp.items
        .filter((r) => selectedArr.includes(r.id))
        .map((r) => r.taskId);
      if (taskIds.length === 0) {
        toast.warning('未找到可导出的任务');
        return;
      }
      await batchExportHistory(taskIds, 'docx');
      toast.success('导出任务已创建');
    } catch (e: any) {
      toast.error(e.message || '批量导出失败');
    }
  }, [selectedArr]);

  const handleExportSingle = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentExportTaskId(taskId);
    setShowExportModal(true);
  }, []);

  const handleOpen = useCallback((rec: HistoryRecord) => {
    navigate(`/result/${rec.taskId}`);
  }, [navigate]);

  const handleEdit = useCallback((taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/edit/${taskId}`);
  }, [navigate]);

  const viewMode: HistoryViewMode = (historyViewMode as HistoryViewMode) || 'grid';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HistoryIcon className="w-6 h-6 text-brand-500" />
            <h1 className="text-2xl font-bold text-slate-800">历史记录</h1>
          </div>
          <p className="text-sm text-slate-500">
            浏览、搜索和管理您过去的识别结果
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Upload className="w-4 h-4" />}
          onClick={() => navigate('/')}
        >
          新建识别
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-5 pt-4">
          <div className="flex items-center gap-1 flex-wrap -mx-1">
            {CATEGORY_TABS.map((tab) => {
              const active = activeCategory === tab.value;
              const count = categoryCounts[tab.key] || 0;
              return (
                <button
                  key={tab.value}
                  onClick={() => {
                    setActiveCategory(tab.value);
                    setSelectedIds(new Set());
                  }}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-md transition-all mb-3 mx-1',
                    active
                      ? 'bg-brand-50 text-brand-700 font-medium shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-mono rounded-full',
                      active ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-slate-200 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索名称或内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none transition"
              />
            </div>

            <div className="relative">
              <select
                value={activeTime}
                onChange={(e) => setActiveTime(e.target.value)}
                className="h-9 pl-9 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none appearance-none transition"
              >
                {TIME_RANGES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {activeTime === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
                />
                <span className="text-slate-400 text-sm">至</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
                />
              </div>
            )}

            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="h-9 pl-9 pr-8 text-sm rounded-lg border border-slate-200 bg-white focus:border-brand-400 focus:ring-2 focus:ring-brand-100 outline-none appearance-none transition"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ArrowUpDown className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={() => setSortDesc((v) => !v)}
              className="h-9 px-3 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition inline-flex items-center gap-1"
              title={sortDesc ? '降序' : '升序'}
            >
              <ArrowUpDown className={cn('w-4 h-4 text-slate-500', !sortDesc && 'rotate-180')} />
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1" />

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setHistoryViewMode('grid')}
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
              <button
                onClick={() => setHistoryViewMode('list')}
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
                  已选 <span className="font-semibold font-mono text-brand-600">{selectedIds.size}</span> 条
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Folders className="w-4 h-4 text-slate-500" />}
                    onClick={() => setShowMoveDialog(true)}
                  >
                    移动分类
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Download className="w-4 h-4 text-slate-500" />}
                    onClick={handleBatchExport}
                  >
                    批量导出
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="w-4 h-4 text-red-500" />}
                    onClick={handleBatchDelete}
                  >
                    批量删除
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin-slow" />
            正在加载历史记录...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-8">
            <EmptyState
              size="lg"
              icon={
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <FolderOpen className="w-8 h-8 text-slate-400" />
                </div>
              }
              title={records.length === 0 ? '还没有识别记录' : '没有匹配的记录'}
              description={
                records.length === 0
                  ? '前往工作台上传图片，开始您的第一次手写识别'
                  : '尝试调整搜索关键词或筛选条件'
              }
              action={
                records.length === 0 ? (
                  <Button
                    variant="primary"
                    icon={<Sparkles className="w-4 h-4" />}
                    onClick={() => navigate('/')}
                  >
                    去工作台
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredRecords.map((rec) => {
                const sel = selectedIds.has(rec.id);
                const category = rec.category as keyof typeof CATEGORY_LABELS;
                return (
                  <div
                    key={rec.id}
                    className="group relative rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                    onClick={() => handleOpen(rec)}
                  >
                    <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                      {rec.thumbnail ? (
                        <img
                          src={rec.thumbnail}
                          alt={rec.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <FileImage className="w-10 h-10 opacity-40" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => toggleSelect(rec.id, e)}
                          className="w-6 h-6 rounded-md bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition"
                        >
                          {sel ? (
                            <CheckSquare className="w-4 h-4 text-brand-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                      </div>
                      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handleEdit(rec.taskId, e)}
                          className="w-7 h-7 rounded-md bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition"
                          title="编辑"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <button
                          onClick={(e) => handleExportSingle(rec.taskId, e)}
                          className="w-7 h-7 rounded-md bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition"
                          title="导出"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpen(menuOpen === rec.id ? null : rec.id);
                            }}
                            className="w-7 h-7 rounded-md bg-white/90 backdrop-blur flex items-center justify-center shadow-sm hover:bg-white transition"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                          {menuOpen === rec.id && (
                            <div
                              className="absolute right-0 top-8 z-50 min-w-[140px] py-1 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                onClick={(e) => {
                                  setMenuOpen(null);
                                  handleOpen(rec);
                                }}
                              >
                                <Eye className="w-3.5 h-3.5" /> 查看
                              </button>
                              <button
                                className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                onClick={(e) => {
                                  setMenuOpen(null);
                                  handleEdit(rec.taskId, e);
                                }}
                              >
                                <Edit3 className="w-3.5 h-3.5" /> 编辑
                              </button>
                              <button
                                className="w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                onClick={(e) => {
                                  setMenuOpen(null);
                                  handleExportSingle(rec.taskId, e);
                                }}
                              >
                                <Download className="w-3.5 h-3.5" /> 导出
                              </button>
                              <div className="h-px bg-slate-100 my-1" />
                              <button
                                className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                                onClick={(e) => {
                                  setMenuOpen(null);
                                  handleDelete(rec.id, e);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" /> 删除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {sel && (
                        <div className="absolute inset-0 border-2 border-brand-500 rounded-xl pointer-events-none" />
                      )}
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <h3 className="text-sm font-medium text-slate-800 line-clamp-1 flex-1 min-w-0">
                          {rec.name}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between">
                        <Tag size="sm" variant="default">
                          {CATEGORY_LABELS[category]}
                        </Tag>
                        <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {(rec.charCount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(rec.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-left text-slate-500 text-xs uppercase tracking-wider">
                  <th className="w-10 px-4 py-3 font-medium">
                    <button onClick={toggleSelectAll}>
                      {allSelected ? (
                        <CheckSquare className="w-4 h-4 text-brand-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium">缩略图</th>
                  <th className="px-4 py-3 font-medium">名称</th>
                  <th className="px-4 py-3 font-medium">分类</th>
                  <th className="px-4 py-3 font-medium">字数</th>
                  <th className="px-4 py-3 font-medium">创建时间</th>
                  <th className="px-4 py-3 font-medium">最后查看</th>
                  <th className="px-4 py-3 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((rec) => {
                  const sel = selectedIds.has(rec.id);
                  const category = rec.category as keyof typeof CATEGORY_LABELS;
                  return (
                    <tr
                      key={rec.id}
                      onClick={() => handleOpen(rec)}
                      className={cn(
                        'border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors',
                        sel && 'bg-brand-50/40',
                      )}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button onClick={(e) => toggleSelect(rec.id, e)}>
                          {sel ? (
                            <CheckSquare className="w-4 h-4 text-brand-500" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-14 h-10 rounded-md bg-slate-100 overflow-hidden flex items-center justify-center">
                          {rec.thumbnail ? (
                            <img src={rec.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <FileImage className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 line-clamp-1 max-w-xs">
                        {rec.name}
                      </td>
                      <td className="px-4 py-3">
                        <Tag size="sm" variant="default">
                          {CATEGORY_LABELS[category]}
                        </Tag>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {(rec.charCount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {formatDate(rec.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {rec.lastViewedAt ? formatDate(rec.lastViewedAt) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => handleEdit(rec.taskId, e)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="编辑"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleExportSingle(rec.taskId, e)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="导出"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(rec.id, e)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowMoveDialog(false)}>
          <div
            className="w-[420px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <Folders className="w-5 h-5 text-brand-500" />
              <h3 className="font-semibold text-slate-800">移动到分类</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-500">
                将 <span className="font-mono font-medium text-brand-600">{selectedArr.length}</span> 条记录移动到：
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FILE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMoveTargetCategory(cat)}
                    className={cn(
                      'px-3 py-2 text-sm rounded-lg border transition-all text-left',
                      moveTargetCategory === cat
                        ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700',
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50/50 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowMoveDialog(false)}>
                取消
              </Button>
              <Button variant="primary" onClick={handleBatchMove}>
                确认移动
              </Button>
            </div>
          </div>
        </div>
      )}

      <ExportModal
        open={showExportModal}
        onClose={() => {
          setShowExportModal(false);
          setCurrentExportTaskId(null);
        }}
        taskId={currentExportTaskId}
      />
    </div>
  );
}

export default History;
