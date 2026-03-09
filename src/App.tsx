import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Toaster } from '@/components/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function App() {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="grid min-h-screen grid-rows-[auto_1fr] bg-zinc-950 text-zinc-100">
        <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-sm bg-zinc-800 text-zinc-200"
            >
              DEVELOPMENT
            </Badge>
            <p className="truncate text-xs text-zinc-300">
              table-plus-web | SQLite no browser
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
              >
                Abrir .db
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              A integração com File System Access API entra na próxima fase.
            </TooltipContent>
          </Tooltip>
        </header>

        <main className="grid min-h-0 grid-cols-[280px_1fr]">
          <aside className="flex min-h-0 flex-col border-r border-zinc-800 bg-zinc-900/50 p-3">
            <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-400">
              <span>Items</span>
              <Separator
                orientation="vertical"
                className="h-3 bg-zinc-700"
              />
              <span>Queries</span>
              <Separator
                orientation="vertical"
                className="h-3 bg-zinc-700"
              />
              <span>History</span>
            </div>
            <Input
              placeholder="Search for item..."
              className="h-8 border-zinc-700 bg-zinc-950 text-zinc-200 placeholder:text-zinc-500"
            />
            <div className="mt-4 rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
              Explorer pronto para receber schema SQLite.
            </div>
          </aside>

          <section className="grid min-h-0 grid-rows-[1fr_180px]">
            <div className="border-b border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex h-full items-center justify-center rounded-md border border-zinc-800 bg-zinc-900/40 text-sm text-zinc-500">
                Data grid area
              </div>
            </div>
            <div className="bg-zinc-950 p-3">
              <div className="h-full rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-500">
                SQL console area
              </div>
            </div>
          </section>
        </main>
      </div>
      <Toaster
        richColors
        closeButton
      />
    </TooltipProvider>
  );
}
