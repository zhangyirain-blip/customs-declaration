import { create } from 'zustand'

export interface PackageBox {
  id: string
  name: string
  grossWeightKg: number // 整盒毛重(kg)
  volumeM3: number      // 整盒体积(m³)
  componentIds: string[]
}

/** 外箱配置：每个外箱包含哪些子盒 */
export interface CartonConfig {
  id: string
  name: string        // 如 "Carton 1"
  boxIds: string[]    // 包含哪些 PackageBox 的 id
}

/** 包装方案：定义一套产品如何分装到各个外箱 */
export interface PackingScheme {
  id: string
  name: string
  description: string
  cartons: CartonConfig[]
}

export interface Component {
  id: string
  seq: number
  nameCN: string
  nameEN: string
  hsCode: string
  grossWeightKg: number // 单件毛重(kg/件)
  netWeightKg: number   // 单件净重(kg/件)
  ratio: number         // 默认单价比例(小数，如0.0333)
  qtyPerSet: number     // 每套配比数量
  unit: string
  declarationElements: string
  brand: string
  packageBoxId?: string  // 所属包装子盒
}

interface DatasetStore {
  components: Component[]
  updateComponent: (id: string, updates: Partial<Component>) => void
  resetToDefaults: () => void
}

// R7 Full Groupset: 9种组件，共11件/套
// 所有重量为单件重量；比例之和 ≈ 100% (因四舍五入最后一件补足)
export const defaultComponents: Component[] = [
  {
    id: 'front_brake',
    seq: 1,
    nameCN: '自行车用前刹车卡钳',
    nameEN: 'Front Brake Caliper',
    hsCode: '87149900',
    grossWeightKg: 0.16,
    netWeightKg: 0.16,
    ratio: 0.0333,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|SENTYEH牌|无品牌',
    brand: 'SENTYEH',
    packageBoxId: 'box_electronic',
  },
  {
    id: 'rear_brake',
    seq: 2,
    nameCN: '自行车用后刹车卡钳',
    nameEN: 'Rear Brake Caliper',
    hsCode: '87149900',
    grossWeightKg: 0.17,
    netWeightKg: 0.17,
    ratio: 0.0333,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|SENTYEH牌|无品牌',
    brand: 'SENTYEH',
    packageBoxId: 'box_electronic',
  },
  {
    id: 'brake_disc',
    seq: 3,
    nameCN: '自行车用刹车碟片',
    nameEN: 'Brake Disc',
    hsCode: '87149900',
    grossWeightKg: 0.11, // 单件0.11kg，一套2件
    netWeightKg: 0.11,
    ratio: 0.0444,
    qtyPerSet: 2,
    unit: '个',
    declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌',
    brand: 'WHALEROAD',
    packageBoxId: 'box_electronic',
  },
  {
    id: 'chainring',
    seq: 4,
    nameCN: '自行车用牙盘',
    nameEN: 'Chainring / Crankset',
    hsCode: '87149900',
    grossWeightKg: 0.80,
    netWeightKg: 0.80,
    ratio: 0.1222,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌',
    brand: 'WHALEROAD',
    packageBoxId: 'box_mechanic',
  },
  {
    id: 'chain',
    seq: 5,
    nameCN: '自行车用链条',
    nameEN: 'Chain',
    hsCode: '87149900',
    grossWeightKg: 0.26,
    netWeightKg: 0.26,
    ratio: 0.0444,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|无品牌|无品牌',
    brand: '无',
    packageBoxId: 'box_mechanic',
  },
  {
    id: 'cassette',
    seq: 6,
    nameCN: '自行车用飞轮',
    nameEN: 'Cassette',
    hsCode: '87149900',
    grossWeightKg: 0.48,
    netWeightKg: 0.48,
    ratio: 0.0778,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌',
    brand: 'WHALEROAD',
    packageBoxId: 'box_mechanic',
  },
  {
    id: 'rear_derailleur',
    seq: 7,
    nameCN: '自行车用后变速器',
    nameEN: 'Rear Derailleur',
    hsCode: '87149900',
    grossWeightKg: 0.39,
    netWeightKg: 0.39,
    ratio: 0.2444,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌',
    brand: 'WHALEROAD',
    packageBoxId: 'box_electronic',
  },
  {
    id: 'left_shifter',
    seq: 8,
    nameCN: '自行车用变速器左刹把变把',
    nameEN: 'Left Brake Lever / Shifter',
    hsCode: '87149900',
    grossWeightKg: 0.25,
    netWeightKg: 0.25,
    ratio: 0.2000,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌',
    brand: 'WHALEROAD',
    packageBoxId: 'box_electronic',
  },
  {
    id: 'right_shifter',
    seq: 9,
    nameCN: '自行车用变速器右刹把变把',
    nameEN: 'Right Brake Lever / Shifter',
    hsCode: '87149900',
    grossWeightKg: 0.25,
    netWeightKg: 0.25,
    ratio: 0.2002,
    qtyPerSet: 1,
    unit: '个',
    declarationElements: '1|0|通用于自行车|WHALEROAD牌|无品牌',
    brand: 'WHALEROAD',
    packageBoxId: 'box_electronic',
  },
]

