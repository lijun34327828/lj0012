import { useCallback, useState } from 'react';
import {
  Sun,
  Contrast,
  Focus,
  Sparkles,
  Palette,
  RotateCcw,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type { EnhanceSettings } from './Canvas';
import { Button } from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import { cn } from '@/lib/utils';

export interface EnhancePanelProps {
  settings: EnhanceSettings;
  onChange: (settings: EnhanceSettings) => void;
  onApply?: (settings: EnhanceSettings) => void;
  className?: string;
}

const DEFAULT_SETTINGS: EnhanceSettings = {
  brightness: 0,
  contrast: 0,
  sharpness: 0,
  denoise: false,
  denoiseStrength: 50,
  binarize: false,
  binarizeThreshold: 128,
};

const PRESETS = [
  {
    key: 'original',
    label: '原图',
    settings: { ...DEFAULT_SETTINGS },
  },
  {
    key: 'document',
    label: '文档增强',
    settings: {
      brightness: 10,
      contrast: 25,
      sharpness: 20,
      denoise: true,
      denoiseStrength: 40,
      binarize: false,
      binarizeThreshold: 128,
    },
  },
  {
    key: 'handwriting',
    label: '手写优化',
    settings: {
      brightness: 15,
      contrast: 35,
      sharpness: 30,
      denoise: true,
      denoiseStrength: 60,
      binarize: false,
      binarizeThreshold: 128,
    },
  },
  {
    key: 'binary',
    label: '黑白模式',
    settings: {
      brightness: 0,
      contrast: 0,
      sharpness: 15,
      denoise: false,
      denoiseStrength: 50,
      binarize: true,
      binarizeThreshold: 140,
    },
  },
];

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex items-center transition-colors duration-200 rounded-full',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        checked ? 'bg-brand-500' : 'bg-slate-300'
      )}
      style={{ width: '36px', height: '20px' }}
    >
      {checked ? (
        <ToggleRight className="absolute -left-0.5 -top-0.5 w-[22px] h-[22px] text-brand-500" />
      ) : (
        <ToggleLeft className="absolute -left-0.5 -top-0.5 w-[22px] h-[22px] text-slate-300" />
      )}
      <span
        className={cn(
          'absolute inline-block rounded-full bg-white shadow-md transition-all duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        )}
        style={{ width: '16px', height: '16px' }}
      />
    </button>
  );
}

export function EnhancePanel({ settings, onChange, onApply, className }: EnhancePanelProps) {
  const [activePreset, setActivePreset] = useState<string>('original');

  const handleChange = useCallback(
    <K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => {
      onChange({ ...settings, [key]: value });
      setActivePreset('');
    },
    [settings, onChange]
  );

  const handleReset = useCallback(() => {
    onChange({ ...DEFAULT_SETTINGS });
    setActivePreset('original');
    if (onApply) onApply({ ...DEFAULT_SETTINGS });
  }, [onChange, onApply]);

  const handlePreset = useCallback(
    (preset: typeof PRESETS[number]) => {
      onChange({ ...preset.settings });
      setActivePreset(preset.key);
      if (onApply) onApply({ ...preset.settings });
    },
    [onChange, onApply]
  );

  const isModified =
    settings.brightness !== 0 ||
    settings.contrast !== 0 ||
    settings.sharpness !== 0 ||
    settings.denoise !== false ||
    settings.binarize !== false;

  return (
    <div className={cn('space-y-5', className)}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">快速预设</h4>
          <Button
            variant="ghost"
            size="sm"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={handleReset}
            disabled={!isModified}
            className="text-xs"
          >
            全部重置
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePreset(preset)}
              className={cn(
                'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200',
                activePreset === preset.key
                  ? 'border-brand-500 bg-brand-50 shadow-sm ring-2 ring-brand-500/20'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  activePreset === preset.key ? 'bg-brand-500' : 'bg-slate-100'
                )}
              >
                <Sparkles
                  className={cn(
                    'w-4 h-4',
                    activePreset === preset.key ? 'text-white' : 'text-slate-500'
                  )}
                />
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  activePreset === preset.key ? 'text-brand-700' : 'text-slate-600'
                )}
              >
                {preset.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Sun className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <Slider
                label="亮度"
                value={settings.brightness}
                onChange={(v) => handleChange('brightness', v)}
                min={-100}
                max={100}
                formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
              <Contrast className="w-4 h-4 text-sky-500" />
            </div>
            <div className="flex-1">
              <Slider
                label="对比度"
                value={settings.contrast}
                onChange={(v) => handleChange('contrast', v)}
                min={-100}
                max={100}
                formatValue={(v) => (v > 0 ? `+${v}` : `${v}`)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
              <Focus className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <Slider
                label="锐度"
                value={settings.sharpness}
                onChange={(v) => handleChange('sharpness', v)}
                min={0}
                max={100}
                formatValue={(v) => `${v}`}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-slate-100">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">去噪</p>
                <p className="text-xs text-slate-500">减少图像噪点，提升清晰度</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.denoise}
              onChange={(v) => handleChange('denoise', v)}
            />
          </div>

          {settings.denoise && (
            <div className="pl-10 animate-slide-down">
              <Slider
                value={settings.denoiseStrength}
                onChange={(v) => handleChange('denoiseStrength', v)}
                min={0}
                max={100}
                label="去噪强度"
                formatValue={(v) => `${v}%`}
              />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                <Palette className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">二值化 (黑白)</p>
                <p className="text-xs text-slate-500">转换为纯黑白图像，适合文字识别</p>
              </div>
            </div>
            <ToggleSwitch
              checked={settings.binarize}
              onChange={(v) => handleChange('binarize', v)}
            />
          </div>

          {settings.binarize && (
            <div className="pl-10 animate-slide-down space-y-2">
              <Slider
                value={settings.binarizeThreshold}
                onChange={(v) => handleChange('binarizeThreshold', v)}
                min={0}
                max={255}
                label="阈值"
                formatValue={(v) => `${v}`}
              />

              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-6 rounded-lg overflow-hidden border border-slate-200"
                  style={{
                    background: `linear-gradient(to right, rgb(0,0,0) 0%, rgb(0,0,0) ${(settings.binarizeThreshold / 255) * 100}%, rgb(255,255,255) ${(settings.binarizeThreshold / 255) * 100}%, rgb(255,255,255) 100%)`,
                  }}
                />
                <span className="text-xs font-mono text-slate-500 shrink-0">
                  小于 {settings.binarizeThreshold} → 黑
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {isModified && (
        <div className="p-3 rounded-xl bg-brand-50 border border-brand-100">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-brand-700 mb-1">已应用的增强效果</p>
              <div className="flex flex-wrap gap-1">
                {settings.brightness !== 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/80 text-amber-700 text-[10px] font-mono">
                    亮度 {settings.brightness > 0 ? '+' : ''}{settings.brightness}
                  </span>
                )}
                {settings.contrast !== 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/80 text-sky-700 text-[10px] font-mono">
                    对比 {settings.contrast > 0 ? '+' : ''}{settings.contrast}
                  </span>
                )}
                {settings.sharpness !== 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/80 text-emerald-700 text-[10px] font-mono">
                    锐度 +{settings.sharpness}
                  </span>
                )}
                {settings.denoise && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/80 text-violet-700 text-[10px] font-mono">
                    去噪 {settings.denoiseStrength}%
                  </span>
                )}
                {settings.binarize && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/80 text-slate-700 text-[10px] font-mono">
                    二值化 @{settings.binarizeThreshold}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnhancePanel;
