/**
 * exportUtils.ts — Excel export functionality using xlsx
 */

import * as XLSX from 'xlsx'

export type DocumentType =
  | 'commercial_invoice'
  | 'purchase_contract'
  | 'packing_list'
  | 'customs_declaration'

/** Helper to trigger a file download from a Blob */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Build a Commercial Invoice worksheet as array-of-arrays */
function buildCommercialInvoiceSheet(data: any): XLSX.WorkSheet {
  const d = data || {}
  const items: any[] = d.items || []
  const rows: (string | number)[][] = []

  // Header
  rows.push(['广州鲸途科技有限公司 / Guangzhou Jingtu Technology Co., Ltd.'])
  rows.push(['广州市黄埔区东众路42号B3栋1506单元 / Unit 1506, Building B3, No. 42 Dongzhong Road, Huangpu District, Guangzhou'])
  rows.push(['电话: 8613268212381'])
  rows.push([])
  rows.push(['INVOICE'])
  rows.push([])
  rows.push(['Bill To:', d.buyerName || '', '', 'Date:', d.date || ''])
  rows.push([d.buyerAddress || '', '', '', 'Invoice No:', d.invoiceNo || ''])
  rows.push(['', '', '', 'Contract No:', d.piNo || ''])
  rows.push([])
  rows.push(['Payment term:', d.terms || '', '', 'From:', 'China'])
  rows.push(['', '', '', 'To:', d.destinationCountry || ''])
  rows.push([])

  // Table header
  rows.push([
    'NO.',
    'CODE NO.',
    'DESCRIPTION',
    'QTY.',
    'UNIT PRC(USD)',
    'AMT.(USD)',
  ])

  // Items
  let total = 0
  items.forEach((item: any, idx: number) => {
    const amt = (item.unitPrice || 0) * (item.quantity || 0)
    total += amt
    rows.push([
      idx + 1,
      item.hsCode || '',
      `${item.nameCN || ''} / ${item.nameEN || ''}`,
      item.quantity || 0,
      item.unitPrice || 0,
      amt,
    ])
  })

  // Total row
  rows.push(['', '', '', '', 'TOTAL:', total])
  rows.push([])
  rows.push(['仅供报关使用'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Set column widths
  ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 45 },
    { wch: 10 },
    { wch: 16 },
    { wch: 16 },
  ]
  return ws
}

/** Build a Purchase Contract worksheet */
function buildPurchaseContractSheet(data: any): XLSX.WorkSheet {
  const d = data || {}
  const items: any[] = d.items || []
  const rows: (string | number)[][] = []

  rows.push(['订购合同 / PURCHASE CONTRACT'])
  rows.push([])
  rows.push(['卖方(Seller):', '广州鲸途科技有限公司 / Guangzhou Jingtu Technology Co., Ltd.'])
  rows.push(['地址(Address):', '广州市黄埔区东众路42号B3栋1506单元'])
  rows.push(['协议号(Contract No.):', d.piNo || '', '', '日期(Date):', d.date || ''])
  rows.push(['签订地点(Signed at):', 'Guangzhou'])
  rows.push([])
  rows.push(['买方(Buyer):', d.buyerName || ''])
  rows.push(['地址(Address):', d.buyerAddress || ''])
  rows.push([])

  // Contract clauses
  rows.push(['经买卖双方确认同意，达成如下条款：'])
  rows.push(['1. 品名及规格(Name of Commodity & Specification)、数量(Quantity)、金额(Amount)如下：'])
  rows.push([])

  // Product table header
  rows.push([
    '序号',
    '商品名称',
    '英文名称',
    '数量',
    '单价(USD)',
    '金额(USD)',
  ])

  let total = 0
  items.forEach((item: any, idx: number) => {
    const amt = (item.unitPrice || 0) * (item.quantity || 0)
    total += amt
    rows.push([
      idx + 1,
      item.nameCN || '',
      item.nameEN || '',
      item.quantity || 0,
      item.unitPrice || 0,
      amt,
    ])
  })

  rows.push(['', '', '', '', 'TOTAL:', total])
  rows.push([])

  // Clauses
  rows.push(['2. 质量要求(Marking): 详见上述表格中的规格型号栏'])
  rows.push(['3. 包装要求(Packing): IN STANDARD EXPORT PACKING'])
  rows.push(['4. 唛头要求(Marking): N/M'])
  rows.push(['5. 交货时间(Time of Delivery): 收到订单后30天内'])
  rows.push(['6. 交货地点(Port of Delivery): Guangzhou'])
  rows.push(['7. 运输方式(Means of Transportation): 航空运输'])
  rows.push(['8. 付款条件(Payment): EXW'])
  rows.push(['9. 保险(Insurance): 由买方承担'])
  rows.push(['10. 检验标准(Inspection): 以出厂检验为准'])
  rows.push(['11. 异议与索赔(Discrepancy and Claim): 货到后30天内可提出异议'])
  rows.push(['12. 不可抗力(Force Majeure): 因不可抗力导致延期交货，卖方不承担责任'])
  rows.push(['13. 争议解决方式(Arbitration): 协商解决，协商不成提交中国国际经济贸易仲裁委员会仲裁'])
  rows.push(['14. 其他(Others): 本合同一式两份，买卖双方各执一份，具有同等法律效力'])
  rows.push([])
  rows.push(['买方签章/Buyer Signature:', '', '卖方签章/Seller Signature:'])
  rows.push([])
  rows.push(['仅供报关使用'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 14 }, { wch: 14 }]
  return ws
}

