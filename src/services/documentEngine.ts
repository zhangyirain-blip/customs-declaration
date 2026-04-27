/**
 * 文档模板引擎
 *
 * 将硬编码的四种文档生成逻辑重构为模板驱动：
 * - 内置 4 套标准模板
 * - 支持自定义模板（字段映射、表头、附加条款等）
 * - 统一的渲染管道
 */

import * as XLSX from 'xlsx'

export type DocumentType =
  | 'commercial_invoice'
  | 'purchase_contract'
  | 'packing_list'
  | 'customs_declaration'

export interface DocumentField {
  key: string
  label: string
  source: 'pi' | 'seller' | 'calculated' | 'custom'
  defaultValue?: string
}

export interface DocumentTemplate {
  id: string
  type: DocumentType
  name: string
  description: string
  isBuiltIn: boolean
  headerFields: DocumentField[]
  tableColumns: { key: string; label: string; width?: number }[]
  footerConfig: {
    showSellerStamp: boolean
    showBuyerStamp: boolean
    customClauses?: string[]
    disclaimer?: string
  }
}

export interface RenderContext {
  pi: Record<string, unknown>
  seller: Record<string, unknown>
  items: Array<Record<string, unknown>>
  totals: {
    amount: number
    quantity: number
    grossWeight: number
    netWeight: number
    packages: number
  }
  cartons?: Array<{
    id: string
    boxName: string
    grossWeightKg: number
    volumeM3: number
    items: Array<{
      componentId: string
      nameCN: string
      nameEN: string
      qty: number
      netWeightKg: number
    }>
  }>
  totalCartons?: number
  totalCartonGross?: number
  totalCartonVolume?: number
}

// ─── Built-in Templates ──────────────────────────────────

