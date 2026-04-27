import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import * as pdfjsLib from 'pdfjs-dist'
import {
  Upload, FileSpreadsheet, FileType, X, Check, AlertTriangle,
  ArrowRight, Save, Loader2, FileText, Brain, Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useProjectStore, type PIData, defaultPIData } from '@/stores/projectStore'
import { useProductTemplateStore, getGrossWeightPerSet, getNetWeightPerSet, getPiecesPerSet } from '@/stores/productTemplateStore'
import { usePIStore } from '@/stores/piStore'
import { usePriceStore } from '@/stores/priceStore'
import { parsePIWithLLM } from '@/services/llmParser'
import { pluginRegistry } from '@/plugins/registry'

const pageVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
}

// ─── PDF.js worker setup ─────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

// ─── PDF Text Extractor ──────────────────────────────────
async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      let pageText = ''
      for (const item of content.items as Array<{ str: string; hasEOL: boolean }>) {
        pageText += item.str + (item.hasEOL ? '\n' : ' ')
      }
      text += pageText + '\n\n'
    }
    return text
  } catch (err) {
    console.error('PDF extract error:', err)
    return ''
  }
}

// Fix PDF text splitting in company names like "KONJULBAKI- T R ADELAB"
function fixSplitCompanyName(name: string): string {
  // First, split hyphen-glued uppercase letters: "KONJULBAKI-T" -> "KONJULBAKI- T"
  const expanded = name.replace(/([A-Z])-(?=[A-Z])/g, '$1- ')
  const words = expanded.trim().split(/\s+/).filter(Boolean)
  // If there are 2+ short uppercase fragments (1-2 chars), it's likely PDF-split
  const shortUpperCount = words.filter((w) => /^[A-Z]{1,2}$/.test(w)).length
  if (shortUpperCount >= 2) {
    return words.join('')
  }
  return name
}

// ─── Excel to Text ───────────────────────────────────────
function excelToText(data: ArrayBuffer): string {
  try {
    const workbook = XLSX.read(data, { type: 'array' })
    let text = ''
    workbook.SheetNames.forEach((name) => {
      text += `\n--- Sheet: ${name} ---\n`
      text += XLSX.utils.sheet_to_csv(workbook.Sheets[name])
    })
    return text
  } catch { return '' }
}

function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Normalize extracted date to YYYY-MM-DD ──────────────
function normalizeDate(raw: string): string | undefined {
  // 2026-04-02 | 2026/04/02 | 2026.04.02 | 2026年04月02日
  const m1 = raw.match(/(\d{4})\s*[-/\.年]\s*(\d{1,2})\s*[-/\.月]\s*(\d{1,2})\s*日?/)
  if (m1) return `${m1[1]}-${m1[2].padStart(2, '0')}-${m1[3].padStart(2, '0')}`
  // 02-Apr-2026 | 02 Apr 2026
  const m2 = raw.match(/(\d{1,2})\s*[-/\.]?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*[-/\.]?\s*(\d{4})/i)
  if (m2) {
    const map: Record<string, string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
    return `${m2[3]}-${map[m2[2].toLowerCase()]}-${m2[1].padStart(2, '0')}`
  }
  // Apr 02, 2026
  const m3 = raw.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{1,2})[,\s]+(\d{4})/i)
  if (m3) {
    const map: Record<string, string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
    return `${m3[3]}-${map[m3[1].toLowerCase()]}-${m3[2].padStart(2, '0')}`
  }
  return undefined
}

