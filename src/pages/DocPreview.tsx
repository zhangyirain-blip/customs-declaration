import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  FileSpreadsheet,
  Package,
  Scale,
  ArrowLeft,
  Download,
  Check,
  CheckCircle2,
  Home,
} from 'lucide-react'
import { usePIStore } from '@/stores/piStore'
import { useDatasetStore, defaultPackageBoxes, defaultPackingSchemes, getTotalPiecesPerSet, generateCartons, type PackingScheme } from '@/stores/datasetStore'
import { useProjectStore } from '@/stores/projectStore'
import { useProductTemplateStore } from '@/stores/productTemplateStore'
import { usePriceStore } from '@/stores/priceStore'
import { useHistoryStore } from '@/stores/historyStore'
import { generateInvoiceNo } from '@/utils/documentUtils'
import { exportDocument, exportCombinedWorkbook } from '@/utils/exportUtils'
import Stepper from '@/components/Stepper'

type DocTab = 'commercial_invoice' | 'purchase_contract' | 'packing_list' | 'customs_declaration'

const cardEase = [0.16, 1, 0.3, 1] as [number, number, number, number]

/* ------------------------------------------------------------------ */
/*  Seller fixed info                                                  */
/* ------------------------------------------------------------------ */
const SELLER = {
  nameCN: '广州鲸途科技有限公司',
  nameEN: 'Guangzhou Jingtu Technology Co., Ltd.',
  address: '广州市黄埔区东众路42号B3栋1506单元',
  addressEN: 'Unit 1506, Building B3, No. 42 Dongzhong Road, Huangpu District, Guangzhou',
  phone: '8613268212381',
}

/* ------------------------------------------------------------------ */
/*  Helper: build items array from stores                              */
/* ------------------------------------------------------------------ */
function useDocData() {
  const piStore = usePIStore()
  const datasetStore = useDatasetStore()
  const priceStore = usePriceStore()

  const pi = piStore.uploadedPI

  const quantity = pi?.quantity ?? 0
  const totalAmount = priceStore.totalAmount
  const piNo = pi?.piNumber ?? ''
  const invoiceNo = piNo ? generateInvoiceNo(piNo) : ''
  const date = pi?.date ?? ''
  const buyerName = pi?.clientNameEN || pi?.clientNameCN || ''
  const buyerAddress = pi?.clientAddressEN || pi?.clientAddressCN || ''
  const terms = pi?.tradeTerms ?? ''
  const transportMode = pi?.transportMode ?? ''
  const tradeCountry = pi?.tradeCountry ?? ''
  const destinationCountry = pi?.destinationCountry ?? ''
  const destinationPort = pi?.destinationPort ?? ''
  const supervisionMode = pi?.supervisionMode ?? ''
  const taxNature = pi?.taxExemption ?? ''
  const packagingType = pi?.packageType ?? ''
  const totalPackages = pi?.packageCount ?? 0


  const items = useMemo(() => {
    return datasetStore.components.map((c) => {
      const totalQty = c.qtyPerSet * quantity
      const totalPrice = priceStore.componentPrices[c.id] ?? 0
      const unitPrice = totalQty > 0 ? totalPrice / totalQty : 0
      return {
        id: c.id,
        nameCN: c.nameCN,
        nameEN: c.nameEN,
        hsCode: c.hsCode,
        qtyPerSet: c.qtyPerSet,
        totalQty,
        unitPrice: Math.round(unitPrice * 100) / 100,
        totalPrice: Math.round(totalPrice * 100) / 100,
        weightKg: c.grossWeightKg,
        netWeightKg: c.netWeightKg,
        declarationElements: c.declarationElements,
        brand: c.brand,
      }
    })
  }, [datasetStore.components, quantity, priceStore.componentPrices])

  // Carton-level packing data for Packing List
  // Resolve packing scheme from project → template → fallback
  const projectStore = useProjectStore()
  const templateStore = useProductTemplateStore()
  const currentProject = projectStore.getCurrentProject()
  const activeTemplate = templateStore.getActiveTemplate()

  const resolvedScheme = useMemo(() => {
    if (currentProject?.customPackingScheme) {
      return currentProject.customPackingScheme as unknown as PackingScheme
    }
    const schemeId = currentProject?.packingSchemeId || activeTemplate?.defaultPackingSchemeId
    if (schemeId) {
      const fromTemplate = activeTemplate?.packingSchemes?.find((s) => s.id === schemeId)
      if (fromTemplate) return fromTemplate as unknown as PackingScheme
      const fromDefault = defaultPackingSchemes?.find((s) => s.id === schemeId)
      if (fromDefault) return fromDefault
    }
    // Fallback: one carton per package box
    if (defaultPackageBoxes.length > 0) {
      return {
        id: 'fallback',
        name: '默认分盒',
        description: '每个子盒单独装箱',
        cartons: defaultPackageBoxes.map((b) => ({ id: b.id, name: b.name, boxIds: [b.id] })),
      }
    }
    return null
  }, [currentProject, activeTemplate])

  const packageBoxes = useMemo(() => {
    return (activeTemplate?.packageBoxes || defaultPackageBoxes) as unknown as typeof defaultPackageBoxes
  }, [activeTemplate])

  const cartons = useMemo(() => {
    if (!resolvedScheme || quantity <= 0) return []
    return generateCartons(quantity, resolvedScheme, packageBoxes, datasetStore.components)
  }, [quantity, resolvedScheme, packageBoxes, datasetStore.components])

  const totalQtyAll = items.reduce((s, i) => s + i.totalQty, 0)
  const totalGross = items.reduce((s, i) => s + i.weightKg * i.totalQty, 0)
  const totalNet = items.reduce((s, i) => s + i.netWeightKg * i.totalQty, 0)
  const totalCartons = cartons.length
  const totalCartonGross = cartons.reduce((s, c) => s + c.grossWeightKg, 0)
  const totalCartonVolume = cartons.reduce((s, c) => s + c.volumeM3, 0)

  return {
    piNo,
    invoiceNo,
    date,
    buyerName,
    buyerAddress,
    terms,
    quantity,
    totalAmount,
    items,
    cartons,
    totalQtyAll,
    totalGross,
    totalNet,
    totalCartons,
    totalCartonGross,
    totalCartonVolume,
    sellerNameCN: SELLER.nameCN,
    sellerNameEN: SELLER.nameEN,
    sellerAddress: SELLER.address,
    sellerAddressEN: SELLER.addressEN,
    sellerPhone: SELLER.phone,
    transportMode,
    tradeCountry,
    destinationCountry,
    destinationPort,
    packagingType,
    totalPackages,
    supervisionMode,
    taxNature,
    originCountry: '中国',
    inlandSource: '广州其他',
    taxType: '照章征税',
    currency: 'USD',
    unitPrice: pi?.unitPrice ?? 0,
  }
}

