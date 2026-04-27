import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Lock,
  Unlock,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  RotateCcw,
  BarChart3,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { usePIStore } from '@/stores/piStore'
import { useDatasetStore } from '@/stores/datasetStore'
import { usePriceStore } from '@/stores/priceStore'
import { rebalancePrices, buildRatiosMap, distributeIntegerUnitPrices, rebalancePricesInteger, formatPriceValue } from '@/utils/documentUtils'
import Stepper from '@/components/Stepper'

const cardEase = [0.16, 1, 0.3, 1] as [number, number, number, number]

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RowData {
  id: string
  seq: number
  nameCN: string
  nameEN: string
  qtyPerSet: number
  totalQty: number
  ratioPct: number
  unitPrice: number
  totalPrice: number
  locked: boolean
}

/* ------------------------------------------------------------------ */
/*  PriceAdjust Page                                                   */
/* ------------------------------------------------------------------ */
export default function PriceAdjust() {
  const navigate = useNavigate()
  const piStore = usePIStore()
  const datasetStore = useDatasetStore()
  const priceStore = usePriceStore()

  const pi = piStore.uploadedPI
  const quantity = pi?.quantity ?? 0
  const totalAmount = priceStore.totalAmount

  // Integer mode: when original unit price is a whole number
  const isIntegerMode = useMemo(() => {
    const unitPrice = quantity > 0 ? totalAmount / quantity : 0
    return Number.isInteger(unitPrice) && Number.isInteger(totalAmount)
  }, [totalAmount, quantity])

  // Initialize price store when entering if needed
  useEffect(() => {
    if (pi && priceStore.totalAmount !== pi.totalAmount) {
      priceStore.setTotalAmount(pi.totalAmount)
    }
  }, [pi, priceStore])

  // Lock state: which components are locked
  const [lockedComponents, setLockedComponents] = useState<Record<string, boolean>>({})

  // Local editable prices (total per component, not unit)
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({
    ...priceStore.componentPrices,
  })

  // Track which inputs are being edited
  const [editingId, setEditingId] = useState<string | null>(null)

  // Sync with store when it changes externally
  useEffect(() => {
    setLocalPrices({ ...priceStore.componentPrices })
  }, [priceStore.componentPrices])

  // Build table rows
  const rows: RowData[] = useMemo(() => {
    return datasetStore.components.map((c, idx) => {
      const totalQty = c.qtyPerSet * quantity
      const totalPrice = localPrices[c.id] ?? 0
      const unitPrice = totalQty > 0 ? totalPrice / totalQty : 0
      const roundedUnitPrice = isIntegerMode ? Math.round(unitPrice) : Math.round(unitPrice * 100) / 100
      const roundedTotalPrice = isIntegerMode
        ? roundedUnitPrice * totalQty
        : Math.round(totalPrice * 100) / 100
      return {
        id: c.id,
        seq: idx + 1,
        nameCN: c.nameCN,
        nameEN: c.nameEN,
        qtyPerSet: c.qtyPerSet,
        totalQty,
        ratioPct: c.ratio * 100,
        unitPrice: roundedUnitPrice,
        totalPrice: roundedTotalPrice,
        locked: !!lockedComponents[c.id],
      }
    })
  }, [datasetStore.components, quantity, localPrices, lockedComponents, isIntegerMode])

  // Summary stats
  const currentTotal = useMemo(
    () => rows.reduce((sum, r) => sum + r.totalPrice, 0),
    [rows]
  )
  const diff = Math.round((totalAmount - currentTotal) * 100) / 100
  const isStrictlyBalanced = Math.abs(diff) < 0.01
  const isLooselyBalanced = isIntegerMode && Math.abs(diff) <= quantity
  const isBalanced = isStrictlyBalanced || isLooselyBalanced
  const totalPieces = useMemo(() => rows.reduce((sum, r) => sum + r.totalQty, 0), [rows])

  // Bar chart data
  const chartData = useMemo(
    () =>
      rows.map((r) => ({
        name: r.nameCN.replace('自行车用', ''),
        totalPrice: r.totalPrice,
        unitPrice: r.unitPrice,
        id: r.id,
      })),
    [rows]
  )

  // ---- handlers ----

  const handlePriceChange = useCallback(
    (id: string, rawValue: string) => {
      const val = parseFloat(rawValue)
      if (Number.isNaN(val) || val < 0) return
      // Update the local price for this component
      setLocalPrices((prev) => ({ ...prev, [id]: Math.round(val * 100) / 100 }))
    },
    []
  )

  const handlePriceBlur = useCallback(
    (id: string) => {
      setEditingId(null)

      if (isIntegerMode) {
        const c = datasetStore.components.find((c) => c.id === id)!
        const totalQty = c.qtyPerSet * quantity
        const unitPrice = totalQty > 0 ? Math.round((localPrices[id] || 0) / totalQty) : 0

        const balanced = rebalancePricesInteger(
          id,
          unitPrice,
          localPrices,
          lockedComponents,
          totalAmount,
          quantity,
          datasetStore.components
        )
        setLocalPrices(balanced)
        priceStore.setComponentPrices(balanced)
      } else {
        const newPrice = localPrices[id] ?? 0
        const ratios = buildRatiosMap()
        const balanced = rebalancePrices(
          id,
          newPrice,
          localPrices,
          lockedComponents,
          ratios,
          totalAmount
        )
        setLocalPrices(balanced)
        priceStore.setComponentPrices(balanced)
      }
    },
    [localPrices, lockedComponents, totalAmount, priceStore, isIntegerMode, quantity, datasetStore.components]
  )

  const toggleLock = useCallback((id: string) => {
    setLockedComponents((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handleReset = useCallback(() => {
    if (isIntegerMode) {
      const prices = distributeIntegerUnitPrices(totalAmount, quantity, datasetStore.components)
      priceStore.setComponentPrices(prices)
    } else {
      priceStore.autoDistribute()
    }
    setLockedComponents({})
  }, [priceStore, isIntegerMode, totalAmount, quantity, datasetStore.components])

  return (
    <div className="space-y-6 pb-24">
      {/* ---- Page Header ---- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cardEase }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1D23] tracking-tight">价格调整</h1>
            <p className="text-sm text-[#5A6270] mt-1">
              调整各组件单价，系统将自动确保总价一致
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              第 3 步 / 共 4 步
            </span>
            <button
              onClick={handleReset}
              className="jt-btn-secondary flex items-center gap-1.5 text-xs py-1.5 px-3"
            >
              <RotateCcw size={13} />
              恢复默认分配
            </button>
          </div>
        </div>

        <Stepper currentStep={3} />
      </motion.section>

      {/* ---- Order Summary Banner ---- */}
      <motion.section
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: cardEase }}
        className="rounded-xl px-6 py-4 border border-[rgba(79,70,229,0.15)]"
        style={{ backgroundColor: '#EEF2FF' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm text-[#4F46E5] font-medium">
              {pi?.piNumber || '—'}
            </span>
            <span className="text-sm text-[#5A6270]">
              {pi?.clientNameEN || pi?.clientNameCN || '—'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-sm font-medium text-[#1A1D23]">
              R7 Full Groupset × {quantity} 套
            </span>
            <span className="text-lg font-semibold font-mono text-[#4F46E5]">
              总价目标: ${formatPriceValue(totalAmount, isIntegerMode)}
            </span>
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                <Check size={12} /> 已平衡
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                <AlertTriangle size={12} /> 未平衡
              </span>
            )}
          </div>
        </div>
      </motion.section>

      {/* ---- Main Content: Table + Charts ---- */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: Price Table */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: cardEase }}
          className="jt-card p-5 xl:w-[58%]"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#1A1D23]">组件单价明细</h2>
            <span className="text-xs text-[#8F96A3]">单位: USD</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E2E5E9]">
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-[#8F96A3] uppercase tracking-wider w-10">
                    序号
                  </th>
                  <th className="text-left py-2.5 px-2 text-xs font-medium text-[#8F96A3] uppercase tracking-wider">
                    商品名称
                  </th>
                  <th className="text-center py-2.5 px-2 text-xs font-medium text-[#8F96A3] uppercase tracking-wider w-16">
                    数量
                  </th>
                  <th className="text-right py-2.5 px-2 text-xs font-medium text-[#8F96A3] uppercase tracking-wider w-20">
                    比例
                  </th>
                  <th className="text-right py-2.5 px-2 text-xs font-medium text-[#8F96A3] uppercase tracking-wider w-28">
                    单价(USD)
                  </th>
                  <th className="text-right py-2.5 px-2 text-xs font-medium text-[#8F96A3] uppercase tracking-wider w-28">
                    金额(USD)
                  </th>
                  <th className="text-center py-2.5 px-2 text-xs font-medium text-[#8F96A3] uppercase tracking-wider w-14">
                    锁定
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.3, ease: cardEase }}
                    className={[
                      'border-b border-[#E2E5E9] transition-colors duration-150',
                      row.locked ? 'bg-[#F8F9FB]' : 'hover:bg-[#F1F5F9]',
                      editingId === row.id ? 'bg-[#EFF6FF]' : '',
                    ].join(' ')}
                  >
                    <td className="py-3 px-2 text-center text-[#8F96A3] text-xs">
                      {row.seq}
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-[#1A1D23] font-medium text-[13px]">{row.nameCN}</div>
                      <div className="text-[#8F96A3] text-xs">{row.nameEN}</div>
                    </td>
                    <td className="py-3 px-2 text-center text-[#1A1D23] font-mono text-[13px]">
                      {row.totalQty}
                    </td>
                    <td className="py-3 px-2 text-right text-[#8F96A3] text-xs">
                      {row.ratioPct.toFixed(2)}%
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end">
                        <span className="text-[#8F96A3] mr-1 text-xs">$</span>
                        <input
                          type="number"
                          min={0}
                          step={isIntegerMode ? 1 : 0.01}
                          value={editingId === row.id ? undefined : row.unitPrice}
                          defaultValue={editingId === row.id ? row.unitPrice : undefined}
                          onFocus={() => setEditingId(row.id)}
                          onChange={(e) => {
                            const unitVal = parseFloat(e.target.value)
                            if (!Number.isNaN(unitVal)) {
                              const totalVal = unitVal * row.totalQty
                              handlePriceChange(row.id, String(totalVal))
                            }
                          }}
                          onBlur={() => handlePriceBlur(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handlePriceBlur(row.id)
                            }
                          }}
                          disabled={row.locked}
                          className={[
                            'w-24 text-right font-mono text-[13px] py-1 px-2 rounded border',
                            'focus:outline-none focus:ring-2 focus:ring-[#BFDBFE] focus:border-[#2563EB]',
                            row.locked
                              ? 'bg-transparent border-transparent text-[#8F96A3] cursor-not-allowed'
                              : 'bg-white border-[#E2E5E9] text-[#1A1D23]',
                          ].join(' ')}
                        />
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-[13px] text-[#1A1D23]">
                      ${formatPriceValue(row.totalPrice, isIntegerMode)}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <button
                        onClick={() => toggleLock(row.id)}
                        className={[
                          'inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200',
                          row.locked
                            ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FECACA]'
                            : 'bg-[#F0FDF4] text-[#16A34A] hover:bg-[#BBF7D0]',
                        ].join(' ')}
                        title={row.locked ? '已锁定，点击解锁' : '点击锁定'}
                      >
                        {row.locked ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
              {/* Footer summary */}
              <tfoot>
                <tr className="bg-[#F8F9FB] border-t-2 border-[#E2E5E9]">
                  <td colSpan={2} className="py-3 px-2 text-sm font-semibold text-[#1A1D23]">
                    合计
                  </td>
                  <td className="py-3 px-2 text-center font-mono text-sm font-semibold text-[#1A1D23]">
                    {totalPieces}
                  </td>
                  <td className="py-3 px-2" />
                  <td className="py-3 px-2" />
                  <td className="py-3 px-2 text-right font-mono text-sm font-semibold text-[#1A1D23]">
                    ${formatPriceValue(currentTotal, isIntegerMode)}
                  </td>
                  <td className="py-3 px-2" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Validation summary below table */}
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-2">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[#5A6270]">
                目标:{' '}
                <span className="font-mono font-medium text-[#1A1D23]">
                  ${formatPriceValue(totalAmount, isIntegerMode)}
                </span>
              </span>
              <span className="text-[#5A6270]">
                当前:{' '}
                <span
                  className={[
                    'font-mono font-medium',
                    isBalanced ? 'text-[#16A34A]' : 'text-[#D97706]',
                  ].join(' ')}
                >
                  ${formatPriceValue(currentTotal, isIntegerMode)}
                </span>
              </span>
              <span className="text-[#5A6270]">
                差额:{' '}
                <span
                  className={[
                    'font-mono font-medium',
                    isBalanced ? 'text-[#16A34A]' : 'text-[#DC2626]',
                  ].join(' ')}
                >
                  {diff >= 0 ? '+' : ''}
                  {formatPriceValue(diff, isIntegerMode)}
                </span>
              </span>
            </div>
            <div className="text-xs text-[#8F96A3]">
              锁定项: {rows.filter((r) => r.locked).length} / {rows.length}
            </div>
          </div>
        </motion.section>

        {/* Right: Visualization */}
        <motion.section
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: cardEase }}
          className="flex flex-col gap-5 xl:w-[42%]"
        >
          {/* Price Distribution Bar Chart */}
          <div className="jt-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-[#2563EB]" />
              <h3 className="text-base font-semibold text-[#1A1D23]">组件价格分布</h3>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E5E9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#8F96A3' }}
                    axisLine={{ stroke: '#E2E5E9' }}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#5A6270' }}
                    axisLine={{ stroke: '#E2E5E9' }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${formatPriceValue(value, isIntegerMode)}`, '金额']}
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #E2E5E9',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="totalPrice" radius={[0, 4, 4, 0]} barSize={18}>
                    {chartData.map((entry, index) => (
                      <Cell key={entry.id} fill="#2563EB" fillOpacity={0.7 + index * 0.03} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Balance Status Card */}
          <div className="jt-card p-5">
            <h3 className="text-base font-semibold text-[#1A1D23] mb-4">平衡状态</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5A6270]">目标总价</span>
                <span className="font-mono text-sm font-semibold text-[#1A1D23]">
                  ${formatPriceValue(totalAmount, isIntegerMode)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5A6270]">当前合计</span>
                <span
                  className={[
                    'font-mono text-sm font-semibold',
                    isBalanced ? 'text-[#16A34A]' : 'text-[#D97706]',
                  ].join(' ')}
                >
                  ${formatPriceValue(currentTotal, isIntegerMode)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5A6270]">差额</span>
                <span
                  className={[
                    'font-mono text-sm font-semibold',
                    isBalanced ? 'text-[#16A34A]' : 'text-[#DC2626]',
                  ].join(' ')}
                >
                  {diff >= 0 ? '+' : ''}
                  {formatPriceValue(diff, isIntegerMode)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5A6270]">状态</span>
                {isBalanced ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                    <Check size={12} /> 已平衡
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]">
                    <AlertTriangle size={12} /> 未平衡
                  </span>
                )}
              </div>
              {/* Progress bar visual */}
              <div className="pt-2">
                <div className="h-2 bg-[#E2E5E9] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: isBalanced ? '#16A34A' : diff > 0 ? '#D97706' : '#DC2626',
                    }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min((currentTotal / totalAmount) * 100, 100)}%`,
                    }}
                    transition={{ duration: 0.5, ease: cardEase }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>

      {/* ---- Warning Banner (conditional) ---- */}
      {!isBalanced && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]"
        >
          <AlertTriangle size={18} className="text-[#D97706] shrink-0" />
          <p className="text-sm text-[#92400E]">
            价格未平衡：当前合计 ${formatPriceValue(currentTotal, isIntegerMode)}
            ，与目标总价相差 {diff >= 0 ? '+' : ''}
            {formatPriceValue(diff, isIntegerMode)}。系统已按比例自动调整未锁定项。
          </p>
        </motion.div>
      )}

      {/* ---- Action Bar ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="fixed bottom-0 left-0 right-0 lg:left-[260px] bg-white border-t border-[#E2E5E9] px-6 py-4 z-50 flex items-center justify-between"
      >
        <button
          onClick={() => navigate('/data-config')}
          className="jt-btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          上一步
        </button>
        <button
          onClick={() => navigate('/doc-preview')}
          disabled={!isBalanced}
          className={[
            'jt-btn-primary flex items-center gap-2',
            !isBalanced ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          title={!isBalanced ? '请先平衡价格' : ''}
        >
          下一步
          <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  )
}
