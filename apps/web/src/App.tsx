import { lazy, Suspense, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Route, Routes } from 'react-router'
import { NotFound } from './app/NotFound'
import { FullPageLoading, RequireRole, RootRedirect } from './app/RequireRole'
import { AppShell } from './components/AppShell'
import { ComingSoon } from './components/ComingSoon'
import { ItemForm, ItemsList } from './features/admin/ItemsPages'
import { MorePage } from './features/admin/MorePage'
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
function Soon({ area, page, stage }: { area: string; page: string; stage: number }) {
  const { t } = useTranslation()
  return <ComingSoon title={t(`pages.${area}.${page}`)} stage={stage} />
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoading />}>
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
          <Route path="payments" element={<Soon area="shop" page="payments" stage={7} />} />
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
          <Route path="orders" element={<Soon area="admin" page="orders" stage={5} />} />
          <Route path="rates" element={<RatesPage />} />
          <Route path="bills" element={<Soon area="admin" page="bills" stage={6} />} />
          <Route path="balances" element={<Soon area="admin" page="balances" stage={7} />} />
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
          <Route index element={<Soon area="delivery" page="home" stage={7} />} />
          <Route path="history" element={<Soon area="delivery" page="history" stage={7} />} />
        </Route>

        {PdfSpike && <Route path="/spikes/pdf" element={<PdfSpike />} />}
        {StatusSpike && <Route path="/spikes/status" element={<StatusSpike />} />}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
