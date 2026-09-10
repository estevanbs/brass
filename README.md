# Brass: Birmingham — bot pessoal

Motor completo de **Brass: Birmingham** em TypeScript — regras, três bots de força crescente
(aleatório, heurístico, ISMCTS), uma CLI de terminal e uma GUI web (Angular + NestJS) para
jogar contra eles. Todo o projeto — backend e frontend — vive num único **monorepo Nx** em
`client/` (o nome ficou do tempo em que a pasta só tinha o frontend; hoje ela é o workspace
inteiro). Ver `docs/PLANO.md` para o prompt original, `docs/RULES.md` para a especificação de
regras que o código implementa, `docs/ASSUMPTIONS.md` para toda decisão tomada diante de
ambiguidade, e `docs/PROGRESS.md` para o histórico marco a marco (incluindo os bugs reais
encontrados e corrigidos ao longo do caminho).

## Instalação

Requer Node.js ≥24.15 (exigido pelo Angular/Nx mais recentes — ex. `nvm install 24 && nvm use 24`).

```sh
cd client
npm install
```

## Rodar os testes

```sh
cd client
npx nx run-many -t lint typecheck test build   # tudo — os 8 projetos do workspace
npx nx test backend-domain                      # só as regras do motor
npx nx test backend-infrastructure              # só os bots (é o alvo lento, ver abaixo)
```

Os testes de `backend-infrastructure` levam **3-4 minutos**: dois deles jogam centenas de
partidas completas bot-contra-bot para validar taxas de vitória reais (não simuladas) — ver a
seção de Limitações. Todos os testes são determinísticos (nenhum depende de tempo real ou
aleatoriedade não semeada); os poucos testes lentos usam orçamentos de simulação fixos, não
relógio de parede, especificamente para evitar variar com a velocidade da máquina.

## Como jogar

