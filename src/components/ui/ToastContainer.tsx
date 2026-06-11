import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toast, type ToastItem } from './Toast';

let globalAddToast: ((toast: Omit<ToastItem, 'id'>) => string) | null = null;
let globalRemoveToast: ((id: string) => void) | null = null;
let globalClearToasts: (() => void) | null = null;

export const toastApi = {
  add: (toast: Omit<ToastItem, 'id'>) => {
    if (globalAddToast) return globalAddToast(toast);
    console.warn('ToastContainer not mounted');
    return '';
  },
  remove: (id: string) => {
    globalRemoveToast?.(id);
  },
  clear: () => {
    globalClearToasts?.();
  },
};

export interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxToasts?: number;
}

const positionClasses: Record<string, string> = {
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
};

export function ToastContainer({
  position = 'top-right',
  maxToasts = 5,
}: ToastContainerProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    globalAddToast = (toast) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newToast = { ...toast, id };
      setToasts((prev) => {
        const next = [...prev, newToast];
        return next.length > maxToasts ? next.slice(next.length - maxToasts) : next;
      });
      return id;
    };

    globalRemoveToast = (id) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    globalClearToasts = () => {
      setToasts([]);
    };

    return () => {
      globalAddToast = null;
      globalRemoveToast = null;
      globalClearToasts = null;
    };
  }, [maxToasts]);

  const handleRemove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (!mounted || typeof document === 'undefined') return null;

  const reversedToasts = position.startsWith('top') ? [...toasts].reverse() : toasts;

  return createPortal(
    <div
      className={cn(
        'fixed z-[100] flex flex-col gap-3 pointer-events-none',
        positionClasses[position]
      )}
    >
      {reversedToasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onRemove={handleRemove} />
        </div>
      ))}
    </div>,
    document.body
  );
}

export default ToastContainer;

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
