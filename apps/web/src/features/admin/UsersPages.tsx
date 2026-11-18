import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import {
  Banner,
  Empty,
  Loading,
  PageHeader,
  SelectField,
  StatusPill,
  TextField,
} from '../../components/ui'
import { RoleChip } from '../../components/RoleChip'
import { Avatar } from '../../components/Avatar'
import { useAdminApi } from '../../data/apiContext'
import { useAuth } from '../auth/AuthProvider'
import type { Language, UserRole } from '../auth/types'
import { errorText, keys, useShops, useUsers } from './queries'
import { passwordSchema, userSchema } from './schemas'
import { useForm } from './useForm'

const BASE = '/admin/more/users'

export function UsersList() {
  const { t } = useTranslation()
  const users = useUsers()

  return (
    <section>
      <PageHeader
        title={t('admin.users.title')}
        backTo="/admin/more"
        action={
          <Link
            to={`${BASE}/new`}
            aria-label={t('admin.users.add')}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-paper no-underline"
          >
            <Plus size={22} aria-hidden="true" />
          </Link>
        }
      />
      {users.isPending ? (
        <Loading />
      ) : users.isError ? (
        <Banner kind="error">{errorText(t, users.error)}</Banner>
      ) : users.data.length === 0 ? (
        <Empty>{t('admin.users.empty')}</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[1.75rem] border border-line bg-paper">
          {users.data.map((u) => (
            <li key={u.id}>
              <Link
                to={`${BASE}/${u.id}`}
                className="flex items-center gap-3 px-3.5 py-3 no-underline"
              >
                <Avatar name={u.fullName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{u.fullName}</p>
                  <p className="truncate text-sm text-mute">
                    {[u.phone, u.shopName].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <RoleChip role={u.role} />
                <StatusPill active={u.isActive} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function NewUserForm() {
  const { t } = useTranslation()
  const api = useAdminApi()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const shops = useShops()
  const form = useForm({
    fullName: '',
    phone: '',
    password: '',
    role: 'shop' as UserRole,
    shopId: '',
    language: 'en' as Language,
  })
  const [failure, setFailure] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createUser>[0]) => api.createUser(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.users })
      void navigate(BASE)
    },
    onError: (e) => setFailure(errorText(t, e)),
  })

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setFailure(null)
    const v = form.values
    const parsed = form.validate(userSchema, {
      ...v,
      shopId: v.role === 'shop' && v.shopId ? v.shopId : null,
    })
    if (parsed) create.mutate(parsed)
  }

  const { values, set, errors } = form
  const activeShops = (shops.data ?? []).filter((s) => s.isActive)
  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'shop', label: t('roles.shop') },
    { value: 'distributor', label: t('roles.distributor') },
    { value: 'admin', label: t('roles.admin') },
  ]

  return (
    <section>
      <PageHeader title={t('admin.users.new')} backTo={BASE} />
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-paper p-4"
      >
        <TextField
          id="fullName"
          label={t('admin.users.name')}
          value={values.fullName}
          onChange={(x) => set('fullName', x)}
          error={errors.fullName}
        />
        <TextField
          id="phone"
          label={t('admin.users.phone')}
          value={values.phone}
          onChange={(x) => set('phone', x)}
          error={errors.phone}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          hint={t('admin.users.phoneHint')}
        />
        <TextField
          id="password"
          label={t('admin.users.password')}
          value={values.password}
          onChange={(x) => set('password', x)}
          error={errors.password}
          autoComplete="new-password"
          hint={t('admin.users.passwordHint')}
        />
        <SelectField
          id="role"
          label={t('admin.users.role')}
          value={values.role}
          onChange={(x) => set('role', x as UserRole)}
          options={roleOptions}
        />
        {values.role === 'shop' && (
          <SelectField
            id="shopId"
            label={t('admin.users.shop')}
            value={values.shopId}
            onChange={(x) => set('shopId', x)}
            error={errors.shopId}
            placeholder={t('admin.users.selectShop')}
            options={activeShops.map((s) => ({ value: s.id, label: s.nameEn }))}
          />
        )}
        <SelectField
          id="language"
          label={t('admin.users.language')}
          value={values.language}
          onChange={(x) => set('language', x as Language)}
          options={[
            { value: 'en', label: t('common.english') },
            { value: 'ta', label: t('common.tamil') },
          ]}
        />

        {failure && <Banner kind="error">{failure}</Banner>}
        <div>
          <button
            type="submit"
            className="btn h-12 w-full rounded-full"
            disabled={create.isPending}
          >
            {create.isPending ? t('admin.common.saving') : t('admin.users.create')}
          </button>
        </div>
      </form>
    </section>
  )
}

export function UserDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const users = useUsers()
  const user = users.data?.find((u) => u.id === id)

  if (users.isPending) return <Loading />
  if (users.isError) return <Banner kind="error">{errorText(t, users.error)}</Banner>
  if (!user) return <Banner kind="error">{t('admin.apiErrors.not_found')}</Banner>
  return <UserDetailBody userId={user.id} />
}