/** Build a Packing List worksheet */
function buildPackingListSheet(data: any): XLSX.WorkSheet {
  const d = data || {}
  const cartons: any[] = d.cartons || []
  const items: any[] = d.items || []
  const rows: (string | number)[][] = []

  rows.push(['广州鲸途科技有限公司 / Guangzhou Jingtu Technology Co., Ltd.'])
  rows.push(['广州市黄埔区东众路42号B3栋1506单元'])
  rows.push([])
  rows.push(['装箱单 / PACKING LIST'])
  rows.push([])
  rows.push(['Invoice No:', d.invoiceNo || '', '', 'Date:', d.date || ''])
  rows.push(['Contract No:', d.piNo || '', '', 'Page:', '1 of 1'])
  rows.push([])

  // Table header
  rows.push([
    'NO.',
    'Description',
    'Quantity(PCS)',
    'Package',
    'Gross Weight(KGS)',
    'Net Weight(KGS)',
    'Measurement(m³)',
  ])

  if (cartons.length > 0) {
    let globalIdx = 0
    let totalQty = 0
    let totalGross = 0
    let totalNet = 0

    cartons.forEach((carton: any) => {
      carton.items.forEach((item: any, itemIdx: number) => {
        globalIdx++
        const isFirst = itemIdx === 0
        const qty = item.qty || 0
        const net = (item.netWeightKg || 0) * qty
        totalQty += qty
        totalNet += net
        if (isFirst) totalGross += carton.grossWeightKg || 0

        rows.push([
          globalIdx,
          `${item.nameCN || ''} / ${item.nameEN || ''}`,
          qty,
          isFirst ? '1 carton' : '',
          isFirst ? (carton.grossWeightKg || 0).toFixed(1) : '',
          net.toFixed(2),
          isFirst ? (carton.volumeM3 || 0).toString() : '',
        ])
      })
    })

    rows.push([
      '',
      'TOTAL',
      totalQty,
      `${cartons.length} cartons`,
      `${totalGross.toFixed(1)} KGS`,
      `${totalNet.toFixed(2)} KGS`,
      `${(d.totalCartonVolume || 0).toFixed(2)} m³`,
    ])
  } else {
    let totalQty = 0
    let totalGross = 0
    let totalNet = 0

    items.forEach((item: any, idx: number) => {
      const qty = item.quantity || 0
      const gross = (item.weightKg || 0) * qty
      const net = (item.netWeightKg || 0) * qty
      totalQty += qty
      totalGross += gross
      totalNet += net
      rows.push([
        idx + 1,
        `${item.nameCN || ''} / ${item.nameEN || ''}`,
        qty,
        'Carton',
        gross.toFixed(2),
        net.toFixed(2),
        '',
      ])
    })

    rows.push(['', 'TOTAL', totalQty, '', totalGross.toFixed(2), totalNet.toFixed(2), ''])
  }

  rows.push([])
  rows.push(['仅供报关使用'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 }]
  return ws
}

