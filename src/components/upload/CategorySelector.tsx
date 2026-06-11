import { FileText, NotebookText, Receipt, Settings2, CheckCircle2 } from 'lucide-react';
import type { FileCategory } from '@shared/types';
import { CATEGORY_LABELS } from '@shared/types';
import { useUploadStore } from '@/stores/uploadStore';
import { cn } from '@/lib/utils';

export interface CategorySelectorProps {
  value?: FileCategory;
  onChange?: (category: FileCategory) => void;
  className?: string;
}

interface CategoryCardConfig {
  key: FileCategory;
  icon: typeof FileText;
  description: string;
  accent: string;
  bgLight: string;
  borderActive: string;
  bgHover: string;
  iconColor: string;
}

const CATEGORY_CONFIG: CategoryCardConfig[] = [
  {
    key: 'exam',
    icon: FileText,
    description: '试卷、答题卡、作业等教学文档',
    accent: 'from-brand-500 to-brand-600',
    bgLight: 'bg-brand-50',
    borderActive: 'border-brand-500 ring-brand-500/20',
    bgHover: 'hover:bg-brand-50/50',
    iconColor: 'text-brand-500',
  },
  {
    key: 'note',
    icon: NotebookText,
    description: '课堂笔记、手账、草稿等手写记录',
    accent: 'from-emerald-500 to-emerald-600',
    bgLight: 'bg-emerald-50',
    borderActive: 'border-emerald-500 ring-emerald-500/20',
    bgHover: 'hover:bg-emerald-50/50',
    iconColor: 'text-emerald-500',
  },
  {
    key: 'receipt',
    icon: Receipt,
    description: '发票、收据、报销单、账单等财务票据',
    accent: 'from-amber-500 to-amber-600',
    bgLight: 'bg-amber-50',
    borderActive: 'border-amber-500 ring-amber-500/20',
    bgHover: 'hover:bg-amber-50/50',
    iconColor: 'text-amber-500',
  },
  {
    key: 'custom',
    icon: Settings2,
    description: '通用类型，自动适配各类内容识别',
    accent: 'from-violet-500 to-violet-600',
    bgLight: 'bg-violet-50',
    borderActive: 'border-violet-500 ring-violet-500/20',
    bgHover: 'hover:bg-violet-50/50',
    iconColor: 'text-violet-500',
  },
];

export function CategorySelector({ value, onChange, className }: CategorySelectorProps) {
  const storeCategory = useUploadStore((s) => s.selectedCategory);
  const setStoreCategory = useUploadStore((s) => s.setCategory);

  const selected = value ?? storeCategory;

  const handleSelect = (category: FileCategory) => {
    onChange?.(category);
    if (value === undefined) {
      setStoreCategory(category);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">选择场景类型</h3>
        <p className="text-xs text-slate-400">选择合适的场景可获得更准确的识别效果</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CATEGORY_CONFIG.map((config) => {
          const isSelected = selected === config.key;
          const Icon = config.icon;

          return (
            <button
              key={config.key}
              type="button"
              onClick={() => handleSelect(config.key)}
              className={cn(
                'group relative text-left p-4 rounded-2xl border-2 transition-all duration-300',
                'focus:outline-none focus-visible:ring-4',
                isSelected
                  ? `${config.borderActive} bg-white shadow-md ring-4`
                  : `border-slate-200 bg-white ${config.bgHover} hover:border-slate-300 hover:shadow-sm`
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-gradient-to-br shadow-md flex items-center justify-center animate-scale-in"
                  style={{ backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
                >
                  <div className={cn('absolute inset-0 rounded-full bg-gradient-to-br', config.accent)} />
                  <CheckCircle2 className="relative w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-300',
                  isSelected ? config.bgLight : 'bg-slate-50 group-hover:bg-slate-100'
                )}
              >
                <Icon
                  className={cn(
                    'w-6 h-6 transition-all duration-300',
                    isSelected ? config.iconColor : 'text-slate-400 group-hover:text-slate-600'
                  )}
                />
              </div>

              <h4
                className={cn(
                  'text-base font-semibold mb-1 transition-colors duration-300',
                  isSelected ? config.iconColor : 'text-slate-800'
                )}
              >
                {CATEGORY_LABELS[config.key]}
              </h4>

              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {config.description}
              </p>

              {isSelected && (
                <div
                  className={cn(
                    'absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-gradient-to-r',
                    config.accent
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CategorySelector;
