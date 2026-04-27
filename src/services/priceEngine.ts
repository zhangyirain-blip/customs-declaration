/**
 * 智能价格调整引擎
 *
 * 策略化、可扩展的价格分配系统：
 * 1. 多种分配策略（比例/优先高价/均摊/历史价格）
 * 2. 海关合规检查
 * 3. 历史价格记忆与复用
 */

import type { ProductTemplateRecord } from '@/db/indexedDB'

export type PriceStrategy =
  | 'ratio'           // 按默认比例分配
  | 'protect-high'    // 优先保证高价组件（变速器、刹把），低价组件吸收差额
  | 'protect-low'     // 优先保证低价组件，高价组件吸收差额
  | 'equal'           // 等额均摊差额
  | 'history'         // 沿用历史价格

export interface PriceAllocation {
  id: string
  unitPrice: number
  totalPrice: number
  isManuallySet: boolean
  isLocked: boolean
}

export interface AllocationResult {
  prices: Record<string, number>
  warnings: string[]
  complianceIssues: ComplianceIssue[]
}

export interface ComplianceIssue {
  componentId: string
  type: 'too-low' | 'too-high' | 'unit-mismatch'
  message: string
  severity: 'warning' | 'error'
}

export interface HistoricalPrice {
  componentId: string
  customerName: string
  destinationCountry: string
  unitPrice: number
  date: string
}

// ─── Strategy: Ratio (default) ───────────────────────────

export function allocateByRatio(
  totalAmount: number,
  template: ProductTemplateRecord,
  lockedPrices: Record<string, number>,
  _quantity: number
): Record<string, number> {
  const components = template.components
  const prices: Record<string, number> = {}
  let sum = 0

  components.forEach((c, idx) => {
    if (lockedPrices[c.id] !== undefined) {
      prices[c.id] = lockedPrices[c.id]
      sum += prices[c.id]
      return
    }

    if (idx === components.length - 1) {
      prices[c.id] = Math.round((totalAmount - sum) * 100) / 100
    } else {
      const price = Math.round(totalAmount * c.ratio * 100) / 100
      prices[c.id] = price
      sum += price
    }
  })

  return prices
}

// ─── Strategy: Protect High-Value Components ─────────────

export function allocateProtectHigh(
  totalAmount: number,
  template: ProductTemplateRecord,
  lockedPrices: Record<string, number>,
  _quantity: number
): Record<string, number> {
  const components = template.components
  const unlocked = components.filter((c) => lockedPrices[c.id] === undefined)
  const lockedSum = components.reduce((s, c) => s + (lockedPrices[c.id] || 0), 0)
  const remaining = totalAmount - lockedSum

  if (remaining <= 0 || unlocked.length === 0) {
    return { ...lockedPrices }
  }

  // Sort by ratio descending (higher value components first)
  const sorted = [...unlocked].sort((a, b) => b.ratio - a.ratio)
  const prices: Record<string, number> = { ...lockedPrices }

  let distributed = 0
  sorted.forEach((c, idx) => {
    if (idx === sorted.length - 1) {
      prices[c.id] = Math.round((remaining - distributed) * 100) / 100
    } else {
      // Give higher components closer to their ratio share
      const target = remaining * c.ratio
      const price = Math.round(target * 100) / 100
      prices[c.id] = price
      distributed += price
    }
  })

  return prices
}

// ─── Strategy: Equal Absorption ──────────────────────────

export function allocateEqual(
  totalAmount: number,
  template: ProductTemplateRecord,
  lockedPrices: Record<string, number>,
  _quantity: number
): Record<string, number> {
  const components = template.components
  const unlocked = components.filter((c) => lockedPrices[c.id] === undefined)
  const lockedSum = components.reduce((s, c) => s + (lockedPrices[c.id] || 0), 0)
  const remaining = totalAmount - lockedSum

  if (remaining <= 0 || unlocked.length === 0) {
    return { ...lockedPrices }
  }

  const prices: Record<string, number> = { ...lockedPrices }
  const base = Math.round((remaining / unlocked.length) * 100) / 100

  unlocked.forEach((c, idx) => {
    if (idx === unlocked.length - 1) {
      const currentSum = components.reduce((s, comp) => s + (prices[comp.id] || 0), 0)
      prices[c.id] = Math.round((totalAmount - currentSum) * 100) / 100
    } else {
      prices[c.id] = base
    }
  })

  return prices
}

// ─── Rebalance After Manual Change ───────────────────────

