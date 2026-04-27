import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  DollarSign,
  Clock,
  Upload,
  Eye,
  Download,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react'
import Stepper from '@/components/Stepper'
import DataTable from '@/components/DataTable'
import { useHistoryStore } from '@/stores/historyStore'
import type { Declaration } from '@/stores/historyStore'

/* ------------------------------------------------------------------ */
/*  Animation config                                                   */
/* ------------------------------------------------------------------ */
const cardEase = [0.16, 1, 0.3, 1] as [number, number, number, number]

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: cardEase },
  }),
}

/* ------------------------------------------------------------------ */
/*  Animated number counter                                            */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
}) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: cardEase }}
      className="font-mono text-[28px] font-bold tracking-tight"
    >
      {prefix}{value.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
    </motion.span>
  )
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */
function StatusBadge({ status }: { status: Declaration['status'] }) {
  const config = {
    completed: { label: '已完成', className: 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]', icon: null },
    processing: { label: '处理中', className: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]', icon: Loader2 },
    draft: { label: '草稿', className: 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]', icon: null },
  }
  const c = config[status]
  const Icon = c.icon
  return (
    <span className={['inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium', c.className].join(' ')}>
      {Icon && <Icon size={12} className="animate-spin" />}
      {c.label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Stats Card                                                         */
/* ------------------------------------------------------------------ */
interface StatsCardProps {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  borderColor: string
  value: React.ReactNode
  label: string
  trend?: { text: string; positive: boolean }
  action?: { text: string; onClick: () => void; color: string }
  index: number
}

function StatsCard({ icon: Icon, iconColor, iconBg, borderColor, value, label, trend, action, index }: StatsCardProps) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="jt-card p-5 cursor-pointer hover:shadow-md transition-shadow duration-200 border-l-[3px]"
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: iconBg }}>
          <Icon size={24} style={{ color: iconColor }} />
        </div>
        {value}
      </div>
      <p className="text-xs text-[#8F96A3] font-medium tracking-wide mb-1">{label}</p>
      {trend && (
        <div className="flex items-center gap-1">
          {trend.positive ? (
            <ArrowUpRight size={14} className="text-[#16A34A]" />
          ) : (
            <ArrowDownRight size={14} className="text-[#16A34A]" />
          )}
          <span className="text-xs text-[#16A34A] font-medium">{trend.text}</span>
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="text-[13px] font-medium hover:underline mt-1"
          style={{ color: action.color }}
        >
          {action.text}
        </button>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard Page                                                */
/* ------------------------------------------------------------------ */
export default function Dashboard() {
  const navigate = useNavigate()
  const historyStore = useHistoryStore()
  const [selectedRow, setSelectedRow] = useState<string | null>(null)
  const [tipsOpen, setTipsOpen] = useState(true)

  // Get real data from history store
  const declarations = historyStore.filteredDeclarations()
  const statusCounts = historyStore.getStatusCounts()

  const today = new Date()
  const weekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 ${weekday[today.getDay()]}`

  // Calculate stats
  const completedCount = statusCounts.completed
  const totalAmount = declarations
    .filter((d) => d.status === 'completed')
    .reduce((sum, d) => sum + d.totalAmount, 0)
  const processingCount = declarations.filter((d) => d.status === 'processing').length

  const tableColumns = [
    { key: 'invoiceNumber', header: '报关单号', sortable: true },
    { key: 'customerName', header: '客户名称', sortable: true },
    { key: 'piNumber', header: 'PI号', sortable: true },
    {
      key: 'quantity',
      header: '货物数量',
      align: 'center' as const,
      render: (row: Declaration) => `${row.quantity}套R7`,
    },
    {
      key: 'totalAmount',
      header: '总金额',
      align: 'right' as const,
      render: (row: Declaration) => `$${row.totalAmount.toLocaleString()}`,
    },
    {
      key: 'status',
      header: '状态',
      align: 'center' as const,
      render: (row: Declaration) => <StatusBadge status={row.status} />,
    },
    { key: 'date', header: '日期', sortable: true },
    {
      key: 'actions',
      header: '操作',
      align: 'center' as const,
      render: (row: Declaration) => (
        <div className="flex items-center justify-center gap-1">
          {row.status === 'processing' ? (
            <button
              onClick={(e) => { e.stopPropagation(); navigate('/data-config') }}
              className="p-1.5 rounded-md bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
              aria-label="继续"
            >
              <ArrowRight size={14} />
            </button>
          ) : (
            <>
              <button
                onClick={(e) => { e.stopPropagation() }}
                className="jt-btn-ghost p-1.5"
                aria-label="查看"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation() }}
                className="jt-btn-ghost p-1.5"
                aria-label="下载"
              >
                <Download size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ---------- Section 1: Welcome Hero ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: cardEase }}
        className="jt-card p-6 lg:p-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(to right, #EFF6FF, #FFFFFF)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="lg:w-3/5">
            <h1 className="text-2xl font-semibold text-[#1A1D23] mb-2 tracking-tight">
              欢迎使用鲸途报关
            </h1>
            <p className="text-sm text-[#5A6270] mb-3">
              今日已完成 {completedCount} 单报关资料生成，还有 {processingCount} 单待处理
            </p>
            <p className="font-mono text-[13px] text-[#8F96A3]">{dateStr}</p>
          </div>
          <div className="lg:w-2/5 flex flex-col sm:flex-row lg:justify-end items-start sm:items-center gap-3">
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/pi-upload')}
              className="jt-btn-primary flex items-center gap-2 px-7 py-3.5 text-base"
              style={{
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                animation: 'pulse-border 2s infinite ease-in-out',
              }}
            >
              <Upload size={18} />
              上传PI开始报关
            </motion.button>
            <button
              onClick={() => navigate('/history')}
              className="text-sm text-[#2563EB] font-medium hover:underline flex items-center gap-1"
            >
              查看历史记录 <ArrowRight size={14} />
            </button>
          </div>
        </div>
        {/* Subtle glow effect */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#BFDBFE]/30 blur-3xl pointer-events-none" />
      </motion.section>

      {/* ---------- Section 2: Workflow Stepper ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cardEase, delay: 0.1 }}
        className="jt-card p-6"
      >
        <Stepper currentStep={0} />
      </motion.section>

      {/* ---------- Section 3: Statistics Cards ---------- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatsCard
          index={0}
          icon={FileText}
          iconColor="#2563EB"
          iconBg="#EFF6FF"
          borderColor="#2563EB"
          value={<AnimatedNumber value={completedCount} />}
          label="本月报关单数"
          trend={{ text: `+${completedCount > 0 ? 1 : 0} 较上月`, positive: true }}
        />
        <StatsCard
          index={1}
          icon={DollarSign}
          iconColor="#4F46E5"
          iconBg="#EEF2FF"
          borderColor="#4F46E5"
          value={<AnimatedNumber value={totalAmount} prefix="$" />}
          label="本月出口总额 (USD)"
          trend={{ text: '+15% 较上月', positive: true }}
        />
        <StatsCard
          index={2}
          icon={Clock}
          iconColor="#16A34A"
          iconBg="#F0FDF4"
          borderColor="#16A34A"
          value={<AnimatedNumber value={8.5} suffix="分钟" decimals={1} />}
          label="平均单证处理时间"
          trend={{ text: '-2分钟 较上月', positive: true }}
        />
        <StatsCard
          index={3}
          icon={Upload}
          iconColor="#D97706"
          iconBg="#FFFBEB"
          borderColor="#D97706"
          value={<AnimatedNumber value={processingCount} />}
          label="待处理PI"
          action={{ text: '立即处理 →', onClick: () => navigate('/pi-upload'), color: '#D97706' }}
        />
      </section>

      {/* ---------- Section 4: Recent Declarations ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cardEase, delay: 0.35 }}
        className="jt-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#1A1D23]">最近报关记录</h2>
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-[#2563EB] font-medium hover:underline flex items-center gap-1"
          >
            查看全部 <ArrowRight size={14} />
          </button>
        </div>
        <DataTable
          columns={tableColumns}
          data={declarations.slice(0, 5)}
          keyExtractor={(row) => row.id}
          selectedRow={selectedRow}
          onRowSelect={setSelectedRow}
        />
      </motion.section>

      {/* ---------- Section 5: Quick Tips ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cardEase, delay: 0.5 }}
        className="jt-card p-5 border border-[#FDE68A] bg-[#FFFBEB]"
      >
        <button
          onClick={() => setTipsOpen(!tipsOpen)}
          className="flex items-center justify-between w-full"
        >
          <h3 className="text-base font-semibold text-[#D97706] flex items-center gap-2">
            <span>&#x1F4A1;</span> 快速提示
          </h3>
          {tipsOpen ? (
            <ChevronUp size={18} className="text-[#D97706] transition-transform" />
          ) : (
            <ChevronDown size={18} className="text-[#D97706] transition-transform" />
          )}
        </button>
        {tipsOpen && (
          <ul className="mt-3 space-y-2 text-sm text-[#5A6270]">
            <li className="flex items-start gap-2">
              <span className="text-[#D97706] mt-1">&#x2022;</span>
              上传PI后请仔细核对提取的客户名称和PI编号
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D97706] mt-1">&#x2022;</span>
              R7 Full Groupset默认已按标准比例拆解，价格调整时请确保总价一致
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D97706] mt-1">&#x2022;</span>
              报关单生成后请在中国海关系统中进行二次核对
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#D97706] mt-1">&#x2022;</span>
              所有生成的资料仅供报关使用，标注于每份文档底部
            </li>
          </ul>
        )}
      </motion.section>

      {/* Inline keyframes for CTA pulse */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25), 0 0 0 0 rgba(37, 99, 235, 0.3); }
          50% { box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25), 0 0 0 6px rgba(37, 99, 235, 0); }
        }
      `}</style>
    </div>
  )
}
