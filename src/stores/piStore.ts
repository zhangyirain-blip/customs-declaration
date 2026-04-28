import { create } from 'zustand'

export interface PIData {
  // PI 基本信息
  piNumber: string
  invoiceNumber: string
  date: string
  contractNo: string
  // 买方信息
  clientNameCN: string
  clientNameEN: string
  clientAddressCN: string
  clientAddressEN: string
  // 交易信息
  tradeTerms: string
  transportMode: string
  tradeCountry: string
  destinationCountry: string
  destinationPort: string
  entryPort: string
  // 货物信息
  productName: string
  quantity: number        // 套数
  unitPrice: number       // 每套单价(USD)
  totalAmount: number     // 总价 = quantity * unitPrice
  // 其他信息
  packageType: string
  packageCount: number
  grossWeight: number     // 总毛重(kg)
  netWeight: number       // 总净重(kg)
  supervisionMode: string
  taxExemption: string
  // 报关单人民币金额（与货代确认后手动输入）
  customsDeclarationAmountCNY?: number
  // 币种
  currency?: string
}

type ExtractionStatus = 'idle' | 'extracting' | 'success' | 'error'

interface PIStore {
  uploadedPI: PIData | null
  extractionStatus: ExtractionStatus
  extractionError: string | null
  setUploadedPI: (pi: PIData | null) => void
  updatePI: (updates: Partial<PIData>) => void
  setExtractionStatus: (status: ExtractionStatus) => void
  setExtractionError: (error: string | null) => void
  reset: () => void
}

export const defaultPIData: PIData = {
  piNumber: 'PI-260402-2002',
  invoiceNumber: 'CI-260402-2002',
  date: '2026-04-09',
  contractNo: 'CTR-260402-2002',
  clientNameCN: '',
  clientNameEN: 'KONJULBAKI-TRADELAB',
  clientAddressCN: '',
  clientAddressEN: 'Seoul, South Korea',
  tradeTerms: 'CIF',
  transportMode: '航空运输',
  tradeCountry: '韩国',
  destinationCountry: '韩国',
  destinationPort: '意大利',
  entryPort: '',
  productName: 'R7 Full Groupset',
  quantity: 3,
  unitPrice: 450,
  totalAmount: 1350,
  packageType: '纸箱',
  packageCount: 6,
  grossWeight: 13.5,
  netWeight: 8.94,
  supervisionMode: '一般贸易',
  taxExemption: '一般征税',
  customsDeclarationAmountCNY: undefined,
  currency: 'USD',
}

export const usePIStore = create<PIStore>((set) => ({
  uploadedPI: { ...defaultPIData },
  extractionStatus: 'success',
  extractionError: null,

  setUploadedPI: (pi) => set({ uploadedPI: pi, extractionStatus: pi ? 'success' : 'idle', extractionError: null }),

  updatePI: (updates) =>
    set((state) => {
      if (!state.uploadedPI) return state
      const next = { ...state.uploadedPI, ...updates }
      // 自动保持总价 = 数量 × 单价
      if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
        next.totalAmount = next.quantity * next.unitPrice
      }
      return { uploadedPI: next }
    }),

  setExtractionStatus: (status) => set({ extractionStatus: status }),
  setExtractionError: (error) => set({ extractionError: error }),

  reset: () => set({ uploadedPI: null, extractionStatus: 'idle', extractionError: null }),
}))