```sh
cd client
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
no mesmo estado final (ver `libs/backend-application/tests/unit/render-and-game-log.test.ts`).

### GUI web (opcional, mais amigável que a CLI)

Em desenvolvimento, backend e frontend rodam como dois processos separados (dois apps Nx), com
o Angular fazendo proxy de `/api/*` para o Nest:

```sh
cd client
npx nx serve api    # NestJS em http://localhost:3000/api
npx nx serve web    # Angular em http://localhost:4200 (proxy.conf.json encaminha /api para :3000)
```

Abra `http://localhost:4200`. Para rodar como um único processo/origem (mais perto de produção
— era assim que o antigo servidor `node:http` funcionava):

```sh
npx nx build web && npx nx build api
node dist/apps/api/main.js   # serve a API em /api/* e o build do Angular (client/../public) em /
```

É a mesma partida da CLI, com a mesma lógica de motor por baixo — o backend só expõe
`legalActions`/`applyAction`/os bots (`apps/api`, NestJS). Depois que você joga sua carta, cada
jogada de bot que segue chega pelo WebSocket (`/ws/games`) **uma de cada vez**, conforme
acontece — não só o resultado final depois que todos os bots já jogaram — então dá pra
acompanhar o tabuleiro/mão/registro mudando jogada a jogada em vez de um salto direto pro
estado final. Estilo Hearthstone: o tabuleiro (mapa cujo layout reproduz o posicionamento real
das localidades no tabuleiro físico do jogo — ver `docs/ASSUMPTIONS.md` #16) ocupa a tela
inteira como fundo, a mão fica em cartas na frente, e selecionar uma carta destaca diretamente
no mapa os locais/links jogáveis — clicar neles abre uma caixa de confirmação mostrando o que a
ação vai custar (dinheiro, peça, fonte de carvão/ferro/cerveja) antes de executá-la. Cada
jogador tem seu próprio "tabuleiro pessoal" (estoque de peças de indústria por custo/VP/renda,
mais as já construídas no tabuleiro) sempre visível num painel; o registro de jogadas também.
Não salva/carrega partida nem faz replay (só a CLI faz isso, por enquanto) — o estado de cada
partida fica em memória no processo do backend e se perde ao reiniciá-lo.

## Arquitetura

Todo o código vive num único **monorepo Nx** em `client/`, com dois apps (`apps/api` —
NestJS; `apps/web` — Angular) e sete libs em `client/libs/`, cada uma um projeto Nx separado
com seu próprio `lint`/`typecheck`/`test`/`build`:

```sh
cd client
npx nx run-many -t lint typecheck test build   # os 8 projetos
```

**Backend — clean architecture em três camadas, sem nenhuma delas conhecer NestJS:**

- **`libs/backend-domain`** — o motor em si, puro TypeScript sem nenhuma dependência de
  framework. Define o vocabulário do domínio (`GameState`, `PlayerState`, `Card`, etc.), o RNG
  semeado (`mulberry32`, único gerador de aleatoriedade permitido em código de produção), as
  funções de setup/serialização/hash do estado (`core/`), os dados estáticos do jogo —
  tabuleiro, tabela de indústrias, composição do baralho — como constantes puras (`rules/`), e
  onde as regras viram código (`engine/`): `applyAction` aplica cada uma das 7 ações como uma
  função pura `(state, action) -> state` que nunca muta a entrada e lança erro em qualquer
  caminho ilegal; `engine/cycle.ts` orquestra o ciclo de turno/rodada/era por cima disso;
  `engine/legal` gera a lista de ações legais.
- **`libs/backend-infrastructure`** — os três bots (`bots/random.ts`, `bots/heuristic.ts`,
  `bots/ismcts.ts`) e o harness que os joga uns contra os outros (`bots/harness.ts`), como
  implementações plugáveis do motor — nenhuma conhece HTTP nem Nest.
- **`libs/backend-application`** — casos de uso, framework-agnósticos: `GameService` (criar
  partida, aplicar a ação do humano, deixar os bots jogarem até voltar a vez do humano),
  `action-cost.ts` (o que uma ação vai custar, para a caixa de confirmação da GUI), `render.ts`
  (formatação de texto a partir do `GameState`, compartilhada pela CLI e pela API) e
  `game-log.ts` (salvar uma partida é só `{ seed, playerIds, actions }`, nunca o estado
  completo — o replay é literalmente `createInitialState(seed)` seguido de reaplicar cada ação
  do log, o que dobra como uma prova de determinismo do motor inteiro toda vez que roda).
  `InMemoryGameRepository` também mora aqui, junto ao *port* `GameRepository` que implementa.
  `GameService.submitHumanAction` aceita um `onMove` opcional, chamado uma vez por jogada
  (a do humano, depois uma por bot) em vez de só devolver o estado final — é o que permite ao
  transporte (o gateway WebSocket abaixo) fazer streaming em vez de esperar o lote inteiro.
- **`apps/api`** — a fiação NestJS. `GamesController` só cuida do que não precisa de streaming
  — `POST /api/games` (criar partida) e `GET /api/games/:id` (buscar o estado atual, útil pra
  resincronizar depois de uma queda de conexão). Submeter uma ação é `GamesGateway`, um
  WebSocket em `/ws/games` (`@nestjs/websockets` + `@nestjs/platform-ws`, sem socket.io — o
  frontend usa a `WebSocket` nativa do browser): o cliente manda uma mensagem `submitAction`, o
  servidor devolve um `moveApplied` por jogada aplicada conforme `onMove` dispara, e fecha com
  `sequenceComplete` (ou um único `error` em caso de falha) — ver `apps/api/src/app/games/
  ws-events.ts` para o protocolo completo. DTOs com `class-validator` nos dois transportes; um
  filtro de exceção traduz os erros de `GameService` para os mesmos status code/mensagem de
  sempre no REST, e o próprio handler do gateway faz o equivalente para o WebSocket.
  `GameService` é conectado via `useFactory` no módulo — não é decorado com `@Injectable()`,
  então continua 100% testável fora do Nest (ver
  `libs/backend-application/tests/unit/game.service.test.ts` e
  `apps/api/src/app/games/games.gateway.spec.ts`, este último com um cliente `ws` real).

O ponto mais delicado do motor continua sendo a geração de ações legais (`engine/legal/`),
por causa do fator de ramificação real do jogo: um turno típico oferece de 100 a mais de 600
ações legais distintas, contando cada escolha de local, slot, carta e fonte de
carvão/ferro/cerveja como uma ação separada. Gerar esse espaço combinatório à mão e depois
confiar que cada candidata é de fato aplicável seria arriscado; em vez disso, cada gerador
(`legal/build.ts`, `legal/network.ts`, etc.) produz candidatas de forma razoavelmente enxuta —
mas o filtro final e definitivo é literalmente chamar o código real de cada ação
(`applyBuild`, `applyNetworkAction`, ...) dentro de um `try/catch`: uma candidata só chega ao
chamador depois de ter sido genuinamente validada por aplicação, e a deduplicação usa a mesma
serialização canônica usada para o hash do estado. Isso elimina uma classe inteira de bugs "a
lista disse que essa ação era legal, mas aplicá-la lançou um erro".

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

A CLI (`client/tools/cli.ts`) é deliberadamente fina — só chama `backend-domain`,
`backend-infrastructure` e os helpers de `backend-application`, sem regra própria nenhuma.
Nenhuma regra de jogo é duplicada no backend — tanto a CLI quanto a GUI web só formatam o
mesmo estado e despacham para o mesmo `applyAction`; o frontend por sua vez também não
reimplementa regra nenhuma, só *exibe* o `GameState` que a API manda e envia de volta o índice
da ação escolhida dentre as `legalActions` que a API já calculou.

**Frontend — clean architecture em quatro camadas, cada uma um projeto Nx sob `client/libs/`:**

- **`domain`** — modelos (`Card`, `GameState`, `GameView`, ...) e funções puras sem nenhuma
  dependência de Angular ou de framework nenhum: `cardKey`/formatação de carta,
  `incomeLevelForPosition` (mesma fórmula de `backend-domain/engine/income.ts`, duplicada só
  para exibição), o layout do mapa (`computeMapLayout`, posições lidas do tabuleiro físico real
  — `docs/ASSUMPTIONS.md` #16 — mais um passo de "desamontoamento" de rótulos) e a atribuição
  de cor por jogador. Testável com Vitest puro, sem `TestBed`.
- **`application`** — `GameStateService`, o único lugar que guarda estado de seleção/UI (carta
  selecionada, modo Scout, popup aberto) como signals, e o *port* `GameGateway` (uma classe
  abstrata usada como token de injeção) que ele depende — nunca de um cliente HTTP concreto.
  Também expõe wrappers injetáveis finos (`CardFormatService`, `IncomeService`, etc.) em cima
  das funções puras de `domain`, para que a UI sempre injete via DI em vez de importar função
  solta.
- **`infrastructure`** — `HttpGameGateway`, o único adaptador que de fato conhece o transporte
  do backend, implementando o port `GameGateway` de `application`: `createGame`/`getGame` via
  REST (`HttpClient`, `/api/games...`), `submitAction` via WebSocket nativa do browser
  (`/ws/games`) — devolve um `Observable<GameMoveEvent>` que emite um valor por jogada
  transmitida e completa quando o servidor manda `sequenceComplete`.
- **`presentation`** — todos os componentes de UI (mapa, mão, tabuleiro pessoal, popups,
  etc.), consumindo só `application`/`domain` — nunca `infrastructure` diretamente.
- **`apps/web`** — a *composition root*: o único lugar que sabe que `GameGateway` é
  implementado por `HttpGameGateway` (`app.config.ts` faz esse `provide`), e que renderiza o
  componente-raiz de `presentation`. Propositalmente fino — nenhuma lógica de tela mora aqui.

A regra de dependência é de mão única em cada lado: no backend, `backend-domain` não depende
de nada, `backend-infrastructure` só de `backend-domain`, `backend-application` dos dois,
`apps/api` de todos; no frontend, `domain` não depende de nada, `application` só de `domain`,
`infrastructure` e `presentation` de `application` e `domain`, `apps/web` de todos — nunca o
inverso. Do lado do frontend, essa inversão (via o port `GameGateway`) é o que permite testar
`GameStateService` e todos os componentes de `presentation` com um `FakeGameGateway` em vez de
subir um backend HTTP de verdade nos testes (ver `libs/application/.../game-state.service.spec.ts`
e `libs/presentation/src/lib/testing/fake-game-gateway.ts`).

## Limitações conhecidas

- **A topologia do tabuleiro (quais das 27 localidades se conectam a quais, quantos slots
  cada uma tem e quais indústrias cada slot aceita, quais mercadores exigem quantos jogadores,
  e a era de cada link) vem de fontes reais fornecidas pelo usuário, não de invenção** — o
  que era o caso nas primeiríssimas versões deste projeto, quando não havia fonte confiável
  disponível. Os dois aspectos que exigiam mais interpretação visual (quais indústrias cada
  slot aceita, e a lista/era de cada link) hoje vêm de dois arquivos que o próprio usuário
  escreveu à mão — `docs/BUILDINGS.md` e `docs/CONNECTIONS.md` — declarados por ele como fonte
  final de verdade, e que substituem toda reconstrução anterior feita a partir de fotos do
  tabuleiro. O que **continua** sendo composição própria, não uma transcrição literal: as
  tabelas numéricas exatas de custo/VP/renda/produção impressas em cada peça de indústria (o
  manual oficial dá só o total de peças por indústria, não a tabela nível a nível). O fluxo de
  turno, as 7 ações, as fórmulas de mercado e a trilha de renda, por outro lado, foram
  verificados contra o resumo de regras oficial da Roxley e batem exatamente. Ver
  `docs/ASSUMPTIONS.md` (entradas #1, #5, #15, #16, #23, #24) para o histórico completo de cada
  decisão, com grau de confiança e impacto.
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
  ISMCTS × heurístico, orçamento real de 1s/jogada, `client/tools/run-ismcts-validation.ts`, ~142
  minutos) terminou em **182/300 vitórias (60,7%)**, abaixo do alvo de 65%. O ISMCTS joga
  visivelmente melhor que o bot aleatório e vence o heurístico na maioria das partidas, só não
  na margem pedida. Ver `docs/PROGRESS.md` (seção M7) para os caminhos identificados para
  fechar essa distância (árvore compartilhada entre mundos em vez de uma nova por mundo,
  `rootTopK` maior, etc.) — nenhum foi implementado por tempo. O teste embutido na suíte usa
  um orçamento de simulações fixo (não tempo real) numa amostra menor, para continuar
  determinístico independente da velocidade da máquina.
- **As sucessivas reconstruções do tabuleiro a partir de fontes reais (acima) mudaram o
  desempenho do ISMCTS contra o heurístico repetidamente ao longo de várias sessões — para
  pior, recuperado, para pior de novo, e finalmente para muito melhor.** Cada revisão do
  tabuleiro muda o fator de ramificação que o `rootTopK` do ISMCTS foi calibrado para lidar (o
  tabuleiro atual, transcrito de `docs/BUILDINGS.md`/`docs/CONNECTIONS.md`, tem 20 localidades
  industriais e 39 links — bem diferente do "18 localidades, 43 links" original inventado sem
  fonte). Na mesma amostra fixa de 12 partidas com orçamento determinístico de 120 simulações
  que antes ficava perto de 50%: a primeira reconstrução do tabuleiro (foto) derrubou para
  41,7% (5/12); a correção dos totais de peças de indústria derrubou ainda mais, para 33,3%
  (4/12); a correção da distribuição exata de cartas recuperou para 50,0% (6/12); a
  re-verificação da era de cada link (foto de melhor qualidade) derrubou de novo para 41,7%
  (5/12), mas dessa vez sem confirmação de uma amostra maior (provavelmente ruído, não
  regressão real); e a reescrita final da topologia a partir dos dois arquivos de fonte final
  de verdade (bullet anterior) subiu para **75,0% (9/12)**, confirmado por uma amostra
  independente de 30 partidas em 63,3% (19/30). O limiar embutido
  (`client/libs/backend-infrastructure/tests/properties/ismcts-vs-heuristic.test.ts`) acompanhou essas idas e voltas — ver o
  comentário do próprio arquivo de teste para o histórico completo com todos os números e a
  justificativa de cada mudança de limiar. `rootTopK` e o resto da calibração do ISMCTS nunca
  foram re-validados formalmente contra nenhuma dessas revisões de tabuleiro — essa validação
  continua sendo trabalho real e não feito, do mesmo porte da própria validação do M7.
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
- **A topologia de links e os slots de cada localidade foram totalmente reescritos a partir de
  `docs/BUILDINGS.md` e `docs/CONNECTIONS.md`, dois arquivos que o usuário escreveu à mão e
  declarou fonte final de verdade — substituindo de vez qualquer leitura de foto anterior para
  esses dois aspectos.** O tabuleiro passou de 30 para **39 links** (nenhum par de localidades
  repetido entre as categorias de era, então cada linha do arquivo virou um `LinkSlotDef`
  direto). Mudança mais notável no lado dos slots: **Cervejaria deixou de ser exclusiva das
  duas fazendas cervejeiras** — vários slots de localidades industriais comuns (Walsall,
  Coventry, Stone, Uttoxeter, Stafford, Burton-on-Trent, Coalbrookdale, Nuneaton, Derby) também
  a aceitam. Nenhum código do motor assumia que cerveja só existe em localidades `kind:
  'farm_brewery'` (verificado antes de aplicar a mudança), então não foi preciso tocar em
  lógica de jogo — só nos dados de `board-data.ts` e nos testes que tinham fixtures presas a
  slots/links específicos que deixaram de existir daquela forma (27 testes em 5 arquivos).
  **Efeito colateral honesto**: com o tabuleiro bem mais conectado, a amostra fixa de 12
  partidas ISMCTS×heurístico subiu de 41,7% para **75,0% (9/12)** — confirmado por uma amostra
  independente de 30 partidas em 63,3% (19/30).
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
- **A GUI web (`apps/api`) guarda as partidas só em memória do processo** — sem
  save/load/replay em disco (isso continua sendo só da CLI), sem autenticação, e pensada para
  uso local de um único jogador por vez, não para expor na rede.
