import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  CheckCircle,
  Circle,
  FileText,
  Package,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
} from 'lucide-react'
import type { Declaration, ComponentDetail } from '@/stores/historyStore'

interface DetailDrawerProps {
  declaration: Declaration | null
  isOpen: boolean
  onClose: () => void
  onCopyAsNew: (d: Declaration) => void
}

const statusMap = {
  completed: { label: '已完成', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  processing: { label: '处理中', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  draft: { label: '草稿', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
}

const docTypeMap = [
  { key: 'ci' as keyof Declaration['documents'], label: '商业发票', short: 'CI' },
  { key: 'pl' as keyof Declaration['documents'], label: '装箱单', short: 'PL' },
  { key: 'pc' as keyof Declaration['documents'], label: '采购合同', short: 'PC' },
  { key: 'customs' as keyof Declaration['documents'], label: '报关单', short: ' customs' },
]

function InfoRow({ label, value, mono = false }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#F0F0F0] last:border-0">
      <span className="text-[13px] text-[#8F96A3]">{label}</span>
      <span className={mono ? 'font-mono text-sm text-[#1A1D23] font-medium' : 'text-sm text-[#1A1D23] font-medium'}>
        {value}
      </span>
    </div>
  )
}

export default function DetailDrawer({ declaration, isOpen, onClose, onCopyAsNew }: DetailDrawerProps) {
  const [componentsOpen, setComponentsOpen] = useState(true)

  if (!declaration) return null

  const status = statusMap[declaration.status]
  const formatCurrency = (val: number) => `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white z-50 shadow-[-4px_0_20px_rgba(0,0,0,0.1)] flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E2E5E9] flex-shrink-0">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-[#1A1D23] truncate font-mono">
                    {declaration.invoiceNumber}
                  </h2>
                  <div className="flex items-center gap-2 mt-2">
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
                    <span className="text-xs text-[#8F96A3]">{declaration.date}</span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="ml-4 p-2 rounded-lg hover:bg-[#F8F9FB] text-[#5A6270] transition-colors flex-shrink-0"
                  aria-label="关闭"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* PI Info Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="px-6 py-5 border-b border-[#E2E5E9]"
              >
                <h3 className="text-base font-semibold text-[#1A1D23] mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-[#2563EB]" />
                  PI 基本信息
                </h3>
                <div className="space-y-0.5">
                  <InfoRow label="PI 编号" value={declaration.piNumber} mono />
                  <InfoRow label="客户名称" value={declaration.customerName} />
                  <InfoRow label="日期" value={declaration.date} />
                  <InfoRow label="交易条件" value={declaration.terms || '-'} />
                  <InfoRow label="目的国/地区" value={declaration.destination} />
                  <InfoRow label="R7套数" value={`${declaration.quantity} 套`} />
                  <InfoRow label="组件总件数" value={`${declaration.totalPieces} 件`} />
                  <InfoRow label="单价" value={formatCurrency(declaration.unitPrice || 0)} mono />
                  <InfoRow label="总价" value={formatCurrency(declaration.totalAmount)} mono />
                </div>
              </motion.div>

              {/* Components Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.3 }}
                className="border-b border-[#E2E5E9]"
              >
                <button
                  onClick={() => setComponentsOpen(!componentsOpen)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F8F9FB] transition-colors"
                >
                  <h3 className="text-base font-semibold text-[#1A1D23] flex items-center gap-2">
                    <Package size={16} className="text-[#2563EB]" />
                    组件明细
                  </h3>
                  {componentsOpen ? (
                    <ChevronUp size={18} className="text-[#8F96A3]" />
                  ) : (
                    <ChevronDown size={18} className="text-[#8F96A3]" />
                  )}
                </button>
                <AnimatePresence>
                  {componentsOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-[#E2E5E9]">
                                <th className="text-left py-2 text-xs text-[#8F96A3] font-medium">组件名称</th>
                                <th className="text-right py-2 text-xs text-[#8F96A3] font-medium">数量</th>
                                <th className="text-right py-2 text-xs text-[#8F96A3] font-medium">单价</th>
                                <th className="text-right py-2 text-xs text-[#8F96A3] font-medium">小计</th>
                              </tr>
                            </thead>
                            <tbody>
                              {declaration.components?.map((comp: ComponentDetail, idx: number) => (
                                <tr key={idx} className="border-b border-[#F5F5F0] last:border-0">
                                  <td className="py-2 text-[#1A1D23]">{comp.name}</td>
                                  <td className="py-2 text-right font-mono text-[#5A6270]">{comp.quantity}</td>
                                  <td className="py-2 text-right font-mono text-[#5A6270]">
                                    ${comp.unitPrice.toFixed(2)}
                                  </td>
                                  <td className="py-2 text-right font-mono font-medium text-[#1A1D23]">
                                    ${comp.subtotal.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-[#E2E5E9]">
                                <td className="py-3 text-sm font-semibold text-[#1A1D23]" colSpan={3}>
                                  合计
                                </td>
                                <td className="py-3 text-right font-mono font-semibold text-[#1A1D23]">
                                  {formatCurrency(declaration.totalAmount)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Documents Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.3 }}
                className="px-6 py-5 border-b border-[#E2E5E9]"
              >
                <h3 className="text-base font-semibold text-[#1A1D23] mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-[#2563EB]" />
                  生成文档
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {docTypeMap.map((doc) => {
                    const generated = declaration.documents[doc.key]
                    return (
                      <div
                        key={doc.key}
                        className={[
                          'flex items-center gap-3 p-3 rounded-lg border transition-all',
                          generated
                            ? 'border-[#BBF7D0] bg-[#F0FDF4]'
                            : 'border-[#E2E5E9] bg-[#F8F9FB] opacity-60',
                        ].join(' ')}
                      >
                        <div
                          className={[
                            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                            generated ? 'bg-[#16A34A]/10' : 'bg-[#E2E5E9]',
                          ].join(' ')}
                        >
                          {generated ? (
                            <CheckCircle size={16} className="text-[#16A34A]" />
                          ) : (
                            <Circle size={16} className="text-[#8F96A3]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1A1D23]">{doc.label}</p>
                          <p className="text-xs text-[#8F96A3]">{generated ? '已生成' : '未生成'}</p>
                        </div>
                        {generated && (
                          <button
                            className="p-1.5 rounded-md hover:bg-white/80 text-[#5A6270] transition-colors"
                            aria-label={`下载${doc.label}`}
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Activity Log Section */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.3 }}
                className="px-6 py-5"
              >
                <h3 className="text-base font-semibold text-[#1A1D23] mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-[#2563EB]" />
                  操作记录
                </h3>
                <div className="relative pl-4 border-l-2 border-[#E2E5E9] space-y-4">
                  {declaration.status === 'completed' && (
                    <>
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#16A34A] ring-4 ring-[#F0FDF4]" />
                        <p className="text-sm text-[#1A1D23]">文档生成完成</p>
                        <p className="text-xs text-[#8F96A3] mt-0.5">{declaration.date} 10:40</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-4 ring-[#EFF6FF]" />
                        <p className="text-sm text-[#1A1D23]">价格调整完成</p>
                        <p className="text-xs text-[#8F96A3] mt-0.5">{declaration.date} 10:35</p>
                      </div>
                    </>
                  )}
                  {(declaration.status === 'completed' || declaration.status === 'processing') && (
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#2563EB] ring-4 ring-[#EFF6FF]" />
                      <p className="text-sm text-[#1A1D23]">PI 提取完成</p>
                      <p className="text-xs text-[#8F96A3] mt-0.5">{declaration.date} 10:31</p>
                    </div>
                  )}
                  <div className="relative">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#8F96A3] ring-4 ring-[#F8F9FB]" />
                    <p className="text-sm text-[#1A1D23]">上传 PI</p>
                    <p className="text-xs text-[#8F96A3] mt-0.5">{declaration.date} 10:30</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#E2E5E9] bg-[#FAFBFC] flex-shrink-0 space-y-2">
              <button className="w-full jt-btn-primary flex items-center justify-center gap-2 py-2.5">
                <Download size={16} />
                下载全部文档 (ZIP)
              </button>
              <button
                onClick={() => onCopyAsNew(declaration)}
                className="w-full jt-btn-secondary flex items-center justify-center gap-2 py-2.5"
              >
                <Copy size={16} />
                复制为新报关单
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
