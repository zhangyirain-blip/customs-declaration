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
  rows.push([])
  rows.push(['INVOICE'])
  rows.push([])
  rows.push(['To:', d.buyerName || '', '', 'Date:', d.date || ''])
  rows.push([d.buyerAddress || '', '', '', 'Invoice No:', d.invoiceNo || ''])
  rows.push(['', '', '', 'Contract No:', d.piNo || ''])
  rows.push([])
  rows.push(['Payment term:', d.terms || '', '', 'From:', '中国'])
  rows.push(['', '', '', 'to:', d.destinationCountry || ''])
  rows.push([])

  // Table header
  rows.push([
    'CODE NO.',
    'DESCRIPTION',
    'QTY.',
    'UNIT PRC(USD)',
    'AMT.(USD)',
  ])

  // Items
  let total = 0
  items.forEach((item: any) => {
    const amt = (item.unitPrice || 0) * (item.quantity || 0)
    total += amt
    rows.push([
      '无型号',
      item.nameCN || '',
      item.quantity || 0,
      item.unitPrice || 0,
      amt,
    ])
  })

  // Total row
  rows.push(['', '', '', 'TOTAL:', total])
  rows.push([])
  rows.push(['Guangzhou Jingtu Technology Co., Ltd.'])
  rows.push([])
  rows.push(['仅供报关使用'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Set column widths
  ws['!cols'] = [
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

  rows.push(['订 购 合 同'])
  rows.push(['PURCHASE CONTRACT'])
  rows.push([])
  rows.push(['卖方: 广州鲸途科技有限公司', '', '', '协议号:', d.piNo || ''])
  rows.push(['THE SELLERS: Guangzhou Jingtu Technology Co., Ltd.', '', '', '日期:', d.date || ''])
  rows.push(['广州市黄埔区东众路42号B3栋1506单元', '', '', '地点:', 'GUANGZHOU,CHINA'])
  rows.push(['Unit 1506, Building B3, No. 42 Dongzhong Road, Huangpu District, Guangzhou'])
  rows.push([])
  rows.push(['买方:', d.buyerName || ''])
  rows.push(['THE BUYER:', d.buyerName || ''])
  rows.push([])

  // Contract clauses intro
  rows.push(['兹经买卖双方同意按照以下的条款由买方购进卖方售出以下商品：'])
  rows.push(['This contract is made by and between the Buyer and the Sellers:whereby the Buyers agree to buy and the Sellers agree to sell the under-mentioned goods subject to the terms and conditions as stipulated hereinafter:'])
  rows.push([])
  rows.push(['(1)商品名称及规格(Name of commodity and Specification):'])
  rows.push([])

  // Product table header
  rows.push([
    'CODE NO.',
    'DESCRIPTION',
    'QTY.',
    'UNIT PRC(USD)',
    'AMT.(USD)',
  ])

  let total = 0
  items.forEach((item: any) => {
    const amt = (item.unitPrice || 0) * (item.quantity || 0)
    total += amt
    rows.push([
      '无型号',
      item.nameCN || '',
      item.quantity || 0,
      item.unitPrice || 0,
      amt,
    ])
  })

  rows.push(['', '', '', 'TOTAL:', total])
  rows.push([])

  // Clauses
  const totalQty = items.reduce((s, i) => s + (i.quantity || 0), 0)
  rows.push(['(2)数量(Quantity): ' + totalQty + 'PCS'])
  rows.push(['(3)价格条件(Price condition): ' + (d.terms || '')])
  rows.push(['(4)总值(Total Value): USD' + total])
  rows.push(['(5)包装(Packing): IN STANDARD EXPORT PACKING'])
  rows.push(['(6)生产国家及制造厂商(Country of Origin & Manufacturer): 中国'])
  rows.push(['(7)付款条件(Terms of Payment): T/T'])
  rows.push(['(8)保险(Insurance): 由交易条件的责任方去购买保险'])
  rows.push(['(9)装运时间(Time of Shipment): BEFORE ' + (d.date || '')])
  rows.push(['(10)装运口岸(Port of Loading):'])
  rows.push(['(11)目的口岸(Port of Destination): ' + (d.destinationCountry || '')])
  rows.push(['(12)装运唛头[Shipping Mark(s)]: BY SELLER\'S OPTION'])
  rows.push([])
  rows.push(['件货物上应刷明到货口岸、件号、每件毛重及净重、尺码及上列唛头（如系危险及/或有毒货物，应按惯例在每件货物上明显刷出有关标记及性质说明）。'])
  rows.push(['On each package shall be stencilled conspicuously: port of destination,package number,gross and net weights,measurement and the shipping mark shown on the above(For dangerous and/or poisonous cargo,'])
  rows.push(['the name and the generally adopted symbol shall be marked conspicuously on each package)'])
  rows.push([])
  rows.push(['(13)其他条款: (a)本合同其他有关事项（第14款即附加条款除外，）均按交货条款之规定办理，该交货条款为本合同之不可分割部分。 (b) 本合同以中文及英文两种文字说明，两种文字的条款具有同等效力'])
  rows.push(['Other terms:(a) Other matters (excepting Clause 14 viz. Supplementary Condition) relating to this Contract shall be dealt with in accordance with the Terms of Delivery as specified overleaf, which shall form an integral part of this Contract.(b) This Contract is made out in Chinese and English, both versions being equally authentic.'])
  rows.push([])
  rows.push(['(14)附加条款（本合同其他任何条款如与本附加条款有抵触时，以本附加条款为准双方都认可的有关电传、电报等书面材料也可构成本条款的一部分。）'])
  rows.push(['Supplementary Condition(s) (Should any other clause in this Contract be in connice with the following Supplementary Condition(s),the Supplementary Condition (s) should be taken as final and binding.,Fax, cable and other papers, to which both parties agreed, will constitute part of this clause.):'])
  rows.push([])
  rows.push(['买方/Buyer', '', '卖方/Seller'])
  rows.push(['THE BUYERS', '', 'THE SELLERS'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 12 }, { wch: 16 }, { wch: 16 }]
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
  rows.push(['Invoice No.', d.invoiceNo || '', '', 'Date:', d.date || ''])
  rows.push(['Contract No.', d.piNo || '', '', 'Page:', ''])
  rows.push([])

  // Table header
  rows.push([
    'CODE NO',
    'Description',
    'Quantity(PCS)',
    'Inner Package',
    'Gross Weight(KGS)',
    'Net Weight(KGS)',
    'Measurement(m3)',
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
          '无型号',
          item.nameCN || '',
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
      'TOTAL:',
      totalQty,
      `${cartons.length} carton`,
      `${totalGross.toFixed(1)} KGS`,
      `${totalNet.toFixed(2)} KGS`,
      `${(d.totalCartonVolume || 0).toFixed(2)} m³`,
    ])
  } else {
    let totalQty = 0
    let totalGross = 0
    let totalNet = 0

    items.forEach((item: any) => {
      const qty = item.quantity || 0
      const gross = (item.weightKg || 0) * qty
      const net = (item.netWeightKg || 0) * qty
      totalQty += qty
      totalGross += gross
      totalNet += net
      rows.push([
        '无型号',
        item.nameCN || '',
        qty,
        'Carton',
        gross.toFixed(2),
        net.toFixed(2),
        '',
      ])
    })

    rows.push(['', 'TOTAL:', totalQty, '', totalGross.toFixed(2), totalNet.toFixed(2), ''])
  }

  rows.push([])
  rows.push(['Guangzhou Jingtu Technology Co., Ltd.'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 16 }]
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
  rows.push(['首段运输方式:', d.transportMode || '航空运输'])
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
  rows.push(['人民币报关金额:', d.customsDeclarationAmountCNY || ''])
  rows.push([])

  // Items table
  rows.push([
    '项号',
    '商品编号',
    '商品名称',
    '申报要素',
    '数量',
    '单位',
    '千克',
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
      item.totalQty || 0,
      '个',
      item.netWeightKg || 0,
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
  rows.push(['特殊关系确认: 否', '', '价格影响确认: 否', '', '支持特许权使用费确认: 否', '', '自报自缴: 是'])
  rows.push([])
  rows.push(['报关人员', '', '报关人员证号', '', '电话', '', '兹申明对以上内容承担如实申报、依法纳税之', '', '海关批注及签章'])
  rows.push([])
  rows.push(['申报单位', '', '', '', '', '', '申报单位(签'])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 28 },
    { wch: 30 },
    { wch: 10 },
    { wch: 8 },
    { wch: 10 },
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
