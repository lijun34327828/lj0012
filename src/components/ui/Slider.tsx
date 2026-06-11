import { type ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  trackClassName?: string;
  thumbClassName?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  formatValue,
  disabled = false,
  className,
  trackClassName,
  thumbClassName,
}: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const displayValue = formatValue ? formatValue(value) : value.toString();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    onChange(newValue);
  };

  return (
    <div className={cn('w-full', disabled && 'opacity-50 cursor-not-allowed', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
          {showValue && (
            <span className="text-sm font-mono text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <div className="relative h-2 flex items-center">
        <div
          className={cn(
            'absolute inset-x-0 h-2 bg-slate-200 rounded-full overflow-hidden',
            trackClassName
          )}
        >
          <div
            className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={handleChange}
          className={cn(
            'absolute inset-0 w-full h-2 appearance-none bg-transparent cursor-pointer',
            'disabled:cursor-not-allowed',
            thumbClassName,
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white',
            '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-500',
            '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform',
            '[&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95',
            '[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-500',
            '[&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-none'
          )}
        />
      </div>
    </div>
  );
}

export default Slider;
