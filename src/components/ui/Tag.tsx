import { type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TagVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

export interface TagProps {
  variant?: TagVariant;
  size?: 'sm' | 'md';
  closable?: boolean;
  onClose?: () => void;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const variantClasses: Record<TagVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  primary: 'bg-brand-50 text-brand-700 border border-brand-200',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200',
  info: 'bg-violet-50 text-violet-700 border border-violet-200',
  outline: 'bg-transparent text-slate-600 border border-slate-300',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs rounded-md gap-1',
  md: 'px-3 py-1 text-sm rounded-lg gap-1.5',
};

export function Tag({
  variant = 'default',
  size = 'md',
  closable = false,
  onClose,
  icon,
  children,
  className,
}: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {closable && (
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'shrink-0 -mr-1 rounded hover:bg-black/10 transition-colors',
            size === 'sm' ? 'p-0.5' : 'p-1'
          )}
        >
          <X size={size === 'sm' ? 12 : 14} />
        </button>
      )}
    </span>
  );
}

export default Tag;
