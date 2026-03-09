import {
  Database,
  FolderOpenDot,
  Hammer,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Sigma,
} from 'lucide-react';

import { useSession } from '@/app/session/session-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function TopBar() {
  const {
    state: {
      databaseName,
      sqliteVersion,
      openStatus,
      activeObject,
      isExplorerVisible,
      isSqlConsoleVisible,
    },
    dispatch,
  } = useSession();

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-card px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Badge
          variant="secondary"
          className="rounded-sm"
        >
          DEVELOPMENT
        </Badge>
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Database className="size-3.5 text-muted-foreground" />
          <p className="truncate">{databaseName ?? 'No database opened'}</p>
          <span className="text-border">|</span>
          <p>SQLite {sqliteVersion ?? '-'}</p>
          {activeObject ? (
            <>
              <span className="text-border">|</span>
              <p className="font-semibold text-foreground">{activeObject}</p>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="px-2 py-0.5 text-[10px] uppercase tracking-wide"
        >
          {openStatus}
        </Badge>
        <Button
          size="sm"
          variant="outline"
          className="bg-card hover:bg-accent"
        >
          <FolderOpenDot className="size-4" />
          Abrir .db
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-card hover:bg-accent"
        >
          <Sigma className="size-4" />
          SQL
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="bg-card hover:bg-accent"
        >
          <Hammer className="size-4" />
          Tools
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-8 bg-card hover:bg-accent"
          onClick={() => dispatch({ type: 'TOGGLE_EXPLORER_PANEL' })}
          title={
            isExplorerVisible
              ? 'Ocultar painel lateral'
              : 'Mostrar painel lateral'
          }
          aria-label={
            isExplorerVisible
              ? 'Ocultar painel lateral'
              : 'Mostrar painel lateral'
          }
        >
          {isExplorerVisible ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-8 bg-card hover:bg-accent"
          onClick={() => dispatch({ type: 'TOGGLE_SQL_CONSOLE_PANEL' })}
          title={
            isSqlConsoleVisible
              ? 'Ocultar painel inferior'
              : 'Mostrar painel inferior'
          }
          aria-label={
            isSqlConsoleVisible
              ? 'Ocultar painel inferior'
              : 'Mostrar painel inferior'
          }
        >
          {isSqlConsoleVisible ? (
            <PanelBottomClose className="size-4" />
          ) : (
            <PanelBottomOpen className="size-4" />
          )}
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
