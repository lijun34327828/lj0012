import { useMemo } from 'react';
import {
  FileText,
  PenLine,
  Printer,
  Clock,
  Layers,
  Grid3X3,
  BarChart3,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import type { LayoutResult, OCRTask } from '@shared/types';
import { useResultStore } from '@/stores/resultStore';
import { useTaskStore } from '@/stores/taskStore';
import { Tag } from '@/components/ui/Tag';
import { cn } from '@/lib/utils';

interface StatisticsPanelProps {
  onJumpToLowConfidence?: () => void;
}

interface StatCardProps {
  icon: typeof FileText;
  label: string;
  value: string | number;
  color?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  suffix?: string;
}

function StatCard({ icon: Icon, label, value, color = 'default', suffix }: StatCardProps) {
  const colorMap = {
    default: 'bg-slate-50 text-slate-600 border-slate-200',
    primary: 'bg-brand-50 text-brand-600 border-brand-200',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    warning: 'bg-amber-50 text-amber-600 border-amber-200',
    danger: 'bg-red-50 text-red-600 border-red-200',
  };
  const iconBg = colorMap[color];

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-slate-500 mb-1.5">{label}</div>
          <div className="text-2xl font-bold text-slate-800 tabular-nums leading-tight">
            {value}
            {suffix && <span className="text-sm font-normal text-slate-400 ml-1">{suffix}</span>}
          </div>
        </div>
        <div className={cn('p-2 rounded-lg border', iconBg)}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ConfidenceHistogram({ data }: { data: number[] }) {
  const buckets = [
    { min: 0, max: 0.6, label: '<60%', color: 'bg-danger-500' },
    { min: 0.6, max: 0.75, label: '60-75%', color: 'bg-amber-500' },
    { min: 0.75, max: 0.85, label: '75-85%', color: 'bg-amber-400' },
    { min: 0.85, max: 0.95, label: '85-95%', color: 'bg-emerald-400' },
    { min: 0.95, max: 1.01, label: '>95%', color: 'bg-emerald-500' },
  ];

  const counts = buckets.map((b) => data.filter((v) => v >= b.min && v < b.max).length);
  const maxCount = Math.max(1, ...counts);

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2 h-28">
        {buckets.map((b, i) => {
          const count = counts[i];
          const height = (count / maxCount) * 100;
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] text-slate-500 tabular-nums">{count}</span>
              <div
                className={cn('w-full rounded-t-md transition-all duration-500', b.color)}
                style={{ height: `${Math.max(2, height)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-2">
        {buckets.map((b) => (
          <div key={b.label} className="flex-1 text-center">
            <span className="text-[10px] text-slate-500 whitespace-nowrap">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieChart({ handwritten, printed }: { handwritten: number; printed: number }) {
  const total = handwritten + printed;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-slate-400 text-sm">
        暂无数据
      </div>
    );
  }

  const handRatio = handwritten / total;
  const printRatio = printed / total;
  const radius = 56;
  const cx = 72;
  const cy = 72;
  const circumference = 2 * Math.PI * radius;
  const handOffset = circumference * (1 - handRatio);

  const describeArc = (startAngle: number, endAngle: number): string => {
    const start = polarToCartesian(cx, cy, radius, endAngle);
    const end = polarToCartesian(cx, cy, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad),
    };
  };

  const handStart = 0;
  const handEnd = handRatio * 360;
  const printStart = handEnd;
  const printEnd = 360;

  return (
    <div className="flex items-center justify-center gap-6">
      <svg width="144" height="144" viewBox="0 0 144 144">
        {handRatio > 0 && (
          <path
            d={describeArc(handStart, handEnd)}
            fill="#3b82f6"
            className="transition-all duration-500"
          />
        )}
        {printRatio > 0 && (
          <path
            d={describeArc(printStart, printEnd)}
            fill="#64748b"
            className="transition-all duration-500"
          />
        )}
        <circle cx={cx} cy={cy} r={36} fill="white" />
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-slate-800 font-bold text-lg">
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-500 text-[10px]">
          总字数
        </text>
      </svg>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-brand-500" />
          <span className="text-sm text-slate-600">手写体</span>
          <span className="text-sm font-semibold text-slate-800 tabular-nums ml-1">
            {Math.round(handRatio * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-slate-500" />
          <span className="text-sm text-slate-600">印刷体</span>
          <span className="text-sm font-semibold text-slate-800 tabular-nums ml-1">
            {Math.round(printRatio * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function StatisticsPanel({ onJumpToLowConfidence }: StatisticsPanelProps) {
  const { currentResult, currentTask } = useResultStore();
  const { tasks } = useTaskStore();

  const displayTask = useMemo<OCRTask | null>(() => {
    if (currentTask) return currentTask;
    return tasks.find((t) => t.result) || null;
  }, [currentTask, tasks]);

  const stats = useMemo(() => {
    const result: LayoutResult | null = currentResult || displayTask?.result || null;
    if (!result) {
      return {
        totalChars: 0,
        handwrittenChars: 0,
        printedChars: 0,
        avgConfidence: 0,
        pages: 0,
        paragraphs: 0,
        tables: 0,
        confidenceList: [] as number[],
        lowConfidenceCount: 0,
        duration: 0,
      };
    }

    let handwrittenChars = 0;
    let printedChars = 0;
    const confidenceList: number[] = [];
    let paragraphs = 0;
    let tables = 0;

    result.blocks.forEach((pb) => {
      if (pb.type === 'paragraph' || pb.type === 'heading' || pb.type === 'list') paragraphs++;
      if (pb.type === 'table') tables++;
      pb.texts.forEach((tb) => {
        const len = tb.content.length;
        if (tb.type === 'handwritten') handwrittenChars += len;
        else printedChars += len;
        confidenceList.push(tb.confidence);
      });
    });

    const lowConfidenceCount = confidenceList.filter((c) => c < 0.7).length;
    const avgConfidence = confidenceList.length
      ? confidenceList.reduce((a, b) => a + b, 0) / confidenceList.length
      : 0;

    const duration = displayTask?.createdAt && displayTask?.updatedAt
      ? (displayTask.updatedAt - displayTask.createdAt) / 1000
      : 0;

    return {
      totalChars: result.statistics?.totalChars ?? handwrittenChars + printedChars,
      handwrittenChars: result.statistics?.handwrittenChars ?? handwrittenChars,
      printedChars: result.statistics?.printedChars ?? printedChars,
      avgConfidence: result.statistics?.avgConfidence ?? avgConfidence,
      pages: result.pages || 0,
      paragraphs,
      tables,
      confidenceList,
      lowConfidenceCount,
      duration,
    };
  }, [currentResult, displayTask]);

  const formatDuration = (secs: number): string => {
    if (secs < 60) return `${Math.round(secs)}秒`;
    if (secs < 3600) return `${Math.floor(secs / 60)}分${Math.round(secs % 60)}秒`;
    return `${Math.floor(secs / 3600)}时${Math.floor((secs % 3600) / 60)}分`;
  };

  const getAvgColor = (avg: number) => {
    if (avg >= 0.9) return 'success';
    if (avg >= 0.75) return 'warning';
    return 'danger';
  };

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
      <div className="bg-white px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-brand-500" />
          <h3 className="font-semibold text-slate-800">识别统计</h3>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={FileText}
            label="总字数"
            value={stats.totalChars}
            color="primary"
          />
          <StatCard
            icon={PenLine}
            label="手写体"
            value={stats.handwrittenChars}
            color="primary"
          />
          <StatCard
            icon={Printer}
            label="印刷体"
            value={stats.printedChars}
            color="default"
          />
          <StatCard
            icon={BarChart3}
            label="平均置信度"
            value={(stats.avgConfidence * 100).toFixed(1)}
            color={getAvgColor(stats.avgConfidence)}
            suffix="%"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Clock} label="识别耗时" value={formatDuration(stats.duration)} />
          <StatCard icon={Layers} label="页数" value={stats.pages} suffix="页" />
          <StatCard icon={FileText} label="段落数" value={stats.paragraphs} />
          <StatCard icon={Grid3X3} label="表格数" value={stats.tables} />
        </div>

        {stats.lowConfidenceCount > 0 && (
          <button
            onClick={onJumpToLowConfidence}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-700">
                低置信度文字 <span className="font-bold">{stats.lowConfidenceCount}</span> 处
              </span>
            </div>
            <ChevronRight
              size={16}
              className="text-amber-500 group-hover:translate-x-0.5 transition-transform"
            />
          </button>
        )}

        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <BarChart3 size={14} className="text-brand-500" />
              置信度分布
            </div>
            <Tag size="sm" variant="default">
              {stats.confidenceList.length} 个文字块
            </Tag>
          </div>
          <ConfidenceHistogram data={stats.confidenceList} />
        </div>

        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-4">
            <Layers size={14} className="text-brand-500" />
            手写 / 印刷比例
          </div>
          <PieChart handwritten={stats.handwrittenChars} printed={stats.printedChars} />
        </div>
      </div>
    </div>
  );
}

export default StatisticsPanel;
