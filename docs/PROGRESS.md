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

## M4 — Geração de ações legais — CONCLUÍDO

- `src/engine/cards.ts`: cópias idênticas de carta colapsam em uma só (`distinctCards`).
- `src/engine/legal/{build,network,develop,sell,misc}.ts`: geradores de candidatos por tipo
  de ação — específicos o bastante para não explodir (aplicam a prioridade de slot de ícone
  único, colapsam empates de distância de carvão, restringem a Rede-dupla a links alcançáveis
  da rede atual, limitam subconjuntos/fontes de cerveja de Vender acima de um teto) — ver
  `docs/ASSUMPTIONS.md` #11.
- `src/engine/legal/index.ts`: agrega os candidatos e os filtra chamando de fato o código real
  de cada ação (`applyBuild`, `applyNetworkAction`, etc.) — nenhuma ação chega ao chamador sem
  ter sido literalmente validada por aplicação, e a deduplicação final usa a mesma
  canonicalização de `core/state.ts`.
- **Bug real encontrado e corrigido durante este marco**: uma partida aleatória completa
  travava com "nenhuma ação legal" quando a mão de um jogador esvaziava antes da dos outros
  (consequência da minha própria composição de baralho, `ASSUMPTIONS.md` #6, não calibrada
  como a do jogo real para esvaziar todas as mãos na mesma rodada). Corrigido em
  `engine/cycle.ts` (`skipEmptyHandTurns`): um jogador sem cartas pula o turno (ou as ações
  restantes) sem efeito, em vez de travar o motor — `ASSUMPTIONS.md` #12.
- Testes: sem duplicatas, toda ação devolvida é de fato aplicável, ações legais construídas à
  mão aparecem na lista gerada (Build e Sell), e um benchmark que joga partidas aleatórias
  completas de 2/3/4 jogadores até o fim, registrando tamanho médio/máximo da lista:
  - 2p: 58 turnos, tamanho médio 211, máximo 620.
  - 3p: 105 turnos, tamanho médio 205, máximo 603.
  - 4p: 152 turnos, tamanho médio 185, máximo 568 (observado em exploração manual: até ~8300
    num tabuleiro tardio muito desenvolvido, com uma chamada de até ~690ms — ponto de atenção
    para o orçamento de tempo do ISMCTS no M7, não um bloqueio agora).
- `npm run verify` passa: 167 testes, cobertura 93.98% em `src/rules` + `src/engine`.

## M5 — Bot aleatório e harness — CONCLUÍDO

- `src/bots/random.ts`: escolhe uniformemente entre `legalActions` usando o RNG semeado.
- `src/bots/harness.ts`: `playGame` (uma partida completa até `gameOver`, com limite de
  5000 turnos para detectar loop infinito) e `runBatch` (N partidas em lote, com resumo de
  turnos/duração/VP do vencedor).
- **Bug real encontrado e corrigido durante este marco**: nenhuma ação verificava se o
  jogador tinha dinheiro suficiente — `payMoney` (`player-ops.ts`) permitia saldo negativo.
  Uma partida aleatória completa terminou com um jogador em -£18. Corrigido: `payMoney` agora
  lança erro se o custo excede o saldo, o que automaticamente faz `legalActions` (via seu
  filtro de "verificar aplicando de verdade") parar de oferecer ações que o jogador não pode
  pagar. Isso também reduziu o tamanho médio da lista de ações legais (menos candidatos
  descartáveis gerados) e teve como efeito colateral melhorar a performance.
- Otimização: `legal/build.ts` e `legal/network.ts` agora descartam candidatos obviamente
  inacessíveis (custo mínimo > dinheiro do jogador) antes de gerar as combinações de
  carvão/ferro/cerveja, evitando gerar-e-descartar via exceção em excesso.
- `scripts/run-random-batch.ts`: script standalone (fora da suíte `npm test`, roda partidas
  demais para isso) que joga N partidas por contagem de jogadores e imprime a distribuição.