function UserDetailBody({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const api = useAdminApi()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const users = useUsers()
  const user = users.data!.find((u) => u.id === userId)!
  const form = useForm({ password: '' })
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const reset = useMutation({
    mutationFn: (password: string) => api.resetPassword(userId, password),
    onSuccess: () => {
      form.set('password', '')
      setNotice({ kind: 'success', text: t('admin.users.resetDone') })
    },
    onError: (e) => setNotice({ kind: 'error', text: errorText(t, e) }),
  })
  const toggle = useMutation({
    mutationFn: () => api.setUserActive(userId, !user.isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: keys.users })
      setNotice({
        kind: 'success',
        text: user.isActive ? t('admin.users.switchedOff') : t('admin.users.switchedOn'),
      })
    },
    onError: (e) => setNotice({ kind: 'error', text: errorText(t, e) }),
  })

  function onReset(event: FormEvent) {
    event.preventDefault()
    setNotice(null)
    const parsed = form.validate(passwordSchema)
    if (parsed) reset.mutate(parsed.password)
  }

  const isSelf = profile?.id === user.id
  return (
    <section className="max-w-xl">
      <PageHeader title={user.fullName} backTo={BASE} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <RoleChip role={user.role} />
        <StatusPill active={user.isActive} />
        <span className="text-mute">{[user.phone, user.shopName].filter(Boolean).join(' · ')}</span>
      </div>

      {notice && (
        <div className="mb-4">
          <Banner kind={notice.kind}>{notice.text}</Banner>
        </div>
      )}

      <form
        onSubmit={onReset}
        noValidate
        className="mb-8 flex flex-col gap-4 rounded-2xl border border-line p-4"
      >
        <h2 className="text-lg">{t('admin.users.resetTitle')}</h2>
        <TextField
          id="password"
          label={t('admin.users.newPassword')}
          value={form.values.password}
          onChange={(x) => form.set('password', x)}
          error={form.errors.password}
          autoComplete="new-password"
          hint={t('admin.users.passwordHint')}
        />
        <div>
          <button type="submit" className="btn h-12 w-full rounded-full" disabled={reset.isPending}>
            {t('admin.users.reset')}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border-2 border-dashed border-ink p-4">
        {isSelf ? (
          <p className="text-mute">{t('admin.users.cannotSelf')}</p>
        ) : (
          <>
            <p className="mb-3 text-mute">{t('admin.users.switchWarn')}</p>
            <button
              type="button"
              className="btn btn-outline h-12 w-full rounded-full"
              onClick={() => toggle.mutate()}
              disabled={toggle.isPending}
            >
              {user.isActive ? t('admin.common.switchOff') : t('admin.common.switchOn')}
            </button>
          </>
        )}
      </div>
    </section>
  )
}
