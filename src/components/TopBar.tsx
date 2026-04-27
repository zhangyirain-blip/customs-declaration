import { useState, useEffect } from 'react'
import { Bell, Menu } from 'lucide-react'

interface TopBarProps {
  onMenuToggle: () => void
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#E2E5E9] z-30 flex items-center px-4 lg:hidden',
        scrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.06)]' : '',
      ].join(' ')}
    >
      <button
        onClick={onMenuToggle}
        className="p-2 rounded-lg hover:bg-[#F8F9FB] text-[#5A6270] mr-3"
        aria-label="打开菜单"
      >
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#2563EB" d="M42 24c0-2.5-1.5-4.5-3.8-5.4.3-.9.5-1.9.5-2.9 0-5.2-4.2-9.4-9.4-9.4-2.8 0-5.4 1.2-7.1 3.2C20.6 9 18.8 8 16.8 8c-5 0-9 4-9 9 0 .7.1 1.4.3 2-3.5.8-6.1 3.9-6.1 7.6 0 4.3 3.5 7.8 7.8 7.8h24.7c4.3 0 7.8-3.5 7.8-7.8 0-1.6-.5-3.1-1.4-4.3 1.6-.5 2.9-1.9 2.9-3.7z" />
          <ellipse cx="38" cy="24" rx="2.5" ry="2.5" fill="white" />
          <ellipse cx="38" cy="24" rx="1" ry="1" fill="#2563EB" />
        </svg>
        <span className="text-base font-bold text-[#1A1D23]">鲸途报关</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-lg hover:bg-[#F8F9FB] text-[#5A6270] relative"
          aria-label="通知"
        >
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#DC2626] rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center">
          <span className="text-xs font-semibold text-[#2563EB]">张</span>
        </div>
      </div>
    </header>
  )
}