export const builtInTemplates: DocumentTemplate[] = [
  {
    id: 'ci-default',
    type: 'commercial_invoice',
    name: '标准商业发票',
    description: 'Commercial Invoice 标准格式',
    isBuiltIn: true,
    headerFields: [
      { key: 'sellerNameEN', label: 'Seller', source: 'seller' },
      { key: 'sellerAddressEN', label: 'Address', source: 'seller' },
      { key: 'sellerPhone', label: 'Tel', source: 'seller' },
      { key: 'buyerName', label: 'Bill To', source: 'pi' },
      { key: 'buyerAddress', label: 'Buyer Address', source: 'pi' },
      { key: 'date', label: 'Date', source: 'pi' },
      { key: 'invoiceNo', label: 'Invoice No', source: 'pi' },
      { key: 'piNo', label: 'Contract No', source: 'pi' },
      { key: 'terms', label: 'Payment term', source: 'pi' },
      { key: 'destinationCountry', label: 'To', source: 'pi' },
    ],
    tableColumns: [
      { key: 'seq', label: 'NO.', width: 6 },
      { key: 'hsCode', label: 'CODE NO.', width: 14 },
      { key: 'description', label: 'DESCRIPTION', width: 45 },
      { key: 'totalQty', label: 'QTY.', width: 10 },
      { key: 'unitPrice', label: 'UNIT PRC(USD)', width: 16 },
      { key: 'totalPrice', label: 'AMT.(USD)', width: 16 },
    ],
    footerConfig: {
      showSellerStamp: true,
      showBuyerStamp: false,
      disclaimer: '仅供报关使用',
    },
  },
  {
    id: 'pc-default',
    type: 'purchase_contract',
    name: '标准采购合同',
    description: 'Purchase Contract 双语格式',
    isBuiltIn: true,
    headerFields: [
      { key: 'sellerNameCN', label: '卖方', source: 'seller' },
      { key: 'sellerNameEN', label: 'Seller EN', source: 'seller' },
      { key: 'sellerAddress', label: '地址', source: 'seller' },
      { key: 'piNo', label: '协议号', source: 'pi' },
      { key: 'date', label: '日期', source: 'pi' },
      { key: 'buyerName', label: '买方', source: 'pi' },
      { key: 'buyerAddress', label: '买方地址', source: 'pi' },
    ],
    tableColumns: [
      { key: 'seq', label: '序号', width: 10 },
      { key: 'nameCN', label: '商品名称', width: 30 },
      { key: 'nameEN', label: '英文名称', width: 25 },
      { key: 'totalQty', label: '数量', width: 12 },
      { key: 'unitPrice', label: '单价(USD)', width: 14 },
      { key: 'totalPrice', label: '金额(USD)', width: 14 },
    ],
    footerConfig: {
      showSellerStamp: true,
      showBuyerStamp: true,
      customClauses: [
        '2. 质量要求(Marking): 详见上述表格中的规格型号栏',
        '3. 包装要求(Packing): IN STANDARD EXPORT PACKING',
        '4. 唛头要求(Marking): N/M',
        '5. 交货时间: 收到订单后30天内',
        '6. 交货地点: Guangzhou',
        '7. 运输方式: {transportMode}',
        '8. 付款条件: {terms}',
        '9. 保险: 由买方承担',
        '10. 检验标准: 以出厂检验为准',
        '11. 异议与索赔: 货到后30天内可提出异议',
        '12. 不可抗力: 因不可抗力导致延期交货，卖方不承担责任',
        '13. 争议解决: 协商解决，协商不成提交中国国际经济贸易仲裁委员会仲裁',
        '14. 其他: 本合同一式两份，买卖双方各执一份',
      ],
      disclaimer: '仅供报关使用',
    },
  },
  {
    id: 'pl-default',
    type: 'packing_list',
    name: '标准装箱单',
    description: 'Packing List 标准格式',
    isBuiltIn: true,
    headerFields: [
      { key: 'sellerNameCN', label: 'Company CN', source: 'seller' },
      { key: 'sellerNameEN', label: 'Company EN', source: 'seller' },
      { key: 'sellerAddress', label: 'Address', source: 'seller' },
      { key: 'invoiceNo', label: 'Invoice No', source: 'pi' },
      { key: 'piNo', label: 'Contract No', source: 'pi' },
      { key: 'date', label: 'Date', source: 'pi' },
    ],
    tableColumns: [
      { key: 'seq', label: 'NO', width: 6 },
      { key: 'description', label: 'Description', width: 40 },
      { key: 'totalQty', label: 'Quantity(PCS)', width: 14 },
      { key: 'package', label: 'Package', width: 12 },
      { key: 'grossWeight', label: 'G.W.(KGS)', width: 18 },
      { key: 'netWeight', label: 'N.W.(KGS)', width: 16 },
      { key: 'measurement', label: 'Meas.(m³)', width: 16 },
    ],
    footerConfig: {
      showSellerStamp: false,
      showBuyerStamp: false,
      disclaimer: '仅供报关使用',
    },
  },
  {
    id: 'cd-default',
    type: 'customs_declaration',
    name: '标准报关单',
    description: '中华人民共和国海关出口货物报关单',
    isBuiltIn: true,
    headerFields: [
      { key: 'sellerNameCN', label: '境内发货人', source: 'seller' },
      { key: 'buyerName', label: '境外收货人', source: 'pi' },
      { key: 'transportMode', label: '运输方式', source: 'pi' },
      { key: 'sellerNameCN', label: '生产销售单位', source: 'seller' },
      { key: 'supervisionMode', label: '监管方式', source: 'pi' },
      { key: 'taxNature', label: '征免性质', source: 'pi' },
      { key: 'piNo', label: '合同协议号', source: 'pi' },
      { key: 'tradeCountry', label: '贸易国', source: 'pi' },
      { key: 'destinationCountry', label: '运抵国', source: 'pi' },
      { key: 'destinationPort', label: '指运港', source: 'pi' },
      { key: 'terms', label: '成交方式', source: 'pi' },
      { key: 'packagingType', label: '包装种类', source: 'pi' },
      { key: 'totalPackages', label: '件数', source: 'calculated' },
      { key: 'grossTotal', label: '毛重(千克)', source: 'calculated' },
      { key: 'netTotal', label: '净重(千克)', source: 'calculated' },
    ],
    tableColumns: [
      { key: 'seq', label: '项号', width: 6 },
      { key: 'hsCode', label: '商品编号', width: 12 },
      { key: 'nameCN', label: '商品名称', width: 20 },
      { key: 'declarationElements', label: '规格型号', width: 28 },
      { key: 'totalQty', label: '数量及单位', width: 14 },
      { key: 'unitPrice', label: '单价', width: 12 },
      { key: 'totalPrice', label: '总价', width: 12 },
      { key: 'currency', label: '币制', width: 8 },
      { key: 'originCountry', label: '原产国', width: 10 },
      { key: 'destinationCountry', label: '目的国', width: 12 },
      { key: 'inlandSource', label: '货源地', width: 10 },
      { key: 'taxType', label: '征免', width: 8 },
    ],
    footerConfig: {
      showSellerStamp: true,
      showBuyerStamp: false,
    },
  },
]

