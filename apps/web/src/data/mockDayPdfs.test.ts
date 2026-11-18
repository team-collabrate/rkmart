import { describe, expect, it } from 'vitest'
import { todayISO } from '../lib/dates'
import { createMockAdminApi } from './mockAdminApi'
import { createMockState } from './mockState'

const today = todayISO()
const pdf = (text = 'x') => new Blob([text], { type: 'application/pdf' })

async function setup() {
  const state = createMockState({ seedDemo: true })
  const admin = createMockAdminApi({ state })
  await admin.generateBill('o3')
  await admin.generateBill('o4')
  const ids = (await admin.listDayInvoices(today)).map((i) => i.id)
  return { state, admin, ids }
}

describe('demo day bills and PDFs', () => {
  it('lists only the day’s issued bills, in invoice order', async () => {
    const { admin, ids } = await setup()
    const list = await admin.listDayInvoices(today)
    expect(list.map((i) => i.invoiceNo.slice(-4))).toEqual(['0003', '0004'])

    await admin.cancelBill(ids[1], 'Wrong shop')
    expect((await admin.listDayInvoices(today)).map((i) => i.id)).toEqual([ids[0]])
    expect(await admin.listDayInvoices('2020-01-01')).toEqual([])
  })

  it('numbers each saved PDF of a day and keeps its file', async () => {
    const { admin, ids } = await setup()
    const first = await admin.saveDayPdf(today, pdf('one'), ids)
    const second = await admin.saveDayPdf(today, pdf('two'), [ids[1]])
    expect([first.version, second.version]).toEqual([1, 2])
    expect(first.billCount).toBe(2)
    expect((await admin.listDayPdfs(today)).map((p) => p.version)).toEqual([1, 2])
    expect(await (await admin.getDayPdf(second.id)).text()).toBe('two')

    expect(await admin.listDayPdfs('2020-01-01')).toEqual([])
  })

  it('refuses an empty list, an unknown bill and an unknown PDF', async () => {
    const { admin, ids } = await setup()
    await expect(admin.saveDayPdf(today, pdf(), [])).rejects.toMatchObject({ code: 'invalid' })
    await expect(admin.saveDayPdf(today, pdf(), ['nope'])).rejects.toMatchObject({
      code: 'not_found',
    })
    await expect(admin.getDayPdf('nope')).rejects.toMatchObject({ code: 'not_found' })
    await admin.cancelBill(ids[0], 'Wrong quantity')
    await expect(admin.saveDayPdf(today, pdf(), [ids[0]])).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
