import { Check, Loader2, FileImage, ScanText, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatProgress } from '@/utils/format';

export interface StageProgress {
  preprocess: number;
  ocr: number;
  layout: number;
}

export type CurrentStage = 'pending' | 'preprocess' | 'ocr' | 'layout' | 'done';

export interface ProgressBarProps {
  percent: number;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  showPercent?: boolean;
  striped?: boolean;
  animated?: boolean;
  currentStage?: CurrentStage;
  stageProgress?: StageProgress;
  showStages?: boolean;
  className?: string;
  barClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

const colorClasses: Record<string, string> = {
  primary: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
};

const sizeConfig = {
  sm: { height: 'h-1', text: 'text-xs' },
  md: { height: 'h-2.5', text: 'text-sm' },
  lg: { height: 'h-3.5', text: 'text-base' },
};

const stages = [
  { key: 'preprocess' as const, label: '预处理', icon: FileImage },
  { key: 'ocr' as const, label: 'OCR识别', icon: ScanText },
  { key: 'layout' as const, label: '排版还原', icon: LayoutGrid },
];

function getStageStatus(
  stageKey: 'preprocess' | 'ocr' | 'layout',
  currentStage: CurrentStage,
  progress: number
): 'done' | 'active' | 'pending' {
  const order = ['pending', 'preprocess', 'ocr', 'layout', 'done'];
  const currentIdx = order.indexOf(currentStage);
  const stageIdx = order.indexOf(stageKey);

  if (currentIdx > stageIdx) return 'done';
  if (currentIdx === stageIdx) return 'active';
  if (currentStage === 'done') return 'done';
  return 'pending';
}

export function ProgressBar({
  percent,
  color = 'primary',
  showPercent = true,
  striped = false,
  animated = false,
  currentStage,
  stageProgress,
  showStages = false,
  className,
  barClassName,
  size = 'md',
}: ProgressBarProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const config = sizeConfig[size];

  if (showStages && currentStage && stageProgress) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="grid grid-cols-3 gap-4">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const status = getStageStatus(stage.key, currentStage, stageProgress[stage.key]);
            const progress = stageProgress[stage.key];

            return (
              <div
                key={stage.key}
                className={cn(
                  'relative p-4 rounded-xl border transition-all duration-300',
                  status === 'done' && 'bg-emerald-50 border-emerald-200',
                  status === 'active' && 'bg-brand-50 border-brand-200',
                  status === 'pending' && 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      status === 'done' && 'bg-emerald-500 text-white',
                      status === 'active' && 'bg-brand-500 text-white',
                      status === 'pending' && 'bg-slate-200 text-slate-400'
                    )}
                  >
                    {status === 'done' ? (
                      <Check size={18} />
                    ) : status === 'active' ? (
                      <Loader2 className="animate-spin-slow" size={18} />
                    ) : (
                      <Icon size={18} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        status === 'done' && 'text-emerald-700',
                        status === 'active' && 'text-brand-700',
                        status === 'pending' && 'text-slate-500'
                      )}
                    >
                      {stage.label}
                    </p>
                    <p
                      className={cn(
                        'text-xs font-mono mt-0.5',
                        status === 'done' && 'text-emerald-600',
                        status === 'active' && 'text-brand-600',
                        status === 'pending' && 'text-slate-400'
                      )}
                    >
                      {formatProgress(progress)}
                    </p>
                  </div>
                </div>

                <div className="relative h-1.5 bg-white/60 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      status === 'done' && 'bg-emerald-500',
                      status === 'active' && 'bg-brand-500 animate-progress-striped',
                      status === 'pending' && 'bg-slate-300'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative bg-slate-200 rounded-full overflow-hidden h-2">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                colorClasses[color],
                (striped || animated) && 'animate-progress-striped'
              )}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>
          {showPercent && (
            <span className={cn('font-mono font-medium text-slate-600 min-w-[4rem] text-right', config.text)}>
              {formatProgress(clampedPercent)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative bg-slate-200 rounded-full overflow-hidden',
          config.height,
          barClassName
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            colorClasses[color],
            (striped || animated) && 'animate-progress-striped'
          )}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      {showPercent && (
        <div className="flex justify-end mt-1.5">
          <span className={cn('font-mono font-medium text-slate-500', config.text)}>
            {formatProgress(clampedPercent)}
          </span>
        </div>
      )}
    </div>
  );
}

export default ProgressBar;
