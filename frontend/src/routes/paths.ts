export const ROUTES = {
  dashboard: '/',
  customers: '/customers',
  inventory: '/inventory',
  createOrder: '/orders/new',
  orders: '/orders',
  fulfilmentDetails: '/orders/:orderId',
} as const;

export const fulfilmentDetailsPath = (orderId: string): string => `/orders/${orderId}`;
