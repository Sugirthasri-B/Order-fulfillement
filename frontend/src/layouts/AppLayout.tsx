import { NavLink, Outlet } from 'react-router-dom';
import { classNames } from '../utils/format';
import { ROUTES } from '../routes/paths';

const NAV_ITEMS = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: '📊' },
  { to: ROUTES.customers, label: 'Customers', icon: '👥' },
  { to: ROUTES.inventory, label: 'Inventory', icon: '📦' },
  { to: ROUTES.createOrder, label: 'Create Order', icon: '➕' },
  { to: ROUTES.orders, label: 'Orders', icon: '🧾' },
];

export const AppLayout = () => (
  <div className="app-shell">
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <span className="app-sidebar__brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </span>
        Order Fulfilment
      </div>
      <nav className="app-sidebar__nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) => classNames('app-sidebar__link', isActive && 'is-active')}
          >
            <span className="app-sidebar__link-icon" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
    <main className="app-main">
      <div className="app-main__inner">
        <Outlet />
      </div>
    </main>
  </div>
);