// 计算每套总件数
export function getTotalPiecesPerSet(components: Component[]): number {
  return components.reduce((sum, c) => sum + c.qtyPerSet, 0)
}

// 计算每套总毛重
export function getTotalGrossWeightPerSet(components: Component[]): number {
  return components.reduce((sum, c) => sum + c.grossWeightKg * c.qtyPerSet, 0)
}

// 计算每套总净重
export function getTotalNetWeightPerSet(components: Component[]): number {
  return components.reduce((sum, c) => sum + c.netWeightKg * c.qtyPerSet, 0)
}

// R7 默认包装方案：每套2个内盒
export const defaultPackageBoxes: PackageBox[] = [
  {
    id: 'box_electronic',
    name: 'Box-Electronic',
    grossWeightKg: 2.2,
    volumeM3: 0.011,
    componentIds: ['left_shifter', 'right_shifter', 'rear_derailleur', 'front_brake', 'rear_brake', 'brake_disc'],
  },
  {
    id: 'box_mechanic',
    name: 'Box-Mechanic',
    grossWeightKg: 2.3,
    volumeM3: 0.01,
    componentIds: ['chainring', 'chain', 'cassette'],
  },
]

// R7 预设包装方案
export const defaultPackingSchemes: PackingScheme[] = [
  {
    id: 'r7_separate',
    name: '分盒包装（每套2箱）',
    description: 'Electronic盒和Mechanic盒分别装箱',
    cartons: [
      { id: 'carton_e', name: 'Electronic Box', boxIds: ['box_electronic'] },
      { id: 'carton_m', name: 'Mechanic Box', boxIds: ['box_mechanic'] },
    ],
  },
  {
    id: 'r7_combined',
    name: '合并包装（每套1箱）',
    description: 'Electronic盒和Mechanic盒合并装入同一外箱',
    cartons: [
      { id: 'carton_combo', name: 'Combined Box', boxIds: ['box_electronic', 'box_mechanic'] },
    ],
  },
]

/** 根据包装方案和数量生成 carton 明细 */
export function generateCartons(
  quantity: number,
  scheme: PackingScheme,
  packageBoxes: PackageBox[],
  components: Component[]
): Array<{
  id: string
  boxName: string
  grossWeightKg: number
  volumeM3: number
  items: Array<{
    componentId: string
    nameCN: string
    nameEN: string
    qty: number
    netWeightKg: number
  }>
}> {
  const result: ReturnType<typeof generateCartons> = []
  for (let setIdx = 0; setIdx < quantity; setIdx++) {
    scheme.cartons.forEach((cartonCfg) => {
      const cartonItems = cartonCfg.boxIds.flatMap((boxId) => {
        const box = packageBoxes.find((b) => b.id === boxId)
        if (!box) return []
        return box.componentIds.map((cid) => {
          const c = components.find((c) => c.id === cid)
          if (!c) return null
          return {
            componentId: cid,
            nameCN: c.nameCN,
            nameEN: c.nameEN,
            qty: c.qtyPerSet,
            netWeightKg: c.netWeightKg,
          }
        }).filter(Boolean) as NonNullable<ReturnType<typeof generateCartons>>[number]['items'][number][]
      })
      const grossWeightKg = cartonCfg.boxIds.reduce((sum, boxId) => {
        const box = packageBoxes.find((b) => b.id === boxId)
        return sum + (box?.grossWeightKg || 0)
      }, 0)
      const volumeM3 = cartonCfg.boxIds.reduce((sum, boxId) => {
        const box = packageBoxes.find((b) => b.id === boxId)
        return sum + (box?.volumeM3 || 0)
      }, 0)
      result.push({
        id: `${cartonCfg.id}_set${setIdx + 1}`,
        boxName: cartonCfg.name,
        grossWeightKg,
        volumeM3,
        items: cartonItems,
      })
    })
  }
  return result
}

// 计算比例总和(应为≈100%)
export function getTotalRatio(components: Component[]): number {
  return components.reduce((sum, c) => sum + c.ratio, 0)
}

export const useDatasetStore = create<DatasetStore>((set) => ({
  components: defaultComponents,

  updateComponent: (id, updates) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  resetToDefaults: () =>
    set(() => ({
      components: defaultComponents.map((c) => ({ ...c })),
    })),
}))
