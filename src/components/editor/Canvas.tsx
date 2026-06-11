import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/lib/utils';
import { loadImage } from '@/utils/image';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export interface EnhanceSettings {
  brightness: number;
  contrast: number;
  sharpness: number;
  denoise: boolean;
  denoiseStrength: number;
  binarize: boolean;
  binarizeThreshold: number;
}

export interface CanvasProps {
  imageSrc: string | null;
  rotation?: number;
  cropRect?: CropRect | null;
  showCropOverlay?: boolean;
  enhanceSettings?: Partial<EnhanceSettings>;
  onCropChange?: (rect: CropRect | null) => void;
  onSelectionChange?: (selection: Selection | null) => void;
  onImageLoad?: (info: { width: number; height: number }) => void;
  className?: string;
}

export interface CanvasHandle {
  getCurrentTransform: () => Transform;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (scale: number) => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const TILE_SIZE = 512;

const DEFAULT_ENHANCE: EnhanceSettings = {
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  denoise: false,
  denoiseStrength: 50,
  binarize: false,
  binarizeThreshold: 128,
};

export const Canvas = forwardRef<CanvasHandle, CanvasProps>(function Canvas(
  {
    imageSrc,
    rotation = 0,
    cropRect,
    showCropOverlay = false,
    enhanceSettings,
    onCropChange,
    onSelectionChange,
    onImageLoad,
    className,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const currentRotation = rotation;

  const mergedEnhance = useMemo<EnhanceSettings>(
    () => ({ ...DEFAULT_ENHANCE, ...(enhanceSettings || {}) }),
    [enhanceSettings]
  );

  const getEnhanceFilter = useCallback((settings: EnhanceSettings): string => {
    const filters: string[] = [];

    if (settings.brightness !== 0) {
      filters.push(`brightness(${100 + settings.brightness}%)`);
    }

    if (settings.contrast !== 0) {
      filters.push(`contrast(${100 + settings.contrast}%)`);
    }

    if (settings.sharpness > 0) {
      filters.push(`contrast(${100 + settings.sharpness * 0.3}%)`);
    }

    return filters.join(' ');
  }, []);

  const renderImage = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const image = imageRef.current;
    if (!canvas || !container || !image) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    setContainerSize({ width: cw, height: ch });

    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    const cx = cw / 2 + offsetX;
    const cy = ch / 2 + offsetY;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.rotate((currentRotation * Math.PI) / 180);

    const filter = getEnhanceFilter(mergedEnhance);
    if (filter) {
      ctx.filter = filter;
    }

    const iw = image.width;
    const ih = image.height;

    const useTiling = iw > TILE_SIZE * 2 || ih > TILE_SIZE * 2;

    if (useTiling) {
      const cols = Math.ceil(iw / TILE_SIZE);
      const rows = Math.ceil(ih / TILE_SIZE);
      const sx = -iw / 2;
      const sy = -ih / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const tx = c * TILE_SIZE;
          const ty = r * TILE_SIZE;
          const tw = Math.min(TILE_SIZE, iw - tx);
          const th = Math.min(TILE_SIZE, ih - ty);

          const viewLeft = -iw / 2 - cw / 2 / scale;
          const viewTop = -ih / 2 - ch / 2 / scale;
          const viewRight = -iw / 2 + cw + cw / 2 / scale;
          const viewBottom = -ih / 2 + ch + ch / 2 / scale;

          const tileLeft = sx + tx;
          const tileTop = sy + ty;
          const tileRight = tileLeft + tw;
          const tileBottom = tileTop + th;

          if (tileRight < viewLeft || tileLeft > viewRight || tileBottom < viewTop || tileTop > viewBottom) {
            continue;
          }

          ctx.drawImage(image, tx, ty, tw, th, sx + tx, sy + ty, tw, th);
        }
      }
    } else {
      ctx.drawImage(image, -iw / 2, -ih / 2, iw, ih);
    }

    if (mergedEnhance.binarize) {
      const threshold = mergedEnhance.binarizeThreshold;
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const v = gray > threshold ? 255 : 0;
          data[i] = data[i + 1] = data[i + 2] = v;
        }
        ctx.putImageData(imageData, 0, 0);
      } catch {
        // ignore CORS errors
      }
    }

    ctx.restore();
  }, [offsetX, offsetY, scale, currentRotation, mergedEnhance, getEnhanceFilter]);

  useEffect(() => {
    renderImage();
  }, [renderImage]);

  useEffect(() => {
    if (!imageSrc) {
      imageRef.current = null;
      setImageSize({ width: 0, height: 0 });
      return;
    }

    let cancelled = false;

    loadImage(imageSrc)
      .then((img) => {
        if (cancelled) return;
        imageRef.current = img;
        setImageSize({ width: img.width, height: img.height });
        onImageLoad?.({ width: img.width, height: img.height });

        const container = containerRef.current;
        if (container) {
          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const fitScale = Math.min((cw * 0.85) / img.width, (ch * 0.85) / img.height, 1);
          setScale(fitScale);
          setOffsetX(0);
          setOffsetY(0);
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      cancelled = true;
    };
  }, [imageSrc, onImageLoad]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      renderImage();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [renderImage]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const delta = -e.deltaY;
    const zoomFactor = delta > 0 ? 1.1 : 1 / 1.1;

    setScale((prev) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev * zoomFactor));
      return next;
    });
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (showCropOverlay) return;

      setIsDragging(true);
      setDragStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    },
    [offsetX, offsetY, showCropOverlay]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setOffsetX(e.clientX - dragStart.x);
      setOffsetY(e.clientY - dragStart.y);
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => {
    const image = imageRef.current;
    const container = containerRef.current;
    if (!image || !container) {
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      return;
    }

    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const fitScale = Math.min((cw * 0.85) / image.width, (ch * 0.85) / image.height, 1);
    setScale(fitScale);
    setOffsetX(0);
    setOffsetY(0);
  }, []);

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_SCALE, prev * 1.2));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_SCALE, prev / 1.2));
  }, []);

  const setZoom = useCallback((next: number) => {
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, next)));
  }, []);

  useImperativeHandle(ref, () => ({
    getCurrentTransform: () => ({
      scale,
      offsetX,
      offsetY,
      rotation: currentRotation,
    }),
    resetView,
    zoomIn,
    zoomOut,
    setZoom,
  }));

  const displayScale = Math.round(scale * 100);

  return (
    <div ref={containerRef} className={cn('relative w-full h-full min-h-[400px] checkerboard overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className={cn('w-full h-full', isDragging ? 'cursor-grabbing' : showCropOverlay ? 'cursor-crosshair' : 'cursor-grab')}
      />

      {!imageSrc && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/60 flex items-center justify-center">
              <Maximize2 className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">请先上传图片</p>
          </div>
        </div>
      )}

      {showCropOverlay && cropRect && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute bg-black/40"
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: `calc(100% - ${cropRect.y + cropRect.height}px)`,
            }}
          />
          <div
            className="absolute bg-black/40"
            style={{
              top: `${cropRect.y + cropRect.height}px`,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <div
            className="absolute bg-black/40"
            style={{
              top: `${cropRect.y}px`,
              left: 0,
              width: `${cropRect.x}px`,
              height: `${cropRect.height}px`,
            }}
          />
          <div
            className="absolute bg-black/40"
            style={{
              top: `${cropRect.y}px`,
              left: `${cropRect.x + cropRect.width}px`,
              right: 0,
              height: `${cropRect.height}px`,
            }}
          />

          <div
            className="absolute border-2 border-brand-500"
            style={{
              top: `${cropRect.y}px`,
              left: `${cropRect.x}px`,
              width: `${cropRect.width}px`,
              height: `${cropRect.height}px`,
            }}
          >
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-1/3 w-px h-full bg-white/40" />
              <div className="absolute top-0 left-2/3 w-px h-full bg-white/40" />
              <div className="absolute top-1/3 left-0 w-full h-px bg-white/40" />
              <div className="absolute top-2/3 left-0 w-full h-px bg-white/40" />
            </div>
          </div>
        </div>
      )}

      {imageSrc && (
        <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 px-3 py-2 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            icon={<ZoomOut className="w-4 h-4" />}
            onClick={zoomOut}
            className="w-8 h-8 p-0"
          />

          <div className="w-28">
            <Slider
              value={displayScale}
              onChange={(v) => setZoom(v / 100)}
              min={10}
              max={400}
              showValue={false}
            />
          </div>

          <span className="text-xs font-mono text-slate-600 min-w-[48px] text-center">
            {displayScale}%
          </span>

          <Button
            variant="ghost"
            size="sm"
            icon={<ZoomIn className="w-4 h-4" />}
            onClick={zoomIn}
            className="w-8 h-8 p-0"
          />

          <div className="w-px h-5 bg-slate-200" />

          <Button
            variant="ghost"
            size="sm"
            icon={<Maximize2 className="w-4 h-4" />}
            onClick={resetView}
            className="w-8 h-8 p-0"
            title="适应画布"
          />
        </div>
      )}

      {imageSize.width > 0 && (
        <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 px-3 py-1.5">
          <span className="text-xs font-mono text-slate-600">
            {imageSize.width} × {imageSize.height} px
          </span>
        </div>
      )}
    </div>
  );
});

export default Canvas;
