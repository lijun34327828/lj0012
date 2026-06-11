import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Columns3,
  Rows3,
  FileText,
  Image as ImageIcon,
  GripVertical,
} from 'lucide-react';
import type { TextBlock as TextBlockType, UploadFile, LayoutResult } from '@shared/types';
import { useResultStore } from '@/stores/resultStore';
import { useTaskStore } from '@/stores/taskStore';
import { LayoutView } from './LayoutView';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type ViewMode = 'split-h' | 'split-v' | 'text-only' | 'image-only';

const STORAGE_KEY = 'compare-view-split';
const MODE_STORAGE_KEY = 'compare-view-mode';

interface CompareViewProps {
  imageUrl?: string;
  imageFile?: UploadFile;
}

export function CompareView({ imageUrl, imageFile }: CompareViewProps) {
  const { currentResult, currentTask } = useResultStore();
  const { tasks } = useTaskStore();

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return (saved as ViewMode) || 'split-h';
  });

  const [splitRatio, setSplitRatio] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) : 0.3;
  });

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, splitRatio.toString());
  }, [splitRatio]);

  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const allTextBlocks = useMemo(() => {
    const blocks: TextBlockType[] = [];
    if (currentResult) {
      currentResult.blocks.forEach((pb) => {
        pb.texts.forEach((tb) => blocks.push(tb));
      });
    }
    return blocks;
  }, [currentResult]);

  const actualImageUrl = useMemo(() => {
    if (imageUrl) return imageUrl;
    if (imageFile) return imageFile.url;
    if (currentTask?.fileIds?.[0]) {
      const task = tasks.find((t) => t.id === currentTask.id);
      if (task?.fileIds?.[0]) {
        return `/api/upload/files/${task.fileIds[0]}`;
      }
    }
    return undefined;
  }, [imageUrl, imageFile, currentTask, tasks]);

  const handleImageMouseMove = useCallback(
    (e: React.MouseEvent<HTMLImageElement>) => {
      if (!imageRef.current || allTextBlocks.length === 0) return;

      const img = imageRef.current;
      const rect = img.getBoundingClientRect();
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      const scaleX = imgWidth / rect.width;
      const scaleY = imgHeight / rect.height;

      const relX = (e.clientX - rect.left) * scaleX;
      const relY = (e.clientY - rect.top) * scaleY;

      const matched = new Set<string>();
      for (const tb of allTextBlocks) {
        if (!tb.boundingBox) continue;
        const { x, y, w, h } = tb.boundingBox;
        if (relX >= x && relX <= x + w && relY >= y && relY <= y + h) {
          matched.add(tb.id);
        }
      }
      setHighlightedIds(matched);
    },
    [allTextBlocks]
  );

  const handleImageMouseLeave = useCallback(() => {
    setHighlightedIds(new Set());
  }, []);

  const handleSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let ratio: number;
      if (viewMode === 'split-h') {
        ratio = (e.clientX - rect.left) / rect.width;
      } else {
        ratio = (e.clientY - rect.top) / rect.height;
      }
      ratio = Math.max(0.15, Math.min(0.85, ratio));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, viewMode]);

  const handleSyncScroll = useCallback((source: 'image' | 'text') => {
    if (syncingRef.current) return;
    syncingRef.current = true;

    const srcEl = source === 'image' ? imageContainerRef.current : textContainerRef.current;
    const dstEl = source === 'image' ? textContainerRef.current : imageContainerRef.current;

    if (srcEl && dstEl) {
      const srcRatio = srcEl.scrollTop / (srcEl.scrollHeight - srcEl.clientHeight || 1);
      dstEl.scrollTop = srcRatio * (dstEl.scrollHeight - dstEl.clientHeight);
    }

    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const viewModes: { mode: ViewMode; icon: typeof Columns3; label: string }[] = [
    { mode: 'split-h', icon: Columns3, label: '左右对照' },
    { mode: 'split-v', icon: Rows3, label: '垂直对照' },
    { mode: 'text-only', icon: FileText, label: '仅文字' },
    { mode: 'image-only', icon: ImageIcon, label: '仅图片' },
  ];

  const isHorizontal = viewMode === 'split-h';
  const showImage = viewMode !== 'text-only';
  const showText = viewMode !== 'image-only';
  const isSplit = viewMode === 'split-h' || viewMode === 'split-v';

  return (
    <div className="flex flex-col h-full bg-slate-50 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-100 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {viewModes.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200',
                viewMode === mode
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
              title={label}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {showImage && (
          <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-brand-600 transition-all"
              title="缩小"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-medium text-slate-600 w-12 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-brand-600 transition-all"
              title="放大"
            >
              <ZoomIn size={16} />
            </button>
            <div className="w-px h-4 bg-slate-300 mx-0.5" />
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-brand-600 transition-all"
              title="旋转"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setRotation(0);
              }}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-brand-600 transition-all"
              title="重置"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={cn(
          'flex-1 flex relative overflow-hidden',
          viewMode === 'split-v' && 'flex-col'
        )}
      >
        {showImage && (
          <div
            ref={imageContainerRef}
            className={cn(
              'overflow-auto bg-slate-100 checkerboard relative flex-shrink-0',
              isSplit && (isHorizontal ? 'border-r' : 'border-b'),
              isSplit && 'border-slate-200'
            )}
            style={
              isSplit
                ? isHorizontal
                  ? { width: `${splitRatio * 100}%` }
                  : { height: `${splitRatio * 100}%` }
                : undefined
            }
            onScroll={() => handleSyncScroll('image')}
          >
            {actualImageUrl ? (
              <div className="min-h-full flex items-center justify-center p-8">
                <img
                  ref={imageRef}
                  src={actualImageUrl}
                  alt="原图"
                  onMouseMove={handleImageMouseMove}
                  onMouseLeave={handleImageMouseLeave}
                  className="max-w-none shadow-xl rounded-lg select-none"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  }}
                  draggable={false}
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <ImageIcon size={48} strokeWidth={1.5} className="mb-3 opacity-50" />
                <p className="text-sm">暂无图片</p>
              </div>
            )}

            {highlightedIds.size > 0 && imageRef.current && (
              <div className="pointer-events-none absolute inset-0">
                {Array.from(highlightedIds).map((id) => {
                  const tb = allTextBlocks.find((t) => t.id === id);
                  if (!tb?.boundingBox || !imageRef.current) return null;
                  const img = imageRef.current;
                  const rect = img.getBoundingClientRect();
                  const { x, y, w, h } = tb.boundingBox;
                  const scaleX = rect.width / img.naturalWidth;
                  const scaleY = rect.height / img.naturalHeight;

                  return (
                    <div
                      key={id}
                      className="absolute border-2 border-brand-500 bg-brand-500/20 rounded-md animate-[scaleIn_0.1s_ease-out]"
                      style={{
                        left: `${(x / img.naturalWidth) * 100}%`,
                        top: `${(y / img.naturalHeight) * 100}%`,
                        width: `${(w / img.naturalWidth) * 100}%`,
                        height: `${(h / img.naturalHeight) * 100}%`,
                      }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isSplit && (
          <div
            onMouseDown={handleSplitMouseDown}
            className={cn(
              'group bg-slate-200 hover:bg-brand-400 transition-colors cursor-col-resize flex-shrink-0 z-10 flex items-center justify-center',
              isHorizontal
                ? 'w-1.5 hover:w-2 cursor-col-resize'
                : 'h-1.5 hover:h-2 cursor-row-resize'
            )}
          >
            <div
              className={cn(
                'bg-white/80 rounded-md shadow-md p-0.5 transition-all',
                isHorizontal
                  ? 'group-hover:scale-110'
                  : 'group-hover:scale-110 rotate-90'
              )}
            >
              <GripVertical size={isHorizontal ? 14 : 14} className="text-slate-400 group-hover:text-brand-500" />
            </div>
          </div>
        )}

        {showText && (
          <div
            ref={textContainerRef}
            className="flex-1 overflow-auto p-4"
            onScroll={() => handleSyncScroll('text')}
          >
            <LayoutView highlightedBlockIds={highlightedIds} />
          </div>
        )}
      </div>
    </div>
  );
}

export default CompareView;
