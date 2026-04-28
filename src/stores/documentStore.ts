import { create } from 'zustand'

type DocumentType = 'commercial_invoice' | 'purchase_contract' | 'packing_list' | 'customs_declaration'

type PreviewMode = 'side-by-side' | 'full'

type GenerationStatus = 'idle' | 'generating' | 'success' | 'error'

interface DocumentStore {
  selectedDocuments: DocumentType[]
  previewMode: PreviewMode
  generationStatus: Record<DocumentType, GenerationStatus>
  toggleDocument: (type: DocumentType) => void
  setPreviewMode: (mode: PreviewMode) => void
  setGenerationStatus: (type: DocumentType, status: GenerationStatus) => void
  selectAll: () => void
  deselectAll: () => void
  reset: () => void
}

const ALL_DOCS: DocumentType[] = [
  'commercial_invoice',
  'purchase_contract',
  'packing_list',
  'customs_declaration',
]

const defaultStatus: Record<DocumentType, GenerationStatus> = {
  commercial_invoice: 'idle',
  purchase_contract: 'idle',
  packing_list: 'idle',
  customs_declaration: 'idle',
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  selectedDocuments: [...ALL_DOCS],
  previewMode: 'full',
  generationStatus: { ...defaultStatus },

  toggleDocument: (type) =>
    set((state) => ({
      selectedDocuments: state.selectedDocuments.includes(type)
        ? state.selectedDocuments.filter((t) => t !== type)
        : [...state.selectedDocuments, type],
    })),

  setPreviewMode: (mode) => set({ previewMode: mode }),

  setGenerationStatus: (type, status) =>
    set((state) => ({
      generationStatus: { ...state.generationStatus, [type]: status },
    })),

  selectAll: () => set({ selectedDocuments: [...ALL_DOCS] }),
  deselectAll: () => set({ selectedDocuments: [] }),

  reset: () => set({ selectedDocuments: [...ALL_DOCS], previewMode: 'full', generationStatus: { ...defaultStatus } }),
}))
