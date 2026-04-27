import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import PIUpload from '@/pages/PIUpload'
import DataConfig from '@/pages/DataConfig'
import PriceAdjust from '@/pages/PriceAdjust'
import DocPreview from '@/pages/DocPreview'
import History from '@/pages/History'
import Settings from '@/pages/Settings'
import ProductTemplates from '@/pages/ProductTemplates'
import { useProjectStore } from '@/stores/projectStore'
import { useProductTemplateStore } from '@/stores/productTemplateStore'
import { seedBuiltInData } from '@/db/indexedDB'

function AppInitializer() {
  const initProjects = useProjectStore((s) => s.loadProjects)
  const initTemplates = useProductTemplateStore((s) => s.loadTemplates)

  useEffect(() => {
    seedBuiltInData().then(() => {
      initProjects()
      initTemplates()
    })
  }, [initProjects, initTemplates])

  return null
}

export default function App() {
  return (
    <HashRouter>
      <AppInitializer />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pi-upload" element={<PIUpload />} />
          <Route path="/data-config" element={<DataConfig />} />
          <Route path="/price-adjust" element={<PriceAdjust />} />
          <Route path="/doc-preview" element={<DocPreview />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/product-templates" element={<ProductTemplates />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
