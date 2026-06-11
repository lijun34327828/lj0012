import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  maskClosable?: boolean;
  escClosable?: boolean;
  width?: string | number;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maskClosable = true,
  escClosable = true,
  width = 520,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open || !escClosable) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, escClosable, onClose]);

  if (!open) return null;

  const modalNode = (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
        onClick={() => maskClosable && onClose()}
      />
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-2xl mx-4 max-h-[85vh] flex flex-col',
          className
        )}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
      >
        <div
          className="absolute"
          style={{
            animation: 'scaleIn 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          }}
        >
          {title && (
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}
          {!title && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          )}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
          {footer && (
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

export default Modal;
