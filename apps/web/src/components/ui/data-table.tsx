"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  filterPlaceholder?: string;
  globalFilterKey?: string;
}

export function DataTable<TData>({ columns, data, filterPlaceholder = "Search…" }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, columnFilters, globalFilter },
  });

  return (
    <div className="space-y-3">
      <input
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder={filterPlaceholder}
        className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Desktop table */}
      <div className="hidden sm:block overflow-auto rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={cn(
                      "px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap",
                      header.column.getCanSort() && "cursor-pointer select-none hover:text-gray-900",
                    )}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {table.getRowModel().rows.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400">No results.</div>
        )}
      </div>

      {/* Mobile card list */}
      <ul className="sm:hidden space-y-2">
        {table.getRowModel().rows.length === 0 ? (
          <li className="text-center text-sm text-gray-400 py-8">No results.</li>
        ) : (
          table.getRowModel().rows.map((row) => (
            <li key={row.id} className="rounded-lg border bg-white p-4 shadow-sm space-y-2">
              {row.getVisibleCells().map((cell) => (
                <div key={cell.id} className="flex items-start justify-between text-sm">
                  <span className="font-medium text-gray-500 mr-2 whitespace-nowrap">
                    {typeof cell.column.columnDef.header === "string"
                      ? cell.column.columnDef.header
                      : cell.column.id}
                    :
                  </span>
                  <span className="text-right">{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                </div>
              ))}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
