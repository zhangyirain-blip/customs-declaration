import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  KeyRound,
  Brain,
  Save,
  Check,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  Database,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { getSetting, setSetting } from '@/db/indexedDB'
import type { LLMConfig } from '@/services/llmParser'

const cardEase = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function SettingsPage() {
  const navigate = useNavigate()

  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'moonshot',
    apiKey: '',
    model: 'moonshot-v1-8k',
  })
  const [showKey, setShowKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [dbStats, setDbStats] = useState({ projects: 0, templates: 0 })

  useEffect(() => {
    getSetting<LLMConfig>('llmConfig').then((cfg) => {
      if (cfg) setLlmConfig(cfg)
    })
    // Count localStorage items for stats
    try {
      const projects = JSON.parse(localStorage.getItem('jingtu_projects_backup') || '[]')
      setDbStats({ projects: projects.length, templates: 1 })
    } catch {
      // ignore
    }
  }, [])

  const handleSaveLLM = async () => {
    setIsSaving(true)
    await setSetting('llmConfig', llmConfig)
    setIsSaving(false)
    toast.success('LLM 配置已保存')
  }

  const handleExportData = () => {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      llmConfig,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jingtu-settings-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('配置已导出')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="max-w-[800px] mx-auto pb-24"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[24px] font-semibold text-[#1A1D23] tracking-tight">设置</h1>
          <p className="text-[14px] text-[#5A6270] mt-1">管理 API 配置、数据备份与系统偏好</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="jt-btn-ghost flex items-center gap-2 text-[#5A6270]"
        >
          <ArrowLeft size={16} />
          返回工作台
        </button>
      </div>

      {/* LLM Configuration */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cardEase, delay: 0.05 }}
        className="jt-card p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <Brain size={20} className="text-[#7C3AED]" />
          <div>
            <h2 className="text-[18px] font-semibold text-[#1A1D23]">LLM 智能解析配置</h2>
            <p className="text-[13px] text-[#8F96A3]">配置大模型 API，实现 PI 智能识别</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">服务提供商</label>
              <select
                value={llmConfig.provider}
                onChange={(e) => setLlmConfig((prev) => ({ ...prev, provider: e.target.value as LLMConfig['provider'] }))}
                className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all"
              >
                <option value="moonshot">Moonshot (Kimi)</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="custom">自定义</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">模型名称</label>
              <input
                value={llmConfig.model}
                onChange={(e) => setLlmConfig((prev) => ({ ...prev, model: e.target.value }))}
                className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all"
                placeholder="moonshot-v1-8k"
              />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">API Key</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8F96A3]" />
              <input
                type={showKey ? 'text' : 'password'}
                value={llmConfig.apiKey}
                onChange={(e) => setLlmConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                className="w-full pl-9 pr-10 py-2.5 border border-[#E2E5E9] rounded-lg text-sm text-[#1A1D23] placeholder:text-[#8F96A3] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BFDBFE] transition-all"
                placeholder="sk-xxxxxxxxxxxxxxxx"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8F96A3] hover:text-[#5A6270]"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[12px] text-[#8F96A3] mt-1">API Key 仅存储在本地浏览器中，不会上传到任何服务器</p>
          </div>

          {llmConfig.provider === 'custom' && (
            <div>
              <label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">自定义 Base URL</label>
              <input
                value={llmConfig.baseUrl || ''}
                onChange={(e) => setLlmConfig((prev) => ({ ...prev, baseUrl: e.target.value }))}
                className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all"
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveLLM}
              disabled={isSaving}
              className="jt-btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Check size={16} /> : <Save size={16} />}
              {isSaving ? '已保存' : '保存配置'}
            </button>
          </div>
        </div>
      </motion.section>

      {/* Data Management */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cardEase, delay: 0.1 }}
        className="jt-card p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <Database size={20} className="text-[#0891B2]" />
          <div>
            <h2 className="text-[18px] font-semibold text-[#1A1D23]">数据管理</h2>
            <p className="text-[13px] text-[#8F96A3]">备份与恢复本地数据</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#F8F9FB] rounded-lg p-4 border border-[#E2E5E9]">
            <div className="text-[24px] font-semibold font-mono text-[#1A1D23]">{dbStats.projects}</div>
            <div className="text-[13px] text-[#5A6270]">报关项目</div>
          </div>
          <div className="bg-[#F8F9FB] rounded-lg p-4 border border-[#E2E5E9]">
            <div className="text-[24px] font-semibold font-mono text-[#1A1D23]">{dbStats.templates}</div>
            <div className="text-[13px] text-[#5A6270]">产品模板</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleExportData}
            className="jt-btn-secondary flex items-center gap-2 text-sm"
          >
            <Download size={16} />
            导出配置备份
          </button>
        </div>

        <div className="mt-4 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-[#D97706] shrink-0" />
          <p className="text-[13px] text-[#D97706]">
            所有数据仅存储在浏览器本地（IndexedDB）。清除浏览器数据将导致数据丢失，请定期导出备份。
          </p>
        </div>
      </motion.section>
    </motion.div>
  )
}
