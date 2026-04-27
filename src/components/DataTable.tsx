import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

type SortDirection = 'asc' | 'desc' | null

interface Column<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  selectedRow?: string | null
  onRowSelect?: (key: string | null) => void
  emptyText?: string
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  selectedRow,
  onRowSelect,
  emptyText = '暂无数据',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') {
        setSortKey(null)
        setSortDir(null)
      } else {
        setSortDir('asc')
      }
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sortedData = [...data]
  if (sortKey && sortDir) {
    sortedData.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey]
      const bVal = (b as Record<string, unknown>)[sortKey]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      const aStr = String(aVal)
      const bStr = String(bVal)
      return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
    })
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-[#8F96A3] text-sm">
        {emptyText}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-[#F8F9FB] border-b border-[#E2E5E9]">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={[
                  'px-4 py-3 text-xs font-medium uppercase tracking-wider text-[#8F96A3] whitespace-nowrap',
                  col.sortable ? 'cursor-pointer select-none hover:text-[#2563EB] transition-colors' : '',
                  col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                ].join(' ')}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-1" style={{ justifyContent: col.align === 'center' ? 'center' : col.align === 'right' ? 'flex-end' : 'flex-start' }}>
                  {col.header}
                  {col.sortable && (
                    <span className="inline-flex flex-col -space-y-1">
                      <ChevronUp size={12} className={sortKey === col.key && sortDir === 'asc' ? 'text-[#2563EB]' : 'text-[#C9CDD4]'} />
                      <ChevronDown size={12} className={sortKey === col.key && sortDir === 'desc' ? 'text-[#2563EB]' : 'text-[#C9CDD4]'} />
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => {
            const key = keyExtractor(row)
            const isSelected = selectedRow === key
            return (
              <tr
                key={key}
                className={[
                  'border-b border-[#E2E5E9] transition-all duration-150 cursor-pointer',
                  isSelected
                    ? 'bg-[#EFF6FF] border-l-[3px] border-l-[#2563EB]'
                    : index % 2 === 1
                      ? 'bg-[#F8F9FB]'
                      : 'bg-white',
                  !isSelected && 'hover:bg-[#F1F5F9]',
                ].join(' ')}
                onClick={() => onRowSelect?.(isSelected ? null : key)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-3.5 text-sm',
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left',
                    ].join(' ')}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
