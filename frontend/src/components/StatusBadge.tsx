import { classNames } from '../utils/format';

type BadgeTone = 'good' | 'warning' | 'critical' | 'neutral';

const STATUS_TONE: Record<string, BadgeTone> = {
  released: 'good',
  'partially released': 'warning',
  blocked: 'critical',
  eligible: 'good',
  'credit hold': 'critical',
  unknown: 'neutral',
};

export interface StatusBadgeProps {
  status: string;
  tone?: BadgeTone;
}

/**
 * Renders one of the app's fixed status values (order status, customer
 * eligibility) with a consistent color + icon, never color alone.
 */
export const StatusBadge = ({ status, tone }: StatusBadgeProps) => {
  const resolvedTone = tone ?? STATUS_TONE[status] ?? 'neutral';

  return (
    <span className={classNames('badge', `badge--${resolvedTone}`)}>
      <span className="badge__dot" aria-hidden="true" />
      {status}
    </span>
  );
};
