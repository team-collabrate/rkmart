import type { UserRole } from '../features/auth/types'

export interface NavItem {
  /** Path relative to the app root. */
  to: string
  /** Translation key under "nav". */
  labelKey: string
  /** lucide icon name, resolved in AppShell. */
  icon:
    | 'home'
    | 'cart'
    | 'list'
    | 'wallet'
    | 'tags'
    | 'receipt'
    | 'scale'
    | 'more'
    | 'truck'
    | 'history'
  /** The build stage that makes this screen real. */
  stage: number
}

export const HOME_PATH: Record<UserRole, string> = {
  shop: '/shop',
  admin: '/admin',
  distributor: '/delivery',
}

export const NAV: Record<UserRole, NavItem[]> = {
  shop: [
    { to: '/shop', labelKey: 'home', icon: 'home', stage: 4 },
    { to: '/shop/order', labelKey: 'order', icon: 'cart', stage: 4 },
    { to: '/shop/orders', labelKey: 'orders', icon: 'list', stage: 4 },
    { to: '/shop/payments', labelKey: 'payments', icon: 'wallet', stage: 7 },
  ],
  admin: [
    { to: '/admin/orders', labelKey: 'orders', icon: 'list', stage: 5 },
    { to: '/admin/rates', labelKey: 'rates', icon: 'tags', stage: 3 },
    { to: '/admin/bills', labelKey: 'bills', icon: 'receipt', stage: 6 },
    { to: '/admin/balances', labelKey: 'balances', icon: 'scale', stage: 7 },
    { to: '/admin/more', labelKey: 'more', icon: 'more', stage: 3 },
  ],
  distributor: [
    { to: '/delivery', labelKey: 'deliveries', icon: 'truck', stage: 7 },
    { to: '/delivery/history', labelKey: 'history', icon: 'history', stage: 7 },
  ],
}

/** Where a signed-in user starts. The admin lands on Orders, the screen used most. */
export function startPath(role: UserRole): string {
  return role === 'admin' ? '/admin/orders' : HOME_PATH[role]
}

/** Which role owns a path, or null for paths outside the three areas. */
export function roleForPath(pathname: string): UserRole | null {
  if (pathname === '/shop' || pathname.startsWith('/shop/')) return 'shop'
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin'
  if (pathname === '/delivery' || pathname.startsWith('/delivery/')) return 'distributor'
  return null
}
