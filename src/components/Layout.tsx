import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import TopBar from './TopBar'
import Footer from './Footer'

export default function Layout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] flex bg-[#F8F9FB]">
      <Navbar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <TopBar onMenuToggle={() => setMobileNavOpen(true)} />

      {/* Main content area */}
      <main className="flex-1 lg:ml-[260px] pt-14 lg:pt-0 min-h-[100dvh] flex flex-col">
        <div className="flex-1 px-4 sm:px-6 py-6 lg:py-8">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </div>
        <Footer />
      </main>
    </div>
  )
}
