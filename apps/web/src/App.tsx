import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { NotFound } from './app/NotFound'
import { FullPageLoading, RequireRole, RootRedirect } from './app/RequireRole'
import { AppShell } from './components/AppShell'
import { PushSync } from './features/alerts/PushSync'
import { BalancesPage, ShopStatementPage } from './features/admin/BalancesPages'
import { BillPage } from './features/admin/BillPage'
import { DeliveriesPage, DeliveryHistoryPage } from './features/delivery/DeliveryPages'
import { ShopPaymentsPage } from './features/shop/PaymentsPage'
import { BillsPage } from './features/admin/BillsPage'
import { ItemForm, ItemsList } from './features/admin/ItemsPages'
import { MorePage } from './features/admin/MorePage'
import { OrderDetailPage as AdminOrderDetailPage } from './features/admin/OrderDetail'
import { NewOrderPage } from './features/admin/NewOrderPage'
import { OrdersInbox } from './features/admin/OrdersInbox'
import { RatesPage } from './features/admin/RatesPage'
import { SettingsPage } from './features/admin/SettingsPage'
import { ShopForm, ShopsList } from './features/admin/ShopsPages'
import { NewUserForm, UserDetail, UsersList } from './features/admin/UsersPages'
import { LoginPage } from './features/auth/LoginPage'
import { OrderPage } from './features/shop/OrderPage'
import { OrderDetailPage, OrdersList } from './features/shop/OrdersPages'
import { ReviewPage } from './features/shop/ReviewPage'
import { ShopHome } from './features/shop/ShopHome'

// Stage 0 spike pages exist only in dev builds, or when built with VITE_SPIKES=1.
// In a normal production build this whole branch is removed.
const spikesEnabled = import.meta.env.DEV || import.meta.env.VITE_SPIKES === '1'
const PdfSpike: ComponentType | null = spikesEnabled
  ? lazy(() => import('./spikes/PdfSpike'))
  : null
const StatusSpike: ComponentType | null = spikesEnabled
  ? lazy(() => import('./spikes/StatusSpike'))
  : null

/** A screen that a later stage builds, with its title in the current language. */

export default function App() {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <PushSync />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/shop"
          element={
            <RequireRole role="shop">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<ShopHome />} />
          <Route path="order" element={<OrderPage />} />
          <Route path="order/review" element={<ReviewPage />} />
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="payments" element={<ShopPaymentsPage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireRole role="admin">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders" element={<OrdersInbox />} />
          <Route path="orders/new" element={<NewOrderPage />} />
          <Route path="orders/:id" element={<AdminOrderDetailPage />} />
          <Route path="orders/:id/bill" element={<BillPage />} />
          <Route path="rates" element={<RatesPage />} />
          <Route path="bills" element={<BillsPage />} />
          <Route path="balances" element={<BalancesPage />} />
          <Route path="balances/:shopId" element={<ShopStatementPage />} />
          <Route path="more" element={<MorePage />} />
          <Route path="more/items" element={<ItemsList />} />
          <Route path="more/items/new" element={<ItemForm />} />
          <Route path="more/items/:id" element={<ItemForm />} />
          <Route path="more/shops" element={<ShopsList />} />
          <Route path="more/shops/new" element={<ShopForm />} />
          <Route path="more/shops/:id" element={<ShopForm />} />
          <Route path="more/users" element={<UsersList />} />
          <Route path="more/users/new" element={<NewUserForm />} />
          <Route path="more/users/:id" element={<UserDetail />} />
          <Route path="more/settings" element={<SettingsPage />} />
        </Route>

        <Route
          path="/delivery"
          element={
            <RequireRole role="distributor">
              <AppShell />
            </RequireRole>
          }
        >
          <Route index element={<DeliveriesPage />} />
          <Route path="history" element={<DeliveryHistoryPage />} />
        </Route>

        {PdfSpike && <Route path="/spikes/pdf" element={<PdfSpike />} />}
        {StatusSpike && <Route path="/spikes/status" element={<StatusSpike />} />}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
