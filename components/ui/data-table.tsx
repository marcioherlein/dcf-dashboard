'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  className?: string
  stickyHeader?: boolean
  compact?: boolean
  emptyMessage?: string
}

export function DataTable<TData>({
  columns, data, className, stickyHeader, compact, emptyMessage = 'No data',
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const cellPad = compact ? 'px-3 py-1.5' : 'px-4 py-3'

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} className="border-b border-[#E3E1DA]">
              {hg.headers.map(header => {
                const canSort = header.column.getCanSort()
                const sorted  = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    className={cn(
                      cellPad, 'text-label uppercase tracking-wider text-[#8A95A6] font-bold text-left select-none',
                      stickyHeader && 'sticky top-0 bg-[#080F1E] z-10',
                      canSort && 'cursor-pointer hover:text-[#566174]',
                      (header.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' && 'text-right',
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="opacity-50">
                          {sorted === 'asc' ? <ChevronUp size={12} /> : sorted === 'desc' ? <ChevronDown size={12} /> : <ChevronsUpDown size={12} />}
                        </span>
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={cn(cellPad, 'text-center text-[#8A95A6] py-8')}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row, i) => (
              <tr key={row.id} className={i % 2 === 0 ? 'bg-transparent' : 'bg-white/4'}>
                {row.getVisibleCells().map(cell => (
                  <td
                    key={cell.id}
                    className={cn(
                      cellPad, 'text-[#CDD1C8]',
                      (cell.column.columnDef.meta as { align?: string } | undefined)?.align === 'right' && 'text-right font-mono',
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
