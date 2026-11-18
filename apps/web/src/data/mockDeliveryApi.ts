import type { DeliveryApi } from './deliveryApi'
import { deliveries, markDelivered } from './mockPayments'
import { notifyOrdersChanged, type MockState } from './mockState'

/** Demo version of the delivery API, sharing the demo state with the admin and shop demo APIs. */
export function createMockDeliveryApi(
  state: MockState,
  options: { delayMs?: number } = {},
): DeliveryApi {
  const wait = () =>
    options.delayMs ? new Promise((r) => setTimeout(r, options.delayMs)) : Promise.resolve()

  return {
    async listDeliveries() {
      await wait()
      return deliveries(state)
    },

    async markDelivered(orderId) {
      await wait()
      markDelivered(state, orderId)
      notifyOrdersChanged(state)
    },
  }
}
