import { toastApi } from '@/components/ui/ToastContainer';
import type { ToastItem, ToastType } from '@/components/ui/Toast';

export interface ToastOptions extends Omit<ToastItem, 'id' | 'type'> {
  type?: ToastType;
}

function showToast(type: ToastType, message: string, options?: Omit<ToastOptions, 'type'>) {
  return toastApi.add({
    type,
    message,
    ...options,
  });
}

export const toast = {
  success: (message: string, options?: ToastOptions) =>
    showToast('success', message, options),

  info: (message: string, options?: ToastOptions) =>
    showToast('info', message, options),

  warning: (message: string, options?: ToastOptions) =>
    showToast('warning', message, options),

  error: (message: string, options?: ToastOptions) =>
    showToast('error', message, options),

  custom: (options: ToastItem) =>
    toastApi.add(options),

  dismiss: (id: string) => toastApi.remove(id),

  clear: () => toastApi.clear(),
};

export default toast;
