import { useCallback, useState } from 'react';

interface ToastState {
  message: string;
  tone: 'success' | 'error';
}

/**
 * Minimal single-slot toast: showing a new message replaces any current
 * one. Enough for page-level success/error feedback without a global
 * notification system.
 */
export const useToast = () => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showSuccess = useCallback((message: string) => setToast({ message, tone: 'success' }), []);
  const showError = useCallback((message: string) => setToast({ message, tone: 'error' }), []);
  const dismiss = useCallback(() => setToast(null), []);

  return { toast, showSuccess, showError, dismiss };
};