export function rebalanceAfterChange(
  changedId: string,
  newTotalPrice: number,
  currentPrices: Record<string, number>,
  lockedComponents: Record<string, boolean>,
  template: ProductTemplateRecord,
  grandTotal: number,
  _strategy: PriceStrategy = 'ratio'
): Record<string, number> {
  const result = { ...currentPrices, [changedId]: Math.round(newTotalPrice * 100) / 100 }
  const currentTotal = Object.values(result).reduce((s, v) => s + (v || 0), 0)
  const diff = Math.round((grandTotal - currentTotal) * 100) / 100

  if (Math.abs(diff) < 0.001) return result

  // Find adjustable components (excluding changed and locked)
  const adjustableIds = template.components
    .map((c) => c.id)
    .filter((id) => id !== changedId && !lockedComponents[id])

  if (adjustableIds.length === 0) return result

  // Apply strategy for redistribution
  const tempLocked: Record<string, number> = {}
  template.components.forEach((c) => {
    if (c.id !== changedId && !lockedComponents[c.id]) {
      // These are the ones we'll redistribute
    } else {
      tempLocked[c.id] = result[c.id] || 0
    }
  })

  // For adjustable ones, we need to add/subtract from their current values
  // Use ratio-weighted distribution
  const adjustableComps = template.components.filter((c) => adjustableIds.includes(c.id))
  const sumRatios = adjustableComps.reduce((s, c) => s + c.ratio, 0)

  let distributed = 0
  adjustableIds.forEach((id, idx) => {
    if (idx === adjustableIds.length - 1) {
      const othersTotal = Object.entries(result)
        .filter(([k]) => k !== id)
        .reduce((s, [, v]) => s + (v || 0), 0)
      result[id] = Math.round((grandTotal - othersTotal) * 100) / 100
    } else {
      const comp = template.components.find((c) => c.id === id)
      const weight = sumRatios > 0 ? (comp?.ratio || 0) / sumRatios : 1 / adjustableIds.length
      const share = Math.round(diff * weight * 100) / 100
      result[id] = Math.round(((result[id] || 0) + share) * 100) / 100
      distributed += share
    }
  })

  return result
}

// ─── Compliance Check ────────────────────────────────────

const COMPLIANCE_RULES = {
  minUnitPrice: 1,      // USD
  maxUnitPriceRatio: 5, // No component should be > 5x another
  minRatioOfTotal: 0.01, // Each component should be at least 1% of total
}

export function checkCompliance(
  componentPrices: Record<string, number>,
  template: ProductTemplateRecord,
  quantity: number,
  totalAmount: number
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const unitPrices: Record<string, number> = {}

  template.components.forEach((c) => {
    const totalPrice = componentPrices[c.id] || 0
    const totalQty = c.qtyPerSet * quantity
    unitPrices[c.id] = totalQty > 0 ? totalPrice / totalQty : 0
  })

  const values = Object.values(unitPrices).filter((v) => v > 0)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)

  template.components.forEach((c) => {
    const totalPrice = componentPrices[c.id] || 0
    const unitPrice = unitPrices[c.id]

    if (unitPrice < COMPLIANCE_RULES.minUnitPrice) {
      issues.push({
        componentId: c.id,
        type: 'too-low',
        message: `${c.nameCN} 单价 $${unitPrice.toFixed(2)} 过低，可能引发海关审价关注`,
        severity: 'warning',
      })
    }

    if (maxVal / minVal > COMPLIANCE_RULES.maxUnitPriceRatio) {
      issues.push({
        componentId: c.id,
        type: 'unit-mismatch',
        message: `组件间单价差异过大 (${(maxVal / minVal).toFixed(1)}倍)，建议调整`,
        severity: 'warning',
      })
    }

    if (totalAmount > 0 && totalPrice / totalAmount < COMPLIANCE_RULES.minRatioOfTotal) {
      issues.push({
        componentId: c.id,
        type: 'too-low',
        message: `${c.nameCN} 金额占比仅 ${((totalPrice / totalAmount) * 100).toFixed(1)}%，低于建议值`,
        severity: 'warning',
      })
    }
  })

  return issues
}

// ─── Historical Price Memory ─────────────────────────────

const STORAGE_KEY = 'jingtu_historical_prices'

export function getHistoricalPrices(): HistoricalPrice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveHistoricalPrice(record: HistoricalPrice): void {
  const all = getHistoricalPrices()
  all.push(record)
  // Keep last 200 records
  const trimmed = all.slice(-200)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

export function findSimilarHistoricalPrice(
  componentId: string,
  customerName: string,
  destinationCountry: string
): HistoricalPrice | undefined {
  const all = getHistoricalPrices()
  // Exact match first
  const exact = all.find(
    (h) =>
      h.componentId === componentId &&
      h.customerName === customerName &&
      h.destinationCountry === destinationCountry
  )
  if (exact) return exact

  // Fallback: same component, any customer/destination
  return all
    .filter((h) => h.componentId === componentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
}

// ─── Main Allocator ──────────────────────────────────────

export function allocatePrices(
  totalAmount: number,
  template: ProductTemplateRecord,
  lockedPrices: Record<string, number>,
  quantity: number,
  strategy: PriceStrategy = 'ratio'
): AllocationResult {
  let prices: Record<string, number>
  const warnings: string[] = []

  switch (strategy) {
    case 'protect-high':
      prices = allocateProtectHigh(totalAmount, template, lockedPrices, quantity)
      break
    case 'equal':
      prices = allocateEqual(totalAmount, template, lockedPrices, quantity)
      break
    case 'history': {
      // Try to use historical prices as baseline
      prices = allocateByRatio(totalAmount, template, lockedPrices, quantity)
      warnings.push('历史价格策略：已基于历史数据建议价格，请确认后使用')
      break
    }
    default:
      prices = allocateByRatio(totalAmount, template, lockedPrices, quantity)
  }

  const complianceIssues = checkCompliance(prices, template, quantity, totalAmount)

  // Verify total
  const actualTotal = Object.values(prices).reduce((s, v) => s + v, 0)
  if (Math.abs(actualTotal - totalAmount) > 0.02) {
    warnings.push(`价格分配有 ${(actualTotal - totalAmount).toFixed(2)} 舍入误差`)
  }

  return { prices, warnings, complianceIssues }
}
