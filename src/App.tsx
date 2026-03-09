import { SessionProvider } from '@/app/session/session-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { WorkspaceShell } from '@/features/workspace/workspace-shell';

export default function App() {
  return (
    <ThemeProvider
      defaultTheme="system"
      storageKey="vite-ui-theme"
    >
      <TooltipProvider delayDuration={0}>
        <SessionProvider>
          <WorkspaceShell />
          <Toaster
            richColors
            closeButton
          />
        </SessionProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
