import { useState, useMemo } from 'react';
import { Grid3X3, Hash, List, ListOrdered, Type } from 'lucide-react';
import type { LayoutResult, ParagraphBlock, TextBlock as TextBlockType } from '@shared/types';
import { useResultStore } from '@/stores/resultStore';
import { TextBlockView } from './TextBlockView';
import { cn } from '@/lib/utils';
import { Tag } from '@/components/ui/Tag';

interface LayoutViewProps {
  result?: LayoutResult | null;
  highlightedBlockIds?: Set<string>;
  onTextBlockClick?: (block: TextBlockType) => void;
}

function ParagraphHeading({
  block,
  highlightedBlockIds,
  onTextBlockClick,
}: {
  block: ParagraphBlock;
  highlightedBlockIds?: Set<string>;
  onTextBlockClick?: (block: TextBlockType) => void;
}) {
  return (
    <div className={cn('group relative py-2', block.alignment === 'center' && 'text-center', block.alignment === 'right' && 'text-right')}>
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tag size="sm" variant="primary" icon={<Type size={12} />}>
          标题
        </Tag>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 leading-relaxed tracking-tight">
        {block.texts.map((tb) => (
          <TextBlockView
            key={tb.id}
            block={tb}
            highlighted={highlightedBlockIds?.has(tb.id)}
            onClick={onTextBlockClick}
          />
        ))}
      </h1>
    </div>
  );
}

function ParagraphText({
  block,
  highlightedBlockIds,
  onTextBlockClick,
}: {
  block: ParagraphBlock;
  highlightedBlockIds?: Set<string>;
  onTextBlockClick?: (block: TextBlockType) => void;
}) {
  const indentStyle = block.indent ? { textIndent: `${block.indent * 2}em` } : undefined;

  return (
    <div className={cn('group relative py-1.5', block.alignment === 'center' && 'text-center', block.alignment === 'right' && 'text-right')}>
      <div className="absolute left-0 top-3 -translate-x-full pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tag size="sm" variant="default" icon={<Hash size={12} />}>
          段落
        </Tag>
      </div>
      <p className="text-base text-slate-700 leading-loose tracking-wide" style={indentStyle}>
        {block.texts.map((tb) => (
          <TextBlockView
            key={tb.id}
            block={tb}
            highlighted={highlightedBlockIds?.has(tb.id)}
            onClick={onTextBlockClick}
          />
        ))}
      </p>
    </div>
  );
}

