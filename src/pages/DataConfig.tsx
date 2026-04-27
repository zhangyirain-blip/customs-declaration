import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Database,
  RotateCcw,
  Pencil,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Save,
  AlertTriangle,
  Info,
  Package,
  Weight,
  Hash,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { usePIStore } from '@/stores/piStore'
import {
  useDatasetStore,
  getTotalPiecesPerSet,
  getTotalGrossWeightPerSet,
  getTotalNetWeightPerSet,
  getTotalRatio,
  type Component,
  type PackingScheme,
  defaultPackageBoxes,
  defaultPackingSchemes,
} from '@/stores/datasetStore'
import { useProjectStore } from '@/stores/projectStore'
import { useProductTemplateStore } from '@/stores/productTemplateStore'

// ─── Chart Colors ────────────────────────────────────────
const CHART_COLORS = [
  '#2563EB', '#4F46E5', '#16A34A', '#D97706',
  '#7C3AED', '#DC2626', '#0891B2', '#BE185D', '#059669',
]

// ─── Animation Variants ──────────────────────────────────
const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
}

const rightPanelVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.2 + i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
}

// ─── Component ───────────────────────────────────────────
export default function DataConfig() {
  const navigate = useNavigate()
  const { uploadedPI } = usePIStore()
  const datasetStore = useDatasetStore()

  const [components, setComponents] = useState<Component[]>([...datasetStore.components])
  const [editMode, setEditMode] = useState(false)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Component>>({})
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)

  // ─── Packing Scheme State ──────────────────────────────
  const projectStore = useProjectStore()
  const templateStore = useProductTemplateStore()
  const currentProject = projectStore.getCurrentProject()
  const activeTemplate = templateStore.getActiveTemplate()

  const availableSchemes = useMemo(() => {
    const fromTemplate = activeTemplate?.packingSchemes
    if (fromTemplate && fromTemplate.length > 0) return fromTemplate as unknown as PackingScheme[]
    return defaultPackingSchemes
  }, [activeTemplate])

  const [packingSchemeId, setPackingSchemeId] = useState<string>(
    currentProject?.packingSchemeId || activeTemplate?.defaultPackingSchemeId || ''
  )
  const [customScheme, setCustomScheme] = useState<PackingScheme | null>(null)
  const [isCustomMode, setIsCustomMode] = useState(false)

  const currentScheme = useMemo(() => {
    if (isCustomMode && customScheme) return customScheme
    return availableSchemes.find((s) => s.id === packingSchemeId)
  }, [availableSchemes, packingSchemeId, isCustomMode, customScheme])

  const packageBoxes = useMemo(() => {
    const fromTemplate = activeTemplate?.packageBoxes
    if (fromTemplate && fromTemplate.length > 0) return fromTemplate as unknown as typeof defaultPackageBoxes
    return defaultPackageBoxes
  }, [activeTemplate])

  // Initialize from project on first load
  useEffect(() => {
    if (currentProject?.packingSchemeId) {
      setPackingSchemeId(currentProject.packingSchemeId)
    } else if (activeTemplate?.defaultPackingSchemeId) {
      setPackingSchemeId(activeTemplate.defaultPackingSchemeId)
    }
    if (currentProject?.customPackingScheme) {
      setCustomScheme(currentProject.customPackingScheme as unknown as PackingScheme)
      setIsCustomMode(true)
    }
  }, [currentProject, activeTemplate])

  const handleSchemeChange = (schemeId: string) => {
    setIsCustomMode(false)
    setPackingSchemeId(schemeId)
    projectStore.setPackingScheme(schemeId)
  }

  const handleStartCustom = () => {
    const base = availableSchemes.find((s) => s.id === packingSchemeId) || availableSchemes[0]
    if (!base) return
    const newCustom: PackingScheme = {
      id: `custom-${Date.now()}`,
      name: '自定义方案',
      description: '用户自定义包装方案',
      cartons: base.cartons.map((c) => ({ ...c })),
    }
    setCustomScheme(newCustom)
    setIsCustomMode(true)
    setPackingSchemeId(newCustom.id)
    projectStore.setPackingScheme(newCustom.id, newCustom as unknown as Record<string, unknown>)
  }

  const handleAddCarton = () => {
    setCustomScheme((prev) => {
      if (!prev) return prev
      const next = {
        ...prev,
        cartons: [
          ...prev.cartons,
          { id: `carton_custom_${prev.cartons.length + 1}`, name: `Custom Carton ${prev.cartons.length + 1}`, boxIds: [] },
        ],
      }
      projectStore.setPackingScheme(next.id, next as unknown as Record<string, unknown>)
      return next
    })
  }

  const handleRemoveCarton = (index: number) => {
    setCustomScheme((prev) => {
      if (!prev) return prev
      const next = { ...prev, cartons: prev.cartons.filter((_, i) => i !== index) }
      projectStore.setPackingScheme(next.id, next as unknown as Record<string, unknown>)
      return next
    })
  }

  const handleToggleBoxInCarton = (cartonIndex: number, boxId: string) => {
    setCustomScheme((prev) => {
      if (!prev) return prev
      const carton = prev.cartons[cartonIndex]
      const hasBox = carton.boxIds.includes(boxId)
      const nextBoxIds = hasBox ? carton.boxIds.filter((id) => id !== boxId) : [...carton.boxIds, boxId]
      const next = {
        ...prev,
        cartons: prev.cartons.map((c, i) => (i === cartonIndex ? { ...c, boxIds: nextBoxIds } : c)),
      }
      projectStore.setPackingScheme(next.id, next as unknown as Record<string, unknown>)
      return next
    })
  }

  // ─── Computed Stats ────────────────────────────────────
  const totalPiecesPerSet = useMemo(
    () => getTotalPiecesPerSet(components),
    [components]
  )
  const totalGrossWeight = useMemo(
    () => getTotalGrossWeightPerSet(components),
    [components]
  )
  const totalNetWeight = useMemo(
    () => getTotalNetWeightPerSet(components),
    [components]
  )
  const totalRatio = useMemo(
    () => getTotalRatio(components),
    [components]
  )
  const ratioMismatch = Math.abs(totalRatio - 1) > 0.001

  // ─── Edit Handlers ─────────────────────────────────────
  const startEditRow = (comp: Component) => {
    setEditingRow(comp.id)
    setEditForm({ ...comp })
  }

  const cancelEditRow = () => {
    setEditingRow(null)
    setEditForm({})
  }

  const saveEditRow = () => {
    if (!editingRow) return
    setComponents((prev) =>
      prev.map((c) => (c.id === editingRow ? { ...c, ...editForm } as Component : c))
    )
    setEditingRow(null)
    setEditForm({})
    toast.success('组件已更新')
  }

  const handleReset = () => {
    const defaults = [...datasetStore.components]
    setComponents(defaults)
    setEditingRow(null)
    toast.success('已重置为默认值')
  }

  const handleSave = () => {
    if (ratioMismatch) {
      toast.error(`比例总和为 ${(totalRatio * 100).toFixed(2)}%，应为 100%`)
      return
    }
    // Persist to datasetStore (in real app, this would persist to backend)
    components.forEach((c) => {
      const original = datasetStore.components.find((dc) => dc.id === c.id)
      if (original) {
        const updates: Partial<Component> = {}
        ;(Object.keys(c) as Array<keyof Component>).forEach((k) => {
          if ((c as any)[k] !== (original as any)[k]) {
            ;(updates as any)[k] = (c as any)[k]
          }
        })
        if (Object.keys(updates).length > 0) {
          datasetStore.updateComponent(c.id, updates)
        }
      }
    })
    toast.success('数据集已保存')
  }

  const handleNext = () => {
    if (ratioMismatch) {
      toast.error('比例总和不为 100%，请调整后再继续')
      return
    }
    navigate('/price-adjust')
  }

  const updateEditForm = (field: keyof Component, value: string | number) => {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  // ─── Table Cell Renderer ───────────────────────────────
  const renderEditableCell = (
    comp: Component,
    field: keyof Component,
    align: 'left' | 'right' | 'center' = 'left',
    type: 'text' | 'number' = 'text',
    step?: string
  ) => {
    const isEditing = editingRow === comp.id
    const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

    if (!isEditing) {
      return (
        <span className={alignClass}>
          {field === 'ratio'
            ? `${(comp[field] * 100).toFixed(2)}%`
            : type === 'number'
              ? (comp[field] as number).toFixed(field === 'grossWeightKg' || field === 'netWeightKg' ? 2 : 0)
              : comp[field]}
        </span>
      )
    }

    const val = editForm[field] ?? comp[field]
    return (
      <input
        type={type}
        step={step}
        value={val}
        onChange={(e) =>
          updateEditForm(
            field,
            type === 'number' ? Number(e.target.value) : e.target.value
          )
        }
        className={[
          'w-full h-8 px-2 text-[13px] border border-[#2563EB] rounded bg-[#EFF6FF] outline-none focus:ring-2 focus:ring-[#BFDBFE]',
          alignClass,
          type === 'number' ? 'font-mono' : '',
        ].join(' ')}
        autoFocus={field === 'nameCN'}
      />
    )
  }

  // ─── Render ────────────────────────────────────────────
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="pb-24"
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-semibold text-[#1A1D23] tracking-tight">数据配置</h1>
          <p className="text-[14px] text-[#5A6270] mt-1">R7 Full Groupset 组件拆解数据集</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-[#EEF2FF] text-[#4F46E5] border border-[#C7D2FE] px-3 py-1 text-[13px] font-medium rounded-full">
            第 2 步 / 共 4 步
          </Badge>
          <button
            onClick={handleReset}
            className="jt-btn-secondary text-[13px] py-2 px-3 flex items-center gap-2"
          >
            <RotateCcw size={14} />
            重置为默认值
          </button>
        </div>
      </div>

      {/* Ratio mismatch warning */}
      <AnimatePresence>
        {ratioMismatch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <AlertTriangle size={18} className="text-[#D97706] shrink-0" />
            <p className="text-[13px] text-[#D97706]">
              各组件比例之和为 <strong>{(totalRatio * 100).toFixed(2)}%</strong>，应为 100%。请调整比例使其总和等于 100%。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Two Column Layout ── */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* ── Left Panel: Data Table ── */}
        <div className="flex-1 xl:w-[65%]">
          <motion.div
            custom={0}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="jt-card p-6"
          >
            {/* Table Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <Database size={20} className="text-[#4F46E5]" />
                <div>
                  <h2 className="text-[18px] font-semibold text-[#1A1D23]">组件明细表</h2>
                  <p className="text-[12px] text-[#8F96A3] mt-0.5">
                    共 {components.length} 种组件，{totalPiecesPerSet} 件/套
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit-mode" className="text-[13px] text-[#5A6270] cursor-pointer">
                    编辑模式
                  </Label>
                  <Switch
                    id="edit-mode"
                    checked={editMode}
                    onCheckedChange={setEditMode}
                  />
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F9FB] hover:bg-[#F8F9FB] border-b border-[#E2E5E9]">
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider text-center w-[48px]">序号</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider min-w-[140px]">商品名称</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider min-w-[140px]">英文名称</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider text-center w-[64px]">配比</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider text-center w-[48px]">单位</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider text-right w-[72px]">毛重(kg)</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider text-right w-[72px]">净重(kg)</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider w-[90px]">HS Code</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider min-w-[160px]">申报要素</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider text-right w-[80px]">比例</TableHead>
                    <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider w-[90px]">品牌</TableHead>
                    {editMode && (
                      <TableHead className="text-[11px] font-medium text-[#8F96A3] uppercase tracking-wider text-center w-[80px]">操作</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {components.map((comp, index) => {
                    const isEditing = editingRow === comp.id
                    const isSelected = selectedRowId === comp.id
                    return (
                      <motion.tr
                        key={comp.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                        className={[
                          'border-b border-[#E2E5E9] transition-all duration-150',
                          isEditing ? 'bg-[#EFF6FF]' : index % 2 === 1 ? 'bg-[#F8F9FB]' : 'bg-white',
                          !isEditing && 'hover:bg-[#F1F5F9]',
                          isSelected && !isEditing ? 'ring-1 ring-inset ring-[#2563EB]' : '',
                        ].join(' ')}
                        onClick={() => {
                          setSelectedRowId(comp.id)
                        }}
                      >
                        <TableCell className="text-center font-mono text-[13px] text-[#5A6270]">
                          {comp.seq}
                        </TableCell>
                        <TableCell className="text-[13px] text-[#1A1D23] min-w-[140px]">
                          {renderEditableCell(comp, 'nameCN')}
                        </TableCell>
                        <TableCell className="text-[13px] text-[#5A6270] italic min-w-[140px]">
                          {renderEditableCell(comp, 'nameEN')}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[13px] text-[#1A1D23]">
                          {renderEditableCell(comp, 'qtyPerSet', 'center', 'number')}
                        </TableCell>
                        <TableCell className="text-center text-[13px] text-[#5A6270]">
                          {comp.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] text-[#1A1D23]">
                          {renderEditableCell(comp, 'grossWeightKg', 'right', 'number', '0.01')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] text-[#1A1D23]">
                          {renderEditableCell(comp, 'netWeightKg', 'right', 'number', '0.01')}
                        </TableCell>
                        <TableCell className="font-mono text-[13px] text-[#2563EB]">
                          {renderEditableCell(comp, 'hsCode')}
                        </TableCell>
                        <TableCell className="text-[12px] text-[#5A6270] max-w-[200px] truncate" title={comp.declarationElements}>
                          {renderEditableCell(comp, 'declarationElements')}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] font-medium text-[#1A1D23]">
                          {renderEditableCell(comp, 'ratio', 'right', 'number', '0.0001')}
                        </TableCell>
                        <TableCell className="text-[13px] text-[#5A6270]">
                          {renderEditableCell(comp, 'brand')}
                        </TableCell>
                        {editMode && (
                          <TableCell className="text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); saveEditRow() }}
                                  className="p-1.5 rounded-md bg-[#16A34A] text-white hover:bg-[#15803D] transition-colors"
                                  aria-label="保存"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); cancelEditRow() }}
                                  className="p-1.5 rounded-md bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors"
                                  aria-label="取消"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); startEditRow(comp) }}
                                className="p-1.5 rounded-md hover:bg-[#EFF6FF] text-[#8F96A3] hover:text-[#2563EB] transition-colors"
                                aria-label="编辑"
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                          </TableCell>
                        )}
                      </motion.tr>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Table footer summary */}
            <div className="mt-4 pt-3 border-t border-[#E2E5E9] flex items-center justify-between text-[12px] text-[#8F96A3]">
              <span>共 {components.length} 条记录</span>
              <span className={ratioMismatch ? 'text-[#D97706] font-medium' : 'text-[#16A34A] font-medium'}>
                比例合计：{(totalRatio * 100).toFixed(2)}% {ratioMismatch ? '(需调整至100%)' : '✓'}
              </span>
            </div>
          </motion.div>

          {/* Packing Scheme Card */}
          {availableSchemes.length > 0 && (
            <motion.div
              custom={1}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="jt-card p-5 mt-5"
            >
              <h3 className="text-[16px] font-semibold text-[#1A1D23] mb-3 flex items-center gap-2">
                <Package size={16} className="text-[#4F46E5]" />
                包装方案
              </h3>

              {/* Scheme Selector */}
              <div className="mb-4">
                <Label className="text-[12px] text-[#8F96A3] mb-1.5 block">选择方案</Label>
                <select
                  value={isCustomMode ? 'custom' : packingSchemeId}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'custom') {
                      handleStartCustom()
                    } else {
                      handleSchemeChange(val)
                    }
                  }}
                  className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[13px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all"
                >
                  {availableSchemes.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  <option value="custom">➕ 自定义方案</option>
                </select>
                {currentScheme && (
                  <p className="text-[12px] text-[#8F96A3] mt-1">{currentScheme.description}</p>
                )}
              </div>

              {/* Carton List */}
              {currentScheme && (
                <div className="space-y-3">
                  {currentScheme.cartons.map((carton, idx) => (
                    <div key={carton.id} className="bg-[#F8F9FB] rounded-lg p-3 border border-[#E2E5E9]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13px] font-medium text-[#1A1D23]">
                          第 {idx + 1} 箱: {carton.name}
                        </span>
                        {isCustomMode && (
                          <button
                            onClick={() => handleRemoveCarton(idx)}
                            className="text-[#DC2626] hover:text-[#B91C1C] text-[11px]"
                          >
                            删除
                          </button>
                        )}
                      </div>
                      <div className="text-[12px] text-[#5A6270] space-y-1">
                        {carton.boxIds.length === 0 ? (
                          <p className="text-[#8F96A3] italic">未分配子盒</p>
                        ) : (
                          carton.boxIds.map((boxId) => {
                            const box = packageBoxes.find((b) => b.id === boxId)
                            if (!box) return null
                            return (
                              <div key={boxId} className="flex items-center justify-between">
                                <span>{box.name}</span>
                                <span className="text-[#8F96A3]">{box.grossWeightKg}KGS / {box.volumeM3}m³</span>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* Custom mode: box assignment toggles */}
                      {isCustomMode && (
                        <div className="mt-2 pt-2 border-t border-[#E2E5E9] flex flex-wrap gap-2">
                          {packageBoxes.map((box) => (
                            <button
                              key={box.id}
                              onClick={() => handleToggleBoxInCarton(idx, box.id)}
                              className={[
                                'px-2 py-1 rounded text-[11px] transition-colors',
                                carton.boxIds.includes(box.id)
                                  ? 'bg-[#2563EB] text-white'
                                  : 'bg-white border border-[#E2E5E9] text-[#5A6270] hover:bg-[#F8F9FB]',
                              ].join(' ')}
                            >
                              {carton.boxIds.includes(box.id) ? '✓ ' : ''}{box.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {isCustomMode && (
                    <button
                      onClick={handleAddCarton}
                      className="w-full py-2 rounded-lg border border-dashed border-[#C7D2FE] text-[#4F46E5] text-[13px] hover:bg-[#EEF2FF] transition-colors"
                    >
                      + 添加外箱
                    </button>
                  )}

                  {/* Summary */}
                  <div className="pt-2 border-t border-[#E2E5E9] text-[12px] text-[#5A6270]">
                    <p>每套 {currentScheme.cartons.length} 个外箱</p>
                    {uploadedPI && (
                      <p className="text-[#4F46E5] font-medium mt-0.5">
                        共 {uploadedPI.quantity} 套 = {currentScheme.cartons.length * uploadedPI.quantity} 个外箱
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* ── Right Panel: Summary + Charts ── */}
        <div className="xl:w-[35%] space-y-5">
          {/* Weight Stats Card */}
          <motion.div
            custom={1}
            variants={rightPanelVariants}
            initial="hidden"
            animate="visible"
            className="jt-card p-5"
          >
            <h3 className="text-[16px] font-semibold text-[#1A1D23] mb-4 flex items-center gap-2">
              <Weight size={16} className="text-[#4F46E5]" />
              单套重量统计
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] text-[#5A6270]">
                  <Package size={14} />
                  每套组件总数
                </div>
                <span className="text-[18px] font-semibold font-mono text-[#1A1D23]">
                  {totalPiecesPerSet} <span className="text-[13px] font-normal text-[#5A6270]">件</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] text-[#5A6270]">
                  <Hash size={14} />
                  组件种类数
                </div>
                <span className="text-[18px] font-semibold font-mono text-[#1A1D23]">
                  {components.length} <span className="text-[13px] font-normal text-[#5A6270]">种</span>
                </span>
              </div>
              <div className="border-t border-[#E2E5E9] pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] text-[#5A6270]">每套总毛重</span>
                  <span className="text-[18px] font-semibold font-mono text-[#1A1D23]">
                    {totalGrossWeight.toFixed(2)} <span className="text-[13px] font-normal text-[#5A6270]">kg</span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#5A6270]">每套总净重</span>
                  <span className="text-[18px] font-semibold font-mono text-[#1A1D23]">
                    {totalNetWeight.toFixed(2)} <span className="text-[13px] font-normal text-[#5A6270]">kg</span>
                  </span>
                </div>
              </div>

              {/* Mini weight bar chart */}
              <div className="pt-2 space-y-1.5">
                {components.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#8F96A3] w-4 text-right shrink-0">{c.seq}</span>
                    <div className="flex-1 h-2 bg-[#F8F9FB] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(c.grossWeightKg * c.qtyPerSet / totalGrossWeight) * 100}%`,
                          backgroundColor: CHART_COLORS[(c.seq - 1) % CHART_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-[#8F96A3] w-10 text-right shrink-0">
                      {(c.grossWeightKg * c.qtyPerSet).toFixed(2)}kg
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Current PI Info Card */}
          <motion.div
            custom={2}
            variants={rightPanelVariants}
            initial="hidden"
            animate="visible"
            className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl p-5"
          >
            <h3 className="text-[16px] font-semibold text-[#4F46E5] mb-3 flex items-center gap-2">
              <Info size={16} />
              当前订单
            </h3>
            {uploadedPI ? (
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-[#5A6270]">PI编号</span>
                  <span className="font-mono font-medium text-[#1A1D23]">{uploadedPI.piNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A6270]">客户</span>
                  <span className="font-medium text-[#1A1D23]">{uploadedPI.clientNameEN || uploadedPI.clientNameCN}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5A6270]">数量</span>
                  <span className="font-mono font-medium text-[#1A1D23]">{uploadedPI.quantity} 套</span>
                </div>
                <div className="border-t border-[#C7D2FE] pt-2 mt-2">
                  <p className="text-[#4F46E5] font-medium">
                    共 {uploadedPI.quantity * totalPiecesPerSet} 件组件待拆解
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[#8F96A3]">暂无PI数据，请先上传PI</p>
            )}
            <button
              onClick={() => navigate('/pi-upload')}
              className="mt-3 text-[13px] text-[#4F46E5] hover:text-[#1D4ED8] font-medium flex items-center gap-1 transition-colors"
            >
              返回修改PI信息
              <ChevronRight size={14} />
            </button>
          </motion.div>

        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[260px] bg-white border-t border-[#E2E5E9] px-6 py-4 z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/pi-upload')}
            className="jt-btn-ghost flex items-center gap-2 text-[#5A6270]"
          >
            <ArrowLeft size={16} />
            上一步
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="jt-btn-secondary flex items-center gap-2"
            >
              <Save size={16} />
              保存配置
            </button>
            <button
              onClick={handleNext}
              disabled={ratioMismatch}
              className="jt-btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:transform-none"
            >
              确认并下一步
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