- Validação de 10.014 partidas (3338 × 2/3/4 jogadores) com bots aleatórios: todas terminaram
  com `gameOver = true`, nenhuma exceção, nenhum estado inválido, nenhum loop infinito.
  Achado estrutural interessante: como o número de ações por turno é fixo (1 na primeira
  rodada da era Canal, 2 depois) e independente das escolhas dos jogadores, a duração de uma
  partida em turnos é **determinística** por número de jogadores (sempre 58 turnos com 2
  jogadores, 105 com 3, 152 com 4) — só o *conteúdo* de cada turno varia com a semente.
  Resultado da validação completa (`scripts/run-random-batch.ts 3334`, 10.014 partidas =
  3334 × {2,3,4} jogadores, todas terminando em `gameOver=true`, zero exceções):
  - 2p: duração média 51,9ms/partida (máx. 126ms); VP do vencedor: média 2,2, mín. 0, máx. 32.
  - 3p: duração média 81,5ms/partida (máx. 210ms); VP do vencedor: média 2,2, mín. 0, máx. 72.
  - 4p: duração média 108,3ms/partida (máx. 174ms); VP do vencedor: média 2,1, mín. 0, máx. 39.
  - Tempo total da validação: 806,1s (~13,4 min).
- Testes rápidos (`tests/unit/harness.test.ts`): 2/3/4 jogadores terminam sem exceção,
  determinismo por seed, e uma amostra de 24 partidas com invariantes (dinheiro/VP/cubos
  nunca negativos) — mantidos na suíte padrão; a validação de 10k roda à parte por ser lenta
  (script acima).
- `npm run verify` passa: 170 testes, cobertura 95.66% em `src/rules` + `src/engine`.

## M6 — Bot heurístico — CONCLUÍDO

