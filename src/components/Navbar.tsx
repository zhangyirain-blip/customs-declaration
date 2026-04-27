import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Upload,
  Database,
  DollarSign,
  FileText,
  History,
  Settings,
  Package,
  X,
} from 'lucide-react'

const navItems = [
  { label: '工作台', path: '/', icon: LayoutDashboard },
  { label: '上传PI', path: '/pi-upload', icon: Upload },
  { label: '数据配置', path: '/data-config', icon: Database },
  { label: '价格调整', path: '/price-adjust', icon: DollarSign },
  { label: '文档生成', path: '/doc-preview', icon: FileText },
  { label: '历史记录', path: '/history', icon: History },
]

const bottomItems = [
  { label: '产品模板', path: '/product-templates', icon: Package },
  { label: '设置', path: '/settings', icon: Settings },
]

function Logo() {
  return (
    <div className="flex items-center gap-3 h-12 px-2">
      <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#2563EB" d="M42 24c0-2.5-1.5-4.5-3.8-5.4.3-.9.5-1.9.5-2.9 0-5.2-4.2-9.4-9.4-9.4-2.8 0-5.4 1.2-7.1 3.2C20.6 9 18.8 8 16.8 8c-5 0-9 4-9 9 0 .7.1 1.4.3 2-3.5.8-6.1 3.9-6.1 7.6 0 4.3 3.5 7.8 7.8 7.8h24.7c4.3 0 7.8-3.5 7.8-7.8 0-1.6-.5-3.1-1.4-4.3 1.6-.5 2.9-1.9 2.9-3.7z" />
        <ellipse cx="38" cy="24" rx="2.5" ry="2.5" fill="white" />
        <ellipse cx="38" cy="24" rx="1" ry="1" fill="#2563EB" />
      </svg>
      <span className="text-lg font-bold text-[#1A1D23]">鲸途报关</span>
    </div>
  )
}

interface NavbarProps {
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Navbar({ mobileOpen, onMobileClose }: NavbarProps) {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-full w-[260px] flex-col bg-white border-r border-[#E2E5E9] z-40">
        <div className="px-4 pt-6 pb-4">
          <Logo />
        </div>
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  active
                    ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                    : 'text-[#5A6270] font-medium hover:bg-[#F8F9FB]',
                ].join(' ')}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 2} />
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="px-3 py-2 space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                  active
                    ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                    : 'text-[#5A6270] font-medium hover:bg-[#F8F9FB]',
                ].join(' ')}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 2} />
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </div>
        <div className="p-4 border-t border-[#E2E5E9]">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1D23] truncate">当前用户</p>
              <p className="text-xs text-[#8F96A3] truncate">未登录</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40 lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
              className="fixed top-0 left-0 h-full w-[260px] flex-col bg-white border-r border-[#E2E5E9] z-50 lg:hidden flex"
            >
              <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                <Logo />
                <button
                  onClick={onMobileClose}
                  className="p-2 rounded-lg hover:bg-[#F8F9FB] text-[#5A6270]"
                  aria-label="关闭菜单"
                >
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
                {[...navItems, ...bottomItems].map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.path)
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={onMobileClose}
                      className={[
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                        active
                          ? 'bg-[#EFF6FF] text-[#2563EB] font-semibold'
                          : 'text-[#5A6270] font-medium hover:bg-[#F8F9FB]',
                      ].join(' ')}
                    >
                      <Icon size={20} strokeWidth={active ? 2.2 : 2} />
                      <span className="text-sm">{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
              <div className="p-4 border-t border-[#E2E5E9]">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1D23] truncate">当前用户</p>
                    <p className="text-xs text-[#8F96A3] truncate">未登录</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
