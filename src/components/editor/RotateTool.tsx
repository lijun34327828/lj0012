import { useCallback } from 'react';
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Wand2,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/lib/utils';

export type FlipDirection = 'horizontal' | 'vertical';

export interface RotateToolProps {
  angle?: number;
  rotation?: number;
  flippedH: boolean;
  flippedV: boolean;
  onRotate?: (angle: number) => void;
  onFlip?: (dir: FlipDirection) => void;
  onFlipH?: () => void;
  onFlipV?: () => void;
  onAutoCorrect?: () => void;
  onReset?: () => void;
  autoCorrectLoading?: boolean;
  className?: string;
}

const PRESET_ANGLES = [-45, -30, -15, 0, 15, 30, 45];

export function RotateTool({
  angle,
  rotation,
  flippedH,
  flippedV,
  onRotate,
  onFlip,
  onFlipH,
  onFlipV,
  onAutoCorrect,
  onReset,
  autoCorrectLoading = false,
  className,
}: RotateToolProps) {
  const actualAngle = rotation ?? angle ?? 0;
  const actualOnRotate = onRotate ?? (() => {});

  const handleRotate90Left = useCallback(() => {
    actualOnRotate(Math.round(((actualAngle - 90) % 360 + 360) % 360));
  }, [actualAngle, actualOnRotate]);

  const handleRotate90Right = useCallback(() => {
    actualOnRotate(Math.round((actualAngle + 90) % 360));
  }, [actualAngle, actualOnRotate]);

  const handleSliderChange = useCallback(
    (value: number) => {
      actualOnRotate(value);
    },
    [actualOnRotate]
  );

  const normalizeAngle = ((actualAngle % 360) + 360) % 360;
  const displayAngle = normalizeAngle > 180 ? normalizeAngle - 360 : normalizeAngle;

  return (
    <div className={cn('space-y-5', className)}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">快速旋转</h4>
          <Button
            variant="ghost"
            size="sm"
            icon={<RefreshCcw className="w-4 h-4" />}
            onClick={onReset}
            className="text-xs"
          >
            重置
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={<RotateCcw className="w-5 h-5" />}
            onClick={handleRotate90Left}
            className="flex-col py-3 h-auto"
          >
            <span className="text-xs mt-1">左转90°</span>
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<RotateCw className="w-5 h-5" />}
            onClick={handleRotate90Right}
            className="flex-col py-3 h-auto"
          >
            <span className="text-xs mt-1">右转90°</span>
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<FlipHorizontal className="w-5 h-5" />}
            onClick={() => {
              if (onFlipH) onFlipH();
              else if (onFlip) onFlip('horizontal');
            }}
            className={cn(
              'flex-col py-3 h-auto',
              flippedH && 'ring-2 ring-brand-500 ring-offset-1 bg-brand-50'
            )}
          >
            <span className="text-xs mt-1">{flippedH ? '已水平' : '水平翻转'}</span>
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<FlipVertical className="w-5 h-5" />}
            onClick={() => {
              if (onFlipV) onFlipV();
              else if (onFlip) onFlip('vertical');
            }}
            className={cn(
              'flex-col py-3 h-auto',
              flippedV && 'ring-2 ring-brand-500 ring-offset-1 bg-brand-50'
            )}
          >
            <span className="text-xs mt-1">{flippedV ? '已垂直' : '垂直翻转'}</span>
          </Button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Wand2 className="w-4 h-4 text-violet-500 shrink-0" />
              <h5 className="text-sm font-semibold text-violet-800">自动矫正</h5>
            </div>
            <p className="text-xs text-violet-600/80 leading-relaxed">
              智能识别文档边界并自动矫正倾斜角度，适用于拍摄的试卷、笔记等文档
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Wand2 className="w-4 h-4" />}
            onClick={onAutoCorrect}
            loading={autoCorrectLoading}
            disabled={autoCorrectLoading}
            className="shrink-0"
          >
            {autoCorrectLoading ? '处理中...' : '开始矫正'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">精细旋转</h4>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-50 border border-brand-200">
            <span className="text-xs font-mono font-semibold text-brand-700 min-w-[52px] text-center">
              {displayAngle > 0 ? '+' : ''}
              {displayAngle.toFixed(1)}°
            </span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none">
            <div className="w-full h-8 rounded-lg bg-slate-100 overflow-hidden relative">
              <div className="absolute top-0 left-1/2 w-px h-full bg-slate-400/60" />
              {[-30, -15, 15, 30].map((mark) => (
                <div
                  key={mark}
                  className="absolute top-1/2 w-px h-3 bg-slate-300 -translate-y-1/2"
                  style={{
                    left: `${50 + (mark / 45) * 50}%`,
                  }}
                />
              ))}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand-500 border-2 border-white shadow-md transition-all duration-150"
                style={{
                  left: `calc(${50 + (displayAngle / 45) * 50}% - 6px)`,
                }}
              />
            </div>
          </div>
          <div className="relative pt-2">
            <Slider
              value={displayAngle}
              onChange={handleSliderChange}
              min={-45}
              max={45}
              step={0.1}
              showValue={false}
              label=""
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer pt-0"
            />
            <Slider
              value={displayAngle}
              onChange={handleSliderChange}
              min={-45}
              max={45}
              step={0.1}
              showValue={false}
              label=""
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-xs text-slate-500">快捷:</span>
          {PRESET_ANGLES.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => actualOnRotate(preset)}
              className={cn(
                'px-2 py-1 rounded-md text-xs font-mono transition-all duration-200',
                Math.abs(displayAngle - preset) < 0.05
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50'
              )}
            >
              {preset > 0 ? '+' : ''}
              {preset}°
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">当前角度:</span>
            <span className="font-mono font-medium text-slate-700">{displayAngle.toFixed(1)}°</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">翻转状态:</span>
            <div className="flex items-center gap-1">
              {flippedH && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] font-medium">
                  H
                </span>
              )}
              {flippedV && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[10px] font-medium">
                  V
                </span>
              )}
              {!flippedH && !flippedV && <span className="text-slate-400">无</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RotateTool;
