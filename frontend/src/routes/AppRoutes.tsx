import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { DashboardPage } from '../pages/Dashboard/DashboardPage';
import { CustomersPage } from '../pages/Customers/CustomersPage';
import { InventoryPage } from '../pages/Inventory/InventoryPage';
import { CreateOrderPage } from '../pages/CreateOrder/CreateOrderPage';
import { OrdersPage } from '../pages/Orders/OrdersPage';
import { FulfilmentDetailsPage } from '../pages/FulfilmentDetails/FulfilmentDetailsPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export const AppRoutes = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route index element={<DashboardPage />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="orders/new" element={<CreateOrderPage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="orders/:orderId" element={<FulfilmentDetailsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);
