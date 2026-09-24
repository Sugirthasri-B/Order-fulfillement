import { ReactNode } from 'react';

export interface ErrorMessageProps {
  message: string;
  action?: ReactNode;
}

export const ErrorMessage = ({ message, action }: ErrorMessageProps) => (
  <div className="error-message" role="alert">
    <span aria-hidden="true">⚠</span>
    <span>{message}</span>
    {action}
  </div>
);
