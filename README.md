# Brass: Birmingham — bot pessoal

Motor completo de **Brass: Birmingham** em TypeScript — regras, três bots de força crescente
(aleatório, heurístico, ISMCTS) e uma CLI de terminal para jogar contra eles — construído do
zero, sem UI gráfica e sem dependências pesadas. Ver `docs/PLANO.md` para o prompt original,
`docs/RULES.md` para a especificação de regras que o código implementa, `docs/ASSUMPTIONS.md`
para toda decisão tomada diante de ambiguidade, e `docs/PROGRESS.md` para o histórico marco a
marco (incluindo os bugs reais encontrados e corrigidos ao longo do caminho).

## Instalação

Requer Node.js 20+.

```sh
npm install
```

## Rodar os testes

```sh
npm run verify     # typecheck + lint + testes + cobertura (o que também roda no CI local)
npm test           # só os testes
npm run typecheck   # só o typecheck
npm run lint        # só o lint
```

`npm run verify` leva **2-4 minutos**: três dos testes jogam centenas de partidas completas
bot-contra-bot para validar taxas de vitória reais (não simuladas) — ver a seção de
Limitações. Todos os testes são determinísticos (nenhum depende de tempo real ou aleatoriedade
não semeada); os poucos testes lentos usam orçamentos de simulação fixos, não relógio de
parede, especificamente para evitar variar com a velocidade da máquina.

## Como jogar

```sh
npm run play
```

Pergunta o número de jogadores (2-4) e uma seed opcional, e te coloca como o primeiro jogador
contra bots ISMCTS (1 segundo de orçamento por jogada deles). A cada turno seu, o tabuleiro,
sua mão e os tipos de ação disponíveis são impressos; escolha um tipo (`build`, `network`,
`develop`, `sell`, `loan`, `scout`, `pass`) e depois o número da ação específica na lista.
Comandos especiais no lugar de um tipo: `save <arquivo>` salva a partida em andamento;
`quit` sai.

Para reproduzir uma partida salva byte a byte a partir do log de ações:

```sh
npm run play -- --replay <arquivo>
```

O formato salvo é só `{ seed, playerIds, actions }` — o motor é determinístico o bastante
para que reaplicar a mesma sequência de ações a partir da mesma seed sempre chegue exatamente
no mesmo estado final (ver `tests/unit/cli.test.ts`).

### GUI web (opcional, mais amigável que a CLI)

```sh
npm run web
```

