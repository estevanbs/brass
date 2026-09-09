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
`legalActions`/`applyAction`/os bots por HTTP), mas com o tabuleiro desenhado como grade de
localidades, mão como cartões, ações agrupadas por tipo como botões clicáveis, e um log das
jogadas dos bots com o VP estimado de cada uma. Não salva/carrega partida nem faz replay (só
a CLI faz isso, por enquanto) — o estado de cada partida fica em memória no processo do
servidor e se perde ao reiniciá-lo.

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
`GET|POST /api/games/:id[/actions]`); o frontend em `public/` é JavaScript puro sem build
step, consumindo essa API por `fetch`. Nenhuma regra de jogo é duplicada — tanto a CLI quanto
a GUI web só formatam o mesmo estado e despacham para o mesmo `applyAction`.

## Limitações conhecidas

- **Dados do tabuleiro e das peças de indústria são uma reconstrução própria, não uma cópia
  dos componentes físicos do jogo real.** A topologia do tabuleiro (quais das ~25 localidades
  se conectam a quais) e as tabelas numéricas de custo/VP/renda de cada peça foram desenhadas
  originalmente, seguindo a estrutura e as proporções do jogo publicado, porque não havia uma
  fonte confiável e completa para extrair os números exatos dentro do processo autônomo deste
  projeto. O fluxo de turno, as 7 ações, as fórmulas de mercado e a trilha de renda, por
  outro lado, foram verificados contra o resumo de regras oficial da Roxley e batem
  exatamente. Ver `docs/ASSUMPTIONS.md` para cada decisão, com grau de confiança e impacto.
- **O ISMCTS (M7) não atinge a meta formal do marco.** A validação completa (300 partidas
  ISMCTS × heurístico, orçamento real de 1s/jogada, `scripts/run-ismcts-validation.ts`, ~142
  minutos) terminou em **182/300 vitórias (60,7%)**, abaixo do alvo de 65%. O ISMCTS joga
  visivelmente melhor que o bot aleatório e vence o heurístico na maioria das partidas, só não
  na margem pedida. Ver `docs/PROGRESS.md` (seção M7) para os caminhos identificados para
  fechar essa distância (árvore compartilhada entre mundos em vez de uma nova por mundo,
  `rootTopK` maior, etc.) — nenhum foi implementado por tempo. O teste embutido na suíte usa
  um orçamento de simulações fixo (não tempo real) numa amostra menor, para continuar
  determinístico independente da velocidade da máquina.
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
