import { ButtonHTMLAttributes, forwardRef } from 'react';
import { classNames } from '../utils/format';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...rest }, ref) => (
    <button
      ref={ref}
      className={classNames(
        'btn',
        `btn--${variant}`,
        size === 'sm' && 'btn--sm',
        className
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
);

Button.displayName = 'Button';
