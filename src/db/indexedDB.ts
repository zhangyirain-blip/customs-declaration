/**
 * IndexedDB 持久化层 — 鲸途报关工具核心存储
 *
 * Stores:
 *   - projects: 报关项目（完整订单数据）
 *   - productTemplates: 产品模板配置
 *   - documentTemplates: 文档导出模板
 *   - appSettings: 应用设置（API keys, 偏好等）
 */

const DB_NAME = 'JingtuCustomsDB'
const DB_VERSION = 1

interface DBSchema {
  projects: ProjectRecord
  productTemplates: ProductTemplateRecord
  documentTemplates: DocumentTemplateRecord
  appSettings: AppSettingRecord
}

// --- Type Definitions ---

export interface ProjectRecord {
  id: string
  name: string
  piData: Record<string, unknown>
  componentPrices: Record<string, number>
  lockedComponents: Record<string, boolean>
  status: WorkflowStatus
  productTemplateId: string
  packingSchemeId?: string
  customPackingScheme?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  documentsGenerated: {
    commercial_invoice: boolean
    purchase_contract: boolean
    packing_list: boolean
    customs_declaration: boolean
  }
}

export interface ProductTemplateRecord {
  id: string
  name: string
  description: string
  version: string
  components: ProductComponent[]
  packageBoxes?: PackageBoxRecord[]
  packingSchemes?: PackingSchemeRecord[]
  defaultPackingSchemeId?: string
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

export interface PackageBoxRecord {
  id: string
  name: string
  grossWeightKg: number
  volumeM3: number
  componentIds: string[]
}

export interface PackingSchemeRecord {
  id: string
  name: string
  description: string
  cartons: CartonConfigRecord[]
}

export interface CartonConfigRecord {
  id: string
  name: string
  boxIds: string[]
}

export interface ProductComponent {
  id: string
  seq: number
  nameCN: string
  nameEN: string
  hsCode: string
  grossWeightKg: number
  netWeightKg: number
  ratio: number
  qtyPerSet: number
  unit: string
  declarationElements: string
  brand: string
}

export interface DocumentTemplateRecord {
  id: string
  name: string
  type: 'commercial_invoice' | 'purchase_contract' | 'packing_list' | 'customs_declaration'
  description: string
  config: Record<string, unknown>
  isBuiltIn: boolean
  createdAt: string
}

export interface AppSettingRecord {
  key: string
  value: unknown
}

export type WorkflowStatus =
  | 'draft'
  | 'pi_uploaded'
  | 'data_extracted'
  | 'components_reviewed'
  | 'price_balanced'
  | 'docs_generated'
  | 'exported'
  | 'archived'

// --- DB Initialization ---

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects', { keyPath: 'id' })
        store.createIndex('byStatus', 'status', { unique: false })
        store.createIndex('byDate', 'updatedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains('productTemplates')) {
        db.createObjectStore('productTemplates', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('documentTemplates')) {
        db.createObjectStore('documentTemplates', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('appSettings')) {
        db.createObjectStore('appSettings', { keyPath: 'key' })
      }
    }
  })

  return dbPromise
}

// --- Generic CRUD ---

async function getStore(
  storeName: keyof DBSchema,
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
  const db = await openDB()
  const tx = db.transaction(storeName, mode)
  return tx.objectStore(storeName)
}

// --- Projects ---

export async function getAllProjects(): Promise<ProjectRecord[]> {
  const store = await getStore('projects')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as ProjectRecord[])
    request.onerror = () => reject(request.error)
  })
}

export async function getProjectById(id: string): Promise<ProjectRecord | undefined> {
  const store = await getStore('projects')
  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result as ProjectRecord | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function saveProject(project: ProjectRecord): Promise<void> {
  const store = await getStore('projects', 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.put(project)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteProject(id: string): Promise<void> {
  const store = await getStore('projects', 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// --- Product Templates ---

export async function getAllProductTemplates(): Promise<ProductTemplateRecord[]> {
  const store = await getStore('productTemplates')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as ProductTemplateRecord[])
    request.onerror = () => reject(request.error)
  })
}

export async function getProductTemplateById(id: string): Promise<ProductTemplateRecord | undefined> {
  const store = await getStore('productTemplates')
  return new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result as ProductTemplateRecord | undefined)
    request.onerror = () => reject(request.error)
  })
}

