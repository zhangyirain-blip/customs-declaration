import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  X,
  Eye,
  Copy,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  History,
  ArrowRight,
  ChevronUp,
} from 'lucide-react'
import { useHistoryStore } from '@/stores/historyStore'
import type { Declaration, DeclarationStatus } from '@/stores/historyStore'
import DetailDrawer from '@/components/DetailDrawer'

type SortField = 'date' | 'totalAmount' | 'customerName' | 'quantity'
type SortDirection = 'asc' | 'desc'

const statusMap: Record<DeclarationStatus, { label: string; color: string; bg: string; border: string }> = {
  completed: { label: '已完成', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  processing: { label: '处理中', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  draft: { label: '草稿', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
}

const pageSizeOptions = [10, 20, 50]

const statusOptions: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'completed', label: '已完成' },
  { value: 'processing', label: '处理中' },
  { value: 'draft', label: '草稿' },
]

function formatCurrency(val: number) {
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/* ─── Delete Confirmation Dialog ─── */
function DeleteDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
            onClick={onCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-w-md w-full p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-[#1A1D23] mb-2">{title}</h3>
              <p className="text-sm text-[#5A6270] mb-6">{description}</p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={onCancel} className="jt-btn-secondary px-5 py-2">
                  取消
                </button>
                <button
                  onClick={onConfirm}
                  className="px-5 py-2 rounded-lg text-white text-sm font-medium transition-all duration-200 bg-[#DC2626] hover:bg-[#B91C1C]"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Copy Confirmation Dialog ─── */
function CopyDialog({
  open,
  piNumber,
  onConfirm,
  onCancel,
}: {
  open: boolean
  piNumber: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4"
            onClick={onCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] max-w-md w-full p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-semibold text-[#1A1D23] mb-2">复制为新报关单</h3>
              <p className="text-sm text-[#5A6270] mb-6">
                将基于 <span className="font-mono font-medium text-[#1A1D23]">{piNumber}</span>{' '}
                的数据创建新报关单，您可以在上传PI页面修改后重新生成。
              </p>
              <div className="flex items-center justify-end gap-3">
                <button onClick={onCancel} className="jt-btn-secondary px-5 py-2">
                  取消
                </button>
                <button onClick={onConfirm} className="jt-btn-primary px-5 py-2 flex items-center gap-2">
                  <Copy size={16} />
                  确认复制
                </button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Main History Page ─── */
export default function HistoryPage() {
  const navigate = useNavigate()
  const {
    declarations,
    filters,
    selectedIds,
    setFilters,
    resetFilters,
    toggleSelection,
    clearSelection,
    selectAll,
    softDeleteDeclaration,
    softDeleteMany,
    getUniqueCustomers,
  } = useHistoryStore()

  /* Pagination */
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  /* Sorting */
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')

  /* Detail drawer */
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedDeclaration, setSelectedDeclaration] = useState<Declaration | null>(null)

  /* Delete dialog */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)

  /* Copy dialog */
  const [copyDialogOpen, setCopyDialogOpen] = useState(false)
  const [copyTarget, setCopyTarget] = useState<Declaration | null>(null)

  /* Search input local state for debounce */
  const [searchInput, setSearchInput] = useState(filters.search)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Customers */
  const customers = useMemo(() => getUniqueCustomers(), [getUniqueCustomers, declarations])

  /* Debounced search */
  const handleSearchChange = (val: string) => {
    setSearchInput(val)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      setFilters({ search: val })
      setPage(1)
    }, 300)
  }

  /* Sort handler */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  /* Filter + sort + paginate data */
  const filteredSorted = useMemo(() => {
    const storeFiltered = useHistoryStore.getState().filteredDeclarations()
    const sorted = [...storeFiltered].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      switch (sortField) {
        case 'date':
          return dir * a.date.localeCompare(b.date)
        case 'totalAmount':
          return dir * (a.totalAmount - b.totalAmount)
        case 'customerName':
          return dir * a.customerName.localeCompare(b.customerName)
        case 'quantity':
          return dir * (a.quantity - b.quantity)
        default:
          return 0
      }
    })
    return sorted
  }, [filters, sortField, sortDir, declarations])

  const totalRecords = filteredSorted.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, totalRecords)
  const pageData = filteredSorted.slice(startIdx, endIdx)

  /* Page change reset */
  useEffect(() => {
    if (page > totalPages) setPage(1)
  }, [totalPages, page])

  /* Select all on page */
  const allPageSelected = pageData.length > 0 && pageData.every((d) => selectedIds.includes(d.id))
  const somePageSelected = pageData.some((d) => selectedIds.includes(d.id)) && !allPageSelected

  const handleSelectAllPage = () => {
    if (allPageSelected) {
      const pageIds = new Set(pageData.map((d) => d.id))
      selectAll(selectedIds.filter((id) => !pageIds.has(id)))
    } else {
      const pageIds = pageData.map((d) => d.id)
      selectAll(Array.from(new Set([...selectedIds, ...pageIds])))
    }
  }

  /* Drawer */
  const openDrawer = useCallback((d: Declaration) => {
    setSelectedDeclaration(d)
    setDrawerOpen(true)
  }, [])

  /* Copy */
  const handleCopy = useCallback((d: Declaration) => {
    setCopyTarget(d)
    setCopyDialogOpen(true)
  }, [])

  const confirmCopy = useCallback(() => {
    if (copyTarget) {
      navigate('/pi-upload', { state: { copyFrom: copyTarget } })
    }
    setCopyDialogOpen(false)
    setCopyTarget(null)
  }, [copyTarget, navigate])

  /* Delete */
  const handleDelete = useCallback((id: string) => {
    setDeleteTargetId(id)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDelete = useCallback(() => {
    if (deleteTargetId) {
      softDeleteDeclaration(deleteTargetId)
    }
    setDeleteDialogOpen(false)
    setDeleteTargetId(null)
  }, [deleteTargetId, softDeleteDeclaration])

  const handleBulkDelete = useCallback(() => {
    setBulkDeleteDialogOpen(true)
  }, [])

  const confirmBulkDelete = useCallback(() => {
    softDeleteMany(selectedIds)
    setBulkDeleteDialogOpen(false)
  }, [selectedIds, softDeleteMany])

  /* Reset */
  const handleReset = () => {
    resetFilters()
    setSearchInput('')
    setPage(1)
    setSortField('date')
    setSortDir('desc')
  }

  /* Status counts */
  const statusCounts = useHistoryStore.getState().getStatusCounts()

  /* Page numbers */
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safePage > 3) pages.push('ellipsis')
      const start = Math.max(2, safePage - 1)
      const end = Math.min(totalPages - 1, safePage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (safePage < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ChevronUp size={14} className="text-[#C9CDD4]" />
    return sortDir === 'asc' ? (
      <ChevronUp size={14} className="text-[#2563EB]" />
    ) : (
      <ChevronDown size={14} className="text-[#2563EB]" />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-[13px] text-[#8F96A3]">
        <span className="hover:text-[#2563EB] cursor-pointer transition-colors">工作台</span>
        <ChevronRightIcon />
        <span className="text-[#1A1D23] font-medium">历史记录</span>
      </div>

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A1D23] tracking-tight">历史记录</h1>
          <p className="text-sm text-[#5A6270] mt-1">查看和管理已完成的报关资料</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#8F96A3]">
            共 <span className="font-mono font-medium text-[#1A1D23]">{totalRecords}</span> 条记录
          </span>
          <button className="jt-btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            <Download size={16} />
            导出全部清单
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-white border border-[#E2E5E9] rounded-[10px] p-4 sm:p-5 flex flex-wrap items-center gap-3"
      >
        {/* Search */}
        <div className="relative flex-shrink-0 w-full sm:w-[280px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8F96A3]" />
          <input
            type="text"
            placeholder="搜索PI号、客户名称、报关单号..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 border border-[#E2E5E9] rounded-lg text-sm text-[#1A1D23] placeholder:text-[#8F96A3] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BFDBFE] transition-all"
          />
          {searchInput && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8F96A3] hover:text-[#5A6270]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => {
              setFilters({ dateFrom: e.target.value })
              setPage(1)
            }}
            className="py-2.5 px-3 border border-[#E2E5E9] rounded-lg text-sm text-[#1A1D23] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BFDBFE] transition-all"
          />
          <span className="text-sm text-[#8F96A3]">-</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => {
              setFilters({ dateTo: e.target.value })
              setPage(1)
            }}
            className="py-2.5 px-3 border border-[#E2E5E9] rounded-lg text-sm text-[#1A1D23] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BFDBFE] transition-all"
          />
        </div>

        {/* Customer filter */}
        <select
          value={filters.customer}
          onChange={(e) => {
            setFilters({ customer: e.target.value })
            setPage(1)
          }}
          className="py-2.5 px-3 border border-[#E2E5E9] rounded-lg text-sm text-[#1A1D23] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BFDBFE] transition-all bg-white min-w-[160px]"
        >
          <option value="">全部客户</option>
          {customers.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters({ status: e.target.value })
            setPage(1)
          }}
          className="py-2.5 px-3 border border-[#E2E5E9] rounded-lg text-sm text-[#1A1D23] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BFDBFE] transition-all bg-white min-w-[120px]"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} ({statusCounts[opt.value as keyof typeof statusCounts] || 0})
            </option>
          ))}
        </select>

        {/* Sort dropdown */}
        <select
          value={`${sortField}-${sortDir}`}
          onChange={(e) => {
            const [field, dir] = e.target.value.split('-') as [SortField, SortDirection]
            setSortField(field)
            setSortDir(dir)
          }}
          className="py-2.5 px-3 border border-[#E2E5E9] rounded-lg text-sm text-[#1A1D23] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BFDBFE] transition-all bg-white min-w-[140px]"
        >
          <option value="date-desc">按日期倒序</option>
          <option value="date-asc">按日期正序</option>
          <option value="totalAmount-desc">按金额倒序</option>
          <option value="totalAmount-asc">按金额正序</option>
          <option value="customerName-asc">按客户排序</option>
          <option value="quantity-desc">按套数排序</option>
        </select>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="jt-btn-ghost text-sm flex items-center gap-1.5 py-2.5"
        >
          <X size={14} />
          重置筛选
        </button>
      </motion.div>

      {/* ── Bulk Actions Bar ── */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="flex items-center justify-between bg-[#2563EB] text-white px-5 py-3 rounded-xl shadow-lg"
          >
            <span className="text-sm font-medium">
              已选择 <span className="font-mono font-semibold">{selectedIds.length}</span> 项
            </span>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 transition-colors">
                <Download size={16} />
                批量导出
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-red-500/80 transition-colors"
              >
                <Trash2 size={16} />
                批量删除
              </button>
              <button
                onClick={clearSelection}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors"
              >
                取消选择
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Data Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        className="bg-white border border-[#E2E5E9] rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      >
        {totalRecords === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-20">
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <History size={64} className="text-[#C9CDD4] mb-4" />
            </motion.div>
            <h3 className="text-xl font-semibold text-[#1A1D23] mb-2">暂无历史记录</h3>
            <p className="text-sm text-[#8F96A3] mb-6">完成您的第一份报关资料后，记录将显示在这里</p>
            <button
              onClick={() => navigate('/pi-upload')}
              className="jt-btn-primary flex items-center gap-2"
            >
              开始报关流程
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F9FB] border-b border-[#E2E5E9]">
                    <th scope="col" className="px-3 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected
                        }}
                        onChange={handleSelectAllPage}
                        className="w-4 h-4 rounded border-[#C9CDD4] text-[#2563EB] focus:ring-[#2563EB] focus:ring-2 cursor-pointer"
                      />
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-left text-xs font-medium text-[#8F96A3] uppercase tracking-wider cursor-pointer select-none hover:text-[#2563EB] transition-colors"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center gap-1">
                        报关单号
                        <SortIcon field="date" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-left text-xs font-medium text-[#8F96A3] uppercase tracking-wider cursor-pointer select-none hover:text-[#2563EB] transition-colors"
                      onClick={() => handleSort('customerName')}
                    >
                      <div className="flex items-center gap-1">
                        客户名称
                        <SortIcon field="customerName" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-left text-xs font-medium text-[#8F96A3] uppercase tracking-wider"
                    >
                      PI号
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-left text-xs font-medium text-[#8F96A3] uppercase tracking-wider"
                    >
                      货物明细
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-right text-xs font-medium text-[#8F96A3] uppercase tracking-wider cursor-pointer select-none hover:text-[#2563EB] transition-colors"
                      onClick={() => handleSort('totalAmount')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        总金额(USD)
                        <SortIcon field="totalAmount" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-center text-xs font-medium text-[#8F96A3] uppercase tracking-wider cursor-pointer select-none hover:text-[#2563EB] transition-colors"
                      onClick={() => handleSort('quantity')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        套数
                        <SortIcon field="quantity" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-center text-xs font-medium text-[#8F96A3] uppercase tracking-wider"
                    >
                      状态
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-center text-xs font-medium text-[#8F96A3] uppercase tracking-wider"
                    >
                      生成日期
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3.5 text-center text-xs font-medium text-[#8F96A3] uppercase tracking-wider"
                    >
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.map((row, idx) => {
                    const isSelected = selectedIds.includes(row.id)
                    const status = statusMap[row.status]
                    return (
                      <tr
                        key={row.id}
                        className={[
                          'border-b border-[#E2E5E9] transition-all duration-150 group',
                          isSelected ? 'bg-[#EFF6FF]' : idx % 2 === 1 ? 'bg-[#F8F9FB]' : 'bg-white',
                          'hover:bg-[#F1F5F9]',
                        ].join(' ')}
                      >
                        <td className="px-3 py-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection(row.id)}
                            className="w-4 h-4 rounded border-[#C9CDD4] text-[#2563EB] focus:ring-[#2563EB] focus:ring-2 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => openDrawer(row)}
                            className="font-mono text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8] hover:underline transition-colors"
                          >
                            {row.invoiceNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-[#1A1D23] font-medium">{row.customerName}</span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-sm text-[#5A6270]">{row.piNumber}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm text-[#5A6270]">
                            R7 &times; {row.quantity}套 ({row.totalPieces}件)
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold text-[#1A1D23]">
                          {formatCurrency(row.totalAmount)}
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-sm text-[#5A6270]">
                          {row.quantity}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
                            style={{
                              backgroundColor: status.bg,
                              color: status.color,
                              border: `1px solid ${status.border}`,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center text-sm text-[#5A6270]">{row.date}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <button
                              onClick={() => openDrawer(row)}
                              className="p-1.5 rounded-md hover:bg-[#EFF6FF] text-[#5A6270] hover:text-[#2563EB] transition-colors"
                              title="查看"
                              aria-label="查看"
                            >
                              <Eye size={15} />
                            </button>
                            {row.status === 'completed' ? (
                              <button
                                className="p-1.5 rounded-md hover:bg-[#EFF6FF] text-[#5A6270] hover:text-[#2563EB] transition-colors"
                                title="导出"
                                aria-label="导出"
                              >
                                <Download size={15} />
                              </button>
                            ) : (
                              <button
                                className="p-1.5 rounded-md hover:bg-[#EFF6FF] text-[#5A6270] hover:text-[#2563EB] transition-colors"
                                title="继续"
                                aria-label="继续"
                              >
                                <ArrowRight size={15} />
                              </button>
                            )}
                            <button
                              onClick={() => handleCopy(row)}
                              className="p-1.5 rounded-md hover:bg-[#EFF6FF] text-[#5A6270] hover:text-[#2563EB] transition-colors"
                              title="复制"
                              aria-label="复制"
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="p-1.5 rounded-md hover:bg-[#FEF2F2] text-[#5A6270] hover:text-[#DC2626] transition-colors"
                              title="删除"
                              aria-label="删除"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Pagination ── */}
            <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-4 border-t border-[#E2E5E9] gap-4">
              <div className="flex items-center gap-2 text-[13px] text-[#8F96A3]">
                <span>
                  显示第 <span className="font-mono font-medium text-[#1A1D23]">{totalRecords > 0 ? startIdx + 1 : 0}</span> 到{' '}
                  <span className="font-mono font-medium text-[#1A1D23]">{endIdx}</span> 条，共{' '}
                  <span className="font-mono font-medium text-[#1A1D23]">{totalRecords}</span> 条
                </span>
                <span className="text-[#C9CDD4]">|</span>
                <div className="flex items-center gap-1.5">
                  <span>每页</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                    className="py-1 px-2 border border-[#E2E5E9] rounded-md text-xs text-[#1A1D23] bg-white focus:outline-none focus:border-[#2563EB]"
                  >
                    {pageSizeOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span>条</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-2 rounded-lg border border-[#E2E5E9] text-[#5A6270] hover:bg-[#F8F9FB] hover:text-[#1A1D23] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  aria-label="上一页"
                >
                  <ChevronLeft size={16} />
                </button>

                {getPageNumbers().map((p, i) =>
                  p === 'ellipsis' ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-sm text-[#8F96A3]">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={[
                        'min-w-[36px] h-9 px-2.5 rounded-lg text-sm font-medium transition-all',
                        safePage === p
                          ? 'bg-[#2563EB] text-white shadow-sm'
                          : 'border border-[#E2E5E9] text-[#5A6270] hover:bg-[#F8F9FB] hover:text-[#1A1D23]',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-2 rounded-lg border border-[#E2E5E9] text-[#5A6270] hover:bg-[#F8F9FB] hover:text-[#1A1D23] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  aria-label="下一页"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>

      {/* ── Detail Drawer ── */}
      <DetailDrawer
        declaration={selectedDeclaration}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onCopyAsNew={(d) => {
          setDrawerOpen(false)
          handleCopy(d)
        }}
      />

      {/* ── Delete Dialog ── */}
      <DeleteDialog
        open={deleteDialogOpen}
        title="确认删除"
        description="删除后该记录将不再显示，此操作不可撤销。您确定要删除这条报关记录吗？"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false)
          setDeleteTargetId(null)
        }}
      />

      {/* ── Bulk Delete Dialog ── */}
      <DeleteDialog
        open={bulkDeleteDialogOpen}
        title="确认批量删除"
        description={`您即将删除 ${selectedIds.length} 条报关记录，此操作不可撤销。确定要继续吗？`}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteDialogOpen(false)}
      />

      {/* ── Copy Dialog ── */}
      <CopyDialog
        open={copyDialogOpen}
        piNumber={copyTarget?.piNumber || ''}
        onConfirm={confirmCopy}
        onCancel={() => {
          setCopyDialogOpen(false)
          setCopyTarget(null)
        }}
      />
    </motion.div>
  )
}

/* Small helper for breadcrumb */
function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#C9CDD4]">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
