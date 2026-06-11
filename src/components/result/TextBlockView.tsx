import { useState, useRef, useEffect } from 'react';
import { Check, X, PenLine, Printer, Sparkles } from 'lucide-react';
import type { TextBlock, TextType } from '@shared/types';
import { useResultStore } from '@/stores/resultStore';
import { cn } from '@/lib/utils';

interface TextBlockViewProps {
  block: TextBlock;
  highlighted?: boolean;
  onClick?: (block: TextBlock) => void;
}

const typeLabels: Record<TextType, { label: string; icon: typeof PenLine; color: string }> = {
  handwritten: { label: '手写体', icon: PenLine, color: 'text-brand-600 bg-brand-50 border-brand-200' },
  printed: { label: '印刷体', icon: Printer, color: 'text-slate-600 bg-slate-50 border-slate-200' },
  mixed: { label: '混合', icon: Sparkles, color: 'text-violet-600 bg-violet-50 border-violet-200' },
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'bg-emerald-500';
  if (confidence >= 0.75) return 'bg-amber-500';
  return 'bg-danger-500';
}

function getConfidenceBg(confidence: number): string {
  if (confidence >= 0.9) return 'bg-emerald-100';
  if (confidence >= 0.75) return 'bg-amber-100';
  return 'bg-danger-100';
}

function getConfidenceTextColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-emerald-700';
  if (confidence >= 0.75) return 'text-amber-700';
  return 'text-danger-700';
}

export function TextBlockView({ block, highlighted, onClick }: TextBlockViewProps) {
  const { getBlockContent, editBlock } = useResultStore();
  const [showPopover, setShowPopover] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const editRef = useRef<HTMLSpanElement>(null);

  const content = getBlockContent(block.id) ?? block.content;
  const typeInfo = typeLabels[block.type];
  const TypeIcon = typeInfo.icon;
  const isLowConfidence = block.confidence < 0.7;
  const isHandwritten = block.type === 'handwritten';

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  const handleBlur = () => {
    if (editRef.current) {
      const newContent = editRef.current.innerText;
      if (newContent !== content) {
        editBlock(block.id, newContent);
      }
    }
    setIsEditing(false);
  };

  const handleCandidateClick = (candidate: string) => {
    editBlock(block.id, candidate);
    setShowPopover(false);
  };

  return (
    <span
      ref={containerRef}
      className={cn(
        'relative inline-block cursor-pointer transition-all duration-150 rounded px-0.5 -mx-0.5',
        isHandwritten && 'wavy-underline',
        isLowConfidence && 'confidence-low',
        highlighted && 'ring-2 ring-brand-400 bg-brand-100/60',
        !isLowConfidence && !highlighted && 'hover:bg-brand-50'
      )}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditing) {
          setShowPopover((v) => !v);
          onClick?.(block);
        }
      }}
    >
      {isEditing ? (
        <span
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleBlur();
            }
            if (e.key === 'Escape') {
              setIsEditing(false);
            }
          }}
          className="outline-none border-b-2 border-brand-400 bg-white/80"
        >
          {content}
        </span>
      ) : (
        <span>{content}</span>
      )}

      {showTooltip && !isEditing && !showPopover && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none">
          <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border', typeInfo.color)}>
                <TypeIcon size={10} />
                {typeInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-300">置信度:</span>
              <div className={cn('w-20 h-1.5 rounded-full overflow-hidden', getConfidenceBg(block.confidence))}>
                <div
                  className={cn('h-full rounded-full transition-all', getConfidenceColor(block.confidence))}
                  style={{ width: `${block.confidence * 100}%` }}
                />
              </div>
              <span className={cn('font-medium tabular-nums', getConfidenceTextColor(block.confidence))}>
                {(block.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className="text-slate-400 mt-1">点击查看候选词 · 双击编辑</div>
          </div>
          <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1" />
        </div>
      )}

      {showPopover && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-40 min-w-[220px]">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-[scaleIn_0.15s_ease-out]">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded border', typeInfo.color)}>
                  <TypeIcon size={10} />
                  {typeInfo.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-16 h-1.5 rounded-full overflow-hidden', getConfidenceBg(block.confidence))}>
                    <div
                      className={cn('h-full rounded-full', getConfidenceColor(block.confidence))}
                      style={{ width: `${block.confidence * 100}%` }}
                    />
                  </div>
                  <span className={cn('font-medium tabular-nums w-12 text-right', getConfidenceTextColor(block.confidence))}>
                    {(block.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-2">
              <div className="text-xs text-slate-500 mb-1.5 px-1">候选词</div>
              {block.candidates && block.candidates.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {block.candidates.map((candidate, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCandidateClick(candidate);
                      }}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between group',
                        candidate === content
                          ? 'bg-brand-50 text-brand-700'
                          : 'hover:bg-slate-50 text-slate-700'
                      )}
                    >
                      <span className="font-mono">{candidate}</span>
                      {candidate === content && <Check size={14} className="text-brand-500" />}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-2.5 py-3 text-xs text-slate-400 text-center">暂无候选词</div>
              )}
            </div>

            <div className="px-2 py-2 bg-slate-50 border-t border-slate-100 flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPopover(false);
                  setIsEditing(true);
                }}
                className="flex-1 px-2 py-1.5 text-xs rounded-md text-slate-600 hover:bg-white border border-slate-200 flex items-center justify-center gap-1 transition-colors"
              >
                <PenLine size={12} />
                手动编辑
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPopover(false);
                }}
                className="px-2 py-1.5 text-xs rounded-md text-slate-500 hover:bg-white border border-slate-200 flex items-center justify-center transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

export default TextBlockView;