export async function saveProductTemplate(template: ProductTemplateRecord): Promise<void> {
  const store = await getStore('productTemplates', 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.put(template)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteProductTemplate(id: string): Promise<void> {
  const store = await getStore('productTemplates', 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// --- Document Templates ---

export async function getAllDocumentTemplates(): Promise<DocumentTemplateRecord[]> {
  const store = await getStore('documentTemplates')
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as DocumentTemplateRecord[])
    request.onerror = () => reject(request.error)
  })
}

export async function saveDocumentTemplate(template: DocumentTemplateRecord): Promise<void> {
  const store = await getStore('documentTemplates', 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.put(template)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// --- App Settings ---

export async function getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
  const store = await getStore('appSettings')
  return new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => {
      const result = request.result as AppSettingRecord | undefined
      resolve(result ? (result.value as T) : defaultValue)
    }
    request.onerror = () => reject(request.error)
  })
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const store = await getStore('appSettings', 'readwrite')
  return new Promise((resolve, reject) => {
    const request = store.put({ key, value })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// --- Migration / Seed ---

export async function seedBuiltInData(): Promise<void> {
  const templates = await getAllProductTemplates()
  const r7Template: ProductTemplateRecord = {
    id: 'r7-full-groupset',
    name: 'R7 Full Groupset',
    description: 'R7 完整大套，9种组件共11件',
    version: '1.0.0',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components: [
      { id: 'front_brake', seq: 1, nameCN: '自行车用前刹车卡钳', nameEN: 'Front Brake Caliper', hsCode: '87149900', grossWeightKg: 0.16, netWeightKg: 0.16, ratio: 0.0333, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|SENTYEH牌|无品牌', brand: 'SENTYEH' },
      { id: 'rear_brake', seq: 2, nameCN: '自行车用后刹车卡钳', nameEN: 'Rear Brake Caliper', hsCode: '87149900', grossWeightKg: 0.17, netWeightKg: 0.17, ratio: 0.0333, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|SENTYEH牌|无品牌', brand: 'SENTYEH' },
      { id: 'brake_disc', seq: 3, nameCN: '自行车用刹车碟片', nameEN: 'Brake Disc', hsCode: '87149900', grossWeightKg: 0.11, netWeightKg: 0.11, ratio: 0.0444, qtyPerSet: 2, unit: '个', declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌', brand: 'WHALEROAD' },
      { id: 'chainring', seq: 4, nameCN: '自行车用牙盘', nameEN: 'Chainring / Crankset', hsCode: '87149900', grossWeightKg: 0.80, netWeightKg: 0.80, ratio: 0.1222, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌', brand: 'WHALEROAD' },
      { id: 'chain', seq: 5, nameCN: '自行车用链条', nameEN: 'Chain', hsCode: '87149900', grossWeightKg: 0.26, netWeightKg: 0.26, ratio: 0.0444, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|无品牌|无品牌', brand: '无' },
      { id: 'cassette', seq: 6, nameCN: '自行车用飞轮', nameEN: 'Cassette', hsCode: '87149900', grossWeightKg: 0.48, netWeightKg: 0.48, ratio: 0.0778, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌', brand: 'WHALEROAD' },
      { id: 'rear_derailleur', seq: 7, nameCN: '自行车用后变速器', nameEN: 'Rear Derailleur', hsCode: '87149900', grossWeightKg: 0.39, netWeightKg: 0.39, ratio: 0.2444, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌', brand: 'WHALEROAD' },
      { id: 'left_shifter', seq: 8, nameCN: '自行车用变速器左刹把变把', nameEN: 'Left Brake Lever / Shifter', hsCode: '87149900', grossWeightKg: 0.25, netWeightKg: 0.25, ratio: 0.2000, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌', brand: 'WHALEROAD' },
      { id: 'right_shifter', seq: 9, nameCN: '自行车用变速器右刹把变把', nameEN: 'Right Brake Lever / Shifter', hsCode: '87149900', grossWeightKg: 0.25, netWeightKg: 0.25, ratio: 0.2002, qtyPerSet: 1, unit: '个', declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌', brand: 'WHALEROAD' },
    ],
    packageBoxes: [
      { id: 'box_electronic', name: 'Box-Electronic', grossWeightKg: 2.2, volumeM3: 0.011, componentIds: ['left_shifter', 'right_shifter', 'rear_derailleur', 'front_brake', 'rear_brake', 'brake_disc'] },
      { id: 'box_mechanic', name: 'Box-Mechanic', grossWeightKg: 2.3, volumeM3: 0.01, componentIds: ['chainring', 'chain', 'cassette'] },
    ],
    packingSchemes: [
      { id: 'r7_separate', name: '分盒包装（每套2箱）', description: 'Electronic盒和Mechanic盒分别装箱', cartons: [
        { id: 'carton_e', name: 'Electronic Box', boxIds: ['box_electronic'] },
        { id: 'carton_m', name: 'Mechanic Box', boxIds: ['box_mechanic'] },
      ]},
      { id: 'r7_combined', name: '合并包装（每套1箱）', description: 'Electronic盒和Mechanic盒合并装入同一外箱', cartons: [
        { id: 'carton_combo', name: 'Combined Box', boxIds: ['box_electronic', 'box_mechanic'] },
      ]},
    ],
    defaultPackingSchemeId: 'r7_separate',
  }

  const existing = templates.find((t) => t.id === 'r7-full-groupset')
  if (!existing) {
    // First time: create new
    await saveProductTemplate(r7Template)
  } else if (!existing.packingSchemes || existing.packingSchemes.length === 0) {
    // Existing but missing packing data: migrate
    const migrated: ProductTemplateRecord = {
      ...existing,
      packageBoxes: r7Template.packageBoxes,
      packingSchemes: r7Template.packingSchemes,
      defaultPackingSchemeId: r7Template.defaultPackingSchemeId,
      updatedAt: new Date().toISOString(),
    }
    await saveProductTemplate(migrated)
  }
}
