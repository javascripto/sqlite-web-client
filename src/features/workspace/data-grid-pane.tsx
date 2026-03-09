import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronLeft, ChevronRight, Columns3, Filter } from 'lucide-react';
import { useRef } from 'react';

import { useActiveTableData, useSession } from '@/app/session/session-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DataGridPane() {
  const {
    state: { activeObject, page, pageSize, selectedRowIndex },
    dispatch,
    setPage,
  } = useSession();

  const tableData = useActiveTableData();
  const hasData = Boolean(activeObject && tableData);

  const totalRows = tableData?.totalRows ?? 0;
  const pageStart = page * pageSize;
  const rows = tableData?.rows ?? [];
  const totalPages = Math.max(Math.ceil(totalRows / pageSize), 1);
  const columns = tableData?.columns ?? [];
  const columnTemplate = `repeat(${Math.max(columns.length, 1)}, minmax(140px, 1fr))`;

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 16,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr_auto] rounded-md border border-border bg-card/30">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <p className="truncate font-semibold text-foreground">
            {activeObject ?? 'No table selected'}
          </p>
          <span className="text-border">|</span>
          <p>{totalRows.toLocaleString('en-US')} rows</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 bg-background text-xs hover:bg-accent"
          >
            <Filter className="size-3.5" />
            Filters
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 bg-background text-xs hover:bg-accent"
          >
            <Columns3 className="size-3.5" />
            Columns
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 overflow-auto"
      >
        <div className="min-w-max">
          {hasData ? (
            <>
              <div className="sticky top-0 z-10 border-b border-border bg-background">
                <div
                  className="grid h-8"
                  style={{ gridTemplateColumns: columnTemplate }}
                >
                  {columns.map(column => (
                    <div
                      key={column}
                      className="truncate border-r border-border px-2 text-xs leading-8 text-muted-foreground"
                    >
                      {column}
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="relative"
                style={{ height: rowVirtualizer.getTotalSize() }}
              >
                {virtualRows.map(virtualRow => {
                  const row = rows[virtualRow.index];
                  const absoluteIndex = pageStart + virtualRow.index;
                  const isSelected = selectedRowIndex === absoluteIndex;

                  return (
                    <button
                      key={`${activeObject}-${absoluteIndex}`}
                      type="button"
                      className={cn(
                        'absolute left-0 top-0 w-full cursor-pointer border-b border-border text-foreground',
                        absoluteIndex % 2 === 0
                          ? 'bg-background'
                          : 'bg-muted/40',
                        isSelected
                          ? 'bg-blue-700 text-white hover:bg-blue-700'
                          : 'hover:bg-accent/70',
                      )}
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                      onClick={() =>
                        dispatch({ type: 'SELECT_ROW', payload: absoluteIndex })
                      }
                    >
                      <div
                        className="grid h-full"
                        style={{ gridTemplateColumns: columnTemplate }}
                      >
                        {columns.map(column => (
                          <div
                            key={`${absoluteIndex}-${column}`}
                            className="truncate border-r border-border px-2 text-left font-mono text-xs leading-8"
                          >
                            {String(row[column] ?? '')}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-border bg-card/40 text-sm text-muted-foreground">
              Selecione uma tabela no painel esquerdo.
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <p>
          {selectedRowIndex === null
            ? 'No row selected'
            : `Row ${selectedRowIndex + 1} selected`}
        </p>
        <div className="flex items-center gap-2">
          <p>
            Page {page + 1} of {totalPages}
          </p>
          <Button
            size="icon"
            variant="outline"
            className="size-7 bg-background hover:bg-accent"
            onClick={() => void setPage(page - 1)}
            disabled={page <= 0}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="size-7 bg-background hover:bg-accent"
            onClick={() => void setPage(page + 1)}
            disabled={page + 1 >= totalPages}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