- `src/bots/heuristic.ts`: avaliação gulosa de 1 ply — para cada ação legal, simula aplicá-la
  e pontua o estado resultante; o termo dominante reaproveita `scoring.ts#scoreEra` de forma
  não destrutiva (pontuação projetada se a era acabasse agora, o que já penaliza
  implicitamente peças não viradas), somado a dinheiro, nível de renda, bônus de "ferro cedo"
  na era Canal, e progresso de estoque de indústria (ver `ASSUMPTIONS.md` #13 para os pesos).
  Empates são resolvidos por sorteio uniforme entre as melhores ações.
- `tests/properties/heuristic-vs-random.test.ts`: 1.000 partidas heurístico × aleatório —
  **998/1000 vitórias (99,8%)**, bem acima do limite de 80% exigido. Teste falha se a taxa
  cair abaixo disso (guarda de regressão real, ~140s de execução — a suíte completa já passou
  de ~5s para ~145s por causa deste teste e do de M5; aceitável para um motor de jogo, mas
  vale considerar isolar os testes lentos (`tests/properties/*-benchmark*`,
  `*-vs-random.test.ts`) num script `verify:slow` separado se o ciclo de iteração ficar
  incômodo em marcos futuros).
- `npm run verify` passa: 171 testes, cobertura 96.28% em `src/rules` + `src/engine`.

## M7 — ISMCTS — implementado, mas NÃO atinge a meta formal de 65% do marco (60,7% real)

- `src/engine/determinize.ts`: redistribui aleatoriamente toda carta que não é da própria mão
  nem de baralho/mão visível (i.e., a mão dos outros jogadores + o baralho de compra),
  preservando tamanhos de mão e do baralho — a base da "informação oculta" do ISMCTS.
- `src/bots/rollout-policy.ts`: política barata ponderada por tipo de ação (prioriza Vender >
  Construir > Rede/Desenvolver > Empréstimo/Explorar > Passar) usada dentro dos rollouts —
  nunca simula uma ação para pontuá-la, ao contrário do bot heurístico do M6.
- `src/bots/ismcts.ts`: para cada jogada, sorteia vários "mundos" (determinizações), roda uma
  árvore MCTS (seleção UCB1, expansão, rollout curto + avaliação via `evaluate` do M6,
  retropropagação por jogador) nova em cada mundo, e soma os visits dos filhos da raiz entre
  mundos — a ação mais visitada no total é jogada. Orçamento configurável por tempo
  (`timeBudgetMs`) e simulações por mundo (`simulationsPerWorld`).
- **Bug real encontrado e corrigido**: a contagem de "mundos pesquisados" usada para decidir
  se caía no fallback aleatório incrementava mesmo quando nenhuma simulação chegava a
  terminar dentro do orçamento — o bot acabava sempre jogando a primeira ação gerada,
  deterministicamente, sem busca nenhuma (0/6 partidas contra o heurístico, às vezes com 0 VP
  na partida inteira). Corrigido contando simulações de fato executadas, não iterações do
  laço externo.
- **Achado real e correção de desenho**: mesmo corrigido o bug acima, o fator de ramificação
  do jogo (100-600+ ações legais por turno) era grande demais para o orçamento de simulações
  discriminar qualquer coisa — a maioria das ações nunca era sequer visitada uma vez. A
  correção foi restringir as ações da raiz às `rootTopK` (padrão 8) melhores segundo uma
  passada gulosa de 1 ply (a mesma lógica do M6, calculada uma vez por jogada, não por mundo).
  Isso levou a taxa de vitória de 0% para ~65-67% em amostras pequenas. Detalhes e o que essa
  simplificação abre mão em relação ao ISMCTS "de livro" (árvore única compartilhada entre
  mundos) estão em `docs/ASSUMPTIONS.md` #14.
- **Segundo bug real encontrado e corrigido** (durante o M8, ao rodar o teste sob carga de
  outras partidas em background): o orçamento por `timeBudgetMs` (relógio de parede) fazia o
  resultado do bot — e portanto do teste — variar com a velocidade/carga da máquina, violando
  a própria regra de teste deste projeto ("nenhum teste depende de tempo real"). O teste
  chegou a falhar de verdade (41,7% numa execução sob carga, vs. 66,7-75% isolado). Corrigido
  adicionando `maxTotalSimulations` como orçamento alternativo determinístico, usado pelos
  testes; `timeBudgetMs` continua sendo o padrão para uso interativo real (CLI do M8).
- `tests/properties/ismcts-vs-heuristic.test.ts`: guarda de regressão rápida com orçamento
  **determinístico** (120 simulações/jogada, não tempo real), 12 partidas — **9/12 vitórias
  (75,0%)**, reproduzido de forma idêntica em reexecuções, acima do limiar relaxado de 50%
  usado neste teste rápido.
- `scripts/run-ismcts-validation.ts`: valida a exigência completa do marco (300 partidas,
  orçamento de **1s/jogada real**, que é o próprio requisito do marco — não dá para usar
  orçamento por simulação aqui sem mudar o que está sendo medido). Uma única partida nesse
  orçamento leva ~20-30s; a validação completa das 300 rodou em background durante boa parte
  desta sessão e levou **142,4 minutos**.
  **Resultado final, real, sem maquiagem: 182/300 vitórias do ISMCTS (60,7%) — abaixo do alvo
  de 65% do marco.** A taxa já estava estabilizada por volta de 59-61% desde ~metade da
  validação, então não é ruído de amostra pequena — amostras isoladas menores (6-12 partidas)
  tinham mostrado 66-75%, o que serviu de alerta de que N baixo engana; a amostra de 300
  mostra a taxa real. **O M7 não bateu a meta formal de 65%.** Fica registrado como está: o
  ISMCTS claramente joga melhor que o aleatório (M5) e melhor que o próprio heurístico na
  maioria das partidas, mas não na margem de 65% pedida pelo plano. Caminhos honestos para
  fechar essa distância, não implementados por causa do tempo desta sessão: (a) a
  simplificação de "árvore nova por mundo" (`docs/ASSUMPTIONS.md` #14) descarta conhecimento
  entre determinizações — a versão "de livro" com árvore única compartilhada aproveitaria
  melhor o mesmo orçamento; (b) `rootTopK=8` pode estar cortando cedo demais em posições com
  muitas boas opções; (c) o orçamento real de 1s por jogada, numa máquina sob a carga desta
  sessão (outros processos rodando ao mesmo tempo), provavelmente rendeu menos simulações por
  jogada do que renderia isolado — o número documentado é o que rodou de fato, não uma
  estimativa otimista.
  Ver `README.md` para a limitação registrada na entrega final.
- `npm run verify` passa: 172 testes, cobertura 96.22% em `src/rules` + `src/engine`. A suíte
  completa leva ~2-4 minutos por causa dos três testes de bot-vs-bot (M5 harness, M6 998/1000,
  M7 9/12) — considerar separar em `verify:fast`/`verify:slow` se isso incomodar no futuro.

## M8 — CLI jogável — CONCLUÍDO

- `src/cli/render.ts`: tabuleiro em texto (localidades, slots ocupados/livres, links
  construídos, preços de mercado), mão e status do jogador, placar, e descrição legível de
  qualquer ação.
- `src/cli/game-log.ts`: uma partida salva é só `{ seed, playerIds, actions }` — carregar =
  `createInitialState(seed)` + reaplicar cada ação do log. Isso serve save/load *e* replay com
  o mesmo código, e funciona como uma prova de determinismo do motor toda vez que roda.
- `src/cli/index.ts`: laço interativo — a cada turno seu, mostra tabuleiro/mão, agrupa as
  ações legais por tipo (a lista completa costuma ter 100-600+ ações, grande demais para
  numerar de uma vez; ver M4), você escolhe um tipo e depois o número dentro do grupo; nos
  turnos do bot, mostra o que ele jogou e o VP estimado (`evaluate` do M6). Comandos
  `save <arquivo>` e `quit` disponíveis no lugar de um tipo. `npm run play -- --replay
  <arquivo>` reproduz uma partida salva sem interação.
- **Bug real encontrado e corrigido**: `rl.question()` do `node:readline` (tanto a versão
  `/promises` quanto a de callback) trava indefinidamente na SEGUNDA chamada quando a entrada
  é um pipe não-TTY que já atingiu EOF (confirmado com um repro mínimo antes de mexer no
  código da CLI) — todo teste automatizado e qualquer uso via `echo ... | npm run play`
  ficaria pendurado para sempre depois da primeira pergunta. Corrigido lendo através do
  iterador assíncrono único de `rl` (`rl[Symbol.asyncIterator]()`) em vez de chamar
  `question()` repetidamente — validado com um repro isolado antes e depois da correção.
- Validação manual de ponta a ponta pela própria CLI (não só testes automatizados): joguei
  uma partida completa de 2 jogadores contra o bot ISMCTS via entrada automatizada (sempre
  "pass") até `=== Placar ===` aparecer, sem nenhum crash, atravessando a virada Canal→Rail;
  salvei uma partida no meio com o comando `save`, e `--replay` reproduziu exatamente o mesmo
  estado (mesmo dinheiro, mesma peça virada, mesmo nível de renda) a partir do arquivo salvo.
- `tests/unit/cli.test.ts`: replay bit-a-bit a partir só do log de ações (hash e serialização
  idênticos), round-trip por arquivo em disco, rejeição de arquivo com formato inválido, e
  `describeAction`/`renderBoard`/`renderPlayer`/`renderScoreboard` sem exceções.
- `npm run verify` passa: 177 testes.

## Extra (fora do plano original) — GUI web

Pedido direto do usuário durante a sessão, depois do M8: "implemente uma gui para utilizar no
navegador de maneira mais amigável". M0 dizia explicitamente "sem UI gráfica, terminal
apenas" para o *processo autônomo*; isso é uma adição posterior, pedida por quem está usando
o projeto, não uma mudança de escopo do plano original.

- `src/web/server.ts`: servidor HTTP sem framework (`node:http`) mantendo partidas em memória
  e expondo `POST /api/games`, `GET /api/games/:id`, `POST /api/games/:id/actions` — nenhuma
  regra duplicada, só chama `legalActions`/`applyAction`/os bots, os mesmos que a CLI usa.
  `public/` é HTML/CSS/JS puro, sem build step.
- **Bug real encontrado via teste de navegador de verdade**: o próprio usuário perguntou se
  eu tinha acesso a navegador para testar; como não tinha, instalei o Playwright (via `npx`,
  não como dependência do projeto) e, depois de resolver duas rodadas de bibliotecas de
  sistema faltando (pedi confirmação antes de rodar `sudo pacman -S` — usuário aprovou),
  rodei a GUI num Chromium headless de verdade. Isso achou um bug sério que nenhum teste de
  API/curl pegaria: `[hidden]` não vencia `main { display: grid }` nem `.overlay { display:
  flex }` (mesma especificidade CSS, a regra do autor vem depois da folha do user-agent) — o
  overlay de fim de jogo cobria a tela inteira e bloqueava todo clique desde o carregamento
  da página. **A GUI estava com essa quebra grave desde o commit anterior; só apareceu ao
  testar com um navegador real, nunca via curl.** Corrigido com uma regra global
  `[hidden] { display: none !important }`, validado com screenshots antes/depois.
- `npm run web` sobe o servidor; sem save/load/replay (só a CLI tem isso por enquanto).

**Próximo passo concreto:** nenhum marco restante — M0 a M8 do `docs/PLANO.md` estão
concluídos, mais a GUI web pedida à parte. Ver `README.md` para a entrega final (instalação,
testes, como jogar — CLI e GUI web —, arquitetura, limitações conhecidas). O único item em
aberto é a validação completa de 300 partidas do M7 (1s/jogada), que ainda pode estar rodando
em background — ver a nota na seção do M7 acima.

## Extra (fora do plano original) — GUI estilo Hearthstone, tabuleiro real, tabuleiro do jogador

Sequência de pedidos diretos do usuário sobre a GUI web já entregue acima: mostrar cartas e o
que cada uma habilita ("gere uma interface mais amigável..."); redesenhar a interação inteira
no estilo Hearthstone ("mapa em tela cheia, mão em cartas na frente, seleção de carta destaca
opções direto no mapa em vez de lista"); fazer o visual lembrar o tabuleiro físico real; e
implementar o "tabuleiro do jogador" (o estoque pessoal de peças de indústria que no jogo
físico fica visível para todos na mesa).

- Mapa redesenhado com as posições geográficas reais (lat/lon) das cidades que dão nome às
  localidades do tabuleiro — não é cópia da arte do jogo físico (a topologia já era uma
  reconstrução própria, documentada em `docs/ASSUMPTIONS.md` #1), só usa a geografia real do
  West Midlands para o layout ficar parecido com um mapa de verdade em vez de um grafo
  abstrato. Tema visual "época vitoriana" (paleta pergaminho/serifada) em vez de reaproveitar
  qualquer arte do jogo publicado.
- Painel "tabuleiro do jogador": abas por jogador, colunas por indústria, mostrando a pilha de
  peças restantes (nível, custo, VP, ganho de renda) com a peça do topo destacada e peças
  travadas (só via Desenvolver) marcadas — tudo derivado do mesmo `GameState`/`industryTiles`
  que o servidor já mandava, nenhum dado novo do backend.
- **Bug real encontrado via teste de navegador real (de novo)**: o popup de Desenvolver (até
  21 opções para uma carta) era posicionado relativo ao ancestral DOM errado e sem scroll —
  com muitas opções ele crescia para fora da tela, inclicável mesmo por um usuário real.
  Corrigido ancorando num canto fixo do `.stage` com `max-height`/`overflow-y: auto`.
- Validado com Playwright real a cada mudança (não só a API): seleção de carta, clique no
  mapa com match único (submete direto) vs. múltiplo (abre popup), fluxo de Scout, e o painel
  do tabuleiro do jogador.

## Extra (fora do plano original) — frontend reescrito em Angular, monorepo Nx, clean architecture

Pedido direto do usuário: "reescreva o código do frontend. Utilize angular como framework.
Utilize clean code e injeção de dependencias, escrevendo um bom código angular. Escreva
testes." — e, em seguida, no meio da execução: "reescreva como um monorepo nx, utilizando
clean architecture e a última versão das dependências".

- `client/` deixou de ser um app Angular CLI simples e virou um **workspace Nx** com quatro
  bibliotecas em camadas (`domain` → `application` → `infrastructure`/`presentation` →
  `apps/web`, regra de dependência de mão única — ver a seção "Frontend (`client/`)" do
  `README.md` para o detalhamento completo de cada camada) e Angular na versão mais recente
  compatível com o Node instalado.
- **Bloqueio real de versão do Node**: o Angular CLI/Nx mais novos exigem Node ≥24.15, e o
  Node ativo no ambiente era 24.14.0 (uma versão patch abaixo). Resolvido instalando uma
  versão mais nova via `nvm` (sem `sudo`, sem afetar o resto do sistema) — `client/` agora
  roda numa versão de Node diferente da raiz do projeto (`engines.node` na raiz continua
  `>=20`), documentado no README.
- **Vários atritos reais do preset "ts"/Nx + Angular resolvidos por tentativa e correção,
  verificados a cada passo por build/test real, não assumidos**: o preset em branco do Nx
  gerava `tsconfig`s com `composite`/`emitDeclarationOnly` globais que o compilador do
  Angular rejeita explicitamente (`NG4006`) — a correção teve que ser cirúrgica: `composite`
  só nos `tsconfig.lib.json` de cada biblioteca (usados pelo target `build`/`typecheck`
  isolado de cada lib via `tsc --build`), nunca no `tsconfig.app.json` que o bundler do
  Angular usa de verdade (confirmado quebrando o build real do app ao tentar, e revertido).
  `rootDir`, `tsBuildInfoFile` e `outDir` únicos por projeto também precisaram de ajuste
  manual para o grafo de referências de projeto do TypeScript não colidir entre si.
- Arquitetura validada por injeção de dependência de verdade, não só por convenção: o port
  `GameGateway` (classe abstrata) é a única coisa que `application` conhece; a composição
  concreta com `HttpGameGateway` só acontece no `app.config.ts` do `apps/web` (a *composition
  root*) — isso permitiu testar `GameStateService` e todos os componentes de `presentation`
  com um `FakeGameGateway`, sem HTTP real, e sem duplicar lógica de seleção entre componentes.
- **Bug real encontrado escrevendo os testes (não em produção, mas teria virado um)**: o
  campo de seed no formulário de novo jogo (`<input type="number">` com `[(ngModel)]`) tinha o
  signal tipado como `string` (`signal('')`), mas o `NumberValueAccessor` do Angular para
  `type="number"` escreve `number | null`, nunca string — `this.seedInput().trim()` quebraria
  em runtime assim que o teste realmente disparou o evento de input do jeito que o Angular
  dispara de verdade. Só apareceu porque o teste simulou o evento do DOM em vez de chamar o
  método diretamente; corrigido tipando o signal como `number | null`.
- Suíte de testes nova, cobrindo as quatro camadas: 25 testes em `domain` (funções puras, sem
  `TestBed`), 21 em `application` (`GameStateService` completo via `FakeGameGateway`, mais os
  wrappers finos de formatação), 3 em `infrastructure` (`HttpGameGateway` via
  `HttpTestingController`), 27 em `presentation` (todo componente de tela, incluindo o mapa
  interativo — clique com ação única submete direto, múltipla abre popup) e 1 no shell do
  `apps/web`. `npx nx run-many -t lint typecheck test build` passa limpo nas 5 projetos.
- Validado de ponta a ponta com Playwright real contra o build compilado servido por
  `public/` (mesmo roteiro de antes: novo jogo, seleção de carta, clique no mapa, Empréstimo,
  popup de Desenvolver com 21 opções dentro da viewport, fluxo de Scout) — sem erros de
  console, comportamento idêntico ao app anterior.
- `public/{index.html,app.js,style.css}` (o app vanilla-JS anterior) foram substituídos pelo
  build do Angular (`npm run client:build`); nada do JS antigo restou no diretório.
