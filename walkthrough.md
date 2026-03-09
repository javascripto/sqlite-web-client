# walkthrough.md

## Fase 0 - Bootstrap técnico

### O que foi feito
- Projeto Vite + React + TypeScript inicializado no repositório atual.
- Template padrão removido.
- Tailwind CSS v4 configurado com plugin oficial do Vite.
- `shadcn/ui` inicializado com componentes base.
- `Biome` configurado como ferramenta única de lint/format/check.
- `ESLint` removido.
- Hooks Git (`pre-commit` e `pre-push`) configurados com Husky + lint-staged.

### Validação executada
- `npm run biome:check`
- `npm run build`
- `npm run lint`
- `npm run format`

## Fase 1 - Shell da aplicação

### O que foi feito
- Estrutura modular da interface criada:
  - `TopBar`
  - `ExplorerPane`
  - `DataGridPane`
  - `SqlConsolePane`
- Estado global de sessão criado com React Context.
- Dataset mockado adicionado para permitir fluxo inicial sem banco aberto.
- Fluxos funcionais habilitados:
  - busca e seleção de objetos
  - paginação
  - seleção de linha
  - execução SQL simulada

### Arquivos principais
- `src/app/session/session-provider.tsx`
- `src/app/session/types.ts`
- `src/features/mock/mock-schema.ts`
- `src/features/workspace/*.tsx`

## Tema light/dark/system

### O que foi feito
- `ThemeProvider` adicionado com persistência em `localStorage`.
- `ThemeToggle` adicionado na `TopBar`.
- `Toaster` (`sonner`) ligado ao tema atual.
- Tokens visuais do workspace ajustados para `background`, `foreground`, `border` e afins.

### Arquivos principais
- `src/components/theme-provider.tsx`
- `src/components/theme-toggle.tsx`
- `src/components/ui/sonner.tsx`

## Fase 2 - Browser com File System Access + SQLite WASM

### O que foi feito
- `SQLite` integrado via worker (`@sqlite.org/sqlite-wasm`) com `OPFS`.
- Fluxo real de abertura do `.db` no browser:
  - `showOpenFilePicker`
  - cópia por streaming para OPFS
  - abertura do banco no worker
- Explorer passou a listar objetos reais de `sqlite_master`.
- Data grid passou a carregar dados reais paginados por tabela.
- Console SQL passou a executar queries reais.
- Botão de sincronização exporta o banco de OPFS de volta para o arquivo local.
- Headers COOP/COEP no Vite foram adicionados para habilitar worker/OPFS.

### Arquivos principais
- `src/features/sqlite/sqlite-engine.ts`
- `src/features/sqlite/fs-access-gateway.ts`
- `src/app/session/session-provider.tsx`
- `vite.config.ts`

## Fase 3 - Modo híbrido Browser/Tauri

### O que foi feito
- Fluxo Tauri iniciado para suportar bancos grandes fora das limitações práticas do browser.
- Backend nativo criado com `rusqlite` para:
  - abrir banco
  - listar objetos
  - paginar tabela
  - executar SQL
- Cliente frontend para Tauri criado em `src/features/sqlite/tauri-sqlite-client.ts`.
- Scripts npm ajustados para priorizar toolchain do `rustup`.
- Estado de sessão expandido para rastrear:
  - backend preferido
  - backend ativo
  - modo `read-only`
- `TopBar` atualizada com seletor explícito `Auto / Browser / Tauri`.
- A UI agora ajusta a ação de salvar conforme o backend ativo.

### Arquivos principais
- `src/features/sqlite/tauri-sqlite-client.ts`
- `src-tauri/src/main.rs`
- `src-tauri/src/sqlite.rs`
- `src/app/session/session-provider.tsx`
- `src/app/session/types.ts`
- `src/features/workspace/top-bar.tsx`

### Estado atual
- Browser funciona para bancos menores com OPFS.
- Tauri está preparado no código, mas a validação end-to-end segue pendente.
- O bloqueio operacional atual continua sendo espaço em disco insuficiente para concluir `npm run tauri:dev`.

## Próxima fase recomendada

### Fase 4 - CRUD e inspeção de dados
- Adicionar edição inline na grade.
- Implementar `INSERT`, `UPDATE` e `DELETE`.
- Resolver estratégia de identificação por chave primária ou `rowid`.
- Fazer refresh granular da página após mutações.
