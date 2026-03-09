# Table Plus

SQLite viewer/editor inspirado no TablePlus, construído com React + TypeScript + Vite.

## Stack
- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- Biome
- SQLite WASM (`@sqlite.org/sqlite-wasm`)
- Tauri + `rusqlite`

## O que já existe
- Interface tri-pane com explorer, grade de dados e console SQL.
- Tema `light/dark/system`.
- Abertura real de arquivos SQLite no browser via File System Access API.
- Cópia para OPFS por streaming para evitar carregar o arquivo inteiro na memória da app.
- Listagem real de objetos a partir de `sqlite_master`.
- Paginação real da grade.
- Execução real de SQL.
- Sincronização do banco do OPFS de volta para o arquivo local.
- Base híbrida Browser/Tauri com seletor de backend `Auto / Browser / Tauri`.

## Modos de execução

### Browser
Usa File System Access API + SQLite WASM + OPFS.

```bash
npm install
npm run dev
```

### Tauri
Usa backend nativo com `rusqlite`.

```bash
npm install
npm run tauri:dev
```

Observação: no ambiente atual já houve bloqueio por falta de espaço em disco durante o build Tauri.

## Scripts
- `npm run dev`: sobe a aplicação Vite
- `npm run build`: build de produção
- `npm run lint`: lint com Biome
- `npm run format`: format com Biome
- `npm run biome:check`: check completo com Biome
- `npm run tauri:dev`: roda a aplicação desktop
- `npm run tauri:build`: build desktop

## Estrutura principal
- `src/app/session`: estado global da sessão
- `src/features/workspace`: shell e painéis principais
- `src/features/sqlite`: integrações Browser/Tauri/OPFS
- `src-tauri`: backend desktop

## Estado do roadmap
- Concluído:
  - bootstrap
  - shell da aplicação
  - tema
  - fluxo browser com SQLite real
  - base do modo híbrido Browser/Tauri
- Próximo:
  - CRUD inline na grade
  - `INSERT`, `UPDATE` e `DELETE`
  - inspeção de chave primária / `rowid`
  - melhor feedback para bases grandes