// ─── Universal Text Parser (Excel CSV / PDF text) ────────
function parsePIText(rawText: string): Partial<PIData> | null {
  const result: Partial<PIData> = {}
  const text = rawText.replace(/\r\n?/g, '\n')
  const rawLines = text.split('\n')
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0)
  const fullText = lines.join(' ')

  // ── PI Number ─────────────────────────────────────────
  const piPatterns = [
    /(?:PI\s*No|Proforma\s*Invoice)[\.:\s#]*(PI[-]?\d{6}[-]?\d{4})/i,
    /(?:PI|Proforma\s*Invoice)[\s#:：]*(PI[-]?\d{8}[-]?\d{4})/i,
    /(?:Invoice\s*No|PI\s*No|PI\s*Number)[\.:\s#]*([A-Z0-9][-A-Z0-9]{3,20})/i,
    /(PI[-]\d{2,6}[-]\d{2,6})/i,
  ]
  for (const p of piPatterns) {
    const m = fullText.match(p)
    if (m) { result.piNumber = m[1].toUpperCase(); break }
  }

  // ── Date ──────────────────────────────────────────────
  const datePatterns = [
    /(?:Date|PI\s*Date)[\.:\s]*([\d\-/.年月]+\d{1,2}[日]?)/i,
    /(?:Date)[\.:\s]*(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[,\s]+\d{4})/i,
    /(?:Date)[\.:\s]*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,\s]+\d{4})/i,
  ]
  for (const p of datePatterns) {
    const m = fullText.match(p)
    if (m) {
      const d = normalizeDate(m[1])
      if (d) { result.date = d; break }
    }
  }
  if (!result.date) {
    const fallback = fullText.match(/(\d{4}\s*[-/年.]\s*\d{1,2}\s*[-/月.]\s*\d{1,2})/)
    if (fallback) {
      const d = normalizeDate(fallback[1])
      if (d) result.date = d
    }
  }

  // ── Buyer Name (look for BILL TO / Ship To / Sold To) ─
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^(BILL\s*TO|SHIP\s*TO|SOLD\s*TO|CONSIGNEE|BUYER)[\s:：]*$/i.test(line)) {
      if (i + 1 < lines.length) {
        let name = lines[i + 1].replace(/\s{2,}/g, ' ').trim()
        // If name ends with hyphen or is very short, it's likely split across lines — merge next line
        if (name.length > 0 && (name.endsWith('-') || name.length < 5)) {
          if (i + 2 < lines.length) {
            const nextLine = lines[i + 2].replace(/\s{2,}/g, ' ').trim()
            if (nextLine.length > 0 && !/Bank|Swift|Account|Payment|Grand\s*Total|Authorized|Signature/i.test(nextLine)) {
              name = (name + ' ' + nextLine).replace(/\s{2,}/g, ' ').trim()
            }
          }
        }
        // Exclude bank names and other false positives
        if (name.length > 2 && !/^\d+$/.test(name) && !/Bank|Swift|Account|Payment|Trade|Term/i.test(name)) {
          result.clientNameEN = fixSplitCompanyName(name)
          break
        }
      }
    }
  }
  // Fallback regex for "To:" style
  if (!result.clientNameEN) {
    const toMatch = fullText.match(/(?:To|Messrs|Buyer)[\.:\s]+([A-Z][A-Za-z0-9\s\-]+?)(?=\s*(?:Payment|Trade|Address|Bank|Tel|Email|Date|$))/i)
    if (toMatch) result.clientNameEN = toMatch[1].trim()
  }

  // ── Buyer Address ─────────────────────────────────────
  // Only match address that is NOT a bank address
  const addrMatch = fullText.match(/(?:Address|地址)[\.:\s]+([A-Za-z0-9\s,\-.]{5,60})/i)
  if (addrMatch) {
    const addr = addrMatch[1].trim()
    if (!/Bank|Swift|Beneficiary| Merchant/i.test(addr)) {
      result.clientAddressEN = addr
    }
  }

  // ── Country ───────────────────────────────────────────
  const countryList = '韩国|德国|日本|美国|意大利|法国|新加坡|英国|荷兰|西班牙|泰国|越南|印度|马来西亚|印度尼西亚|澳大利亚|加拿大|墨西哥|巴西|俄罗斯|波兰|土耳其|阿联酋|瑞典|挪威|丹麦|芬兰|瑞士|奥地利|比利时|葡萄牙|希腊|爱尔兰|捷克|匈牙利|罗马尼亚|乌克兰|以色列|南非|沙特阿拉伯|卡塔尔|科威特|阿曼|巴林|埃及|摩洛哥|突尼斯|阿尔及利亚|尼日利亚|肯尼亚|加纳|埃塞俄比亚|坦桑尼亚|乌干达|赞比亚|津巴布韦|博茨瓦纳|纳米比亚|莫桑比克|马达加斯加|毛里求斯|塞舌尔|马尔代夫|斯里兰卡|孟加拉国|巴基斯坦|尼泊尔|缅甸|柬埔寨|老挝|菲律宾|文莱|新西兰|斐济|巴布亚新几内亚|萨摩亚|汤加|瓦努阿图|所罗门群岛|帕劳|马绍尔群岛|密克罗尼西亚|瑙鲁|基里巴斯|图瓦卢|托克劳|纽埃|库克群岛|法属波利尼西亚|瓦利斯和富图纳|新喀里多尼亚|关岛|北马里亚纳群岛|美属萨摩亚|中国香港|中国澳门|中国台湾'
  const cnMatch = fullText.match(new RegExp(`(?:Destination|Country|To|目的国|贸易国|运抵国)[\\.:\\s]*(${countryList})`, 'i'))
  if (cnMatch) {
    result.destinationCountry = cnMatch[1]
    result.tradeCountry = cnMatch[1]
  }
  // Also detect buyer address country as trade country
  if (!result.tradeCountry && result.clientAddressEN) {
    const addrCountry = result.clientAddressEN.match(new RegExp(`(${countryList})`, 'i'))
    if (addrCountry) result.tradeCountry = addrCountry[1]
  }

  // ── Port (from Trade Term) ────────────────────────────
  const termPortMatch = fullText.match(/(?:Trade\s*Term|Terms?)[\.:\s]*(EXW|FOB|CIF|CFR|CPT|CIP|DAP|DDP|DDU|FCA|FAS)\s+([A-Za-z]{2,30})/i)
  if (termPortMatch) {
    result.tradeTerms = termPortMatch[1].toUpperCase()
    result.entryPort = termPortMatch[2].trim()
  } else {
    const termsOnly = fullText.match(/\b(EXW|FOB|CIF|CFR|CPT|CIP|DAP|DDP|DDU|FCA|FAS)\b/i)
    if (termsOnly) result.tradeTerms = termsOnly[1].toUpperCase()
  }

  // ── Product Name ──────────────────────────────────────
  const descMatch = fullText.match(/(?:Description|Item|Product)[\.:\s]+(R7\s+Full\s+Groupset[a-z\s]*)/i)
  if (descMatch) {
    result.productName = descMatch[1].trim()
  } else {
    const descMatch2 = fullText.match(/(R7\s+Full\s+Groupset)/i)
    if (descMatch2) result.productName = descMatch2[1].trim()
  }

  // ── Quantity ──────────────────────────────────────────
  // Strategy 1: Scan table data rows for numbers > 1 (skip Item # = 1)
  for (let i = 0; i < lines.length; i++) {
    if (/Item\s*#|SKU|Description|Qty|Unit\s*Price|Amount/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const line = lines[j]
        // Skip lines that are clearly not data (headers, banking details)
        if (/Bank|Swift|Beneficiary|Payment|Grand\s*Total|Authorized|Signature/i.test(line)) continue
        // Find standalone numbers
        const nums = line.match(/(?:^|\s)(\d{1,4})(?:\s|$)/g)
        if (nums) {
          for (const n of nums) {
            const val = parseInt(n.trim(), 10)
            // Item # is usually 1, Qty is usually > 1
            if (val > 1 && val < 10000) { result.quantity = val; break }
          }
        }
        if (result.quantity) break
      }
      break
    }
  }

  // Strategy 2: Qty keyword followed by number (fallback)
  if (!result.quantity) {
    const qtyMatch = fullText.match(/(?:Qty|Quantity)[\s\S]{0,80}?(\d{1,4})(?!\d)/i)
    if (qtyMatch) result.quantity = parseInt(qtyMatch[1], 10)
  }

  // ── Unit Price ────────────────────────────────────────
  // Strategy 1: Unit Price keyword followed by amount
  const upMatch = fullText.match(/(?:Unit\s*Price)[\s\S]{0,80}?\$?([\d,]+\.\d{2})/i)
  if (upMatch) result.unitPrice = parseFloat(upMatch[1].replace(/,/g, ''))

  // ── Total Amount ──────────────────────────────────────
  // Strategy 1: Explicit total markers (most reliable)
  const totalMarkers = [
    /(?:Grand\s*Total|Total\s*Amount|Total\s*Due|Amount\s*Due|Net\s*Total)[\s\S]{0,60}?\$?([\d,]+\.\d{2})/i,
    /(?:Total)[\s:：]*\$?([\d,]+\.\d{2})(?!.*\d{1,4}\.\d{2})/i, // only match if it's the last amount
  ]
  for (const p of totalMarkers) {
    const m = fullText.match(p)
    if (m) { result.totalAmount = parseFloat(m[1].replace(/,/g, '')); break }
  }

  // Strategy 2: Extract all dollar amounts and infer
  const allAmounts: number[] = []
  let m: RegExpExecArray | null
  const amountRe = /\$([\d,]+\.\d{2})/g
  while ((m = amountRe.exec(fullText)) !== null) {
    allAmounts.push(parseFloat(m[1].replace(/,/g, '')))
  }

  if (allAmounts.length >= 2) {
    const sorted = [...allAmounts].sort((a, b) => a - b)
    if (!result.unitPrice) result.unitPrice = sorted[0]
    if (!result.totalAmount) result.totalAmount = sorted[sorted.length - 1]
  } else if (allAmounts.length === 1) {
    if (!result.unitPrice) result.unitPrice = allAmounts[0]
    if (!result.totalAmount) result.totalAmount = allAmounts[0]
  }

  // ── Cross validation: derive unit price from qty + total ─
  if (result.quantity && result.totalAmount && !result.unitPrice) {
    const derived = Math.round((result.totalAmount / result.quantity) * 100) / 100
    if (derived > 0) result.unitPrice = derived
  }
  // Or derive qty from total + unit price
  if (!result.quantity && result.totalAmount && result.unitPrice) {
    const derived = Math.round(result.totalAmount / result.unitPrice)
    if (derived > 0) result.quantity = derived
  }

  // ── Transport Mode ────────────────────────────────────
  const transportMatch = fullText.match(/(?:By\s+)(Air|Sea|Ocean|Land|Rail|Truck|Express)/i)
  if (transportMatch) {
    const map: Record<string, string> = { air: '航空运输', sea: '海运', ocean: '海运', land: '陆运', rail: '铁路运输', truck: '陆运', express: '快递' }
    result.transportMode = map[transportMatch[1].toLowerCase()] || transportMatch[1]
  }

  return result.piNumber || result.quantity || result.clientNameEN ? result : null
}

