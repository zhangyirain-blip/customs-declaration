import { create } from 'zustand'
import {
  getAllProjects,
  getProjectById,
  saveProject,
  deleteProject,
  type ProjectRecord,
  type WorkflowStatus,
} from '@/db/indexedDB'
import { generateInvoiceNo } from '@/utils/documentUtils'

// Re-export PIData shape for compatibility
export interface PIData {
  piNumber: string
  invoiceNumber: string
  date: string
  contractNo: string
  clientNameCN: string
  clientNameEN: string
  clientAddressCN: string
  clientAddressEN: string
  tradeTerms: string
  transportMode: string
  tradeCountry: string
  destinationCountry: string
  destinationPort: string
  entryPort: string
  productName: string
  quantity: number
  unitPrice: number
  totalAmount: number
  packageType: string
  packageCount: number
  grossWeight: number
  netWeight: number
  supervisionMode: string
  taxExemption: string
}

export const defaultPIData: PIData = {
  piNumber: '',
  invoiceNumber: '',
  date: '',
  contractNo: '',
  clientNameCN: '',
  clientNameEN: '',
  clientAddressCN: '',
  clientAddressEN: '',
  tradeTerms: 'EXW',
  transportMode: '航空运输',
  tradeCountry: '',
  destinationCountry: '',
  destinationPort: '',
  entryPort: '',
  productName: 'R7 Full Groupset',
  quantity: 0,
  unitPrice: 0,
  totalAmount: 0,
  packageType: '纸箱',
  packageCount: 0,
  grossWeight: 0,
  netWeight: 0,
  supervisionMode: '一般贸易',
  taxExemption: '一般征税',
}

interface ProjectStore {
  projects: ProjectRecord[]
  currentProjectId: string | null
  isLoading: boolean
  loadProjects: () => Promise<void>
  createProject: (piData?: Partial<PIData>, productTemplateId?: string) => Promise<string>
  loadProject: (id: string) => Promise<ProjectRecord | undefined>
  updateCurrentProject: (updates: Partial<ProjectRecord>) => Promise<void>
  updatePIData: (updates: Partial<PIData>) => Promise<void>
  setProjectPrices: (componentPrices: Record<string, number>) => Promise<void>
  setProjectLocks: (lockedComponents: Record<string, boolean>) => Promise<void>
  setPackingScheme: (packingSchemeId: string, customScheme?: Record<string, unknown>) => Promise<void>
  advanceStatus: (status: WorkflowStatus) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  getCurrentProject: () => ProjectRecord | undefined
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProjectId: null,
  isLoading: false,

  loadProjects: async () => {
    set({ isLoading: true })
    const projects = await getAllProjects()
    set({ projects, isLoading: false })
  },

  createProject: async (piData, productTemplateId = 'r7-full-groupset') => {
    const id = `proj-${Date.now()}`
    const mergedPi: PIData = { ...defaultPIData, ...piData }
    if (!mergedPi.invoiceNumber && mergedPi.piNumber) {
      mergedPi.invoiceNumber = generateInvoiceNo(mergedPi.piNumber)
    }

    const project: ProjectRecord = {
      id,
      name: `${mergedPi.piNumber || '新项目'} — ${mergedPi.clientNameEN || mergedPi.clientNameCN || '未命名'}`,
      piData: mergedPi as unknown as Record<string, unknown>,
      componentPrices: {},
      lockedComponents: {},
      status: 'draft',
      productTemplateId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documentsGenerated: {
        commercial_invoice: false,
        purchase_contract: false,
        packing_list: false,
        customs_declaration: false,
      },
    }

    await saveProject(project)
    set((state) => ({
      projects: [project, ...state.projects],
      currentProjectId: id,
    }))
    return id
  },

  loadProject: async (id) => {
    const project = await getProjectById(id)
    if (project) {
      set({ currentProjectId: id })
    }
    return project
  },

  updateCurrentProject: async (updates) => {
    const current = get().getCurrentProject()
    if (!current) return
    const updated: ProjectRecord = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await saveProject(updated)
    set((state) => ({
      projects: state.projects.map((p) => (p.id === updated.id ? updated : p)),
    }))
  },

  updatePIData: async (updates) => {
    const current = get().getCurrentProject()
    if (!current) return
    const currentPi = (current.piData as unknown as PIData) || { ...defaultPIData }
    const nextPi = { ...currentPi, ...updates }
    if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
      nextPi.totalAmount = Math.round(nextPi.quantity * nextPi.unitPrice * 100) / 100
    }
    const name = `${nextPi.piNumber || current.name.split(' — ')[0]} — ${nextPi.clientNameEN || nextPi.clientNameCN || '未命名'}`
    await get().updateCurrentProject({ piData: nextPi as unknown as Record<string, unknown>, name })
  },

  setProjectPrices: async (componentPrices) => {
    await get().updateCurrentProject({ componentPrices })
  },

  setProjectLocks: async (lockedComponents) => {
    await get().updateCurrentProject({ lockedComponents })
  },

  setPackingScheme: async (packingSchemeId, customScheme) => {
    await get().updateCurrentProject({ packingSchemeId, customPackingScheme: customScheme })
  },

  advanceStatus: async (status) => {
    await get().updateCurrentProject({ status })
  },

  deleteProject: async (id) => {
    await deleteProject(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
    }))
  },

  getCurrentProject: () => {
    const { projects, currentProjectId } = get()
    return projects.find((p) => p.id === currentProjectId)
  },
}))
