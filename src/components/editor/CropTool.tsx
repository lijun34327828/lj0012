import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Square,
  Scan,
  MonitorPlay,
  FileSpreadsheet,
  Layout,
  Lock,
  Unlock,
  Check,
  X,
} from 'lucide-react';
import type { CropRect } from './Canvas';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { Tag } from '@/components/ui/Tag';
import { cn } from '@/lib/utils';

export type AspectRatio = 'free' | '1:1' | '4:3' | '16:9' | 'A4';

const ASPECT_RATIOS: { key: AspectRatio; label: string; ratio?: number; icon: typeof Square }[] = [
  { key: 'free', label: '自由', icon: Layout },
  { key: '1:1', label: '1:1', ratio: 1, icon: Square },
  { key: '4:3', label: '4:3', ratio: 4 / 3, icon: Scan },
  { key: '16:9', label: '16:9', ratio: 16 / 9, icon: MonitorPlay },
  { key: 'A4', label: 'A4', ratio: 210 / 297, icon: FileSpreadsheet },
];

export interface CropToolProps {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  initialRect?: CropRect | null;
  onApply?: (rect: CropRect) => void;
  onCancel?: () => void;
  onChange?: (rect: CropRect | null) => void;
  className?: string;
}

type HandlePosition =
  | 'nw'
  | 'n'
  | 'ne'
  | 'w'
  | 'e'
  | 'sw'
  | 's'
  | 'se'
  | 'move';

