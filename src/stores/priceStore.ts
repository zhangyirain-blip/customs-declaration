import { create } from 'zustand'
import { defaultComponents, type Component } from './datasetStore'

interface PriceStore {
  totalAmount: number
  componentPrices: Record<string, number>
  manualAdjustments: Record<string, number>
  isBalanced: boolean
  setTotalAmount: (amount: number) => void
  setComponentPrice: (id: string, price: number) => void
  setComponentPrices: (prices: Record<string, number>) => void
  autoDistribute: (totalAmount?: number) => void
  checkBalance: () => boolean
}

const COMPONENT_IDS = defaultComponents.map((c) => c.id)

const DEFAULT_RATIOS: Record<string, number> = {}
defaultComponents.forEach((c) => {
  DEFAULT_RATIOS[c.id] = c.ratio
})

function distribute(total: number, components: Component[] = defaultComponents): Record<string, number> {
  const prices: Record<string, number> = {}
  let sum = 0
  const ids = components.map((c) => c.id)

  ids.forEach((id, idx) => {
    if (idx === ids.length - 1) {
      // Last component gets the remainder to ensure exact total
      prices[id] = Math.round((total - sum) * 100) / 100
    } else {
      const price = Math.round(total * (DEFAULT_RATIOS[id] || 0) * 100) / 100
      prices[id] = price
      sum += price
    }
  })
  return prices
}

export const usePriceStore = create<PriceStore>((set, get) => ({
  totalAmount: 0,
  componentPrices: {},
  manualAdjustments: {},
  isBalanced: true,

  setTotalAmount: (amount) => {
    set({ totalAmount: amount, componentPrices: distribute(amount), isBalanced: true, manualAdjustments: {} })
  },

  setComponentPrice: (id, price) => {
    const state = get()
    const newManual = { ...state.manualAdjustments, [id]: price }
    const newPrices = { ...state.componentPrices, [id]: price }

    let sum = 0
    COMPONENT_IDS.forEach((cid) => {
      sum += newPrices[cid] ?? state.componentPrices[cid] ?? 0
    })
    const balanced = Math.abs(sum - state.totalAmount) < 0.01

    set({
      componentPrices: newPrices,
      manualAdjustments: newManual,
      isBalanced: balanced,
    })
  },

  setComponentPrices: (prices) => {
    const state = get()
    const sum = COMPONENT_IDS.reduce(
      (acc, id) => acc + (prices[id] ?? state.componentPrices[id] ?? 0),
      0
    )
    const balanced = Math.abs(sum - state.totalAmount) < 0.01
    set({ componentPrices: prices, isBalanced: balanced })
  },

  autoDistribute: (totalAmount?) => {
    const state = get()
    const amount = totalAmount ?? state.totalAmount
    set({
      componentPrices: distribute(amount),
      manualAdjustments: {},
      isBalanced: true,
      totalAmount: amount,
    })
  },

  checkBalance: () => {
    const state = get()
    const sum = COMPONENT_IDS.reduce(
      (acc, id) => acc + (state.componentPrices[id] ?? 0),
      0
    )
    const balanced = Math.abs(sum - state.totalAmount) < 0.01
    set({ isBalanced: balanced })
    return balanced
  },
}))
