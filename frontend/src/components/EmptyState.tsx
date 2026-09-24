import { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({ icon = '📭', title, description, action }: EmptyStateProps) => (
  <div className="empty-state">
    <span className="empty-state__icon" aria-hidden="true">
      {icon}
    </span>
    <span className="empty-state__title">{title}</span>
    {description && <span className="empty-state__description">{description}</span>}
    {action}
  </div>
);