const MIN_CROP_SIZE = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function CropTool({
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  scale,
  offsetX,
  offsetY,
  initialRect,
  onApply,
  onCancel,
  onChange,
  className,
}: CropToolProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState<AspectRatio>('free');
  const [lockAspect, setLockAspect] = useState(false);
  const [rect, setRect] = useState<CropRect | null>(initialRect || null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<HandlePosition | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragStartRect, setDragStartRect] = useState<CropRect | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createStart, setCreateStart] = useState({ x: 0, y: 0 });

  const getImageScreenRect = useCallback(() => {
    const cx = containerWidth / 2 + offsetX;
    const cy = containerHeight / 2 + offsetY;
    const w = imageWidth * scale;
    const h = imageHeight * scale;
    return {
      left: cx - w / 2,
      top: cy - h / 2,
      right: cx + w / 2,
      bottom: cy + h / 2,
      width: w,
      height: h,
    };
  }, [containerWidth, containerHeight, scale, offsetX, offsetY, imageWidth, imageHeight]);

  const screenToImageCoords = useCallback(
    (sx: number, sy: number) => {
      const imgRect = getImageScreenRect();
      const ix = (sx - imgRect.left) / scale;
      const iy = (sy - imgRect.top) / scale;
      return {
        x: clamp(ix, 0, imageWidth),
        y: clamp(iy, 0, imageHeight),
      };
    },
    [getImageScreenRect, scale, imageWidth, imageHeight]
  );

  const imageToScreenRect = useCallback(
    (imageRect: CropRect) => {
      const imgRect = getImageScreenRect();
      return {
        left: imgRect.left + imageRect.x * scale,
        top: imgRect.top + imageRect.y * scale,
        width: imageRect.width * scale,
        height: imageRect.height * scale,
      };
    },
    [getImageScreenRect, scale]
  );

  const getAspectRatio = useCallback((): number | null => {
    if (aspect === 'free' && !lockAspect) return null;
    const found = ASPECT_RATIOS.find((a) => a.key === aspect);
    if (found && found.ratio) return found.ratio;
    if (rect && lockAspect) return rect.width / rect.height;
    return null;
  }, [aspect, lockAspect, rect]);

  const applyAspectConstraint = useCallback(
    (x: number, y: number, w: number, h: number, anchor: HandlePosition): CropRect => {
      const ratio = getAspectRatio();
      if (!ratio) {
        return { x, y, width: w, height: h };
      }

      switch (anchor) {
        case 'se':
        case 'e': {
          h = w / ratio;
          break;
        }
        case 's': {
          w = h * ratio;
          break;
        }
        case 'sw': {
          h = w / ratio;
          x = x + w - w;
          break;
        }
        case 'w': {
          h = w / ratio;
          break;
        }
        case 'nw': {
          h = w / ratio;
          break;
        }
        case 'n': {
          w = h * ratio;
          break;
        }
        case 'ne': {
          h = w / ratio;
          break;
        }
        default: {
          if (w / h > ratio) {
            w = h * ratio;
          } else {
            h = w / ratio;
          }
        }
      }

      w = clamp(w, MIN_CROP_SIZE / scale, imageWidth);
      h = clamp(h, MIN_CROP_SIZE / scale, imageHeight);

      x = clamp(x, 0, imageWidth - w);
      y = clamp(y, 0, imageHeight - h);

      return { x, y, width: w, height: h };
    },
    [getAspectRatio, imageWidth, imageHeight, scale]
  );

  useEffect(() => {
    if (!rect && imageWidth > 0 && imageHeight > 0) {
      const defaultRect: CropRect = {
        x: imageWidth * 0.1,
        y: imageHeight * 0.1,
        width: imageWidth * 0.8,
        height: imageHeight * 0.8,
      };
      setRect(applyAspectConstraint(defaultRect.x, defaultRect.y, defaultRect.width, defaultRect.height, 'move'));
    }
  }, [imageWidth, imageHeight, rect, applyAspectConstraint]);

  useEffect(() => {
    onChange?.(rect);
  }, [rect, onChange]);

  const handleContainerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rectBox = containerRef.current.getBoundingClientRect();
      const sx = e.clientX - rectBox.left;
      const sy = e.clientY - rectBox.top;

      setIsCreating(true);
      setCreateStart({ x: sx, y: sy });
      const imgCoords = screenToImageCoords(sx, sy);
      setRect({
        x: imgCoords.x,
        y: imgCoords.y,
        width: 0,
        height: 0,
      });
    },
    [screenToImageCoords]
  );

  const handleContainerMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rectBox = containerRef.current.getBoundingClientRect();
      const sx = e.clientX - rectBox.left;
      const sy = e.clientY - rectBox.top;

      if (isCreating) {
        const start = createStart;
        const startCoords = screenToImageCoords(Math.min(start.x, sx), Math.min(start.y, sy));
        const endCoords = screenToImageCoords(Math.max(start.x, sx), Math.max(start.y, sy));

        const w = Math.max(endCoords.x - startCoords.x, MIN_CROP_SIZE / scale);
        const h = Math.max(endCoords.y - startCoords.y, MIN_CROP_SIZE / scale);

        const constrained = applyAspectConstraint(startCoords.x, startCoords.y, w, h, 'se');
        setRect(constrained);
        return;
      }

      if (!isDragging || !dragHandle || !dragStartRect) return;

      const dx = (sx - dragStart.x) / scale;
      const dy = (sy - dragStart.y) / scale;

      let { x, y, width: w, height: h } = dragStartRect;

      switch (dragHandle) {
        case 'move':
          x = clamp(x + dx, 0, imageWidth - w);
          y = clamp(y + dy, 0, imageHeight - h);
          break;
        case 'nw':
          const nw = w - dx;
          const nh = h - dy;
          x = clamp(x + dx, 0, imageWidth - MIN_CROP_SIZE / scale);
          y = clamp(y + dy, 0, imageHeight - MIN_CROP_SIZE / scale);
          w = Math.max(MIN_CROP_SIZE / scale, nw);
          h = Math.max(MIN_CROP_SIZE / scale, nh);
          break;
        case 'n':
          const nhn = h - dy;
          y = clamp(y + dy, 0, imageHeight - MIN_CROP_SIZE / scale);
          h = Math.max(MIN_CROP_SIZE / scale, nhn);
          break;
        case 'ne':
          const neh = h - dy;
          y = clamp(y + dy, 0, imageHeight - MIN_CROP_SIZE / scale);
          w = Math.max(MIN_CROP_SIZE / scale, w + dx);
          h = Math.max(MIN_CROP_SIZE / scale, neh);
          break;
        case 'w':
          x = clamp(x + dx, 0, imageWidth - MIN_CROP_SIZE / scale);
          w = Math.max(MIN_CROP_SIZE / scale, w - dx);
          break;
        case 'e':
          w = Math.max(MIN_CROP_SIZE / scale, w + dx);
          break;
        case 'sw':
          const swW = w - dx;
          const swH = h + dy;
          x = clamp(x + dx, 0, imageWidth - MIN_CROP_SIZE / scale);
          w = Math.max(MIN_CROP_SIZE / scale, swW);
          h = Math.max(MIN_CROP_SIZE / scale, swH);
          break;
        case 's':
          h = Math.max(MIN_CROP_SIZE / scale, h + dy);
          break;
        case 'se':
          w = Math.max(MIN_CROP_SIZE / scale, w + dx);
          h = Math.max(MIN_CROP_SIZE / scale, h + dy);
          break;
      }

      w = clamp(w, 0, imageWidth - x);
      h = clamp(h, 0, imageHeight - y);
      x = clamp(x, 0, imageWidth - w);
      y = clamp(y, 0, imageHeight - h);

      const constrained = applyAspectConstraint(x, y, w, h, dragHandle);
      setRect(constrained);
    },
    [
      isCreating,
      createStart,
      isDragging,
      dragHandle,
      dragStart,
      dragStartRect,
      screenToImageCoords,
      imageWidth,
      imageHeight,
      scale,
      applyAspectConstraint,
    ]
  );

  const handleContainerMouseUp = useCallback(() => {
    setIsCreating(false);
    setIsDragging(false);
    setDragHandle(null);
    setDragStartRect(null);
  }, []);

  const handleHandleMouseDown = useCallback(
    (handle: HandlePosition, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!containerRef.current || !rect) return;

      const rectBox = containerRef.current.getBoundingClientRect();
      setIsDragging(true);
      setDragHandle(handle);
      setDragStart({
        x: e.clientX - rectBox.left,
        y: e.clientY - rectBox.top,
      });
      setDragStartRect({ ...rect });
    },
    [rect]
  );

  const handleApply = useCallback(() => {
    if (rect) {
      onApply?.({
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    }
  }, [rect, onApply]);

  const handleReset = useCallback(() => {
    if (imageWidth > 0 && imageHeight > 0) {
      const defaultRect: CropRect = {
        x: 0,
        y: 0,
        width: imageWidth,
        height: imageHeight,
      };
      setRect(defaultRect);
    }
  }, [imageWidth, imageHeight]);

  const screenRect = rect ? imageToScreenRect(rect) : null;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-600">比例:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {ASPECT_RATIOS.map((item) => {
            const Icon = item.icon;
            const isActive = aspect === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setAspect(item.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                  isActive
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          type="button"
          onClick={() => setLockAspect((v) => !v)}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            lockAspect
              ? 'bg-amber-50 text-amber-700 border border-amber-200'
              : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
          )}
        >
          {lockAspect ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          {lockAspect ? '锁定比例' : '解锁比例'}
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="ml-auto"
        >
          重置选区
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-[400px] rounded-xl overflow-hidden border border-slate-200 checkerboard cursor-crosshair select-none"
        onMouseDown={handleContainerMouseDown}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={handleContainerMouseUp}
        onMouseLeave={handleContainerMouseUp}
      >
        <div
          className="absolute border border-dashed border-slate-400/50 bg-white/10"
          style={(() => {
            const r = getImageScreenRect();
            return {
              left: `${r.left}px`,
              top: `${r.top}px`,
              width: `${r.width}px`,
              height: `${r.height}px`,
            };
          })()}
        />

        {screenRect && (
          <>
            <div
              className="absolute bg-black/50 transition-colors"
              style={{
                left: 0,
                top: 0,
                width: `${containerWidth}px`,
                height: `${screenRect.top}px`,
              }}
            />
            <div
              className="absolute bg-black/50 transition-colors"
              style={{
                left: 0,
                top: `${screenRect.top + screenRect.height}px`,
                width: `${containerWidth}px`,
                height: `${containerHeight - screenRect.top - screenRect.height}px`,
              }}
            />
            <div
              className="absolute bg-black/50 transition-colors"
              style={{
                left: 0,
                top: `${screenRect.top}px`,
                width: `${screenRect.left}px`,
                height: `${screenRect.height}px`,
              }}
            />
            <div
              className="absolute bg-black/50 transition-colors"
              style={{
                left: `${screenRect.left + screenRect.width}px`,
                top: `${screenRect.top}px`,
                width: `${containerWidth - screenRect.left - screenRect.width}px`,
                height: `${screenRect.height}px`,
              }}
            />

            <div
              className="absolute border-2 border-brand-500 shadow-lg cursor-move"
              style={{
                left: `${screenRect.left}px`,
                top: `${screenRect.top}px`,
                width: `${screenRect.width}px`,
                height: `${screenRect.height}px`,
              }}
              onMouseDown={(e) => handleHandleMouseDown('move', e)}
            >
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/3 w-px h-full bg-white/50" />
                <div className="absolute top-0 left-2/3 w-px h-full bg-white/50" />
                <div className="absolute top-1/3 left-0 w-full h-px bg-white/50" />
                <div className="absolute top-2/3 left-0 w-full h-px bg-white/50" />
              </div>

              {([
                ['nw', 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize'],
                ['n', 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'],
                ['ne', 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize'],
                ['w', 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize'],
                ['e', 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize'],
                ['sw', 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize'],
                ['s', 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'],
                ['se', 'right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize'],
              ] as const).map(([pos, classes]) => (
                <div
                  key={pos}
                  className={cn(
                    'absolute w-3.5 h-3.5 bg-white border-2 border-brand-500 rounded-full shadow-md z-10 pointer-events-auto',
                    classes
                  )}
                  onMouseDown={(e) => handleHandleMouseDown(pos as HandlePosition, e)}
                />
              ))}
            </div>

            <div
              className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2.5 py-1 bg-brand-500 text-white text-xs font-mono rounded-lg shadow-md pointer-events-none"
              style={{
                transform: screenRect.top < 32
                  ? `translate(-50%, calc(${screenRect.top}px + 100% + 8px))`
                  : `translate(-50%, calc(${screenRect.top}px - 100% - 8px))`,
              }}
            >
              {rect ? `${Math.round(rect.width)} × ${Math.round(rect.height)} px` : ''}
            </div>
          </>
        )}
      </div>

      {rect && (
        <div className="grid grid-cols-4 gap-3">
          <div>
            <Slider
              label="X"
              value={Math.round(rect.x)}
              onChange={(v) => setRect((r) => r ? applyAspectConstraint(v, r.y, r.width, r.height, 'e') : r)}
              min={0}
              max={imageWidth}
              formatValue={(v) => `${v}px`}
            />
          </div>
          <div>
            <Slider
              label="Y"
              value={Math.round(rect.y)}
              onChange={(v) => setRect((r) => r ? applyAspectConstraint(r.x, v, r.width, r.height, 's') : r)}
              min={0}
              max={imageHeight}
              formatValue={(v) => `${v}px`}
            />
          </div>
          <div>
            <Slider
              label="宽度"
              value={Math.round(rect.width)}
              onChange={(v) => setRect((r) => r ? applyAspectConstraint(r.x, r.y, v, r.height, 'e') : r)}
              min={MIN_CROP_SIZE}
              max={imageWidth}
              formatValue={(v) => `${v}px`}
            />
          </div>
          <div>
            <Slider
              label="高度"
              value={Math.round(rect.height)}
              onChange={(v) => setRect((r) => r ? applyAspectConstraint(r.x, r.y, r.width, v, 's') : r)}
              min={MIN_CROP_SIZE}
              max={imageHeight}
              formatValue={(v) => `${v}px`}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Tag variant="info" size="sm">
            提示: 拖拽选框可移动，拖拽边角可调整大小
          </Tag>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={<X className="w-4 h-4" />}
            onClick={onCancel}
          >
            取消
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Check className="w-4 h-4" />}
            onClick={handleApply}
            disabled={!rect || rect.width < MIN_CROP_SIZE || rect.height < MIN_CROP_SIZE}
          >
            确认裁剪
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CropTool;
