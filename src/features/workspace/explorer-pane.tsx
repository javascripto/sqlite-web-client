import { ListTree, Search } from 'lucide-react';

import { useSession } from '@/app/session/session-provider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function ExplorerPane() {
  const {
    state: { objects, explorerSearch, activeObject },
    dispatch,
    selectObject,
  } = useSession();

  const normalizedSearch = explorerSearch.trim().toLowerCase();

  const filteredObjects = objects.filter(item =>
    item.name.toLowerCase().includes(normalizedSearch),
  );

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-sidebar p-3 text-sidebar-foreground">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <span>Items</span>
        <Separator
          orientation="vertical"
          className="h-3 bg-border"
        />
        <span>Queries</span>
        <Separator
          orientation="vertical"
          className="h-3 bg-border"
        />
        <span>History</span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
        <Input
          value={explorerSearch}
          onChange={event =>
            dispatch({
              type: 'SET_EXPLORER_SEARCH',
              payload: event.target.value,
            })
          }
          placeholder="Search for item..."
          className="h-8 border-border bg-background pl-7 text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden pr-1">
        <div className="space-y-1">
          {filteredObjects.map(item => {
            const isActive = item.name === activeObject;

            return (
              <button
                key={item.name}
                type="button"
                onClick={() => void selectObject(item.name)}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-blue-700/90 text-white'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <span className="flex items-center gap-2 truncate">
                  <ListTree className="size-3.5 shrink-0 opacity-70" />
                  <span className="truncate font-medium">{item.name}</span>
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'h-5 rounded-sm border-border px-1.5 text-[10px] uppercase',
                    isActive
                      ? 'border-blue-200/40 text-blue-100'
                      : 'text-muted-foreground',
                  )}
                >
                  {item.type}
                </Badge>
              </button>
            );
          })}

          {!filteredObjects.length ? (
            <p className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
              Nenhum objeto encontrado.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