function ParagraphTable({
  block,
  highlightedBlockIds,
  onTextBlockClick,
}: {
  block: ParagraphBlock;
  highlightedBlockIds?: Set<string>;
  onTextBlockClick?: (block: TextBlockType) => void;
}) {
  const tableData = block.tableData;
  const textByIndex = useMemo(() => {
    const map = new Map<string, TextBlockType>();
    block.texts.forEach((t) => map.set(t.id, t));
    return map;
  }, [block.texts]);

  return (
    <div className="group relative py-3 my-2">
      <div className="absolute left-0 top-5 -translate-x-full pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tag size="sm" variant="info" icon={<Grid3X3 size={12} />}>
          表格
        </Tag>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full border-collapse">
          <tbody>
            {tableData?.map((row, ri) => (
              <tr key={ri} className={cn(ri === 0 && 'bg-slate-50')}>
                {row.map((cell, ci) => {
                  const tb = block.texts.find((t) => t.lineIndex === ri && t.pageIndex === ci) || block.texts[ri * (row.length) + ci];
                  return (
                    <td
                      key={ci}
                      className={cn(
                        'border border-slate-200 px-4 py-2.5 text-sm align-top',
                        ri === 0 && 'font-semibold text-slate-800 bg-slate-50'
                      )}
                    >
                      {tb ? (
                        <TextBlockView
                          block={tb}
                          highlighted={highlightedBlockIds?.has(tb.id)}
                          onClick={onTextBlockClick}
                        />
                      ) : (
                        <span className="text-slate-700">{cell}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!tableData && block.texts.length > 0 && (
              <tr>
                <td className="border border-slate-200 px-4 py-2.5 text-sm">
                  {block.texts.map((tb) => (
                    <TextBlockView
                      key={tb.id}
                      block={tb}
                      highlighted={highlightedBlockIds?.has(tb.id)}
                      onClick={onTextBlockClick}
                    />
                  ))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParagraphList({
  block,
  highlightedBlockIds,
  onTextBlockClick,
}: {
  block: ParagraphBlock;
  highlightedBlockIds?: Set<string>;
  onTextBlockClick?: (block: TextBlockType) => void;
}) {
  const isOrdered = block.texts.some((t) => t.content.match(/^[\d]+\./));
  const ListIcon = isOrdered ? ListOrdered : List;

  const items = useMemo(() => {
    const result: { items: TextBlockType[] }[] = [];
    let current: TextBlockType[] = [];

    block.texts.forEach((tb) => {
      if (tb.content.match(/^[\d]+\./) || tb.content.match(/^[•\-·]\s?/)) {
        if (current.length > 0) {
          result.push({ items: current });
        }
        current = [tb];
      } else if (current.length === 0) {
        current = [tb];
      } else {
        current.push(tb);
      }
    });
    if (current.length > 0) {
      result.push({ items: current });
    }

    return result.length > 0 ? result : [{ items: block.texts }];
  }, [block.texts]);

  return (
    <div className="group relative py-2 my-1">
      <div className="absolute left-0 top-3 -translate-x-full pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tag size="sm" variant="warning" icon={<ListIcon size={12} />}>
          {isOrdered ? '有序列表' : '无序列表'}
        </Tag>
      </div>
      {isOrdered ? (
        <ol className="list-decimal list-inside space-y-1 pl-2">
          {items.map((item, idx) => (
            <li key={idx} className="text-base text-slate-700 leading-loose tracking-wide">
              {item.items.map((tb) => (
                <TextBlockView
                  key={tb.id}
                  block={tb}
                  highlighted={highlightedBlockIds?.has(tb.id)}
                  onClick={onTextBlockClick}
                />
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc list-inside space-y-1 pl-2">
          {items.map((item, idx) => (
            <li key={idx} className="text-base text-slate-700 leading-loose tracking-wide">
              {item.items.map((tb) => (
                <TextBlockView
                  key={tb.id}
                  block={tb}
                  highlighted={highlightedBlockIds?.has(tb.id)}
                  onClick={onTextBlockClick}
                />
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function LayoutView({ result, highlightedBlockIds, onTextBlockClick }: LayoutViewProps) {
  const { currentResult } = useResultStore();
  const displayResult = result ?? currentResult;

  if (!displayResult) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Type size={48} strokeWidth={1.5} className="mb-4 opacity-50" />
        <p className="text-base">暂无识别结果</p>
        <p className="text-sm mt-1">上传图片后即可查看排版视图</p>
      </div>
    );
  }

  return (
    <div className="paper-texture rounded-2xl min-h-full p-8 md:p-12 lg:p-16 shadow-inner">
      <div className="max-w-3xl mx-auto space-y-1 pl-16">
        {displayResult.blocks.map((block) => {
          switch (block.type) {
            case 'heading':
              return (
                <ParagraphHeading
                  key={block.id}
                  block={block}
                  highlightedBlockIds={highlightedBlockIds}
                  onTextBlockClick={onTextBlockClick}
                />
              );
            case 'paragraph':
              return (
                <ParagraphText
                  key={block.id}
                  block={block}
                  highlightedBlockIds={highlightedBlockIds}
                  onTextBlockClick={onTextBlockClick}
                />
              );
            case 'table':
              return (
                <ParagraphTable
                  key={block.id}
                  block={block}
                  highlightedBlockIds={highlightedBlockIds}
                  onTextBlockClick={onTextBlockClick}
                />
              );
            case 'list':
              return (
                <ParagraphList
                  key={block.id}
                  block={block}
                  highlightedBlockIds={highlightedBlockIds}
                  onTextBlockClick={onTextBlockClick}
                />
              );
            default:
              return (
                <ParagraphText
                  key={block.id}
                  block={block}
                  highlightedBlockIds={highlightedBlockIds}
                  onTextBlockClick={onTextBlockClick}
                />
              );
          }
        })}
      </div>
    </div>
  );
}

export default LayoutView;