export default function PIUpload() {
  const navigate = useNavigate()
  const projectStore = useProjectStore()
  const templateStore = useProductTemplateStore()

  const activeTemplate = templateStore.getActiveTemplate()
  const piecesPerSet = activeTemplate ? getPiecesPerSet(activeTemplate) : 11

  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseMode, setParseMode] = useState<'rule' | 'llm'>('rule')
  const [showForm, setShowForm] = useState(!!projectStore.getCurrentProject())
  const [errors, setErrors] = useState<Partial<Record<keyof PIData, string>>>({})
  const [extractedText, setExtractedText] = useState('')
  const [showDebug, setShowDebug] = useState(false)

  const currentProject = projectStore.getCurrentProject()
  const currentPi = currentProject ? (currentProject.piData as unknown as PIData) : null

  const [formData, setFormData] = useState<PIData>(() => {
    if (currentPi) return { ...currentPi }
    return { ...defaultPIData, date: formatDateLocal(new Date()) }
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const f = acceptedFiles[0]
      if (f.size > 10 * 1024 * 1024) { toast.error('文件大小超过 10MB'); return }
      setFile(f)
      setShowForm(false)
      setErrors({})
      toast.success(`已选择文件：${f.name}`)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'], 'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    }, maxFiles: 1, noClick: false,
  })

  const handleParse = async () => {
    if (!file) return
    setIsParsing(true)

    const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    let parsed: Partial<PIData> | null = null

    if (parseMode === 'llm') {
      const buffer = await file.arrayBuffer()
      let textContent = ''

      if (isPDF) {
        textContent = await extractPDFText(buffer)
        if (!textContent.trim()) {
          textContent = '[PDF could not extract text, may be scanned image]'
        }
      } else {
        try {
          const workbook = XLSX.read(buffer, { type: 'array' })
          workbook.SheetNames.forEach((name) => {
            textContent += `\n--- Sheet: ${name} ---\n`
            textContent += XLSX.utils.sheet_to_csv(workbook.Sheets[name])
          })
        } catch {
          textContent = '[Binary file, could not extract text]'
        }
      }

      const llmResult = await parsePIWithLLM(textContent, isPDF ? 'pdf' : 'excel')
      if (llmResult.confidence > 0) {
        parsed = {
          piNumber: llmResult.piNumber,
          invoiceNumber: llmResult.invoiceNumber,
          date: llmResult.date,
          contractNo: llmResult.contractNo,
          clientNameCN: llmResult.clientNameCN,
          clientNameEN: llmResult.clientNameEN,
          clientAddressCN: llmResult.clientAddressCN,
          clientAddressEN: llmResult.clientAddressEN,
          tradeTerms: llmResult.tradeTerms,
          transportMode: llmResult.transportMode,
          tradeCountry: llmResult.tradeCountry,
          destinationCountry: llmResult.destinationCountry,
          destinationPort: llmResult.destinationPort,
          entryPort: llmResult.entryPort,
          productName: llmResult.productName,
          quantity: llmResult.quantity,
          unitPrice: llmResult.unitPrice,
          totalAmount: llmResult.totalAmount,
          packageType: llmResult.packageType,
          packageCount: llmResult.packageCount,
          grossWeight: llmResult.grossWeight,
          netWeight: llmResult.netWeight,
          supervisionMode: llmResult.supervisionMode,
          taxExemption: llmResult.taxExemption,
        }
        // Run plugin hooks
        const hooked = await pluginRegistry.runHook('pi:parse:after', {
          ...parsed,
          warnings: llmResult.warnings,
          items: [],
        })
        if (hooked.warnings?.length) {
          hooked.warnings.forEach((w: string) => toast.warning(w))
        }
      } else if (llmResult.warnings.length) {
        llmResult.warnings.forEach((w) => toast.warning(w))
      }
    }

    let extractedRawText = ''
    if (!parsed && parseMode === 'rule') {
      const buffer = await file.arrayBuffer()
      if (isPDF) {
        extractedRawText = await extractPDFText(buffer)
      } else {
        extractedRawText = excelToText(buffer)
      }
      parsed = parsePIText(extractedRawText)
      setExtractedText(extractedRawText)
    }

    setIsParsing(false)

    if (parsed) {
      const next: PIData = { ...formData, ...parsed }
      if (!next.invoiceNumber && next.piNumber) {
        next.invoiceNumber = next.piNumber.replace(/^PI-/i, 'CI-')
      }
      if (!next.date) next.date = formatDateLocal(new Date())
      // Always recalculate totalAmount from quantity × unitPrice (most reliable)
      if (next.quantity && next.unitPrice) {
        next.totalAmount = Math.round(next.quantity * next.unitPrice * 100) / 100
      }
      // Auto weight
      if (activeTemplate && next.quantity) {
        next.grossWeight = Math.round(getGrossWeightPerSet(activeTemplate) * next.quantity * 100) / 100
        next.netWeight = Math.round(getNetWeightPerSet(activeTemplate) * next.quantity * 100) / 100
        next.packageCount = next.quantity * 2
      }
      setFormData(next)
      setShowForm(true)
      setErrors({})
      toast.success('PI 信息提取成功，请核对')
    } else {
      setShowForm(true)
      setErrors({})
      toast.error('未能自动提取，请手动填写')
    }
  }

  const handleRemoveFile = () => { setFile(null); setShowForm(false); setErrors({}); setExtractedText('') }

  const updateField = <K extends keyof PIData>(key: K, value: PIData[K]) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'quantity' || key === 'unitPrice') {
        const qty = key === 'quantity' ? (value as number) : next.quantity
        const price = key === 'unitPrice' ? (value as number) : next.unitPrice
        next.totalAmount = Math.round(qty * price * 100) / 100
        if (activeTemplate) {
          next.grossWeight = Math.round(getGrossWeightPerSet(activeTemplate) * qty * 100) / 100
          next.netWeight = Math.round(getNetWeightPerSet(activeTemplate) * qty * 100) / 100
          next.packageCount = qty * 2
        }
      }
      return next
    })
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n })
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof PIData, string>> = {}
    const stringRequired: (keyof PIData)[] = ['piNumber', 'date', 'clientNameEN', 'tradeTerms', 'transportMode', 'tradeCountry', 'destinationCountry']
    stringRequired.forEach((field) => {
      const val = formData[field]
      if (val === '' || val === undefined) newErrors[field] = '此项为必填项'
    })
    if (formData.quantity === undefined || formData.quantity === null || formData.quantity <= 0) {
      newErrors.quantity = formData.quantity === undefined || formData.quantity === null ? '此项为必填项' : '数量必须大于0'
    }
    if (formData.unitPrice === undefined || formData.unitPrice === null || formData.unitPrice <= 0) {
      newErrors.unitPrice = formData.unitPrice === undefined || formData.unitPrice === null ? '此项为必填项' : '单价必须大于0'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Sync to legacy stores for backward compatibility
  const syncToLegacyStores = () => {
    const piStore = usePIStore.getState()
    const priceStore = usePriceStore.getState()
    piStore.setUploadedPI(formData as unknown as import('@/stores/piStore').PIData)
    if (formData.totalAmount > 0) {
      priceStore.setTotalAmount(formData.totalAmount)
    }
  }

  const handleSave = async () => {
    if (!validateForm()) { toast.error('请检查必填项'); return }
    const current = projectStore.getCurrentProject()
    if (current) {
      await projectStore.updatePIData(formData)
    } else {
      await projectStore.createProject(formData, activeTemplate?.id)
    }
    syncToLegacyStores()
    toast.success('PI 数据已保存')
  }

  const handleNext = async () => {
    if (!validateForm()) { toast.error('请完善必填信息后再继续'); return }
    const current = projectStore.getCurrentProject()
    if (current) {
      await projectStore.updatePIData(formData)
      await projectStore.advanceStatus('data_extracted')
    } else {
      await projectStore.createProject(formData, activeTemplate?.id)
    }
    syncToLegacyStores()
    navigate('/data-config')
  }

  const SectionTitle = ({ icon: Icon, title, subtitle }: { icon?: React.ElementType; title: string; subtitle?: string }) => (
    <div className="flex items-center gap-3 mb-5">
      {Icon && <Icon size={20} className="text-[#2563EB]" />}
      <div>
        <h3 className="text-[16px] font-semibold text-[#1A1D23]">{title}</h3>
        {subtitle && <p className="text-[13px] text-[#8F96A3] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible" className="max-w-[800px] mx-auto pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[24px] font-semibold text-[#1A1D23] tracking-tight">上传PI</h1>
          <p className="text-[14px] text-[#5A6270] mt-1">上传并解析 Proforma Invoice 文件</p>
        </div>
        <Badge className="bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] px-3 py-1 text-[13px] font-medium rounded-full">
          第 1 步 / 共 4 步
        </Badge>
      </div>

      {/* Parse Mode Toggle */}
      <div className="jt-card p-4 mb-6 flex items-center gap-4">
        <span className="text-sm text-[#5A6270] font-medium">解析模式:</span>
        <div className="flex items-center gap-2 bg-[#F8F9FB] rounded-lg p-1">
          <button
            onClick={() => setParseMode('rule')}
            className={['px-3 py-1.5 rounded-md text-sm font-medium transition-all', parseMode === 'rule' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-[#8F96A3] hover:text-[#5A6270]'].join(' ')}
          >
            规则提取
          </button>
          <button
            onClick={() => setParseMode('llm')}
            className={['px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5', parseMode === 'llm' ? 'bg-white text-[#7C3AED] shadow-sm' : 'text-[#8F96A3] hover:text-[#5A6270]'].join(' ')}
          >
            <Brain size={14} />
            AI 智能解析
          </button>
        </div>
        {parseMode === 'llm' && (
          <span className="text-[12px] text-[#8F96A3]">需要在设置中配置 API Key</span>
        )}
      </div>

      {/* Dropzone */}
      <motion.div custom={0} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div {...getRootProps()} className={[
          'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
          isDragActive ? 'border-[#2563EB] bg-[#EFF6FF] scale-[1.01]' : file ? 'border-[#16A34A] bg-[#F0FDF4]' : 'border-[#E2E5E9] bg-white hover:bg-[#F8F9FB] hover:border-[#C9CDD4]',
        ].join(' ')} style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <input {...getInputProps()} />
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div key="uploaded" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#16A34A] flex items-center justify-center mb-3">
                  <Check size={28} strokeWidth={2.5} className="text-white" />
                </div>
                <p className="text-[16px] font-medium text-[#1A1D23]">文件已上传</p>
                <p className="text-[13px] text-[#5A6270] mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                <Upload size={48} className={isDragActive ? 'text-[#2563EB]' : 'text-[#8F96A3]'} strokeWidth={1.5} />
                <p className="text-[18px] font-medium text-[#1A1D23] mt-4">{isDragActive ? '释放以上传文件' : '拖拽PI文件到此处'}</p>
                <p className="text-[14px] text-[#5A6270] mt-2">或点击选择文件上传</p>
                <p className="text-[13px] text-[#8F96A3] mt-3">支持格式：Excel (.xlsx, .xls, .csv) / PDF (.pdf) · 单个文件最大 10MB</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {file && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="mt-4 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white border border-[#E2E5E9] rounded-lg px-4 py-2.5 shadow-sm">
                {file.name.toLowerCase().endsWith('.pdf') ? (
                  <FileType size={18} className="text-[#DC2626]" />
                ) : (
                  <FileSpreadsheet size={18} className="text-[#16A34A]" />
                )}
                <span className="text-[14px] text-[#1A1D23]">{file.name}</span>
                <button onClick={(e) => { e.stopPropagation(); handleRemoveFile() }} className="ml-2 p-0.5 rounded hover:bg-[#F8F9FB] text-[#8F96A3] hover:text-[#DC2626]"><X size={14} /></button>
              </div>
              <button onClick={(e) => { e.stopPropagation(); open() }} className="jt-btn-ghost text-[13px]">重新选择</button>
              {!showForm && (
                <button onClick={(e) => { e.stopPropagation(); handleParse() }} disabled={isParsing} className="jt-btn-primary flex items-center gap-2 disabled:opacity-50">
                  {isParsing ? <><Loader2 size={16} className="animate-spin" /> 解析中...</> : <><Wand2 size={16} /> {parseMode === 'llm' ? 'AI 解析' : '开始提取'}</>}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {extractedText && (
          <div className="mt-3">
            <button onClick={() => setShowDebug(!showDebug)} className="text-[12px] text-[#8F96A3] hover:text-[#2563EB] flex items-center gap-1">
              {showDebug ? '隐藏' : '查看'}提取文本（调试用）
            </button>
            {showDebug && (
              <div className="mt-2 bg-[#1A1D23] text-[#C9CDD4] rounded-lg p-4 text-[12px] font-mono whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                {extractedText}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {!showForm && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-6">
          <button onClick={() => setShowForm(true)} className="text-sm text-[#2563EB] font-medium hover:underline">跳过上传，直接手动填写</button>
        </motion.div>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.5 }} className="jt-card p-6 mb-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E2E5E9]">
              <div className="flex items-center gap-3">
                <h2 className="text-[20px] font-semibold text-[#1A1D23]">PI 信息</h2>
                {file && <Badge className="bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] text-[12px] rounded-md"><Check size={12} className="mr-1" /> 已解析</Badge>}
              </div>
              {file && <button onClick={handleParse} className="jt-btn-secondary text-[13px] py-2 px-3">重新提取</button>}
            </div>

            <SectionTitle icon={FileText} title="PI 基本信息" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">PI编号 <span className="text-[#DC2626]">*</span></Label>
                <Input value={formData.piNumber} onChange={(e) => updateField('piNumber', e.target.value)} className={errors.piNumber ? 'border-[#DC2626] ring-1 ring-[#FECACA]' : ''} placeholder="请输入PI编号" />
                {errors.piNumber && <p className="text-[12px] text-[#DC2626] mt-1">{errors.piNumber}</p>}
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">Invoice编号 <span className="text-[#DC2626]">*</span></Label>
                <Input value={formData.invoiceNumber} onChange={(e) => updateField('invoiceNumber', e.target.value)} placeholder="请输入Invoice编号" />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">日期 <span className="text-[#DC2626]">*</span></Label>
                <Input type="date" value={formData.date} onChange={(e) => updateField('date', e.target.value)} className={errors.date ? 'border-[#DC2626] ring-1 ring-[#FECACA]' : ''} />
                {errors.date && <p className="text-[12px] text-[#DC2626] mt-1">{errors.date}</p>}
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">合同协议号</Label>
                <Input value={formData.contractNo} onChange={(e) => updateField('contractNo', e.target.value)} placeholder="请输入合同协议号" />
              </div>
            </div>

            <SectionTitle title="买方信息" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">客户名称（中文）</Label><Input value={formData.clientNameCN} onChange={(e) => updateField('clientNameCN', e.target.value)} placeholder="输入中文名称" /></div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">客户名称（英文）<span className="text-[#DC2626]">*</span></Label>
                <Input value={formData.clientNameEN} onChange={(e) => updateField('clientNameEN', e.target.value)} className={errors.clientNameEN ? 'border-[#DC2626] ring-1 ring-[#FECACA]' : ''} placeholder="请输入客户英文名称" />
                {errors.clientNameEN && <p className="text-[12px] text-[#DC2626] mt-1">{errors.clientNameEN}</p>}
              </div>
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">客户地址（中文）</Label><Input value={formData.clientAddressCN} onChange={(e) => updateField('clientAddressCN', e.target.value)} placeholder="输入中文地址" /></div>
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">客户地址（英文）</Label><Input value={formData.clientAddressEN} onChange={(e) => updateField('clientAddressEN', e.target.value)} placeholder="请输入英文地址" /></div>
            </div>

            <SectionTitle title="交易信息" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">交易条件 <span className="text-[#DC2626]">*</span></Label>
                <select value={formData.tradeTerms} onChange={(e) => updateField('tradeTerms', e.target.value)} className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all">
                  {['EXW', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">运输方式 <span className="text-[#DC2626]">*</span></Label>
                <select value={formData.transportMode} onChange={(e) => updateField('transportMode', e.target.value)} className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all">
                  {['航空运输', '海运', '陆运', '铁路运输'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">贸易国 <span className="text-[#DC2626]">*</span></Label>
                <Input value={formData.tradeCountry} onChange={(e) => updateField('tradeCountry', e.target.value)} className={errors.tradeCountry ? 'border-[#DC2626] ring-1 ring-[#FECACA]' : ''} placeholder="请输入" />
                {errors.tradeCountry && <p className="text-[12px] text-[#DC2626] mt-1">{errors.tradeCountry}</p>}
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">运抵国 <span className="text-[#DC2626]">*</span></Label>
                <Input value={formData.destinationCountry} onChange={(e) => updateField('destinationCountry', e.target.value)} className={errors.destinationCountry ? 'border-[#DC2626] ring-1 ring-[#FECACA]' : ''} placeholder="请输入" />
                {errors.destinationCountry && <p className="text-[12px] text-[#DC2626] mt-1">{errors.destinationCountry}</p>}
              </div>
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">指运港</Label><Input value={formData.destinationPort} onChange={(e) => updateField('destinationPort', e.target.value)} placeholder="请输入指运港" /></div>
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">目的口岸</Label><Input value={formData.entryPort} onChange={(e) => updateField('entryPort', e.target.value)} placeholder="" /></div>
            </div>

            <SectionTitle title="货物信息" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="sm:col-span-2">
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">产品名称</Label>
                <Input value={formData.productName} onChange={(e) => updateField('productName', e.target.value)} placeholder="请输入产品名称" />
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">数量(套) <span className="text-[#DC2626]">*</span></Label>
                <Input type="number" min={0} value={formData.quantity || ''} onChange={(e) => updateField('quantity', Number(e.target.value))} className={[`font-mono text-right ${errors.quantity ? 'border-[#DC2626] ring-1 ring-[#FECACA]' : ''}`].join(' ')} placeholder="请输入数量" />
                {errors.quantity && <p className="text-[12px] text-[#DC2626] mt-1">{errors.quantity}</p>}
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">单价(USD) <span className="text-[#DC2626]">*</span></Label>
                <Input type="number" min={0} step={0.01} value={formData.unitPrice || ''} onChange={(e) => updateField('unitPrice', Number(e.target.value))} className={[`font-mono text-right ${errors.unitPrice ? 'border-[#DC2626] ring-1 ring-[#FECACA]' : ''}`].join(' ')} placeholder="请输入单价" />
                {errors.unitPrice && <p className="text-[12px] text-[#DC2626] mt-1">{errors.unitPrice}</p>}
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">总价(USD)</Label>
                <Input value={formData.totalAmount ? `$${formData.totalAmount.toLocaleString()}` : ''} readOnly className="bg-[#F8F9FB] text-[#8F96A3] font-mono text-right" />
                <p className="text-[12px] text-[#8F96A3] mt-1">自动计算：数量 × 单价</p>
              </div>
            </div>

            <SectionTitle title="其他信息" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">监管方式</Label>
                <select value={formData.supervisionMode} onChange={(e) => updateField('supervisionMode', e.target.value)} className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all">
                  {['一般贸易', '加工贸易', '保税区', '其他'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">征免性质</Label>
                <select value={formData.taxExemption} onChange={(e) => updateField('taxExemption', e.target.value)} className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all">
                  {['一般征税', '来料加工', '进料加工', '其他'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">包装种类</Label>
                <select value={formData.packageType} onChange={(e) => updateField('packageType', e.target.value)} className="w-full h-9 rounded-md border border-[#E2E5E9] bg-white px-3 text-[14px] text-[#1A1D23] focus:border-[#2563EB] focus:ring-[3px] focus:ring-[#BFDBFE]/50 outline-none transition-all">
                  {['纸箱', '木箱', '纸制或纤维板制盒/箱', '托盘', '其他'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">包装件数</Label><Input type="number" min={0} value={formData.packageCount || ''} onChange={(e) => updateField('packageCount', Number(e.target.value))} className="font-mono text-right" placeholder="请输入包装件数" /></div>
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">总毛重(kg)</Label><Input type="number" min={0} step={0.01} value={formData.grossWeight || ''} onChange={(e) => updateField('grossWeight', Number(e.target.value))} className="font-mono text-right" placeholder="请输入总毛重" /></div>
              <div><Label className="text-[12px] font-medium text-[#8F96A3] mb-1.5 block">总净重(kg)</Label><Input type="number" min={0} step={0.01} value={formData.netWeight || ''} onChange={(e) => updateField('netWeight', Number(e.target.value))} className="font-mono text-right" placeholder="请输入总净重" /></div>
            </div>

            <motion.div className="mt-6 bg-[#F8F9FB] rounded-lg border border-[#E2E5E9] p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-[#D97706]" />
                <h4 className="text-[14px] font-medium text-[#1A1D23]">货物明细</h4>
              </div>
              <p className="text-[13px] text-[#5A6270] mb-3">
                {formData.productName || 'R7 Full Groupset'} × {formData.quantity || 0} 套，预计拆解为 {(formData.quantity || 0) * piecesPerSet} 件组件 ({piecesPerSet}件/套 × {formData.quantity || 0}套)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr className="bg-[#E2E5E9]/30"><th className="px-3 py-2 text-left font-medium text-[#5A6270]">商品</th><th className="px-3 py-2 text-right font-medium text-[#5A6270]">数量(套)</th><th className="px-3 py-2 text-right font-medium text-[#5A6270]">单价(USD)</th><th className="px-3 py-2 text-right font-medium text-[#5A6270]">总价(USD)</th></tr></thead>
                  <tbody><tr className="border-t border-[#E2E5E9]"><td className="px-3 py-2.5 text-[#1A1D23]">{formData.productName || 'R7 Full Groupset'}</td><td className="px-3 py-2.5 text-right font-mono text-[#1A1D23]">{formData.quantity || 0}</td><td className="px-3 py-2.5 text-right font-mono text-[#1A1D23]">${(formData.unitPrice || 0).toFixed(2)}</td><td className="px-3 py-2.5 text-right font-mono font-semibold text-[#2563EB]">${(formData.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr></tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[260px] bg-white border-t border-[#E2E5E9] px-6 py-4 z-30 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="jt-btn-ghost flex items-center gap-2 text-[#5A6270]"><ArrowRight size={16} className="rotate-180" />工作台</button>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} className="jt-btn-secondary flex items-center gap-2" disabled={!showForm}><Save size={16} />保存草稿</button>
            <button onClick={handleNext} disabled={!showForm} className="jt-btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">确认并下一步<ArrowRight size={16} /></button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