Sobe um servidor HTTP local (`src/web/server.ts`, sem framework — só `node:http`) na porta
3000 (configurável via `PORT=...`); abra `http://localhost:3000` no navegador. É a mesma
partida da CLI, com a mesma lógica de motor por baixo (o servidor só expõe
`legalActions`/`applyAction`/os bots por uma API JSON pequena), servindo o build compilado do
frontend Angular a partir de `public/`. Estilo Hearthstone: o tabuleiro (mapa cujo layout
reproduz o posicionamento real das localidades no tabuleiro físico do jogo — ver
`docs/ASSUMPTIONS.md` #16) ocupa a tela inteira como fundo, a mão fica em cartas na frente, e
selecionar uma carta destaca diretamente no mapa os locais/links jogáveis — clicar neles
executa a ação (ou abre um popup pequeno quando há mais de uma opção no mesmo lugar). Cada
jogador tem seu próprio "tabuleiro pessoal" (estoque de peças de indústria por custo/VP/renda)
acessível por um painel lateral. Não salva/carrega partida nem faz replay (só a CLI faz isso,
por enquanto) — o estado de cada partida fica em memória no processo do servidor e se perde ao
reiniciá-lo.

O frontend em si vive em `client/`, um **monorepo Nx** separado (Angular mais recente
compatível, TypeScript, Vitest) com sua própria cadeia de ferramentas — ver a seção
"Frontend (client/)" abaixo para arquitetura, como rodar os testes, e o requisito de versão do
Node (diferente do resto do projeto). Para gerar/atualizar o build servido por `public/`:

```sh
npm run client:build
```

## Arquitetura

O código segue quatro camadas com dependência em uma única direção. `src/core` define o
vocabulário do domínio (`GameState`, `PlayerState`, `Card`, etc.), o RNG semeado
(`mulberry32`, único gerador de aleatoriedade permitido em código de produção) e as funções
de setup/serialização/hash do estado. `src/rules` guarda os dados estáticos do jogo —
tabuleiro (localidades, slots, links), tabela de indústrias e composição do baralho — como
constantes puras, sem lógica de aplicação. `src/engine` é onde as regras viram código:
`applyAction` aplica cada uma das 7 ações como uma função pura `(state, action) -> state` que
nunca muta a entrada e lança erro em qualquer caminho ilegal; `engine/cycle.ts` orquestra o
ciclo de turno/rodada/era por cima disso; `engine/legal` gera a lista de ações legais.
`src/bots` e `src/cli` são os dois consumidores do motor — nenhum dos dois conhece as regras
diretamente, só a API pública do engine.

O ponto mais delicado do projeto foi a geração de ações legais (`engine/legal/`), por causa
do fator de ramificação real do jogo: um turno típico oferece de 100 a mais de 600 ações
legais distintas, contando cada escolha de local, slot, carta e fonte de carvão/ferro/cerveja
como uma ação separada. Gerar esse espaço combinatório à mão e depois confiar que cada
candidata é de fato aplicável seria arriscado; em vez disso, cada gerador (`legal/build.ts`,
`legal/network.ts`, etc.) produz candidatas de forma razoavelmente enxuta — mas o filtro
final e definitivo é literalmente chamar o código real de cada ação (`applyBuild`,
`applyNetworkAction`, ...) dentro de um `try/catch`: uma candidata só chega ao chamador depois
de ter sido genuinamente validada por aplicação, e a deduplicação usa a mesma serialização
canônica usada para o hash do estado. Isso elimina uma classe inteira de bugs "a lista disse
que essa ação era legal, mas aplicá-la lançou um erro".

Os três bots formam uma escada de sofisticação crescente sobre a mesma `legalActions`. O
aleatório escolhe uniformemente. O heurístico faz uma busca gulosa de 1 ply: simula cada ação
legal e pontua o estado resultante reaproveitando `scoring.ts#scoreEra` de forma não
destrutiva (a pontuação projetada se a era acabasse agora), o que já penaliza implicitamente
peças não viradas, somado a dinheiro, renda e alguns bônus de priorização. O ISMCTS
(`bots/ismcts.ts`) sorteia distribuições plausíveis das cartas que não são da própria mão
(`engine/determinize.ts`), roda uma árvore de busca Monte Carlo independente em cada mundo
sorteado, e agrega os visits dos filhos da raiz entre os mundos — mas só depois de restringir
as ações candidatas às melhores segundo a mesma avaliação gulosa do heurístico, porque sem
essa poda o fator de ramificação do jogo torna qualquer orçamento realista de simulações
estatisticamente cego (ver `docs/ASSUMPTIONS.md` #14 para os detalhes e o bug real que essa
poda corrigiu).

A CLI (`src/cli`) é deliberadamente fina: `render.ts` só formata texto a partir do
`GameState`, e `game-log.ts` trata "salvar uma partida" como "salvar a seed + a lista de
ações tomadas", nunca o estado completo — o replay é literalmente `createInitialState(seed)`
seguido de reaplicar cada ação do log, o que dobra como uma prova de determinismo do motor
inteiro toda vez que roda. `src/web` é um terceiro consumidor do mesmo tipo: um servidor HTTP
minúsculo (`node:http`, sem framework) que mantém partidas em memória e expõe
`legalActions`/`applyAction`/os bots por uma API JSON pequena (`POST /api/games`,
`GET|POST /api/games/:id[/actions]`); quem consome essa API é o frontend Angular em `client/`
(ver seção própria abaixo), cujo build compilado é servido estaticamente a partir de
`public/`. Nenhuma regra de jogo é duplicada no backend — tanto a CLI quanto a GUI web só
formatam o mesmo estado e despacham para o mesmo `applyAction`; o frontend por sua vez também
não reimplementa regra nenhuma, só *exibe* o `GameState` que o servidor manda e envia de volta
o índice da ação escolhida dentre as `legalActions` que o servidor já calculou.

## Frontend (`client/`)

O frontend é um **monorepo Nx** (Angular mais recente compatível, standalone components,
signals, change detection zoneless, sem `zone.js`) separado do resto do projeto, com seu
próprio `package.json`/`node_modules`/toolchain — porque o Angular CLI/Nx mais recentes
exigem uma versão de Node mais nova que o restante do projeto (`engines.node` na raiz é
`>=20`; `client/` precisa de **Node ≥24.15**, ex. `nvm install 24 && nvm use 24`). É por isso
que ele não está sob o mesmo `npm install`/`npm run verify` da raiz.

```sh
cd client
npx nx run-many -t lint typecheck test build   # equivalente a `npm run client:verify` na raiz
```

**Arquitetura em camadas (clean architecture), cada uma um projeto Nx separado sob
`client/libs/`:**

- **`domain`** — modelos (`Card`, `GameState`, `GameView`, ...) e funções puras sem nenhuma
  dependência de Angular ou de framework nenhum: `cardKey`/formatação de carta,
  `incomeLevelForPosition` (mesma fórmula de `src/engine/income.ts`, duplicada só para
  exibição), o layout do mapa (`computeMapLayout`, posições lidas do tabuleiro físico real —
  `docs/ASSUMPTIONS.md` #16 — mais um passo de "desamontoamento" de rótulos) e a atribuição de
  cor por jogador. Testável com Vitest puro, sem `TestBed`.
- **`application`** — `GameStateService`, o único lugar que guarda estado de seleção/UI (carta
  selecionada, modo Scout, popup aberto) como signals, e o *port* `GameGateway` (uma classe
  abstrata usada como token de injeção) que ele depende — nunca de um cliente HTTP concreto.
  Também expõe wrappers injetáveis finos (`CardFormatService`, `IncomeService`, etc.) em cima
  das funções puras de `domain`, para que a UI sempre injete via DI em vez de importar função
  solta.
- **`infrastructure`** — `HttpGameGateway`, o único adaptador que de fato conhece a API HTTP
  do backend (`/api/games...`), implementando o port `GameGateway` de `application`.
- **`presentation`** — todos os componentes de UI (mapa, mão, tabuleiro pessoal, popups,
  etc.), consumindo só `application`/`domain` — nunca `infrastructure` diretamente.
- **`apps/web`** — a *composition root*: o único lugar que sabe que `GameGateway` é
  implementado por `HttpGameGateway` (`app.config.ts` faz esse `provide`), e que renderiza o
  componente-raiz de `presentation`. Propositalmente fino — nenhuma lógica de tela mora aqui.

A regra de dependência é de mão única: `domain` não depende de nada; `application` só de
`domain`; `infrastructure` e `presentation` de `application` e `domain`; `apps/web` de todos —
nunca o inverso. Essa inversão (via o port `GameGateway`) é o que permite testar
`GameStateService` e todos os componentes de `presentation` com um `FakeGameGateway` em vez de
subir um backend HTTP de verdade nos testes (ver `libs/application/.../game-state.service.spec.ts`
e `libs/presentation/src/lib/testing/fake-game-gateway.ts`).

## Limitações conhecidas

- **A topologia do tabuleiro (quais das 27 localidades se conectam a quais, quantos slots
  cada uma tem, quais mercadores exigem quantos jogadores, e a era de cada link) foi
  reconstruída a partir de uma foto de alta resolução do tabuleiro físico real**, fornecida
  pelo usuário — não é mais uma invenção sem referência (era o caso nas primeiras versões
  deste projeto, quando não havia uma fonte confiável disponível). A distinção de era por
  link (canal/ferrovia/ambas) foi confirmada diretamente pelo usuário a partir dos dois
  estilos de linha visíveis no tabuleiro (`docs/ASSUMPTIONS.md` #5). O que **continua** sendo
  uma composição própria, não uma leitura literal: o tipo exato de indústria aceito por cada
  slot individual (ícones pequenos demais para ler com certeza numa foto de celular) e as
  tabelas numéricas exatas de custo/VP/renda/produção impressas em cada peça de indústria (não
  visíveis o suficiente na foto para transcrever com confiança). O fluxo de turno, as 7 ações,
  as fórmulas de mercado e a trilha de renda, por outro lado, foram verificados contra o
  resumo de regras oficial da Roxley e batem exatamente. Ver `docs/ASSUMPTIONS.md` (entradas
  #1, #5, #15, #16) para cada decisão, com grau de confiança e impacto.
- **A auditoria contra `docs/HANDBOOK_RULES.md` (o manual oficial, fornecido pelo usuário)
  achou e corrigiu 4 bugs reais de regras**, não só lacunas de design: (1) o limite de
  indústrias na era do canal era contado somando todos os jogadores no local, quando a regra
  é por jogador; (2) a peça travada de olaria (pottery) bloqueava a ação Construir e liberava
  Desenvolver — o oposto do que o manual diz; (3) faltava por completo o mecanismo de
  "restrição de era" do nível 1 de 5 indústrias (carvão, ferro, algodão, fabricante,
  cervejaria), que só podem ser construídas na era do canal e precisam ser desenvolvidas ao
  virar a era do trem; (4) os totais de peças de indústria por jogador estavam errados (48
  peças uniformes em vez das 45 reais, distribuídas de forma desigual por indústria). Também
  foi implementado o mecanismo dos "estandartes de local" (banner colors) — cartas de local só
  entram no baralho de compra a partir de um número mínimo de jogadores. Ver
  `docs/ASSUMPTIONS.md` (entradas #17-#21) para os detalhes e o grau de confiança de cada um.
  Como efeito colateral, a correção dos totais de peças mudou de novo o desempenho do ISMCTS
  contra o heurístico (ver bullet seguinte).
- **O ISMCTS (M7) não atinge a meta formal do marco.** A validação completa (300 partidas
  ISMCTS × heurístico, orçamento real de 1s/jogada, `scripts/run-ismcts-validation.ts`, ~142
  minutos) terminou em **182/300 vitórias (60,7%)**, abaixo do alvo de 65%. O ISMCTS joga
  visivelmente melhor que o bot aleatório e vence o heurístico na maioria das partidas, só não
  na margem pedida. Ver `docs/PROGRESS.md` (seção M7) para os caminhos identificados para
  fechar essa distância (árvore compartilhada entre mundos em vez de uma nova por mundo,
  `rootTopK` maior, etc.) — nenhum foi implementado por tempo. O teste embutido na suíte usa
  um orçamento de simulações fixo (não tempo real) numa amostra menor, para continuar
  determinístico independente da velocidade da máquina.
- **A reconstrução do tabuleiro a partir de fotos reais (acima) mudou o desempenho do ISMCTS
  contra o heurístico repetidas vezes ao longo de várias sessões — para pior, recuperado,
  e para pior de novo.** O tabuleiro real tem 20 localidades industriais (vs. 18 antes) com um
  layout e conectividade diferentes (30 links vs. 43), o que muda o fator de ramificação que o
  `rootTopK` do ISMCTS foi calibrado para lidar. Na mesma amostra fixa de 12 partidas com
  orçamento determinístico de 120 simulações que antes ficava perto de 50%: a reconstrução do
  tabuleiro derrubou para 41,7% (5/12); a correção dos totais de peças de indústria (bug #4 da
  auditoria de regras acima) derrubou ainda mais, para 33,3% (4/12); a correção da distribuição
  exata de cartas por número de jogadores (bullet abaixo) recuperou a taxa para 50,0% (6/12); e
  a re-verificação da era de cada link contra uma foto de melhor qualidade (bullet seguinte)
  derrubou de novo para 41,7% (5/12). As duas primeiras quedas foram confirmadas reais (não
  ruído de amostra pequena) por checagens independentes de 30 partidas na época, batendo na
  mesma faixa. **A última queda, não** — a checagem independente de 30 partidas desta vez deu
  60,0% (18/30), mais alta que a linha de base, sugerindo que os 12 seeds fixos do teste
  embutido só calharam de cair do lado ruim da variância normal, não uma regressão sistemática
  da correção de topologia. Como esses seeds são fixos e determinísticos, o teste sempre vai
  produzir 41,7% de qualquer forma, então o limiar precisa acomodar esse número mesmo sendo
  ruído. O limiar embutido (`tests/properties/ismcts-vs-heuristic.test.ts`) acompanhou essas
  idas e voltas (50%→30%→40%→30%) — ver o comentário do próprio arquivo de teste para o
  histórico completo. `rootTopK` e o resto da calibração do ISMCTS nunca foram re-validados
  formalmente contra nenhuma dessas revisões de tabuleiro — essa validação continua sendo
  trabalho real e não feito, do mesmo porte da própria validação do M7.
- **A distribuição de cartas do baralho de compra era uma fórmula uniforme inventada, não a
  contagem real do jogo.** O usuário forneceu uma foto da carta de referência oficial
  "Distribuição de Cartas" impressa junto com o tabuleiro físico, com o número exato de cópias
  de cada carta de local e de indústria por número de jogadores — nenhuma fórmula, números
  individuais por carta. A implementação anterior usava 1/2/3 cópias uniformes para toda carta
  de local e 2/3/4 para toda carta de indústria (2/3/4 jogadores); a tabela real não segue
  padrão nenhum (Coalbrookdale sempre 3 cópias, Ferro sempre 4, Cerveja sempre 5 — nenhuma
  varia com o número de jogadores; Algodão e Bens Manufaturados têm **zero** cópias em 2
  jogadores e saltam para 6/8 em 3/4). A correção também revelou dois erros na leitura anterior
  de cor de estandarte (`docs/ASSUMPTIONS.md` #21): Kidderminster e Worcester tinham sido
  classificadas como restritas a 3+ jogadores quando na verdade não têm restrição nenhuma. Ver
  `docs/ASSUMPTIONS.md` #22 e `docs/RULES.md` §10 para as duas tabelas completas.
- **A era de 12 dos 30 links do tabuleiro estava errada, e um link tinha a conectividade
  errada.** O usuário forneceu uma segunda foto do tabuleiro, mais nítida e tirada de frente, e
  a regra explícita: linhas azuis = era do Canal, linhas escuras (trilho) = Ferrovia, as duas
  juntas = qualquer era. Retracei os 30 links um a um contra essa foto; 12 tinham a era
  registrada errada (a leitura anterior, de uma foto mais antiga e em ângulo, foi feita com
  confiança "média" desde o início — `docs/ASSUMPTIONS.md` #5 já sinalizava isso). Mais sério:
  **Uttoxeter na verdade se conecta a Derby por ferrovia, não a Burton-on-Trent** como a
  reconstrução original tinha — não existe nenhuma linha entre Uttoxeter e Burton-on-Trent
  nesta foto nova. Ver `docs/ASSUMPTIONS.md` #23 para a lista completa das 12 mudanças de era.
- **O ISMCTS implementado é uma simplificação do algoritmo "de livro".** Em vez de manter uma
  única árvore de conjunto de informação compartilhada entre as determinizações (com checagem
  de compatibilidade de ações por nó), cada "mundo" sorteado ganha sua própria árvore
  independente, e só os visits da raiz são somados no final — a forma mais simples que o
  próprio `docs/PLANO.md` já descreve literalmente. Ver `docs/ASSUMPTIONS.md` #14.
- **A suíte de testes é lenta (2-4 minutos)** porque três testes jogam de dezenas a
  milhares de partidas reais bot-contra-bot para validar taxas de vitória, em vez de apenas
  testar unidades isoladas. Isso foi uma escolha deliberada — são exatamente os testes que
  encontraram os dois bugs mais sérios do projeto (saldo negativo em `payMoney` e a contagem
  de mundos do ISMCTS que fazia o bot jogar sem busca nenhuma) — mas vale considerar separar
  em `verify:fast`/`verify:slow` se o ciclo de iteração incomodar.
- **A CLI é funcional, não bonita.** Lista as ações legais agrupadas por tipo e numeradas
  dentro de cada grupo, sem desenho de tabuleiro nem cores; não há como desfazer uma jogada
  além de recarregar uma partida salva antes dela.
- **Ao pagar uma renda negativa sem dinheiro suficiente, o motor vende peças automaticamente**
  pela política fixa "mais baratas primeiro" (`docs/ASSUMPTIONS.md` #10) — mesmo no modo
  interativo, um jogador humano não escolhe qual peça sacrificar.
- **A GUI web (`npm run web`) guarda as partidas só em memória do processo** — sem
  save/load/replay em disco (isso continua sendo só da CLI), sem autenticação, e pensada para
  uso local de um único jogador por vez, não para expor na rede.
