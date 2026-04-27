import { create } from 'zustand'

export type DeclarationStatus = 'completed' | 'processing' | 'draft'

export interface ComponentDetail {
  id: string
  name: string
  hsCode: string
  quantity: number    // 该组件总数量
  unitPrice: number   // 该组件单价
  subtotal: number
}

export interface Documents {
  ci: boolean // Commercial Invoice
  pl: boolean // Packing List
  pc: boolean // Purchase Contract
  customs: boolean // Customs Declaration
}

export interface Declaration {
  id: string
  piNumber: string
  invoiceNumber: string
  customerName: string
  date: string
  totalAmount: number
  quantity: number      // R7套数
  totalPieces: number   // 组件总件数
  destination: string
  status: DeclarationStatus
  documents: Documents
  components?: ComponentDetail[]
  terms?: string
  unitPrice?: number
  deleted?: boolean
}

export interface Filters {
  search: string
  dateFrom: string
  dateTo: string
  customer: string
  status: string // 'all' | 'completed' | 'processing' | 'draft'
}

interface HistoryStore {
  declarations: Declaration[]
  filters: Filters
  selectedIds: string[]
  setFilters: (filters: Partial<Filters>) => void
  resetFilters: () => void
  addDeclaration: (d: Declaration) => void
  removeDeclaration: (id: string) => void
  softDeleteDeclaration: (id: string) => void
  softDeleteMany: (ids: string[]) => void
  toggleSelection: (id: string) => void
  setSelection: (ids: string[]) => void
  clearSelection: () => void
  selectAll: (ids: string[]) => void
  filteredDeclarations: () => Declaration[]
  getUniqueCustomers: () => string[]
  getStatusCounts: () => Record<DeclarationStatus | 'all', number>
  loadMockData: () => void
  clearAll: () => void
}

// Helper to build component details for a given set count and unit price
function buildComponents(setCount: number, unitPrice: number): ComponentDetail[] {
  const totalAmount = setCount * unitPrice
  // Use same distribution logic as priceStore
  const ratios = [0.0333, 0.0333, 0.0444, 0.1222, 0.0444, 0.0778, 0.2444, 0.2000, 0.2002]
  const qtyPerSet = [1, 1, 2, 1, 1, 1, 1, 1, 1]
  const names = [
    '自行车用前刹车卡钳',
    '自行车用后刹车卡钳',
    '自行车用刹车碟片',
    '自行车用牙盘',
    '自行车用链条',
    '自行车用飞轮',
    '自行车用后变速器',
    '自行车用变速器左刹把变把',
    '自行车用变速器右刹把变把',
  ]
  const ids = [
    'front_brake', 'rear_brake', 'brake_disc', 'chainring', 'chain',
    'cassette', 'rear_derailleur', 'left_shifter', 'right_shifter',
  ]

  let sum = 0
  const totalPrices: number[] = []
  ratios.forEach((r, i) => {
    if (i === ratios.length - 1) {
      totalPrices.push(Math.round((totalAmount - sum) * 100) / 100)
    } else {
      const p = Math.round(totalAmount * r * 100) / 100
      totalPrices.push(p)
      sum += p
    }
  })

  return ids.map((id, i) => {
    const totalQty = qtyPerSet[i] * setCount
    const totalP = totalPrices[i]
    const unitP = totalQty > 0 ? Math.round((totalP / totalQty) * 100) / 100 : 0
    return {
      id,
      name: names[i],
      hsCode: '87149900',
      quantity: totalQty,
      unitPrice: unitP,
      subtotal: totalP,
    }
  })
}

