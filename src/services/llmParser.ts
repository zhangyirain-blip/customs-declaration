/**
 * LLM 智能 PI 解析服务
 *
 * 支持通过用户配置的 API Key 调用大模型，实现：
 * 1. 从任意格式 PDF/Excel/图片中提取结构化 PI 信息
 * 2. 自动识别非标准字段（如客户特殊备注、附加条款）
 * 3. 多语言支持（英文/中文/韩文 PI 自动识别）
 */

import { getSetting } from '@/db/indexedDB'

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'moonshot' | 'custom'
  apiKey: string
  baseUrl?: string
  model: string
}

export interface ParsedPIResult {
  piNumber?: string
  invoiceNumber?: string
  date?: string
  contractNo?: string
  clientNameCN?: string
  clientNameEN?: string
  clientAddressCN?: string
  clientAddressEN?: string
  tradeTerms?: string
  transportMode?: string
  tradeCountry?: string
  destinationCountry?: string
  destinationPort?: string
  entryPort?: string
  productName?: string
  quantity?: number
  unitPrice?: number
  totalAmount?: number
  packageType?: string
  packageCount?: number
  grossWeight?: number
  netWeight?: number
  supervisionMode?: string
  taxExemption?: string
  // Raw text for manual review
  rawExtractedText?: string
  confidence: number // 0-1
  warnings: string[]
}

const SYSTEM_PROMPT = `你是一位专业的国际贸易单证解析专家。用户将上传 PI (Proforma Invoice) 的文本内容，你需要从中提取所有关键字段。

请严格按照以下 JSON 格式返回结果（不要包含 markdown 代码块标记）：
{
  "piNumber": "PI编号",
  "invoiceNumber": "发票编号",
  "date": "日期 (YYYY-MM-DD格式)",
  "contractNo": "合同号",
  "clientNameEN": "客户英文名称",
  "clientNameCN": "客户中文名称（如有）",
  "clientAddressEN": "客户英文地址",
  "clientAddressCN": "客户中文地址（如有）",
  "tradeTerms": "交易条件 (EXW/FOB/CIF/CFR/DAP/DDP等)",
  "transportMode": "运输方式",
  "tradeCountry": "贸易国",
  "destinationCountry": "运抵国",
  "destinationPort": "指运港",
  "entryPort": "目的口岸",
  "productName": "产品名称",
  "quantity": "数量（数字）",
  "unitPrice": "单价（数字，USD）",
  "totalAmount": "总金额（数字，USD）",
  "packageType": "包装种类",
  "packageCount": "包装件数（数字）",
  "grossWeight": "总毛重kg（数字）",
  "netWeight": "总净重kg（数字）",
  "supervisionMode": "监管方式",
  "taxExemption": "征免性质",
  "warnings": ["任何不确定或异常的信息"]
}

规则：
1. 如果某个字段无法识别，使用 null 而不是空字符串
2. 日期统一转换为 YYYY-MM-DD 格式
3. 数量和金额只返回数字，不要包含单位或货币符号
4. 如果总价和数量×单价不一致，在 warnings 中提示
5. 如果文档是非标准格式，尽力提取并说明不确定性
6. 支持中文、英文、韩文等多种语言 PI
`

export async function getLLMConfig(): Promise<LLMConfig | null> {
  const config = await getSetting<LLMConfig>('llmConfig')
  if (!config || !config.apiKey) return null
  return config
}

export async function parsePIWithLLM(
  textContent: string,
  fileType: 'excel' | 'pdf' | 'image'
): Promise<ParsedPIResult> {
  const config = await getLLMConfig()

  if (!config) {
    // Fallback: return empty result with warning
    return {
      confidence: 0,
      warnings: ['未配置 LLM API Key，请在设置中配置后使用智能解析'],
    }
  }

  const userPrompt = `请解析以下 PI 文档内容（文件类型: ${fileType}）：\n\n${textContent.slice(0, 12000)}`

  try {
    const result = await callLLM(config, SYSTEM_PROMPT, userPrompt)
    return normalizeResult(result)
  } catch (err) {
    return {
      confidence: 0,
      warnings: [`LLM 解析失败: ${err instanceof Error ? err.message : String(err)}`],
    }
  }
}

async function callLLM(
  config: LLMConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const { provider, apiKey, baseUrl, model } = config

  let url: string
  let body: Record<string, unknown>
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (provider === 'openai' || provider === 'custom') {
    url = baseUrl || 'https://api.openai.com/v1/chat/completions'
    body = {
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }
  } else if (provider === 'anthropic') {
    url = baseUrl || 'https://api.anthropic.com/v1/messages'
    headers = {
      ...headers,
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
    body = {
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }
  } else if (provider === 'moonshot') {
    url = baseUrl || 'https://api.moonshot.cn/v1/chat/completions'
    body = {
      model: model || 'moonshot-v1-8k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }
  } else {
    throw new Error(`Unknown provider: ${provider}`)
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API Error ${response.status}: ${errorText}`)
  }

  const data = await response.json()

  // Extract content based on provider format
  let content: string
  if (provider === 'anthropic') {
    content = data.content?.[0]?.text || '{}'
  } else {
    content = data.choices?.[0]?.message?.content || '{}'
  }

  try {
    return JSON.parse(content)
  } catch {
    // Try to extract JSON from markdown code block
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1])
    }
    throw new Error('LLM returned non-JSON response')
  }
}

function normalizeResult(raw: Record<string, unknown>): ParsedPIResult {
  const toStr = (v: unknown) => (v == null ? undefined : String(v))
  const toNum = (v: unknown) => {
    if (v == null) return undefined
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,]/g, ''))
    return Number.isNaN(n) ? undefined : n
  }

  const warnings: string[] = Array.isArray(raw.warnings)
    ? raw.warnings.map(String)
    : raw.warnings
      ? [String(raw.warnings)]
      : []

  const quantity = toNum(raw.quantity)
  const unitPrice = toNum(raw.unitPrice)
  const totalAmount = toNum(raw.totalAmount)

  if (quantity && unitPrice && totalAmount && Math.abs(quantity * unitPrice - totalAmount) > 0.1) {
    warnings.push(`价格校验: ${quantity} × ${unitPrice} = ${quantity * unitPrice}, 但文档显示总价为 ${totalAmount}`)
  }

  return {
    piNumber: toStr(raw.piNumber),
    invoiceNumber: toStr(raw.invoiceNumber),
    date: toStr(raw.date),
    contractNo: toStr(raw.contractNo),
    clientNameCN: toStr(raw.clientNameCN),
    clientNameEN: toStr(raw.clientNameEN),
    clientAddressCN: toStr(raw.clientAddressCN),
    clientAddressEN: toStr(raw.clientAddressEN),
    tradeTerms: toStr(raw.tradeTerms),
    transportMode: toStr(raw.transportMode),
    tradeCountry: toStr(raw.tradeCountry),
    destinationCountry: toStr(raw.destinationCountry),
    destinationPort: toStr(raw.destinationPort),
    entryPort: toStr(raw.entryPort),
    productName: toStr(raw.productName),
    quantity,
    unitPrice,
    totalAmount,
    packageType: toStr(raw.packageType),
    packageCount: toNum(raw.packageCount),
    grossWeight: toNum(raw.grossWeight),
    netWeight: toNum(raw.netWeight),
    supervisionMode: toStr(raw.supervisionMode),
    taxExemption: toStr(raw.taxExemption),
    confidence: warnings.length === 0 ? 0.95 : warnings.length > 2 ? 0.6 : 0.8,
    warnings,
  }
}
