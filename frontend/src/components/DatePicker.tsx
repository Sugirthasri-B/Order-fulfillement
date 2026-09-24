import { InputHTMLAttributes, useId } from 'react';
import { classNames } from '../utils/format';

export interface DatePickerProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
}

/**
 * Wraps a native date input so every date field in the app produces the
 * same YYYY-MM-DD string the backend expects, with consistent label/error
 * styling.
 */
export const DatePicker = ({
  label,
  value,
  onChange,
  hint,
  error,
  id,
  className,
  ...rest
}: DatePickerProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={classNames('form-input', error && 'has-error', className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {hint && !error && (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