/** Build a Customs Declaration worksheet */
function buildCustomsDeclarationSheet(data: any): XLSX.WorkSheet {
  const d = data || {}
  const items: any[] = d.items || []
  const rows: (string | number)[][] = []

  rows.push(['中华人民共和国海关出口货物报关单'])
  rows.push([])
  rows.push(['预录入编号:', '', '海关编号:', ''])
  rows.push([])
  rows.push(['境内发货人:', d.sellerName || '广州鲸途科技有限公司'])
  rows.push(['出境关别:', '', '出口日期:', '', '申报日期:', ''])
  rows.push([])
  rows.push(['境外收货人:', d.buyerName || ''])
  rows.push(['运输方式:', d.transportMode || '航空运输'])
  rows.push(['提运单号:', ''])
  rows.push([])
  rows.push(['生产销售单位:', d.sellerName || '广州鲸途科技有限公司'])
  rows.push(['监管方式:', d.supervisionMode || '一般贸易'])
  rows.push(['征免性质:', d.taxNature || '一般征税'])
  rows.push(['合同协议号:', d.piNo || ''])
  rows.push(['贸易国(地区):', d.tradeCountry || ''])
  rows.push(['运抵国(地区):', d.destinationCountry || ''])
  rows.push(['指运港:', d.destinationPort || ''])
  rows.push(['包装种类:', d.packagingType || '纸制或纤维板制盒/箱'])
  rows.push(['件数:', d.totalPackages || 0])
  rows.push(['毛重(千克):', d.grossTotal || 0])
  rows.push(['净重(千克):', d.netTotal || 0])
  rows.push(['成交方式:', d.terms || ''])
  rows.push([])

  // Items table
  rows.push([
    '项号',
    '商品编号',
    '商品名称',
    '规格型号',
    '数量及单位',
    '单价',
    '总价',
    '币制',
    '原产国(地区)',
    '最终目的国(地区)',
    '境内货源地',
    '征免',
  ])

  items.forEach((item: any, idx: number) => {
    rows.push([
      idx + 1,
      item.hsCode || '',
      item.nameCN || '',
      item.declarationElements || '',
      `${item.totalQty || 0}个`,
      item.unitPrice || 0,
      item.totalPrice || 0,
      d.currency || 'USD',
      d.originCountry || '中国',
      d.destinationCountry || '',
      d.inlandSource || '广州其他',
      d.taxType || '照章征税',
    ])
  })

  rows.push([])
  rows.push(['申报单位签章:', '', '海关审单批注及放行日期:'])
  rows.push([])
  rows.push(['仅供报关使用'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 28 },
    { wch: 30 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 10 },
  ]
  return ws
}

/** Map a document type to its sheet builder */
const sheetBuilders: Record<DocumentType, (data: any) => XLSX.WorkSheet> = {
  commercial_invoice: buildCommercialInvoiceSheet,
  purchase_contract: buildPurchaseContractSheet,
  packing_list: buildPackingListSheet,
  customs_declaration: buildCustomsDeclarationSheet,
}

const sheetNames: Record<DocumentType, string> = {
  commercial_invoice: '商业发票',
  purchase_contract: '采购合同',
  packing_list: '装箱单',
  customs_declaration: '报关单',
}

/** Export a single document as an Excel file */
export function exportDocument(type: DocumentType, data: any): void {
  const builder = sheetBuilders[type]
  if (!builder) return

  const ws = builder(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetNames[type])

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const piNo = data?.piNo || 'document'
  downloadBlob(blob, `${piNo}_${type}.xlsx`)
}

/** Export multiple documents as a combined Excel workbook */
export function exportCombinedWorkbook(
  documents: Array<{ type: string; data: any }>
): void {
  const wb = XLSX.utils.book_new()

  documents.forEach((doc) => {
    const type = doc.type as DocumentType
    const builder = sheetBuilders[type]
    if (!builder) return
    const ws = builder(doc.data)
    XLSX.utils.book_append_sheet(wb, ws, sheetNames[type] || type)
  })

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const piNo = documents[0]?.data?.piNo || 'combined'
  downloadBlob(blob, `${piNo}_报关资料.xlsx`)
}
