import { useSession } from '@/app/session/session-provider';
import { DataGridPane } from '@/features/workspace/data-grid-pane';
import { ExplorerPane } from '@/features/workspace/explorer-pane';
import { SqlConsolePane } from '@/features/workspace/sql-console-pane';
import { TopBar } from '@/features/workspace/top-bar';
import { cn } from '@/lib/utils';

export function WorkspaceShell() {
  const {
    state: { isExplorerVisible, isSqlConsoleVisible },
  } = useSession();

  return (
    <div className="grid h-screen grid-rows-[auto_1fr] overflow-hidden bg-muted text-foreground">
      <TopBar />

      <main
        className={cn(
          'grid min-h-0 overflow-hidden',
          isExplorerVisible ? 'grid-cols-[280px_1fr]' : 'grid-cols-[1fr]',
        )}
      >
        {isExplorerVisible ? <ExplorerPane /> : null}

        <section
          className={cn(
            'grid min-h-0 overflow-hidden',
            isSqlConsoleVisible ? 'grid-rows-[1fr_240px]' : 'grid-rows-[1fr]',
          )}
        >
          <div
            className={cn(
              'min-h-0 bg-background p-3',
              isSqlConsoleVisible ? 'border-b border-border' : '',
            )}
          >
            <DataGridPane />
          </div>
          {isSqlConsoleVisible ? <SqlConsolePane /> : null}
        </section>
      </main>
    </div>
  );
}
