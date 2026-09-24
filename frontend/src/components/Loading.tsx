export interface LoadingProps {
  label?: string;
}

export const Loading = ({ label = 'Loading…' }: LoadingProps) => (
  <div className="loading" role="status" aria-live="polite">
    <span className="spinner" aria-hidden="true" />
    <span>{label}</span>
  </div>
);
