import { useEffect } from 'react';
import { classNames } from '../utils/format';

export interface ToastProps {
  message: string;
  tone?: 'success' | 'error';
  onDismiss: () => void;
  durationMs?: number;
}

export const Toast = ({ message, tone = 'success', onDismiss, durationMs = 3500 }: ToastProps) => {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <div className={classNames('toast', `toast--${tone}`)} role="status" aria-live="polite">
      <span aria-hidden="true">{tone === 'success' ? '✓' : '⚠'}</span>
      <span>{message}</span>
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss notification">
        &times;
      </button>
    </div>
  );
};
