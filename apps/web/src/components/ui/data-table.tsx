"use client";

import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  filterPlaceholder?: string;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData>({
  columns,
  data,
  filterPlaceholder = "Search…",
  onRowClick,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, pagination },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-4">
      <Input
        placeholder={filterPlaceholder}
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-sm"
      />

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={header.column.getCanSort() ? "cursor-pointer select-none" : ""}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-muted-foreground">
                          {header.column.getIsSorted() === "asc" ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {table.getRowModel().rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No records found.</p>
        ) : (
          table.getRowModel().rows.map((row) => (
            <div
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              className={`rounded-lg border bg-card p-4 shadow-sm space-y-2 ${
                onRowClick ? "cursor-pointer" : ""
              }`}
            >
              {row.getVisibleCells().map((cell) => {
                const headerLabel = String(cell.column.columnDef.header ?? cell.column.id);
                if (headerLabel === "Actions") {
                  return (
                    <div key={cell.id} className="pt-2 border-t">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                }
                return (
                  <div key={cell.id} className="flex justify-between gap-2 text-sm">
                    <span className="font-medium text-muted-foreground shrink-0">
                      {headerLabel}
                    </span>
                    <span className="text-right">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </span>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
