# walkthrough.md

## Bootstrap Fase 0 - concluido

### O que foi feito
- Projeto Vite + React + TypeScript inicializado no repositório atual.
- Template padrão removido (logos/css de exemplo).
- Tailwind CSS v4 configurado com plugin oficial do Vite.
- `shadcn/ui` inicializado e componentes base adicionados.
- `Biome` configurado como ferramenta única de lint/format/check.
- `ESLint` removido (dependências e arquivo de configuração).
- Hooks Git (`pre-commit` e `pre-push`) configurados com Husky + lint-staged.
- Shell inicial da UI criada no estilo TablePlus (header, explorer, área grid e console).

### Arquivos principais
- `package.json` e `package-lock.json`
- `biome.json`
- `.husky/pre-commit`
- `.husky/pre-push`
- `src/App.tsx`
- `src/index.css`
- `vite.config.ts`
- `tsconfig.json`
- `index.html`

### Validação executada
- `npm run biome:check` (ok)
- `npm run build` (ok)
- `npm run lint` (ok)
- `npm run format` (ok)

## Fase 1 - Shell da aplicacao

### O que foi feito
- Estrutura modular da interface criada:
  - `TopBar`
  - `ExplorerPane`
  - `DataGridPane`
  - `SqlConsolePane`
- Estado global de sessao criado com React Context (`SessionProvider`).
- Dataset mockado adicionado para simular objetos SQLite e tabela `vehicles`.
- Fluxos funcionais habilitados:
  - Busca e selecao de objetos no explorer.
  - Renderizacao de grade por pagina (`LIMIT/OFFSET` simulado via slicing).
  - Selecao de linha.
  - Execucao SQL simulada com log e notificacao.

### Arquivos principais
- `src/app/session/session-provider.tsx`
- `src/app/session/types.ts`
- `src/features/mock/mock-schema.ts`
- `src/features/workspace/top-bar.tsx`
- `src/features/workspace/explorer-pane.tsx`
- `src/features/workspace/data-grid-pane.tsx`
- `src/features/workspace/sql-console-pane.tsx`
- `src/features/workspace/workspace-shell.tsx`
- `src/App.tsx`

## Tema light/dark/system

### O que foi feito
- `ThemeProvider` adicionado com persistencia em `localStorage`.
- `ThemeToggle` adicionado na `TopBar` com opcoes `Light`, `Dark` e `System`.
- `Toaster` (`sonner`) ligado ao tema atual via `useTheme`.
- Classes principais do workspace ajustadas para tokens de tema (`background`, `foreground`, `border`, etc.).

### Arquivos principais
- `src/components/theme-provider.tsx`
- `src/components/theme-toggle.tsx`
- `src/components/ui/sonner.tsx`
- `src/features/workspace/top-bar.tsx`
- `src/features/workspace/workspace-shell.tsx`
