import { Clock3, History, Play, Table2 } from 'lucide-react';

import { useSession } from '@/app/session/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function SqlConsolePane() {
  const {
    state: { queryText, queryLog, lastQueryResult, isRunningQuery },
    dispatch,
    runSql,
  } = useSession();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            SQL Console
          </p>
          <Badge
            variant="outline"
            className="px-2 py-0.5 text-[10px]"
          >
            Ctrl/Cmd + Enter
          </Badge>
        </div>
        <Button
          size="sm"
          className="h-7 bg-blue-700 text-xs hover:bg-blue-600"
          onClick={() => void runSql()}
          disabled={isRunningQuery}
        >
          {isRunningQuery ? (
            <Spinner className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
          {isRunningQuery ? 'Running...' : 'Run'}
        </Button>
      </div>

      <div className="mb-2 grid min-h-0 grid-rows-[auto_auto] gap-2">
        <Textarea
          value={queryText}
          onChange={event =>
            dispatch({ type: 'SET_QUERY_TEXT', payload: event.target.value })
          }
          onKeyDown={event => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              void runSql();
            }
          }}
          className="h-24 resize-none rounded-md border-border bg-card font-mono text-xs text-foreground"
          spellCheck={false}
        />
        {lastQueryResult ? (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Badge
              variant={
                lastQueryResult.status === 'ok' ? 'secondary' : 'destructive'
              }
              className="rounded-sm px-2 py-0.5 text-[10px] uppercase"
            >
              {lastQueryResult.status}
            </Badge>
            <span>
              {new Date(lastQueryResult.ranAt).toLocaleTimeString('pt-BR')}
            </span>
            <span>{lastQueryResult.rowCount} rows</span>
            <span>{lastQueryResult.durationMs} ms</span>
            {lastQueryResult.message ? (
              <span className="truncate">{lastQueryResult.message}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <Tabs
        defaultValue="results"
        className="min-h-0"
      >
        <TabsList variant="line">
          <TabsTrigger value="results">
            <Table2 className="size-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="results"
          className="min-h-0"
        >
          <div className="grid h-full min-h-0 overflow-hidden rounded-md border border-border bg-card/30">
            {lastQueryResult ? (
              lastQueryResult.status === 'error' ? (
                <Empty className="m-3 border border-destructive/30 bg-destructive/5 p-6">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Clock3 />
                    </EmptyMedia>
                    <EmptyTitle>Erro ao executar query</EmptyTitle>
                    <EmptyDescription>
                      {lastQueryResult.message}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : lastQueryResult.columns.length > 0 ? (
                <div className="min-h-0 overflow-auto">
                  <div className="min-w-max">
                    <div
                      className="sticky top-0 z-10 grid h-8 border-b border-border bg-background"
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(lastQueryResult.columns.length, 1)}, minmax(160px, 1fr))`,
                      }}
                    >
                      {lastQueryResult.columns.map(column => (
                        <div
                          key={column}
                          className="truncate border-r border-border px-2 text-xs leading-8 text-muted-foreground"
                        >
                          {column}
                        </div>
                      ))}
                    </div>

                    {lastQueryResult.rows.map((row, rowPosition) => {
                      const rowKey = `${lastQueryResult.ranAt}-${JSON.stringify(row)}`;

                      return (
                        <div
                          key={rowKey}
                          className={cn(
                            'grid border-b border-border text-xs',
                            rowPosition % 2 === 0
                              ? 'bg-background'
                              : 'bg-muted/30',
                          )}
                          style={{
                            gridTemplateColumns: `repeat(${Math.max(lastQueryResult.columns.length, 1)}, minmax(160px, 1fr))`,
                          }}
                        >
                          {lastQueryResult.columns.map(column => (
                            <div
                              key={`${rowKey}-${column}`}
                              className="truncate border-r border-border px-2 py-1.5 font-mono"
                            >
                              {String(row[column] ?? '')}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <Empty className="m-3">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Table2 />
                    </EmptyMedia>
                    <EmptyTitle>Statement executado</EmptyTitle>
                    <EmptyDescription>
                      A query não retornou um conjunto tabular. Verifique o
                      histórico ou a grade principal para ver mutações
                      refletidas.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )
            ) : (
              <Empty className="m-3">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Table2 />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum resultado ainda</EmptyTitle>
                  <EmptyDescription>
                    Execute uma query para ver o retorno tabular aqui.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </TabsContent>

        <TabsContent
          value="history"
          className="min-h-0"
        >
          <div className="h-full overflow-auto rounded-md border border-border bg-card/30 p-2">
            <div className="space-y-2">
              {queryLog.map(item => (
                <div
                  key={item.id}
                  className={cn(
                    'rounded-sm border p-2',
                    item.status === 'error'
                      ? 'border-destructive/30 bg-destructive/5'
                      : 'border-border bg-background',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-[11px] text-foreground">
                      {item.sql}
                    </p>
                    <Badge
                      variant={
                        item.status === 'ok' ? 'secondary' : 'destructive'
                      }
                      className="rounded-sm px-2 py-0.5 text-[10px] uppercase"
                    >
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(item.ranAt).toLocaleTimeString('pt-BR')} |{' '}
                    {item.rows} rows | {item.durationMs} ms
                  </p>
                  {item.message ? (
                    <p className="mt-1 text-[11px] text-destructive">
                      {item.message}
                    </p>
                  ) : null}
                </div>
              ))}

              {!queryLog.length ? (
                <p className="text-xs text-muted-foreground">
                  Sem execuções ainda.
                </p>
              ) : null}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
