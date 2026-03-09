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
