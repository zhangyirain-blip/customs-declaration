/**
 * documentUtils.ts — Helper functions for document generation
 */

import { defaultComponents } from '@/stores/datasetStore'

/** Format a number as currency string with 2 decimals */
export function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Format a date as YYYY-MM-DD */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Generate Invoice number from PI number: PI-260402-2002 → CI-260402-2002 */
export function generateInvoiceNo(piNo: string): string {
  return piNo.replace(/^PI-/i, 'CI-')
}

export interface ComponentInput {
  id: string
  nameCN: string
  nameEN: string
  ratio: number
  qtyPerSet: number
  weightKg: number
  netWeightKg: number
  hsCode: string
  declarationElements: string
  brand: string
}

export interface CalculatedComponent {
  id: string
  nameCN: string
  nameEN: string
  qtyPerSet: number
  totalQty: number
  unitPrice: number
  totalPrice: number
  weightKg: number
  netWeightKg: number
  hsCode: string
  declarationElements: string
  brand: string
  ratio: number
}

/**
 * Calculate component distribution based on total amount and ratios.
 * Returns an array of components with unitPrice and totalPrice filled in.
 */
export function calculateComponentPrices(
  totalAmount: number,
  quantity: number,
  components: ComponentInput[]
): CalculatedComponent[] {
  // Calculate raw amounts from ratios
  const rawPrices: Record<string, number> = {}
  let rawSum = 0

  components.forEach((c, idx) => {
    if (idx === components.length - 1) {
      // Last component gets the remainder
      rawPrices[c.id] = totalAmount - rawSum
    } else {
      const price = Math.round(totalAmount * c.ratio * 100) / 100
      rawPrices[c.id] = price
      rawSum += price
    }
  })

  // Distribute each component's amount across its total quantity as unit prices
  return components.map((c) => {
    const totalPrice = rawPrices[c.id] ?? 0
    const totalQty = c.qtyPerSet * quantity
    const unitPrice = totalQty > 0 ? Math.round((totalPrice / totalQty) * 100) / 100 : 0

    return {
      id: c.id,
      nameCN: c.nameCN,
      nameEN: c.nameEN,
      qtyPerSet: c.qtyPerSet,
      totalQty,
      unitPrice,
      totalPrice,
      weightKg: c.weightKg,
      netWeightKg: c.netWeightKg,
      hsCode: c.hsCode,
      declarationElements: c.declarationElements,
      brand: c.brand,
      ratio: c.ratio,
    }
  })
}

/**
 * Auto-balance prices after user adjusts one component.
 * Distributes the difference proportionally among UNLOCKED components.
 *
 * @param changedId        The component that was manually changed
 * @param newPrice         The new total price for that component
 * @param componentPrices  Current total prices for all components
 * @param lockedComponents Record of which components are locked
 * @param ratios           Default ratios for each component
 * @param totalAmount      The grand total that must be preserved
 */
