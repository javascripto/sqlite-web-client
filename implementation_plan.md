# implementation_plan.md

## 1. Objetivo do produto
Construir uma aplicação web estilo TablePlus para SQLite, com navegação de schema, inspeção/edição de dados e execução de SQL, operando tanto no browser quanto em desktop via Tauri quando necessário.

## 2. Estado atual do projeto

### Concluído
- Bootstrap com React + TypeScript + Vite.
- UI base com Tailwind CSS v4 + shadcn/ui.
- Biome como stack única de lint/format.
- Shell principal da aplicação.
- Tema `light/dark/system`.
- Fluxo browser com File System Access API + SQLite WASM + OPFS.
- Listagem real de objetos, paginação real de tabelas e execução SQL real.
- Base do modo híbrido com backend Tauri.
- Seletor explícito de backend na UI (`Auto / Browser / Tauri`).

### Pendente
- Validar Tauri com bancos reais grandes.
- Implementar CRUD na grade.
- Exibir resultado tabular da query SQL.
- Polir mensagens, persistência e UX para bases grandes.

## 3. Decisões consolidadas
- Stack base: React + TypeScript + Vite.
- UI base: Tailwind CSS + shadcn/ui.
- Qualidade: Biome no lugar de ESLint/Prettier.
- Banco no browser: `@sqlite.org/sqlite-wasm`.
- Fluxo browser: File System Access API + OPFS com cópia por streaming.
- Fluxo desktop: Tauri + `rusqlite`.
- Grid: tabela própria com virtualização de linhas usando `@tanstack/react-virtual`.
- Estratégia híbrida:
  - `Browser` para fluxo web e bases menores.
  - `Tauri` para bancos grandes e diagnóstico desktop.
  - `Auto` como modo padrão dependente do runtime.

## 4. Arquitetura vigente

### SessionStore
Responsável por:
- metadados do banco aberto
- objeto ativo
- paginação
- histórico SQL
- estado visual dos painéis
- backend preferido, backend ativo e `read-only`

### Browser path
- `FsAccessGateway`
  - seleção do arquivo
  - persistência do `FileSystemFileHandle`
  - permissões e sincronização
- `SqliteEngine`
  - inicialização do worker SQLite
  - abertura do banco em OPFS
  - consultas paginadas
  - execução SQL

### Tauri path
- `TauriSqliteClient`
  - ponte frontend para `invoke`
- `src-tauri/src/sqlite.rs`
  - abertura do banco
  - leitura do schema
  - paginação
  - execução SQL

## 5. Próxima fase de implementação

### Fase 4 - CRUD e inspeção de dados
Objetivo: sair de um visualizador/executor SQL para um editor operacional.

#### Escopo
- edição inline de células
- inserção e exclusão de linhas
- detecção de chave primária e fallback para `rowid`
- persistência das mutações no backend ativo
- recarga granular da página/tabela

#### Critérios de aceite
- usuário consegue editar ao menos uma célula e salvar
- usuário consegue inserir e deletar uma linha
- fluxo funciona em `Browser` e `Tauri`
- grade reflete mutações sem precisar reabrir o banco

## 6. Riscos atuais e mitigação
- Browser ainda falha com DB muito grande (`SQLITE_CANTOPEN`):
  - mitigação: manter Tauri como rota nativa e validá-la assim que houver espaço em disco
- Tabelas sem chave primária:
  - mitigação: fallback para `rowid` quando suportado e aviso explícito quando não houver identificador seguro
- Persistência no Tauri ainda superficial:
  - mitigação: revisar `persist_current_database` após validar o runtime desktop

## 7. Plano de validação

### Frontend
- `npm run build`
- `npm run biome:check`

### Desktop
- `cargo check` em `src-tauri`
- `npm run tauri:dev` com:
  - `/Users/yuri/Downloads/fipe_vehicles.db`
  - `/Users/yuri/Downloads/fipe_full.db`

## 8. Observação operacional
O bloqueio prático para fechar a trilha Tauri continua sendo espaço em disco insuficiente durante o build desktop.
