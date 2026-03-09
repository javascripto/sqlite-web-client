# MEMORY

## Contexto do projeto
- App estilo TablePlus para SQLite.
- Frontend: React + TypeScript + Vite.
- UI: Tailwind + shadcn.
- Tabela com virtualização via TanStack Virtual.
- Layout sem scroll na viewport (scroll apenas na tabela).
- Painéis com botões de ocultar/mostrar (lateral e bottom).
- Tema `light/dark/system` incluído.

## Situação atual (onde paramos)
- Fluxo **browser** implementado com File System Access + OPFS.
- Fluxo **Tauri** iniciado para suportar bancos grandes.
- Estratégia híbrida em andamento:
  - Browser para arquivos menores.
  - Tauri para arquivos grandes.
- Erro recorrente no browser para DB grande (1.4GB):
  - `SQLITE_CANTOPEN: sqlite3 result code 14`.
  - Mesmo com cópia completa para OPFS (`src/opfs` com tamanho igual).

## O que já foi feito
- Import para OPFS com progresso, estimativa de storage e mensagens melhores de erro.
- Fallbacks de abertura no engine SQLite WASM (incluindo tentativas read-only/URI/vfs).
- Tratamento de `readOnly` no estado da sessão.
- Cliente Tauri criado:
  - `src/features/sqlite/tauri-sqlite-client.ts`
- Backend Tauri criado:
  - `src-tauri/src/main.rs`
  - `src-tauri/src/sqlite.rs`
  - comandos: `open_database`, `list_objects`, `query_table_page`, `run_sql`, `persist_current_database`.

## Ajustes feitos hoje para Tauri
- Corrigido uso de toolchain Rust do `rustup` nos scripts npm:
  - `tauri:dev`
  - `tauri:build`
- Adicionado:
  - `src-tauri/rust-toolchain.toml` (`stable`)
  - `src-tauri/icons/icon.png` (necessário para gerar contexto Tauri)
- Validação:
  - `npm run build` ✅
  - `cargo check` em `src-tauri` ✅ (com `PATH="$HOME/.cargo/bin:$PATH"`)

## Bloqueio atual
- `npm run tauri:dev` não concluiu por falta de espaço em disco:
  - `No space left on device (os error 28)`
- Sem resolver espaço, não foi possível validar a abertura dos dois bancos no app Tauri.

## Arquivos de teste do usuário
- `/Users/yuri/Downloads/fipe_full.db` (~1.4GB)
- `/Users/yuri/Downloads/fipe_vehicles.db` (~8MB)
- Ambos abrem via `sqlite3` no terminal.

## Próximos passos (ordem recomendada)
1. Liberar espaço em disco suficiente para build Rust/Tauri.
2. Rodar `npm run tauri:dev`.
3. Validar abertura de:
   - `/Users/yuri/Downloads/fipe_full.db`
   - `/Users/yuri/Downloads/fipe_vehicles.db`
4. Confirmar modo híbrido em runtime:
   - Tauri usa backend nativo.
   - Browser mantém OPFS para arquivos menores.
5. (Opcional recomendado) Adicionar seletor explícito de backend no UI (`Auto / Tauri / Browser`) para diagnóstico e fallback manual.
6. Depois da validação: revisar persistência/salvamento no modo Tauri (`persist_current_database`) e UX de mensagens.

## Observações técnicas importantes
- O shell do sistema prioriza `cargo` do Homebrew (`1.81`) em alguns contextos.
- Scripts npm já foram ajustados para priorizar `~/.cargo/bin`.
- Se aparecer erro de toolchain novamente, validar:
  - `cargo --version`
  - `rustc --version`
  - e usar `PATH="$HOME/.cargo/bin:$PATH"` nos comandos.