export function rebalancePrices(
  changedId: string,
  newPrice: number,
  componentPrices: Record<string, number>,
  lockedComponents: Record<string, boolean>,
  ratios: Record<string, number>,
  totalAmount: number
): Record<string, number> {
  const result = { ...componentPrices }

  // Set the changed component's new price
  result[changedId] = Math.round(newPrice * 100) / 100

  // Calculate how much we need to distribute
  const currentTotal = Object.values(result).reduce((sum, v) => sum + (v || 0), 0)
  const diff = Math.round((totalAmount - currentTotal) * 100) / 100

  if (Math.abs(diff) < 0.001) {
    return result // Already balanced
  }

  // Find unlocked components (excluding the changed one)
  const adjustableIds = Object.keys(result).filter(
    (id) => id !== changedId && !lockedComponents[id]
  )

  if (adjustableIds.length === 0) {
    // Nothing can be adjusted — return as-is (caller should warn)
    return result
  }

  // Calculate sum of ratios among adjustable components
  const sumAdjustableRatios = adjustableIds.reduce(
    (sum, id) => sum + (ratios[id] || 0),
    0
  )

  if (sumAdjustableRatios === 0) {
    // Fallback: split equally
    const share = Math.round((diff / adjustableIds.length) * 100) / 100
    adjustableIds.forEach((id, idx) => {
      if (idx === adjustableIds.length - 1) {
        // Last one absorbs rounding
        const othersTotal = Object.entries(result)
          .filter(([k]) => k !== id)
          .reduce((s, [, v]) => s + (v || 0), 0)
        result[id] = Math.round((totalAmount - othersTotal) * 100) / 100
      } else {
        result[id] = Math.round(((result[id] || 0) + share) * 100) / 100
      }
    })
  } else {
    // Distribute proportionally by ratio
    adjustableIds.forEach((id, idx) => {
      if (idx === adjustableIds.length - 1) {
        // Last component absorbs rounding difference
        const totalOfOthers = Object.entries(result)
          .filter(([k]) => k !== id)
          .reduce((s, [, v]) => s + (v || 0), 0)
        result[id] = Math.round((totalAmount - totalOfOthers) * 100) / 100
      } else {
        const share = Math.round((diff * ((ratios[id] || 0) / sumAdjustableRatios)) * 100) / 100
        result[id] = Math.round(((result[id] || 0) + share) * 100) / 100
      }
    })
  }

  return result
}

/** Build ratios map from components */
export function buildRatiosMap(): Record<string, number> {
  const ratios: Record<string, number> = {}
  defaultComponents.forEach((c) => {
    ratios[c.id] = c.ratio
  })
  return ratios
}

/**
 * Distribute total amount using integer unit prices.
 * Each component's unit price is rounded to the nearest integer,
 * and the last component absorbs any remainder.
 */
export function distributeIntegerUnitPrices(
  totalAmount: number,
  quantity: number,
  components: Array<{ id: string; ratio: number; qtyPerSet: number }>
): Record<string, number> {
  const prices: Record<string, number> = {}
  const ids = components.map((c) => c.id)
  let allocated = 0

  ids.forEach((id, idx) => {
    const c = components.find((c) => c.id === id)!
    const totalQty = c.qtyPerSet * quantity

    if (idx === ids.length - 1) {
      const remaining = totalAmount - allocated
      const unitPrice = totalQty > 0 ? Math.round(remaining / totalQty) : 0
      prices[id] = unitPrice * totalQty
    } else {
      const ideal = (totalAmount * c.ratio) / totalQty
      const unitPrice = Math.round(ideal)
      prices[id] = unitPrice * totalQty
      allocated += prices[id]
    }
  })

  return prices
}

/**
 * Rebalance prices using integer unit prices after user adjustment.
 */
export function rebalancePricesInteger(
  changedId: string,
  newUnitPrice: number,
  componentPrices: Record<string, number>,
  lockedComponents: Record<string, boolean>,
  totalAmount: number,
  quantity: number,
  components: Array<{ id: string; ratio: number; qtyPerSet: number }>
): Record<string, number> {
  const changedC = components.find((c) => c.id === changedId)!
  const changedTotalQty = changedC.qtyPerSet * quantity
  const result: Record<string, number> = {
    ...componentPrices,
    [changedId]: newUnitPrice * changedTotalQty,
  }

  const lockedTotal = components
    .filter((c) => c.id !== changedId && lockedComponents[c.id])
    .reduce((sum, c) => sum + (result[c.id] || 0), 0)
  const changedTotal = result[changedId] || 0
  const remaining = totalAmount - lockedTotal - changedTotal

  const adjustable = components.filter(
    (c) => c.id !== changedId && !lockedComponents[c.id]
  )

  if (adjustable.length === 0) return result

  const adjustedPrices = distributeIntegerUnitPrices(remaining, quantity, adjustable)

  adjustable.forEach((c) => {
    result[c.id] = adjustedPrices[c.id]
  })

  return result
}

/** Format price for display. In integer mode, whole numbers hide decimals. */
export function formatPriceValue(value: number, isIntegerMode: boolean): string {
  const isInt = Math.abs(value - Math.round(value)) < 0.001
  if (isIntegerMode && isInt) {
    return Math.round(value).toLocaleString('en-US')
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
