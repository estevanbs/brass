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

## M1 — Regras em texto antes de código — CONCLUÍDO

- `docs/RULES.md`: transcrição completa do fluxo de jogo, das 7 ações, mercados de carvão e
  ferro (com fórmulas derivadas e verificadas contra o rulebook oficial via resumo da
  orderofgamers.com), trilha de renda, consumo de recursos, fim de era e pontuação, baralho e
  estrutura do tabuleiro.
- `docs/ASSUMPTIONS.md`: 7 entradas registrando que o fluxo de jogo/ações/mercados/renda tem
  confiança alta (verificado contra o rulebook oficial), enquanto a topologia exata do
  tabuleiro e as tabelas numéricas de cada peça de indústria são uma reconstrução própria
  (confiança média) — não uma cópia dos componentes físicos, que não puderam ser obtidos de
  forma confiável e completa neste processo autônomo.

## M2 — Modelo de dados e tabuleiro — CONCLUÍDO

- `src/core/types.ts`: tipos do estado do jogo (`GameState`, `PlayerState`, `LocationState`
  discriminado por `kind`, `LinkState`, `Card`, etc.), com `noUncheckedIndexedAccess` e
  `exactOptionalPropertyTypes` respeitados (nenhum campo opcional; ausência representada com
  `null` explícito).
- `src/rules/board-data.ts`: 18 localidades industriais + 5 mercadores + 2 fazendas
  cervejeiras (25 nós), 43 links, conectividade total verificada por BFS em teste.
- `src/rules/industry-data.ts`: tabela completa das 24 peças de indústria (6 tipos × 4
  níveis) e o estoque inicial por jogador (8 peças por indústria, 7 para Cerâmica).
- `src/rules/deck-data.ts`: composição do baralho de compra por número de jogadores.
- `src/core/state.ts`: `createInitialState` (setup completo e determinístico a partir de uma
  seed), `serializeState`/`deserializeState` (JSON), `hashState` (SHA-256 sobre JSON com
  chaves canonicalizadas — estável independente da ordem de inserção das chaves).
- Testes: contagem de localidades/slots/links bate com o design documentado em
  `RULES.md` §11; tabelas de indústria consistentes (VP e custo crescentes, só cerâmica
  nível 1 bloqueada); baralho com as cópias exatas de `RULES.md` §10; setup determinístico
  por seed; serializar→desserializar→serializar idempotente; hash igual para estados iguais
  e diferente após qualquer mutação (dinheiro, rodada, baralho) e independente da ordem de
  chaves.
- `npm run verify` passa: 45 testes, cobertura 99.24% em `src/rules` (limite: 90%).

## M3 — Ações e motor — CONCLUÍDO

- `src/engine/income.ts`: trilha de renda (posição↔nível), avanço por flip, queda de 3 níveis
  no empréstimo — fórmulas com propriedade fast-check de monotonicidade.
- `src/engine/market.ts`: fórmulas de compra/venda de carvão e ferro, verificadas contra os
  preços-limite do rulebook oficial (mercado vazio: £8 carvão / £6 ferro).
- `src/engine/network.ts`: adjacência a partir dos links construídos, BFS de distância,
  pertencimento à rede de um jogador (peça própria OU extremidade de link próprio), conexão a
  mercador (para compra de carvão / venda).
- `src/engine/resources.ts`: consumo de carvão (mina conectada mais próxima → mercado),
  ferro (qualquer siderúrgica não virada → mercado), cerveja (cervejaria própria, cervejaria
  de oponente conectada, ou barril de mercador com bônus); validação de que a fonte
  informada é a exigida pela regra (não uma preferência livre) — ver `ASSUMPTIONS.md` #8.
- `src/engine/actions/*.ts`: as 7 ações (`build`, `network`, `develop`, `sell`, `loan`,
  `scout`, `pass`) como funções puras `(state, action) -> state`, cada uma validando suas
  próprias regras (carta compatível, rede, slot, bloqueio de nível, overbuilding, limite de 1
  peça por local na era Canal, custos e consumo de recursos) e lançando erro em qualquer
  caminho ilegal.
  - Overbuilding: própria peça (qualquer indústria, nível maior) ou peça de oponente (só
    mina/siderúrgica, exige zero cubos daquele recurso no tabuleiro inteiro).
  - Slot de ícone único tem prioridade obrigatória sobre slot compartilhado quando ambos
    livres.
  - Bônus de mercador (dinheiro, renda, VP, desenvolvimento grátis em Gloucester) aplicado na
    venda.
- `src/engine/apply-action.ts`: dispatcher único, valida turno/contagem de ações (1 na
  primeira rodada da era Canal, 2 depois), nunca muta a entrada.
- `src/engine/scoring.ts`: pontuação de links (2 VP por extremidade de mercador, ou soma do
  VP de peças viradas na extremidade, de qualquer dono) e de indústrias (VP ao dono),
  incluindo o caso especial do link Kidderminster–Worcester que também pontua a Fazenda
  Cervejeira Sul.
- `src/engine/era.ts`: transição Canal→Ferrovia (remove peças nível 1, reseta cerveja de
  mercador, reembaralha descartes em baralho novo, distribui 8 cartas, repõe 14 links) e
  fim de jogo (pontua era Ferrovia, marca `gameOver`).
- `src/engine/cycle.ts`: ciclo completo de turno/rodada — reabastece mão, avança jogador
  ativo, e ao fim da rodada reordena por gasto, paga renda (com cobertura de déficit por
  venda de peças a metade do custo, depois perda de VP — política determinística, ver
  `ASSUMPTIONS.md` #10), detecta fim de era pelo esgotamento real do baralho + mãos (não por
  contagem fixa de rodadas) e aciona `endEra`.
- 157 testes (unitários por ação incluindo caminhos de erro, mercado, renda, conectividade,
  pontuação, ciclo de rodada/era) + 1 teste de propriedade (fast-check) cobrindo sequências
  arbitrárias de Pass/Loan: dinheiro, VP e cubos de mercado nunca saem dos limites válidos.
  A propriedade mais ampla ("qualquer ação legal" incluindo Build/Network/Sell/Develop) fica
  para o M4, quando `legalActions` existir para gerá-las.
- `npm run verify` passa: cobertura 92.36% em `src/rules` + `src/engine` (limite: 90%).

**Próximo passo concreto:** M4 — geração de ações legais: `legalActions(state) -> Action[]`
canônica e desduplicada (o ponto mais delicado do projeto, por causa da combinatória de
fontes de carvão/ferro/cerveja). Depois disso, expandir o teste de propriedade do M3 para
cobrir qualquer ação legal, não só Pass/Loan.
