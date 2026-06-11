import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number;
  onClose?: () => void;
}

export interface ToastProps extends ToastItem {
  onRemove: (id: string) => void;
}

const icons = {
  success: CheckCircle,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
};

const typeStyles: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-emerald-50',
    icon: 'text-emerald-500',
    border: 'border-emerald-200',
  },
  info: {
    bg: 'bg-blue-50',
    icon: 'text-brand-500',
    border: 'border-brand-200',
  },
  warning: {
    bg: 'bg-amber-50',
    icon: 'text-amber-500',
    border: 'border-amber-200',
  },
  error: {
    bg: 'bg-red-50',
    icon: 'text-red-500',
    border: 'border-red-200',
  },
};

export function Toast({
  id,
  type,
  message,
  description,
  duration = 3500,
  onClose,
  onRemove,
}: ToastProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const Icon = icons[type];
  const styles = typeStyles[type];

  useEffect(() => {
    if (duration <= 0) return;

    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onRemove(id);
      onClose?.();
    }, 300);
  };

  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-xl border shadow-lg overflow-hidden',
        'flex items-start gap-3 p-4',
        styles.bg,
        styles.border
      )}
      style={{
        animation: isLeaving
          ? 'toastOut 0.3s cubic-bezier(0.4, 0, 1, 1) forwards'
          : 'toastIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }}
    >
      <div className={cn('shrink-0 mt-0.5', styles.icon)}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{message}</p>
        {description && (
          <p className="mt-1 text-sm text-slate-600 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        onClick={handleClose}
        className="shrink-0 p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-600 hover:bg-white/60 rounded-lg transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default Toast;
