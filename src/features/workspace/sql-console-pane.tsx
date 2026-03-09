import { Play } from 'lucide-react';

import { useSession } from '@/app/session/session-provider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export function SqlConsolePane() {
  const {
    state: { queryText, queryLog },
    dispatch,
    runSql,
  } = useSession();

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          SQL Console
        </p>
        <Button
          size="sm"
          className="h-7 bg-blue-700 text-xs hover:bg-blue-600"
          onClick={() => void runSql()}
        >
          <Play className="size-3.5" />
          Run
        </Button>
      </div>

      <div className="grid min-h-0 grid-rows-[auto_1fr] gap-2">
        <Textarea
          value={queryText}
          onChange={event =>
            dispatch({ type: 'SET_QUERY_TEXT', payload: event.target.value })
          }
          className="h-24 resize-none rounded-md border-border bg-card font-mono text-xs text-foreground"
          spellCheck={false}
        />

        <div className="rounded-md border border-border bg-card/30 p-2">
          <div className="space-y-2">
            {queryLog.map(item => (
              <div
                key={item.id}
                className="rounded-sm border border-border bg-background p-2"
              >
                <p className="font-mono text-[11px] text-foreground">
                  {item.sql}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {new Date(item.ranAt).toLocaleTimeString('pt-BR')} |{' '}
                  {item.rows} rows | {item.durationMs} ms | {item.status}
                </p>
              </div>
            ))}

            {!queryLog.length ? (
              <p className="text-xs text-muted-foreground">
                Sem execucoes ainda.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
