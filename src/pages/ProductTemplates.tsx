import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  ArrowLeft,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Save,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useProductTemplateStore,
  getPiecesPerSet,
  getGrossWeightPerSet,
  getNetWeightPerSet,
  getRatioSum,
} from '@/stores/productTemplateStore'
import type { ProductTemplateRecord, ProductComponent } from '@/db/indexedDB'

const cardEase = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function ProductTemplates() {
  const navigate = useNavigate()
  const store = useProductTemplateStore()

  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [editComponents, setEditComponents] = useState<ProductComponent[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')

  useEffect(() => {
    store.loadTemplates()
  }, [])

  const handleEdit = (template: ProductTemplateRecord) => {
    setEditingTemplate(template.id)
    setEditComponents(template.components.map((c) => ({ ...c })))
  }

  const handleSaveEdit = async () => {
    if (!editingTemplate) return
    const ratioSum = editComponents.reduce((s, c) => s + c.ratio, 0)
    if (Math.abs(ratioSum - 1) > 0.01) {
      toast.error(`比例总和为 ${(ratioSum * 100).toFixed(2)}%，应为 100%`)
      return
    }
    await store.updateTemplate(editingTemplate, { components: editComponents })
    setEditingTemplate(null)
    toast.success('模板已保存')
  }

  const handleCreate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('请输入模板名称')
      return
    }
    await store.addTemplate({
      name: newTemplateName,
      description: '自定义产品模板',
      version: '1.0.0',
      components: [],
      isBuiltIn: false,
    })
    setNewTemplateName('')
    setShowCreateForm(false)
    toast.success('新模板已创建')
  }

  const handleDelete = async (id: string) => {
    await store.removeTemplate(id)
    toast.success('模板已删除')
  }

  const updateComponentField = (
    index: number,
    field: keyof ProductComponent,
    value: string | number
  ) => {
    setEditComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="pb-24"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-semibold text-[#1A1D23] tracking-tight">产品模板管理</h1>
          <p className="text-[14px] text-[#5A6270] mt-1">管理报关组件拆解的产品模板</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="jt-btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={16} />
            新建模板
          </button>
          <button
            onClick={() => navigate('/data-config')}
            className="jt-btn-secondary flex items-center gap-2 text-sm"
          >
            <ArrowLeft size={16} />
            返回
          </button>
        </div>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="jt-card p-6 mb-6"
          >
            <h3 className="text-[16px] font-semibold text-[#1A1D23] mb-4">新建产品模板</h3>
            <div className="flex items-center gap-3">
              <input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="输入模板名称（如 R5 Full Groupset）"
                className="flex-1 h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all"
              />
              <button onClick={handleCreate} className="jt-btn-primary text-sm">
                创建
              </button>
              <button onClick={() => setShowCreateForm(false)} className="jt-btn-ghost text-sm">
                取消
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template List */}
      <div className="space-y-4">
        {store.templates.map((template) => {
          const isEditing = editingTemplate === template.id
          const pieces = getPiecesPerSet(template)
          const gross = getGrossWeightPerSet(template)
          const net = getNetWeightPerSet(template)
          const ratioSum = getRatioSum(template)
          const isActive = store.activeTemplateId === template.id
          const ratioOk = Math.abs(ratioSum - 1) <= 0.01

          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: cardEase }}
              className={[
                'jt-card overflow-hidden',
                isActive ? 'ring-2 ring-[#2563EB] ring-offset-2' : '',
              ].join(' ')}
            >
              {/* Template Header */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                    <Package size={20} className="text-[#2563EB]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-semibold text-[#1A1D23]">{template.name}</h3>
                      {template.isBuiltIn && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#F8F9FB] text-[#8F96A3] border border-[#E2E5E9]">
                          内置
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
                          当前使用
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#5A6270]">
                      {template.components.length} 种组件 · {pieces} 件/套 · 毛重 {gross.toFixed(2)}kg · 净重 {net.toFixed(2)}kg
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => store.setActiveTemplate(template.id)}
                      className="jt-btn-secondary text-[13px] py-2 px-3"
                    >
                      设为当前
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(template)}
                    className="p-2 rounded-lg hover:bg-[#EFF6FF] text-[#8F96A3] hover:text-[#2563EB] transition-colors"
                  >
                    <Pencil size={16} />
                  </button>
                  {!template.isBuiltIn && (
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-2 rounded-lg hover:bg-[#FEF2F2] text-[#8F96A3] hover:text-[#DC2626] transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Ratio Warning */}
              {!ratioOk && !isEditing && (
                <div className="px-5 pb-3">
                  <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-3 py-2 flex items-center gap-2 text-[13px] text-[#D97706]">
                    <AlertTriangle size={14} />
                    比例总和 {(ratioSum * 100).toFixed(2)}%，需要调整为 100%
                  </div>
                </div>
              )}

              {/* Edit Table */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden border-t border-[#E2E5E9]"
                  >
                    <div className="p-5">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[#F8F9FB] border-b border-[#E2E5E9]">
                              <th className="px-3 py-2 text-[11px] font-medium text-[#8F96A3] text-center w-[40px]">#</th>
                              <th className="px-3 py-2 text-[11px] font-medium text-[#8F96A3] text-left">名称(中)</th>
                              <th className="px-3 py-2 text-[11px] font-medium text-[#8F96A3] text-left">名称(英)</th>
                              <th className="px-3 py-2 text-[11px] font-medium text-[#8F96A3] text-center w-[60px]">配比</th>
                              <th className="px-3 py-2 text-[11px] font-medium text-[#8F96A3] text-right w-[80px]">毛重(kg)</th>
                              <th className="px-3 py-2 text-[11px] font-medium text-[#8F96A3] text-right w-[80px]">比例</th>
                              <th className="px-3 py-2 text-[11px] font-medium text-[#8F96A3] text-left w-[100px]">HS Code</th>
                            </tr>
                          </thead>
                          <tbody>
                            {editComponents.map((c, idx) => (
                              <tr key={idx} className="border-b border-[#E2E5E9]">
                                <td className="px-3 py-2 text-center text-[#8F96A3] text-xs">{idx + 1}</td>
                                <td className="px-3 py-2">
                                  <input
                                    value={c.nameCN}
                                    onChange={(e) => updateComponentField(idx, 'nameCN', e.target.value)}
                                    className="w-full h-7 px-2 text-[13px] border border-[#E2E5E9] rounded focus:border-[#2563EB] outline-none"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={c.nameEN}
                                    onChange={(e) => updateComponentField(idx, 'nameEN', e.target.value)}
                                    className="w-full h-7 px-2 text-[13px] border border-[#E2E5E9] rounded focus:border-[#2563EB] outline-none"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={c.qtyPerSet}
                                    onChange={(e) => updateComponentField(idx, 'qtyPerSet', Number(e.target.value))}
                                    className="w-full h-7 px-2 text-[13px] border border-[#E2E5E9] rounded focus:border-[#2563EB] outline-none text-center font-mono"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step={0.01}
                                    value={c.grossWeightKg}
                                    onChange={(e) => updateComponentField(idx, 'grossWeightKg', Number(e.target.value))}
                                    className="w-full h-7 px-2 text-[13px] border border-[#E2E5E9] rounded focus:border-[#2563EB] outline-none text-right font-mono"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    step={0.0001}
                                    value={c.ratio}
                                    onChange={(e) => updateComponentField(idx, 'ratio', Number(e.target.value))}
                                    className="w-full h-7 px-2 text-[13px] border border-[#E2E5E9] rounded focus:border-[#2563EB] outline-none text-right font-mono"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    value={c.hsCode}
                                    onChange={(e) => updateComponentField(idx, 'hsCode', e.target.value)}
                                    className="w-full h-7 px-2 text-[13px] border border-[#E2E5E9] rounded focus:border-[#2563EB] outline-none font-mono"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className={ratioOk ? 'text-[13px] text-[#16A34A] font-medium' : 'text-[13px] text-[#D97706] font-medium'}>
                          比例合计: {(editComponents.reduce((s, c) => s + c.ratio, 0) * 100).toFixed(2)}%
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingTemplate(null)}
                            className="jt-btn-ghost text-[13px] flex items-center gap-1"
                          >
                            <X size={14} />
                            取消
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            disabled={!ratioOk}
                            className="jt-btn-primary text-[13px] flex items-center gap-1 disabled:opacity-50"
                          >
                            <Save size={14} />
                            保存
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
