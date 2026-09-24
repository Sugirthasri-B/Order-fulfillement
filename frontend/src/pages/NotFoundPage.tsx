import { Link } from 'react-router-dom';
import { EmptyState } from '../components';
import { ROUTES } from '../routes/paths';

export const NotFoundPage = () => (
  <EmptyState
    icon="🧭"
    title="Page not found"
    description="The page you're looking for doesn't exist."
    action={<Link to={ROUTES.dashboard}>Back to Dashboard</Link>}
  />
);
