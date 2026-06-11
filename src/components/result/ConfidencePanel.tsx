import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Check,
  X,
  PenLine,
  Printer,
  ChevronDown,
  Sparkles,
  Filter,
  EyeOff,
} from 'lucide-react';
import type { TextBlock, TextType, LayoutResult } from '@shared/types';
import { useResultStore } from '@/stores/resultStore';
import { Tag } from '@/components/ui/Tag';
import { Button } from '@/components/ui/Button';
import { toast } from '@/utils/toast';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'handwritten' | 'printed';

const CONFIDENCE_THRESHOLD = 0.85;

interface ConfidenceItemProps {
  block: TextBlock;
  onConfirm: (id: string) => void;
  onIgnore: (id: string) => void;
  onReplace: (id: string, candidate: string) => void;
  onJump?: (block: TextBlock) => void;
}

function ConfidenceItem({ block, onConfirm, onIgnore, onReplace, onJump }: ConfidenceItemProps) {
  const { getBlockContent } = useResultStore();
  const [showCandidates, setShowCandidates] = useState(false);
  const content = getBlockContent(block.id) ?? block.content;

  const confidenceColor =
    block.confidence >= 0.7 ? 'bg-amber-500' : 'bg-danger-500';
  const confidenceBg =
    block.confidence >= 0.7 ? 'bg-amber-100' : 'bg-danger-100';
  const confidenceTextColor =
    block.confidence >= 0.7 ? 'text-amber-700' : 'text-danger-700';

  const typeInfo = block.type === 'handwritten'
    ? { label: '手写', icon: PenLine, color: 'bg-brand-50 text-brand-600 border-brand-200' }
    : { label: '印刷', icon: Printer, color: 'bg-slate-50 text-slate-600 border-slate-200' };
  const TypeIcon = typeInfo.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-3 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'inline-block rounded-md px-2 py-1.5 text-sm font-mono',
              block.confidence < 0.7 && 'confidence-low',
              block.type === 'handwritten' && block.confidence >= 0.7 && 'wavy-underline',
              block.confidence >= 0.7 && block.type !== 'handwritten' && 'bg-slate-50'
            )}
            onClick={() => onJump?.(block)}
          >
            {content}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium',
              typeInfo.color
            )}
          >
            <TypeIcon size={9} />
            {typeInfo.label}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className={cn('flex-1 h-1.5 rounded-full overflow-hidden', confidenceBg)}>
          <div
            className={cn('h-full rounded-full transition-all', confidenceColor)}
            style={{ width: `${block.confidence * 100}%` }}
          />
        </div>
        <span className={cn('text-xs font-semibold tabular-nums w-12 text-right', confidenceTextColor)}>
          {(block.confidence * 100).toFixed(0)}%
        </span>
      </div>

      <div className="space-y-2">
        {(block.candidates?.length ?? 0) > 0 && (
          <div>
            <button
              onClick={() => setShowCandidates((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600 transition-colors"
            >
              <Sparkles size={11} />
              <span>候选词 ({block.candidates?.length})</span>
              <ChevronDown
                size={11}
                className={cn('transition-transform', showCandidates && 'rotate-180')}
              />
            </button>
            {showCandidates && (
              <div className="mt-2 space-y-1 animate-[slideDown_0.15s_ease-out]">
                {block.candidates?.map((c, idx) => (
                  <button
                    key={idx}
                    onClick={() => onReplace(block.id, c)}
                    className={cn(
                      'w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between',
                      c === content
                        ? 'bg-brand-50 text-brand-700 border border-brand-200'
                        : 'bg-slate-50 text-slate-700 hover:bg-brand-50 hover:text-brand-600 border border-transparent hover:border-brand-200'
                    )}
                  >
                    <span className="font-mono">{c}</span>
                    {c === content && <Check size={11} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="success"
            icon={<Check size={12} />}
            className="flex-1 !py-1 !text-xs"
            onClick={() => onConfirm(block.id)}
          >
            确认
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<EyeOff size={12} />}
            className="flex-1 !py-1 !text-xs !text-slate-500 hover:!bg-slate-100"
            onClick={() => onIgnore(block.id)}
          >
            忽略
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ConfidencePanelProps {
  threshold?: number;
  onBlockJump?: (block: TextBlock) => void;
  result?: LayoutResult | null;
  editable?: boolean;
}

export function ConfidencePanel({ threshold = CONFIDENCE_THRESHOLD, onBlockJump, result, editable }: ConfidencePanelProps) {
  const { currentResult, editBlock, getBlockContent } = useResultStore();
  const displayResult = result ?? currentResult;
  const [filter, setFilter] = useState<FilterType>('all');
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

  const lowConfidenceBlocks = useMemo(() => {
    if (!displayResult) return [] as TextBlock[];
    const result: TextBlock[] = [];
    displayResult.blocks.forEach((pb) => {
      pb.texts.forEach((tb) => {
        if (tb.confidence < threshold) {
          result.push(tb);
        }
      });
    });
    return result.sort((a, b) => a.confidence - b.confidence);
  }, [displayResult, threshold]);

  const filteredBlocks = useMemo(() => {
    return lowConfidenceBlocks.filter((b) => {
      if (ignoredIds.has(b.id)) return false;
      if (confirmedIds.has(b.id)) return false;
      if (filter === 'all') return true;
      return b.type === filter;
    });
  }, [lowConfidenceBlocks, filter, ignoredIds, confirmedIds]);

  const pendingCount = filteredBlocks.length;
  const totalCount = lowConfidenceBlocks.length;

  const handleConfirm = (id: string) => {
    setConfirmedIds((prev) => new Set(prev).add(id));
    toast.success('已确认');
  };

  const handleIgnore = (id: string) => {
    setIgnoredIds((prev) => new Set(prev).add(id));
    toast.info('已忽略');
  };

  const handleReplace = (id: string, candidate: string) => {
    editBlock(id, candidate);
    setConfirmedIds((prev) => new Set(prev).add(id));
    toast.success('已替换为候选词');
  };

  const handleAcceptAll = () => {
    let count = 0;
    filteredBlocks.forEach((b) => {
      if (b.candidates?.[0]) {
        editBlock(b.id, b.candidates[0]);
        count++;
      }
      setConfirmedIds((prev) => new Set(prev).add(b.id));
    });
    toast.success(count > 0 ? `已接受 ${count} 处推荐` : '没有可接受的候选词');
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'handwritten', label: '手写体' },
    { key: 'printed', label: '印刷体' },
  ];

  return (
    <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="bg-white px-5 py-3.5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h3 className="font-semibold text-slate-800">置信度审查</h3>
            <Tag size="sm" variant={totalCount > 10 ? 'danger' : totalCount > 0 ? 'warning' : 'success'}>
              {pendingCount}/{totalCount}
            </Tag>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  filter === f.key
                    ? 'bg-white text-brand-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <Button
            size="sm"
            variant="primary"
            icon={<Check size={12} />}
            onClick={handleAcceptAll}
            disabled={pendingCount === 0}
            className="!py-1 !text-xs"
          >
            接受全部推荐
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {pendingCount === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            {totalCount === 0 ? (
              <>
                <Check size={40} strokeWidth={1.5} className="mb-3 opacity-50 text-emerald-400" />
                <p className="text-sm">所有文字块置信度都很高</p>
                <p className="text-xs mt-1">无需额外审查</p>
              </>
            ) : (
              <>
                <Check size={40} strokeWidth={1.5} className="mb-3 opacity-50 text-emerald-400" />
                <p className="text-sm">所有待审查项已处理完毕</p>
                <p className="text-xs mt-1">干得漂亮！</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBlocks.map((block) => (
              <ConfidenceItem
                key={block.id}
                block={block}
                onConfirm={handleConfirm}
                onIgnore={handleIgnore}
                onReplace={handleReplace}
                onJump={onBlockJump}
              />
            ))}
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <div className="border-t border-slate-100 bg-white px-4 py-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              阈值: <span className="font-medium text-slate-700">{(threshold * 100).toFixed(0)}%</span>
            </span>
            <span>
              已确认 <span className="text-emerald-600 font-medium">{confirmedIds.size}</span>
              {' · '}
              已忽略 <span className="text-slate-600 font-medium">{ignoredIds.size}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConfidencePanel;