const mockDeclarations: Declaration[] = [
  {
    id: 'CI-260402-2002',
    piNumber: 'PI-260402-2002',
    invoiceNumber: 'CI-260402-2002',
    customerName: 'KONJULBAKI-TRADELAB',
    date: '2026-04-09',
    totalAmount: 1350,
    quantity: 3,
    totalPieces: 33, // 3套 × 11件
    destination: '韩国',
    status: 'completed',
    terms: 'EXW',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(3, 450),
  },
  {
    id: 'CI-260328-1001',
    piNumber: 'PI-260328-1001',
    invoiceNumber: 'CI-260328-1001',
    customerName: 'STARBIKES GMBH',
    date: '2026-03-28',
    totalAmount: 2250,
    quantity: 5,
    totalPieces: 55,
    destination: '德国',
    status: 'completed',
    terms: 'FOB',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(5, 450),
  },
  {
    id: 'CI-260315-0892',
    piNumber: 'PI-260315-0892',
    invoiceNumber: 'CI-260315-0892',
    customerName: 'VELOTRADE INC',
    date: '2026-03-15',
    totalAmount: 900,
    quantity: 2,
    totalPieces: 22,
    destination: '日本',
    status: 'processing',
    terms: 'CIF',
    unitPrice: 450,
    documents: { ci: true, pl: false, pc: false, customs: false },
    components: buildComponents(2, 450),
  },
  {
    id: 'CI-260301-0654',
    piNumber: 'PI-260301-0654',
    invoiceNumber: 'CI-260301-0654',
    customerName: 'CYCLING PARTS CO',
    date: '2026-03-01',
    totalAmount: 4500,
    quantity: 10,
    totalPieces: 110,
    destination: '美国',
    status: 'completed',
    terms: 'EXW',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(10, 450),
  },
  {
    id: 'CI-260220-0432',
    piNumber: 'PI-260220-0432',
    invoiceNumber: 'CI-260220-0432',
    customerName: 'BIKEDISTRO LLC',
    date: '2026-02-20',
    totalAmount: 450,
    quantity: 1,
    totalPieces: 11,
    destination: '意大利',
    status: 'completed',
    terms: 'FOB',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(1, 450),
  },
  {
    id: 'CI-260215-0391',
    piNumber: 'PI-260215-0391',
    invoiceNumber: 'CI-260215-0391',
    customerName: 'VELOMOTION SAS',
    date: '2026-02-15',
    totalAmount: 1800,
    quantity: 4,
    totalPieces: 44,
    destination: '法国',
    status: 'completed',
    terms: 'CIF',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(4, 450),
  },
  {
    id: 'CI-260201-0210',
    piNumber: 'PI-260201-0210',
    invoiceNumber: 'CI-260201-0210',
    customerName: 'KONJULBAKI-TRADELAB',
    date: '2026-02-01',
    totalAmount: 900,
    quantity: 2,
    totalPieces: 22,
    destination: '韩国',
    status: 'completed',
    terms: 'EXW',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(2, 450),
  },
  {
    id: 'CI-260115-0087',
    piNumber: 'PI-260115-0087',
    invoiceNumber: 'CI-260115-0087',
    customerName: 'ASIABIKE TRADING',
    date: '2026-01-15',
    totalAmount: 2700,
    quantity: 6,
    totalPieces: 66,
    destination: '新加坡',
    status: 'completed',
    terms: 'FOB',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(6, 450),
  },
  {
    id: 'CI-260110-0054',
    piNumber: 'PI-260110-0054',
    invoiceNumber: 'CI-260110-0054',
    customerName: 'STARBIKES GMBH',
    date: '2026-01-10',
    totalAmount: 1350,
    quantity: 3,
    totalPieces: 33,
    destination: '德国',
    status: 'completed',
    terms: 'CIF',
    unitPrice: 450,
    documents: { ci: true, pl: true, pc: true, customs: true },
    components: buildComponents(3, 450),
  },
  {
    id: 'CI-260105-0032',
    piNumber: 'PI-260105-0032',
    invoiceNumber: 'CI-260105-0032',
    customerName: 'VELOTRADE INC',
    date: '2026-01-05',
    totalAmount: 450,
    quantity: 1,
    totalPieces: 11,
    destination: '日本',
    status: 'draft',
    terms: 'EXW',
    unitPrice: 450,
    documents: { ci: false, pl: false, pc: false, customs: false },
    components: buildComponents(1, 450),
  },
]

const defaultFilters: Filters = {
  search: '',
  dateFrom: '',
  dateTo: '',
  customer: '',
  status: 'all',
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  declarations: [],
  filters: { ...defaultFilters },
  selectedIds: [],

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  resetFilters: () =>
    set({ filters: { ...defaultFilters }, selectedIds: [] }),

  addDeclaration: (d) =>
    set((state) => ({ declarations: [d, ...state.declarations] })),

  removeDeclaration: (id) =>
    set((state) => ({
      declarations: state.declarations.filter((d) => d.id !== id),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),

  softDeleteDeclaration: (id) =>
    set((state) => ({
      declarations: state.declarations.map((d) =>
        d.id === id ? { ...d, deleted: true } : d
      ),
      selectedIds: state.selectedIds.filter((sid) => sid !== id),
    })),

  softDeleteMany: (ids) =>
    set((state) => ({
      declarations: state.declarations.map((d) =>
        ids.includes(d.id) ? { ...d, deleted: true } : d
      ),
      selectedIds: state.selectedIds.filter((sid) => !ids.includes(sid)),
    })),

  toggleSelection: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((sid) => sid !== id)
        : [...state.selectedIds, id],
    })),

  setSelection: (ids) => set({ selectedIds: ids }),

  clearSelection: () => set({ selectedIds: [] }),

  selectAll: (ids) => set({ selectedIds: ids }),

  filteredDeclarations: () => {
    const { declarations, filters } = get()
    return declarations.filter((d) => {
      if (d.deleted) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const match =
          d.id.toLowerCase().includes(s) ||
          d.customerName.toLowerCase().includes(s) ||
          d.piNumber.toLowerCase().includes(s) ||
          d.invoiceNumber.toLowerCase().includes(s) ||
          d.destination.toLowerCase().includes(s)
        if (!match) return false
      }
      if (filters.dateFrom && d.date < filters.dateFrom) return false
      if (filters.dateTo && d.date > filters.dateTo) return false
      if (filters.customer && !d.customerName.toLowerCase().includes(filters.customer.toLowerCase())) return false
      if (filters.status && filters.status !== 'all' && d.status !== filters.status) return false
      return true
    })
  },

  getUniqueCustomers: () => {
    const { declarations } = get()
    const customers = new Set<string>()
    declarations.forEach((d) => {
      if (!d.deleted) customers.add(d.customerName)
    })
    return Array.from(customers).sort()
  },

  getStatusCounts: () => {
    const { declarations } = get()
    const counts: Record<string, number> = { all: 0, completed: 0, processing: 0, draft: 0 }
    declarations.forEach((d) => {
      if (!d.deleted) {
        counts.all++
        counts[d.status]++
      }
    })
    return counts as Record<DeclarationStatus | 'all', number>
  },

  loadMockData: () => {
    set({ declarations: mockDeclarations.map((d) => ({ ...d, deleted: false })) })
  },

  clearAll: () => {
    set({ declarations: [], selectedIds: [] })
  },
}))
