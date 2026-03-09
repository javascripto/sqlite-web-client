# implementation_plan.md

## 1) Objetivo do Produto
Construir uma aplicação web estilo TablePlus para SQLite, rodando no browser, com foco em navegação de tabelas, inspeção/edição de dados e execução de SQL.

## 2) Escopo desta Etapa
Somente planejamento técnico e de produto.
Nenhum scaffold, instalação de dependências ou implementação será executado nesta fase.

## 3) Requisitos Confirmados
- Stack base: React + TypeScript + Vite.
- UI base: Tailwind CSS + shadcn/ui.
- Qualidade: Biome como substituto de ESLint/Prettier.
- Limpeza inicial do template padrão antes de iniciar desenvolvimento.
- Banco no browser com SQLite WebAssembly.
- Uso da File System Access API.
- Arquivo `.db` deve ser aberto para uso direto no fluxo do app, evitando modelo de trabalho com “dataset em memória” para browsing/CRUD.
- Interface inspirada nas referências enviadas:
  - Sidebar de objetos (tabelas/views).
  - Grid tabular denso com seleção de linha.
  - Área de SQL/log na parte inferior.

## 4) Skills Aplicadas no Planejamento
- `Antigravity Knowledge System`: checagem prévia de KIs (nenhum KI disponível no momento).
- `Antigravity Operational Framework`: plano estruturado com fases e validação.
- `Antigravity Web Design`: direcionamento visual premium e aderência à referência.
- `init-vite-react-ts`: sequência de bootstrap planejada.
- `add-tailwind-shadcn`: sequência de configuração Tailwind + shadcn planejada.
- `biome-upgrade-hooks`: sequência de migração para Biome e remoção de legado planejada.

## 5) Arquitetura Planejada (alto nível)

### [NEW] Runtime e Persistência
- Camada `FsAccessGateway` para:
  - Solicitar arquivo via `showOpenFilePicker`.
  - Guardar `FileSystemFileHandle` em estado persistível (IndexedDB).
  - Revalidar permissões (`queryPermission`/`requestPermission`) ao reabrir app.
- Camada `SqliteEngine` (WASM) para:
  - Inicializar runtime SQLite no browser.
  - Abrir conexão associada ao arquivo selecionado.
  - Executar queries paginadas e comandos SQL.
- Camada `SessionStore` para:
  - DB ativo, tabela ativa, filtros, paginação e histórico SQL.
  - Estado de UI (painéis e dimensões).

### [NEW] Estratégia de I/O (sem “carregar tudo”)
- Navegação por dados via `SELECT ... LIMIT ... OFFSET ...` e ordenação explícita.
- Preview/contagem com queries dedicadas (`COUNT(*)` sob demanda).
- Edição por linha com `UPDATE/INSERT/DELETE` direcionado por chave primária ou `rowid`.
- Commit síncrono no fluxo de edição e refresh granular da grade.
- Bufferização estritamente de página/resultado, não da base inteira.

### [NEW] Módulos de Interface
- `ExplorerPane` (esquerda): lista de tabelas/objetos com busca.
- `DataGridPane` (centro): grid virtualizável, seleção, ordenação, filtros.
- `SqlConsolePane` (inferior): editor SQL, execução, histórico e log.
- `TopBar`: contexto do arquivo aberto, versão SQLite, ações principais.

### [NEW] Design System e UX
- Tema dark por padrão (inspirado na referência).
- Tipografia monoespaçada em grid/console e legível no restante.
- Densidade alta com foco em produtividade.
- Atalhos de teclado para ações frequentes (executar SQL, focar busca, navegar linhas).

## 6) Fases de Execução (quando você autorizar)

### [NEW] Fase 0 - Bootstrap técnico
- Criar app com `init-vite-react-ts`.
- Limpar template padrão.
- Configurar Tailwind + shadcn com `add-tailwind-shadcn`.
- Aplicar Biome + remoção ESLint/Prettier com `biome-upgrade-hooks`.

### [NEW] Fase 1 - Shell da aplicação
- Layout tri-pane (explorer + grid + console).
- Estado global inicial e rotas básicas (se necessário).
- Placeholders funcionais com dados mockados.

### [NEW] Fase 2 - Integração de arquivo + SQLite WASM
- Fluxo de abrir arquivo `.db`.
- Inicialização do engine WASM.
- Carregamento de schema e listagem de tabelas.

### [NEW] Fase 3 - Data grid real
- Query paginada, ordenação, filtro e seleção.
- Navegação por tabela e inspeção de estrutura.
- Ações de CRUD em linha/célula.

### [NEW] Fase 4 - SQL console
- Execução de SQL arbitrário.
- Exibição de resultados tabulares.
- Histórico e logs de execução.

### [NEW] Fase 5 - Polimento
- UX states (loading/erro/permissão negada).
- Atalhos de teclado.
- Performance com tabelas grandes.

## 7) Critérios de Aceite do MVP
- Usuário abre um `.db` local pelo browser.
- App lista tabelas e permite selecionar uma tabela.
- App exibe dados paginados sem tentativa de carregar banco inteiro.
- Usuário executa SQL no console e vê resultado/log.
- Usuário realiza ao menos 1 `INSERT`, 1 `UPDATE` e 1 `DELETE`.
- Interface permanece fluida com tabela de volume alto (benchmark inicial a definir).

## 8) Riscos Técnicos e Mitigações
- Risco: limitações de escrita/flush do ambiente WASM + FS API.
  - Mitigação: prova de conceito isolada na Fase 2 antes de avançar UI avançada.
- Risco: performance de grid em tabelas muito grandes.
  - Mitigação: virtualização, paginação server-style e queries com índices.
- Risco: ausência de chave primária em algumas tabelas.
  - Mitigação: fallback com `rowid` quando disponível + aviso de limitações.
- Risco: permissões revogadas da File System Access API.
  - Mitigação: camada de reautorização e recuperação de sessão.

## 9) Plano de Verificação (por fase)
- Qualidade estática:
  - `npm run lint`
  - `npm run format`
  - `npm run biome:check`
- Execução:
  - `npm run dev` sem erros de runtime.
- Fluxo funcional:
  - Abrir arquivo.
  - Navegar schema.
  - Paginar dados.
  - Executar SQL.
  - Persistir alterações.

## 10) Decisões em Aberto para fechar antes da implementação
1. Engine SQLite WASM final (opção A/B) e estratégia de binding com File System Access API.
2. Biblioteca do grid (TanStack Table + virtualizer ou alternativa).
3. Escopo de primeira versão do editor SQL (simples vs autocomplete básico).
