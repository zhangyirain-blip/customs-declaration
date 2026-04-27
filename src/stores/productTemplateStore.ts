import { create } from 'zustand'
import {
  getAllProductTemplates,
  getProductTemplateById,
  saveProductTemplate,
  deleteProductTemplate,
  seedBuiltInData,
  type ProductTemplateRecord,
  type ProductComponent,
} from '@/db/indexedDB'

interface ProductTemplateStore {
  templates: ProductTemplateRecord[]
  activeTemplateId: string | null
  isLoading: boolean
  loadTemplates: () => Promise<void>
  setActiveTemplate: (id: string) => void
  getActiveTemplate: () => ProductTemplateRecord | undefined
  addTemplate: (template: Omit<ProductTemplateRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateTemplate: (id: string, updates: Partial<ProductTemplateRecord>) => Promise<void>
  removeTemplate: (id: string) => Promise<void>
  updateComponent: (templateId: string, componentId: string, updates: Partial<ProductComponent>) => Promise<void>
  resetTemplate: (templateId: string) => Promise<void>
}

// Helper: compute derived stats from template
export function getPiecesPerSet(template: ProductTemplateRecord): number {
  return template.components.reduce((s, c) => s + c.qtyPerSet, 0)
}

export function getGrossWeightPerSet(template: ProductTemplateRecord): number {
  return template.components.reduce((s, c) => s + c.grossWeightKg * c.qtyPerSet, 0)
}

export function getNetWeightPerSet(template: ProductTemplateRecord): number {
  return template.components.reduce((s, c) => s + c.netWeightKg * c.qtyPerSet, 0)
}

export function getRatioSum(template: ProductTemplateRecord): number {
  return template.components.reduce((s, c) => s + c.ratio, 0)
}

export function buildRatiosMap(template: ProductTemplateRecord): Record<string, number> {
  const map: Record<string, number> = {}
  template.components.forEach((c) => {
    map[c.id] = c.ratio
  })
  return map
}

export const useProductTemplateStore = create<ProductTemplateStore>((set, get) => ({
  templates: [],
  activeTemplateId: 'r7-full-groupset',
  isLoading: false,

  loadTemplates: async () => {
    set({ isLoading: true })
    await seedBuiltInData()
    const templates = await getAllProductTemplates()
    set({ templates, isLoading: false })
  },

  setActiveTemplate: (id) => set({ activeTemplateId: id }),

  getActiveTemplate: () => {
    const { templates, activeTemplateId } = get()
    return templates.find((t) => t.id === activeTemplateId)
  },

  addTemplate: async (template) => {
    const id = `tpl-${Date.now()}`
    const now = new Date().toISOString()
    const newTemplate: ProductTemplateRecord = {
      ...template,
      id,
      createdAt: now,
      updatedAt: now,
    }
    await saveProductTemplate(newTemplate)
    set((state) => ({ templates: [...state.templates, newTemplate] }))
  },

  updateTemplate: async (id, updates) => {
    const template = get().templates.find((t) => t.id === id)
    if (!template) return
    const updated = { ...template, ...updates, updatedAt: new Date().toISOString() }
    await saveProductTemplate(updated)
    set((state) => ({
      templates: state.templates.map((t) => (t.id === id ? updated : t)),
    }))
  },

  removeTemplate: async (id) => {
    const template = get().templates.find((t) => t.id === id)
    if (template?.isBuiltIn) return // Cannot delete built-in
    await deleteProductTemplate(id)
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
      activeTemplateId: state.activeTemplateId === id ? 'r7-full-groupset' : state.activeTemplateId,
    }))
  },

  updateComponent: async (templateId, componentId, updates) => {
    const template = get().templates.find((t) => t.id === templateId)
    if (!template) return
    const updatedComponents = template.components.map((c) =>
      c.id === componentId ? { ...c, ...updates } : c
    )
    await get().updateTemplate(templateId, { components: updatedComponents })
  },

  resetTemplate: async (templateId) => {
    // Reset only ratios for now; can be extended
    const template = get().templates.find((t) => t.id === templateId)
    if (!template) return
    const builtIn = template.isBuiltIn
    if (!builtIn) return
    // Re-seed from built-in defaults
    await seedBuiltInData()
    const refreshed = await getProductTemplateById(templateId)
    if (refreshed) {
      set((state) => ({
        templates: state.templates.map((t) => (t.id === templateId ? refreshed : t)),
      }))
    }
  },
}))
