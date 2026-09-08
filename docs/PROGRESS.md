# Progress

## M0 — Fundação — CONCLUÍDO

- Projeto npm inicializado (ESM, Node >= 20).
- `tsconfig.json` em modo `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`.
- ESLint 9 (flat config) com `typescript-eslint` type-checked, banindo `Math.random` fora de
  `tests/**` via `no-restricted-properties`. Prettier configurado (não roda no `verify`, é
  formatação local).
- Vitest configurado com cobertura v8 (`src/rules/**`, `src/engine/**`, mínimo 90% de linhas —
  ainda vazios, então o relatório mostra 0/0 e o threshold não bloqueia; vai passar a valer a
  partir do M3).
- RNG semeado `mulberry32` em `src/core/rng.ts` (`next`, `nextInt`, `shuffle`, `pick`,
  `getState`), com teste de reprodutibilidade (mesma seed → mesma sequência) em
  `tests/unit/rng.test.ts`.
- `npm run verify` = `typecheck && lint && test:coverage`. Passa limpo no projeto
  praticamente vazio.

**Próximo passo concreto:** M1 — escrever `docs/RULES.md` com a transcrição completa das
regras de Brass: Birmingham antes de tocar em código de domínio.