// ─── Engine Functions ────────────────────────────────────

export function getTemplateById(id: string): DocumentTemplate | undefined {
  return builtInTemplates.find((t) => t.id === id)
}

export function getTemplatesByType(type: DocumentType): DocumentTemplate[] {
  return builtInTemplates.filter((t) => t.type === type)
}

function resolveValue(field: DocumentField, ctx: RenderContext): string | number {
  const sourceMap: Record<string, Record<string, unknown>> = {
    pi: ctx.pi,
    seller: ctx.seller,
    calculated: ctx.totals as unknown as Record<string, unknown>,
    custom: {},
  }
  const src = sourceMap[field.source] || {}
  const val = src[field.key]
  if (val == null) return field.defaultValue || ''
  return val as string | number
}

function interpolate(template: string, ctx: RenderContext): string {
  return template.replace(/\{([\w.]+)\}/g, (_, key) => {
    const parts = key.split('.')
    let val: unknown = ctx
    for (const part of parts) {
      val = (val as Record<string, unknown>)?.[part]
    }
    return val != null ? String(val) : ''
  })
}

export function renderDocument(
  template: DocumentTemplate,
  ctx: RenderContext
): XLSX.WorkSheet {
  const rows: (string | number)[][] = []

  // Header section
  if (template.type === 'commercial_invoice') {
    const sellerName = String(resolveValue({ key: 'sellerNameEN', source: 'seller', label: '' }, ctx))
    const sellerAddr = String(resolveValue({ key: 'sellerAddressEN', source: 'seller', label: '' }, ctx))
    const sellerPhone = String(resolveValue({ key: 'sellerPhone', source: 'seller', label: '' }, ctx))
    rows.push([sellerName])
    rows.push([sellerAddr])
    rows.push([`Tel: ${sellerPhone}`])
    rows.push([])
    rows.push(['INVOICE'])
    rows.push([])
  } else if (template.type === 'packing_list') {
    const sellerNameCN = String(resolveValue({ key: 'sellerNameCN', source: 'seller', label: '' }, ctx))
    const sellerNameEN = String(resolveValue({ key: 'sellerNameEN', source: 'seller', label: '' }, ctx))
    const sellerAddr = String(resolveValue({ key: 'sellerAddress', source: 'seller', label: '' }, ctx))
    rows.push([sellerNameCN])
    rows.push([sellerNameEN])
    rows.push([sellerAddr])
    rows.push([])
    rows.push(['装箱单 / PACKING LIST'])
    rows.push([])
  } else if (template.type === 'purchase_contract') {
    rows.push(['订购合同 / PURCHASE CONTRACT'])
    rows.push([])
  } else if (template.type === 'customs_declaration') {
    rows.push(['中华人民共和国海关出口货物报关单'])
    rows.push([])
  }

  // Info rows
  template.headerFields.forEach((field) => {
    const val = resolveValue(field, ctx)
    if (val !== '' && val != null) {
      rows.push([`${field.label}:`, val])
    }
  })
  rows.push([])

  // Table header
  rows.push(template.tableColumns.map((c) => c.label))

  // Table body
  if (template.type === 'packing_list' && ctx.cartons && ctx.cartons.length > 0) {
    let globalIdx = 0
    let totalQty = 0
    let totalGross = 0
    let totalNet = 0

    ctx.cartons.forEach((carton) => {
      carton.items.forEach((item, itemIdx) => {
        globalIdx++
        const isFirst = itemIdx === 0
        const qty = Number(item.qty || 0)
        const net = Number(item.netWeightKg || 0) * qty
        totalQty += qty
        totalNet += net
        if (isFirst) totalGross += carton.grossWeightKg || 0

        const row = template.tableColumns.map((col) => {
          if (col.key === 'seq') return globalIdx
          if (col.key === 'description') {
            const nameEN = String(item.nameEN || '')
            const nameCN = String(item.nameCN || '')
            return nameEN ? `${nameEN}\n${nameCN}` : nameCN
          }
          if (col.key === 'totalQty') return qty
          if (col.key === 'package') return isFirst ? '1 carton' : ''
          if (col.key === 'measurement') return isFirst ? (carton.volumeM3 || 0).toString() : ''
          if (col.key === 'grossWeight') return isFirst ? (carton.grossWeightKg || 0).toFixed(1) : ''
          if (col.key === 'netWeight') return net.toFixed(2)
          return ''
        })
        rows.push(row)
      })
    })

    // Override totals for packing list with carton data
    ctx.totals.quantity = totalQty
    ctx.totals.grossWeight = totalGross
    ctx.totals.netWeight = totalNet
    ctx.totals.packages = ctx.cartons.length
  } else {
    ctx.items.forEach((item, idx) => {
      const row = template.tableColumns.map((col) => {
        if (col.key === 'seq') return idx + 1
        if (col.key === 'description') {
          const nameEN = String(item.nameEN || '')
          const nameCN = String(item.nameCN || '')
          return nameEN ? `${nameEN}\n${nameCN}` : nameCN
        }
        if (col.key === 'package') return 'Carton'
        if (col.key === 'measurement') return ''
        if (col.key === 'grossWeight') {
          const w = Number(item.weightKg || 0)
          const qty = Number(item.totalQty || 0)
          return (w * qty).toFixed(2)
        }
        if (col.key === 'netWeight') {
          const w = Number(item.netWeightKg || 0)
          const qty = Number(item.totalQty || 0)
          return (w * qty).toFixed(2)
        }
        if (col.key === 'currency') return 'USD'
        if (col.key === 'originCountry') return '中国'
        if (col.key === 'inlandSource') return '广州其他'
        if (col.key === 'taxType') return '照章征税'
        const v = item[col.key]
        if (typeof v === 'number') return v
        return v != null ? String(v) : ''
      })
      rows.push(row)
    })
  }

  // Totals
  if (template.type === 'commercial_invoice' || template.type === 'purchase_contract') {
    rows.push(['', '', '', '', 'TOTAL:', ctx.totals.amount])
  } else if (template.type === 'packing_list') {
    const cartonCount = ctx.cartons?.length || 0
    if (cartonCount > 0) {
      rows.push(['', 'TOTAL', ctx.totals.quantity, `${cartonCount} cartons`, `${ctx.totals.grossWeight.toFixed(1)} KGS`, `${ctx.totals.netWeight.toFixed(2)} KGS`, `${(ctx.totalCartonVolume || 0).toFixed(2)} m³`])
    } else {
      rows.push(['', 'TOTAL', ctx.totals.quantity, '', ctx.totals.grossWeight.toFixed(2), ctx.totals.netWeight.toFixed(2), ''])
    }
  }
  rows.push([])

  // Footer clauses
  if (template.footerConfig.customClauses) {
    template.footerConfig.customClauses.forEach((clause) => {
      rows.push([interpolate(clause, ctx)])
    })
    rows.push([])
  }

  // Stamps / signatures
  if (template.footerConfig.showBuyerStamp || template.footerConfig.showSellerStamp) {
    rows.push([])
    // Simple placeholder
  }

  // Disclaimer
  if (template.footerConfig.disclaimer) {
    rows.push([template.footerConfig.disclaimer])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = template.tableColumns.map((c) => ({ wch: c.width || 15 }))
  return ws
}

// ─── High-level Export ───────────────────────────────────

export function exportWithTemplate(
  templateId: string,
  ctx: RenderContext,
  filename?: string
): void {
  const template = getTemplateById(templateId)
  if (!template) throw new Error(`Template not found: ${templateId}`)

  const ws = renderDocument(template, ctx)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, template.name)

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `${template.type}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