/* ------------------------------------------------------------------ */
/*  Document Card                                                      */
/* ------------------------------------------------------------------ */
interface DocCardProps {
  icon: React.ElementType
  iconColor: string
  title: string
  subtitle: string
  active: boolean
  onClick: () => void
  generated: boolean
}

function DocCard({ icon: Icon, iconColor, title, subtitle, active, onClick, generated }: DocCardProps) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={[
        'flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 w-full',
        active
          ? 'border-[#2563EB] bg-white shadow-md ring-1 ring-[#BFDBFE]'
          : 'border-[#E2E5E9] bg-white hover:shadow-sm',
      ].join(' ')}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${iconColor}15` }}
      >
        <Icon size={20} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#1A1D23]">{title}</div>
        <div className="text-xs text-[#8F96A3]">{subtitle}</div>
      </div>
      {generated && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] shrink-0">
          <Check size={10} /> 已生成
        </span>
      )}
    </motion.button>
  )
}

/* ------------------------------------------------------------------ */
/*  Commercial Invoice Preview                                         */
/* ------------------------------------------------------------------ */
function CommercialInvoicePreview({ data }: { data: ReturnType<typeof useDocData> }) {
  return (
    <div className="bg-white p-8 min-h-[800px] text-[#1A1D23]">
      {/* Company Header */}
      <div className="text-center mb-6">
        <h2 className="text-base font-bold">{data.sellerNameEN}</h2>
        <p className="text-xs text-[#5A6270] mt-1">{data.sellerAddressEN}</p>
        <p className="text-xs text-[#5A6270]">Tel: {data.sellerPhone}</p>
      </div>

      {/* Title */}
      <h1 className="text-center text-2xl font-bold tracking-[0.15em] mb-8">INVOICE</h1>

      {/* Info Grid */}
      <div className="flex justify-between mb-6 text-sm">
        <div>
          <p className="font-semibold mb-1">Bill To:</p>
          <p>{data.buyerName}</p>
          <p className="text-[#5A6270]">{data.buyerAddress}</p>
        </div>
        <div className="text-right space-y-1">
          <p>
            <span className="text-[#5A6270]">Date: </span>
            <span className="font-medium">{data.date}</span>
          </p>
          <p>
            <span className="text-[#5A6270]">Invoice No: </span>
            <span className="font-mono font-medium">{data.invoiceNo}</span>
          </p>
          <p>
            <span className="text-[#5A6270]">Contract No: </span>
            <span className="font-mono font-medium">{data.piNo}</span>
          </p>
        </div>
      </div>

      {/* Terms */}
      <div className="flex justify-between text-sm mb-4">
        <p>
          <span className="text-[#5A6270]">Payment term: </span>
          <span className="font-medium">{data.terms}</span>
        </p>
        <p>
          <span className="text-[#5A6270]">From: </span>China
          <span className="text-[#5A6270] ml-4">To: </span>
          {data.destinationCountry}
        </p>
      </div>

      {/* Table */}
      <table className="w-full text-sm border border-black border-collapse mb-6">
        <thead>
          <tr className="bg-[#F8F9FB]">
            <th className="border border-black px-2 py-2 text-left w-10">NO.</th>
            <th className="border border-black px-2 py-2 text-left">CODE NO.</th>
            <th className="border border-black px-2 py-2 text-left">DESCRIPTION</th>
            <th className="border border-black px-2 py-2 text-center w-16">QTY.</th>
            <th className="border border-black px-2 py-2 text-right w-24">UNIT PRC(USD)</th>
            <th className="border border-black px-2 py-2 text-right w-24">AMT.(USD)</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={item.id}>
              <td className="border border-black px-2 py-1.5 text-center">{idx + 1}</td>
              <td className="border border-black px-2 py-1.5 font-mono text-xs">{item.hsCode}</td>
              <td className="border border-black px-2 py-1.5">
                {item.nameEN}
                <br />
                <span className="text-xs text-[#5A6270]">{item.nameCN}</span>
              </td>
              <td className="border border-black px-2 py-1.5 text-center">{item.totalQty}</td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">
                {item.unitPrice.toFixed(2)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">
                {item.totalPrice.toFixed(2)}
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={5} className="border border-black px-2 py-2 text-right">
              TOTAL:
            </td>
            <td className="border border-black px-2 py-2 text-right font-mono">
              {data.totalAmount.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex justify-between items-end mt-12 text-sm">
        <p className="text-[#5A6270] italic">仅供报关使用</p>
        <div className="text-center">
          <p className="font-semibold">{data.sellerNameEN}</p>
          <div className="w-32 h-12 border-b border-[#1A1D23] mt-2" />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Purchase Contract Preview                                          */
/* ------------------------------------------------------------------ */
function PurchaseContractPreview({ data }: { data: ReturnType<typeof useDocData> }) {
  return (
    <div className="bg-white p-8 min-h-[800px] text-[#1A1D23]">
      <h1 className="text-center text-xl font-bold mb-6">订购合同 / PURCHASE CONTRACT</h1>

      {/* Seller / Buyer Info */}
      <div className="grid grid-cols-2 gap-6 text-sm mb-6">
        <div className="space-y-1">
          <p>
            <span className="text-[#5A6270]">卖方(Seller): </span>
            <span className="font-medium">{data.sellerNameCN}</span>
          </p>
          <p className="text-xs text-[#5A6270]">{data.sellerNameEN}</p>
          <p className="text-[#5A6270]">地址: {data.sellerAddress}</p>
          <p>
            <span className="text-[#5A6270]">协议号: </span>
            <span className="font-mono">{data.piNo}</span>
          </p>
          <p>
            <span className="text-[#5A6270]">签订地点: </span>Guangzhou
          </p>
        </div>
        <div className="space-y-1">
          <p>
            <span className="text-[#5A6270]">买方(Buyer): </span>
            <span className="font-medium">{data.buyerName}</span>
          </p>
          <p className="text-[#5A6270]">地址: {data.buyerAddress || '—'}</p>
          <p>
            <span className="text-[#5A6270]">日期: </span>
            {data.date}
          </p>
        </div>
      </div>

      <p className="text-sm mb-4">
        经买卖双方确认同意，达成如下条款：
      </p>
      <p className="text-sm font-medium mb-2">
        1. 品名及规格(Name of Commodity & Specification)、数量(Quantity)、金额(Amount)如下：
      </p>

      {/* Product Table */}
      <table className="w-full text-sm border border-black border-collapse mb-4">
        <thead>
          <tr className="bg-[#F8F9FB]">
            <th className="border border-black px-2 py-2 w-10">序号</th>
            <th className="border border-black px-2 py-2">商品名称</th>
            <th className="border border-black px-2 py-2">英文名称</th>
            <th className="border border-black px-2 py-2 w-16">数量</th>
            <th className="border border-black px-2 py-2 w-20">单价(USD)</th>
            <th className="border border-black px-2 py-2 w-20">金额(USD)</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={item.id}>
              <td className="border border-black px-2 py-1.5 text-center">{idx + 1}</td>
              <td className="border border-black px-2 py-1.5">{item.nameCN}</td>
              <td className="border border-black px-2 py-1.5 text-xs">{item.nameEN}</td>
              <td className="border border-black px-2 py-1.5 text-center">{item.totalQty}</td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">
                {item.unitPrice.toFixed(2)}
              </td>
              <td className="border border-black px-2 py-1.5 text-right font-mono">
                {item.totalPrice.toFixed(2)}
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td colSpan={5} className="border border-black px-2 py-2 text-right">TOTAL:</td>
            <td className="border border-black px-2 py-2 text-right font-mono">
              {data.totalAmount.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Clauses */}
      <div className="space-y-1 text-xs text-[#5A6270] mb-8">
        <p>2. 质量要求(Marking): 详见上述表格中的规格型号栏</p>
        <p>3. 包装要求(Packing): IN STANDARD EXPORT PACKING</p>
        <p>4. 唛头要求(Marking): N/M</p>
        <p>5. 交货时间(Time of Delivery): 收到订单后30天内</p>
        <p>6. 交货地点(Port of Delivery): Guangzhou</p>
        <p>7. 运输方式(Means of Transportation): {data.transportMode}</p>
        <p>8. 付款条件(Payment): {data.terms}</p>
        <p>9. 保险(Insurance): 由买方承担</p>
        <p>10. 检验标准(Inspection): 以出厂检验为准</p>
        <p>11. 异议与索赔(Discrepancy and Claim): 货到后30天内可提出异议</p>
        <p>12. 不可抗力(Force Majeure): 因不可抗力导致延期交货，卖方不承担责任</p>
        <p>
          13. 争议解决方式(Arbitration):
          协商解决，协商不成提交中国国际经济贸易仲裁委员会仲裁
        </p>
        <p>14. 其他(Others): 本合同一式两份，买卖双方各执一份，具有同等法律效力</p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 mt-8 text-sm">
        <div>
          <p className="font-medium mb-4">买方签章 / Buyer Signature:</p>
          <div className="w-40 h-16 border-b border-[#1A1D23]" />
        </div>
        <div>
          <p className="font-medium mb-4">卖方签章 / Seller Signature:</p>
          <div className="w-40 h-16 border-b border-[#1A1D23]" />
        </div>
      </div>

      <p className="text-center text-xs text-[#5A6270] italic mt-8">仅供报关使用</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Packing List Preview                                               */
/* ------------------------------------------------------------------ */
function PackingListPreview({ data }: { data: ReturnType<typeof useDocData> }) {
  return (
    <div className="bg-white p-8 min-h-[800px] text-[#1A1D23]">
      <div className="text-center mb-6">
        <h2 className="text-base font-bold">{data.sellerNameCN}</h2>
        <p className="text-xs text-[#5A6270]">{data.sellerNameEN}</p>
        <p className="text-xs text-[#5A6270]">{data.sellerAddress}</p>
      </div>

      <h1 className="text-center text-xl font-bold tracking-wide mb-6">装箱单 / PACKING LIST</h1>

      <div className="flex justify-between text-sm mb-6">
        <div className="space-y-1">
          <p>
            <span className="text-[#5A6270]">Invoice No: </span>
            <span className="font-mono">{data.invoiceNo}</span>
          </p>
          <p>
            <span className="text-[#5A6270]">Contract No: </span>
            <span className="font-mono">{data.piNo}</span>
          </p>
        </div>
        <div className="text-right space-y-1">
          <p>
            <span className="text-[#5A6270]">Date: </span>
            {data.date}
          </p>
          <p>
            <span className="text-[#5A6270]">Page: </span>1 of 1
          </p>
        </div>
      </div>

      <table className="w-full text-sm border border-black border-collapse mb-6">
        <thead>
          <tr className="bg-[#F8F9FB]">
            <th className="border border-black px-2 py-2 w-10">NO</th>
            <th className="border border-black px-2 py-2 text-left">Description</th>
            <th className="border border-black px-2 py-2 text-center w-16">Quantity(PCS)</th>
            <th className="border border-black px-2 py-2 text-center w-16">Package</th>
            <th className="border border-black px-2 py-2 text-right w-20">G.W.(KGS)</th>
            <th className="border border-black px-2 py-2 text-right w-20">N.W.(KGS)</th>
            <th className="border border-black px-2 py-2 text-right w-20">Meas.(m³)</th>
          </tr>
        </thead>
        <tbody>
          {data.cartons.length > 0
            ? (() => {
                let globalIdx = 0
                return data.cartons.flatMap((carton) =>
                  carton.items.map((item, itemIdx) => {
                    globalIdx++
                    const isFirst = itemIdx === 0
                    const net = item.netWeightKg * item.qty
                    return (
                      <tr key={`${carton.id}_${item.componentId}`}>
                        <td className="border border-black px-2 py-1.5 text-center">{globalIdx}</td>
                        <td className="border border-black px-2 py-1.5">
                          {item.nameEN}
                          <br />
                          <span className="text-xs text-[#5A6270]">{item.nameCN}</span>
                        </td>
                        <td className="border border-black px-2 py-1.5 text-center">{item.qty}</td>
                        {isFirst && (
                          <>
                            <td rowSpan={carton.items.length} className="border border-black px-2 py-1.5 text-center">
                              1 carton
                            </td>
                            <td rowSpan={carton.items.length} className="border border-black px-2 py-1.5 text-right font-mono">
                              {carton.grossWeightKg.toFixed(1)}KGS
                            </td>
                          </>
                        )}
                        <td className="border border-black px-2 py-1.5 text-right font-mono">
                          {net.toFixed(2)}KGS
                        </td>
                        {isFirst && (
                          <td rowSpan={carton.items.length} className="border border-black px-2 py-1.5 text-right font-mono">
                            {carton.volumeM3}m³
                          </td>
                        )}
                      </tr>
                    )
                  })
                )
              })()
            : data.items.map((item, idx) => {
                const gross = item.weightKg * item.totalQty
                const net = item.netWeightKg * item.totalQty
                return (
                  <tr key={item.id}>
                    <td className="border border-black px-2 py-1.5 text-center">{idx + 1}</td>
                    <td className="border border-black px-2 py-1.5">
                      {item.nameEN}
                      <br />
                      <span className="text-xs text-[#5A6270]">{item.nameCN}</span>
                    </td>
                    <td className="border border-black px-2 py-1.5 text-center">{item.totalQty}</td>
                    <td className="border border-black px-2 py-1.5 text-center">Carton</td>
                    <td className="border border-black px-2 py-1.5 text-right font-mono">
                      {gross.toFixed(2)}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-right font-mono">
                      {net.toFixed(2)}
                    </td>
                    <td className="border border-black px-2 py-1.5 text-right" />
                  </tr>
                )
              })}
          <tr className="font-bold">
            <td colSpan={2} className="border border-black px-2 py-2 text-right">
              TOTAL
            </td>
            <td className="border border-black px-2 py-2 text-center">
              {data.cartons.length > 0 ? data.totalQtyAll : data.totalQtyAll}
            </td>
            <td className="border border-black px-2 py-2 text-center">
              {data.cartons.length > 0 ? `${data.totalCartons} cartons` : '—'}
            </td>
            <td className="border border-black px-2 py-2 text-right font-mono">
              {data.cartons.length > 0
                ? `${data.totalCartonGross.toFixed(1)} KGS`
                : data.totalGross.toFixed(2)}
            </td>
            <td className="border border-black px-2 py-2 text-right font-mono">
              {data.totalNet.toFixed(2)}KGS
            </td>
            <td className="border border-black px-2 py-2 text-right font-mono">
              {data.cartons.length > 0 ? `${data.totalCartonVolume.toFixed(2)}m³` : ''}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="text-center text-xs text-[#5A6270] italic mt-8">仅供报关使用</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Customs Declaration Preview                                        */
/* ------------------------------------------------------------------ */
function CustomsDeclarationPreview({ data }: { data: ReturnType<typeof useDocData> }) {
  return (
    <div className="bg-white p-6 min-h-[900px] text-[#1A1D23] text-sm">
      <h1 className="text-center text-lg font-bold mb-4">中华人民共和国海关出口货物报关单</h1>

      {/* Header Grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs mb-4 border-b border-black pb-3">
        <div>
          <span className="text-[#5A6270]">预录入编号: </span>
          <span className="inline-block w-32 border-b border-[#999]" />
        </div>
        <div>
          <span className="text-[#5A6270]">海关编号: </span>
          <span className="inline-block w-32 border-b border-[#999]" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs mb-4">
        <div className="col-span-1">
          <span className="text-[#5A6270]">境内发货人: </span>
          <span className="font-medium">{data.sellerNameCN}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">出境关别: </span>
          <span className="inline-block w-16 border-b border-[#999]" />
        </div>
        <div>
          <span className="text-[#5A6270]">出口日期: </span>
          <span className="inline-block w-20 border-b border-[#999]" />
        </div>
        <div className="col-span-3">
          <span className="text-[#5A6270]">境外收货人: </span>
          <span className="font-medium">{data.buyerName}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">运输方式: </span>
          <span className="font-medium">{data.transportMode}</span>
        </div>
        <div className="col-span-2">
          <span className="text-[#5A6270]">运输工具名称及航次号: </span>
          <span className="inline-block w-32 border-b border-[#999]" />
        </div>
        <div className="col-span-3">
          <span className="text-[#5A6270]">提运单号: </span>
          <span className="inline-block w-40 border-b border-[#999]" />
        </div>
        <div className="col-span-1">
          <span className="text-[#5A6270]">生产销售单位: </span>
          <span className="font-medium">{data.sellerNameCN}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">监管方式: </span>
          <span className="font-medium">{data.supervisionMode}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">征免性质: </span>
          <span className="font-medium">{data.taxNature}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">合同协议号: </span>
          <span className="font-mono font-medium">{data.piNo}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">贸易国(地区): </span>
          <span className="font-medium">{data.tradeCountry}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">运抵国(地区): </span>
          <span className="font-medium">{data.destinationCountry}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">指运港: </span>
          <span className="font-medium">{data.destinationPort}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">成交方式: </span>
          <span className="font-medium">{data.terms}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">包装种类: </span>
          <span className="font-medium">{data.packagingType}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">件数: </span>
          <span className="font-medium">{data.totalPackages}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">毛重(千克): </span>
          <span className="font-medium">{data.totalGross.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[#5A6270]">净重(千克): </span>
          <span className="font-medium">{data.totalNet.toFixed(2)}</span>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-xs border border-black border-collapse">
        <thead>
          <tr className="bg-[#F8F9FB]">
            <th className="border border-black px-1 py-1.5 w-6">项号</th>
            <th className="border border-black px-1 py-1.5 w-14">商品编号</th>
            <th className="border border-black px-1 py-1.5 w-28">商品名称</th>
            <th className="border border-black px-1 py-1.5 w-36">规格型号</th>
            <th className="border border-black px-1 py-1.5 w-16">数量及单位</th>
            <th className="border border-black px-1 py-1.5 w-14">单价</th>
            <th className="border border-black px-1 py-1.5 w-14">总价</th>
            <th className="border border-black px-1 py-1.5 w-8">币制</th>
            <th className="border border-black px-1 py-1.5 w-12">原产国</th>
            <th className="border border-black px-1 py-1.5 w-14">目的国</th>
            <th className="border border-black px-1 py-1.5 w-12">货源地</th>
            <th className="border border-black px-1 py-1.5 w-8">征免</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr key={item.id}>
              <td className="border border-black px-1 py-1 text-center">{idx + 1}</td>
              <td className="border border-black px-1 py-1 text-center font-mono">{item.hsCode}</td>
              <td className="border border-black px-1 py-1">{item.nameCN}</td>
              <td className="border border-black px-1 py-1 text-[10px] leading-tight">
                {item.declarationElements}
              </td>
              <td className="border border-black px-1 py-1 text-center">{item.totalQty}个</td>
              <td className="border border-black px-1 py-1 text-right font-mono">{item.unitPrice.toFixed(2)}</td>
              <td className="border border-black px-1 py-1 text-right font-mono">{item.totalPrice.toFixed(2)}</td>
              <td className="border border-black px-1 py-1 text-center">{data.currency}</td>
              <td className="border border-black px-1 py-1 text-center">{data.originCountry}</td>
              <td className="border border-black px-1 py-1 text-center">{data.destinationCountry}</td>
              <td className="border border-black px-1 py-1 text-center">{data.inlandSource}</td>
              <td className="border border-black px-1 py-1 text-center">{data.taxType}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="mt-8 text-xs">
        <div className="flex justify-between mb-4">
          <div>
            <p className="text-[#5A6270] mb-1">特殊关系确认: □ 是 □ 否</p>
            <p className="text-[#5A6270] mb-1">价格影响确认: □ 是 □ 否</p>
            <p className="text-[#5A6270]">特许权使用费确认: □ 是 □ 否</p>
          </div>
          <div>
            <p className="text-[#5A6270]">自报自缴: □ 是 □ 否</p>
          </div>
        </div>
        <div className="border-t border-black pt-3 flex justify-between">
          <div>
            <p className="font-medium mb-2">申报单位签章</p>
            <div className="w-32 h-12" />
          </div>
          <div>
            <p className="font-medium mb-2">海关审单批注及放行日期</p>
            <div className="w-32 h-12" />
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[#5A6270] italic mt-6">仅供报关使用</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main DocPreview Page                                               */
/* ------------------------------------------------------------------ */
export default function DocPreview() {
  const navigate = useNavigate()
  const historyStore = useHistoryStore()
  const piStore = usePIStore()
  const data = useDocData()

  const [activeTab, setActiveTab] = useState<DocTab>('commercial_invoice')
  const generatedDocs: Record<DocTab, boolean> = {
    commercial_invoice: true,
    purchase_contract: true,
    packing_list: true,
    customs_declaration: true,
  }
  const [savedToHistory, setSavedToHistory] = useState(false)

  const tabs: { key: DocTab; label: string }[] = [
    { key: 'commercial_invoice', label: '商业发票' },
    { key: 'purchase_contract', label: '采购合同' },
    { key: 'packing_list', label: '装箱单' },
    { key: 'customs_declaration', label: '报关单' },
  ]

  const buildExportData = useCallback(() => {
    return {
      piNo: data.piNo,
      invoiceNo: data.invoiceNo,
      date: data.date,
      buyerName: data.buyerName,
      buyerAddress: data.buyerAddress,
      terms: data.terms,
      destinationCountry: data.destinationCountry,
      currency: data.currency,
      items: data.items,
      totalAmount: data.totalAmount,
      totalPackages: data.totalPackages,
      packagingType: data.packagingType,
      grossTotal: data.totalGross,
      netTotal: data.totalNet,
      sellerName: data.sellerNameCN,
      transportMode: data.transportMode,
      tradeCountry: data.tradeCountry,
      supervisionMode: data.supervisionMode,
      taxNature: data.taxNature,
      originCountry: data.originCountry,
      inlandSource: data.inlandSource,
      taxType: data.taxType,
      destinationPort: data.destinationPort,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      cartons: data.cartons,
      totalCartons: data.totalCartons,
      totalCartonGross: data.totalCartonGross,
      totalCartonVolume: data.totalCartonVolume,
    }
  }, [data])

  const handleExportSingle = useCallback(() => {
    exportDocument(activeTab, buildExportData())
  }, [activeTab, buildExportData])

  const handleExportAll = useCallback(() => {
    exportCombinedWorkbook(
      tabs.map((t) => ({ type: t.key, data: buildExportData() }))
    )
  }, [buildExportData, tabs])

  const handleSaveToHistory = useCallback(() => {
    if (!piStore.uploadedPI) return
    const pi = piStore.uploadedPI
    const piecesPerSet = getTotalPiecesPerSet(useDatasetStore.getState().components)

    historyStore.addDeclaration({
      id: data.invoiceNo || data.piNo,
      piNumber: pi.piNumber,
      invoiceNumber: data.invoiceNo || generateInvoiceNo(pi.piNumber),
      customerName: pi.clientNameEN || pi.clientNameCN,
      date: pi.date,
      totalAmount: pi.totalAmount,
      quantity: pi.quantity,
      totalPieces: pi.quantity * piecesPerSet,
      destination: pi.destinationCountry,
      status: 'completed',
      terms: pi.tradeTerms,
      unitPrice: pi.unitPrice,
      documents: { ci: true, pl: true, pc: true, customs: true },
    })
    setSavedToHistory(true)
  }, [historyStore, piStore, data])

  const renderPreview = () => {
    switch (activeTab) {
      case 'commercial_invoice':
        return <CommercialInvoicePreview data={data} />
      case 'purchase_contract':
        return <PurchaseContractPreview data={data} />
      case 'packing_list':
        return <PackingListPreview data={data} />
      case 'customs_declaration':
        return <CustomsDeclarationPreview data={data} />
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {/* ---- Header ---- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: cardEase }}
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1D23] tracking-tight">文档生成</h1>
            <p className="text-sm text-[#5A6270] mt-1">预览并导出报关资料</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">
              <Check size={12} /> 第 4 步 / 共 4 步
            </span>
          </div>
        </div>
        <Stepper currentStep={4} />
      </motion.section>

      {/* ---- Document Status Cards ---- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: cardEase }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <DocCard
          icon={FileText}
          iconColor="#2563EB"
          title="商业发票"
          subtitle="Commercial Invoice"
          active={activeTab === 'commercial_invoice'}
          onClick={() => setActiveTab('commercial_invoice')}
          generated={generatedDocs.commercial_invoice}
        />
        <DocCard
          icon={FileSpreadsheet}
          iconColor="#4F46E5"
          title="采购合同"
          subtitle="Purchase Contract"
          active={activeTab === 'purchase_contract'}
          onClick={() => setActiveTab('purchase_contract')}
          generated={generatedDocs.purchase_contract}
        />
        <DocCard
          icon={Package}
          iconColor="#16A34A"
          title="装箱单"
          subtitle="Packing List"
          active={activeTab === 'packing_list'}
          onClick={() => setActiveTab('packing_list')}
          generated={generatedDocs.packing_list}
        />
        <DocCard
          icon={Scale}
          iconColor="#D97706"
          title="报关单"
          subtitle="Customs Declaration"
          active={activeTab === 'customs_declaration'}
          onClick={() => setActiveTab('customs_declaration')}
          generated={generatedDocs.customs_declaration}
        />
      </motion.section>

      {/* ---- Batch Actions Bar ---- */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="jt-card px-5 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <span className="text-sm text-[#5A6270]">
          当前文档: <span className="font-medium text-[#1A1D23]">
            {tabs.find((t) => t.key === activeTab)?.label}
          </span>
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportSingle}
            className="jt-btn-secondary flex items-center gap-1.5 text-xs py-2 px-3"
          >
            <Download size={14} />
            导出当前 (.xlsx)
          </button>
          <button
            onClick={handleExportAll}
            className="jt-btn-primary flex items-center gap-1.5 text-xs py-2 px-3"
          >
            <Download size={14} />
            导出全部 (.xlsx)
          </button>
        </div>
      </motion.section>

      {/* ---- Tab Bar ---- */}
      <div className="flex border-b border-[#E2E5E9]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              'px-5 py-3 text-sm font-medium transition-all duration-200 border-b-2 -mb-px',
              activeTab === tab.key
                ? 'text-[#2563EB] border-[#2563EB]'
                : 'text-[#8F96A3] border-transparent hover:text-[#5A6270]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- Document Preview ---- */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: cardEase }}
        className="jt-card overflow-hidden"
      >
        <div className="max-h-[70vh] overflow-auto">{renderPreview()}</div>
      </motion.div>

      {/* ---- Completion Banner ---- */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3, ease: cardEase }}
        className="rounded-xl px-6 py-5 border border-[#BBF7D0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        style={{ backgroundColor: '#F0FDF4' }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1A1D23]">所有文档已生成完毕</h3>
            <p className="text-sm text-[#5A6270]">
              {data.piNo || '—'} 的报关资料已准备就绪
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveToHistory}
            disabled={savedToHistory}
            className={[
              'jt-btn-secondary flex items-center gap-1.5 text-xs',
              savedToHistory ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {savedToHistory ? <Check size={14} /> : <Download size={14} />}
            {savedToHistory ? '已保存' : '保存到历史'}
          </button>
        </div>
      </motion.section>

      {/* ---- Action Bar ---- */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="fixed bottom-0 left-0 right-0 lg:left-[260px] bg-white border-t border-[#E2E5E9] px-6 py-4 z-50 flex items-center justify-between"
      >
        <button
          onClick={() => navigate('/price-adjust')}
          className="jt-btn-secondary flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          上一步
        </button>
        <button
          onClick={() => navigate('/')}
          className="jt-btn-primary flex items-center gap-2"
        >
          <Home size={16} />
          完成并返回工作台
        </button>
      </motion.div>
    </div>
  )
}
