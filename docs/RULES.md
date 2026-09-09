# RULES.md — Brass: Birmingham, como implementado neste projeto

Este documento é a **fonte única de verdade** do motor. Qualquer divergência entre este
arquivo e o código é um bug — em um dos dois lados — e deve ser corrigida explicitamente.

As regras de fluxo de jogo, ações, mercados e pontuação abaixo são uma transcrição fiel do
jogo publicado. Os **dados exatos do tabuleiro (cidades, links, slots) e as tabelas numéricas
de cada peça de indústria (custo, VP, renda, produção) são uma reconstrução própria**, não uma
cópia literal dos componentes físicos protegidos — ver `docs/ASSUMPTIONS.md` para a
justificativa e o grau de confiança. Sempre que o código precisar desses números, ele os lê de
`src/rules/board-data.ts`, `src/rules/industry-data.ts` e `src/rules/deck-data.ts`, que devem
espelhar exatamente as tabelas deste arquivo.

## 1. Visão geral

- 2 a 4 jogadores. Cada jogador tem uma cor e um conjunto de peças de indústria e de link
  nessa cor.
- O jogo tem 2 **eras**: Canal e Ferrovia (Rail). VPs são pontuados ao final de cada era.
- Cada era é jogada em **rodadas**; cada rodada, todos os jogadores agem uma vez, na ordem do
  turno. A era termina quando o baralho de compra e as mãos de todos os jogadores se esgotam.
- Número de rodadas por era: **10 (2 jogadores), 9 (3 jogadores), 8 (4 jogadores)**.
- Em cada turno, o jogador realiza **2 ações** (apenas **1 ação** na primeira rodada da era do
  Canal). Para cada ação executada — inclusive Pass — descarta-se 1 carta.
- Ao final do turno, a mão é reposta até 8 cartas (se houver cartas suficientes no baralho).

## 2. Estado inicial (setup)

- Cada jogador começa com **£17**, índice de renda na posição **10** da trilha de renda
  (nível de renda 0 — ver §7), marcador de VP em 0, e o estoque completo de peças de indústria
  da sua cor (ver §5).
- Cada jogador recebe **14 peças de link** (repostas integralmente no início da era Ferrovia).
- Cada jogador compra 8 cartas para a mão e 1 carta adicional, colocada virada para baixo como
  topo da pilha de descarte.
- Mercado de carvão: 14 espaços, preenchido com 13 cubos no setup (1 espaço de £1 livre).
- Mercado de ferro: 10 espaços, preenchido com 8 cubos no setup (2 espaços de £1 livres).
- Cartas curinga: `playerCount` cartas de "local curinga" e `playerCount` cartas de "indústria
  curinga", em pilhas à parte, sempre viradas para cima.
- Ordem de turno inicial: aleatória (semente do RNG).

## 3. Sequência de rodada

1. Cada jogador, em ordem de turno, realiza suas ações (2, ou 1 na primeira rodada da era
   Canal).
2. **Fim de rodada:**
   a. Nova ordem de turno: quem gastou menos dinheiro na rodada age primeiro na próxima; em
      caso de empate, mantém a ordem relativa anterior. Depois, o dinheiro gasto é devolvido ao
      banco (ele só serve para desempate de ordem).
   b. **Renda:** cada jogador recebe do banco o valor do seu nível de renda atual (pode ser
      negativo). Renda não é paga na última rodada da era Ferrovia.
      - Se o jogador não tem dinheiro suficiente para pagar uma renda negativa, ele deve
        remover peças de indústria (nunca links) do tabuleiro, uma a uma, cada uma valendo
        metade do seu custo de construção (arredondado para baixo), até cobrir o déficit
        (troco fica com o jogador). A peça removida sai do jogo.
      - Se ainda assim não houver como cobrir o déficit, o jogador perde 1 VP para cada £1
        que faltar (não pode ficar com VP negativo).

## 4. Ações

Em cada ação (das 2 por turno), o jogador escolhe uma das sete opções abaixo (a mesma ação
pode ser repetida) ou passa. Toda ação (inclusive Pass) exige descartar 1 carta.

### 4.1 Build (Construir)

1. Descarta uma carta apropriada:
   - **Carta de local**: constrói qualquer indústria nesse local, mesmo fora da rede do
     jogador.
   - **Carta de local curinga**: jogada como qualquer carta de local (exceto as 2 fazendas
     cervejeiras).
   - **Carta de indústria**: constrói a indústria correspondente em um local que faça parte
     da rede do jogador (ver §4.2 para definição de rede).
   - **Carta de indústria curinga**: jogada como qualquer carta de indústria.
   - **Exceção — sem peças no tabuleiro**: se o jogador não tem nenhuma peça de indústria nem
     de link no tabuleiro, pode descartar uma carta de indústria para construir em *qualquer*
     local com slot livre daquele tipo, mesmo fora da rede.
2. Pega a peça de nível mais baixo daquela indústria no seu tabuleiro pessoal e a coloca
   (lado virado para baixo) num slot livre do local escolhido que aceite aquele ícone,
   preferindo slots que aceitem *apenas* aquele ícone.
   - Era Canal: no máximo 1 peça de indústria **do próprio jogador** por local — jogadores
     diferentes podem ter cada um a sua própria peça no mesmo local, em slots diferentes
     (docs/HANDBOOK_RULES.md §6: "pode ter uma Indústria no mesmo local que outros
     jogadores"). O limite é por dono, não um teto global de 1 peça por local.
   - Era Ferrovia: múltiplas peças por local são permitidas (uma por slot), de qualquer dono.
   - Peças **era-restritas** (nível 1 de toda indústria exceto Cerâmica —
     `IndustryTileDef.eraRestricted`, docs/HANDBOOK_RULES.md §6 e §13) só podem ser
     construídas na era Canal; se ainda não construídas quando a era Ferrovia começa, ficam
     bloqueadas para Build e só saem do tabuleiro pessoal via Develop.
   - A peça **bloqueada** de Cerâmica nível 1 (a "peça com ícone de lâmpada", ver §5.4) é o
     oposto: **só pode ser removida via Build** (nunca via Develop) — é preciso efetivamente
     construí-la no tabuleiro para acessar as peças de Cerâmica de nível maior por baixo dela.
3. Paga o custo da peça (em £) e consome carvão/ferro exigidos pela peça (ver §6).
4. Efeitos imediatos:
   - **Mina de carvão / siderúrgica**: coloca cubos de recurso (quantidade impressa na peça)
     sobre a peça.
   - **Cervejaria**: coloca barris de cerveja — 1 na era Canal, 2 na era Ferrovia.
   - **Venda automática ao mercado**: se construiu uma mina de carvão *conectada a um espaço
     de mercador* (ver §7), ou uma siderúrgica (sempre, independente de conexão), move
     imediatamente o máximo de cubos possível da peça para o mercado correspondente,
     preenchendo os espaços mais caros primeiro, recebendo o dinheiro de cada espaço
     preenchido. Se o último cubo sai da peça, ela vira (flip) e a renda do jogador avança.
     Carvão/ferro só é vendido ao mercado no momento da construção — nunca depois.

**Overbuilding**: um jogador pode substituir uma peça de indústria já construída por uma de
nível maior da mesma indústria, pagando o custo normal de construção:
- Se a peça substituída é sua, pode sobrepor qualquer indústria seu; recursos nela voltam ao
  suprimento geral.
- Se a peça é de um oponente, só pode sobrepor mina de carvão ou siderúrgica, e apenas se não
  houver nenhum cubo daquele recurso em lugar nenhum do tabuleiro (incluindo o mercado).
- A peça sobreposta sai do jogo (não pontua). O dono original não perde renda/VP já obtidos.

### 4.2 Network (Construir link)

1. Descarta qualquer carta.
2. Coloca 1 peça de link (canal na era Canal, ferrovia na era Ferrovia) numa linha livre do
   tabuleiro, adjacente a um local que faça parte da rede do jogador. Um local faz parte da
   rede se contém uma peça de indústria do jogador OU é adjacente a um link do jogador. Se o
   jogador não tem nada no tabuleiro, pode construir em qualquer linha livre.
   - Era Canal: só linhas de canal; **1 link por ação, custando £3**.
   - Era Ferrovia: só linhas de ferrovia; **1 link por ação, custando £5 + 1 carvão**, OU
     **2 links na mesma ação por £15 + 1 cerveja + 1 carvão por link** (a cerveja não pode vir
     de mercador; cada link deve estar conectado a uma fonte de carvão/cerveja depois de
     colocado).

### 4.3 Develop (Desenvolver)

1. Descarta qualquer carta.
2. Remove 1 ou 2 peças (a de nível mais baixo de cada indústria escolhida) do próprio
   tabuleiro pessoal e devolve à caixa (fora do jogo).
3. Consome 1 ferro para cada peça removida.
4. A peça bloqueada de Cerâmica nível 1 (§5.4) **não pode** ser removida via Develop — só via
   Build (o inverso das peças era-restritas do §4.1, que só saem via Develop).

### 4.4 Sell (Vender)

1. Descarta qualquer carta.
2. Escolhe uma peça não virada (tecelagem de algodão, manufatura ou cerâmica) conectada a um
   mercador que aceite aquele ícone.
3. Consome a cerveja exigida (impressa na peça). Cerveja de um espaço de mercador só pode ser
   usada aqui, e concede o bônus do mercador (§4.6).
4. Vira a peça e avança a renda do jogador.
5. Pode repetir para outras peças não viradas do jogador na mesma ação de Sell.

### 4.5 Loan (Empréstimo)

1. Descarta qualquer carta.
2. Recebe £30 do banco e recua 3 **níveis** de renda (não espaços) na trilha, ficando no
   espaço mais alto daquele nível. Proibido se isso levar o nível abaixo de -10.

### 4.6 Scout (Explorar)

1. Descarta a carta base mais 2 cartas adicionais da mão (3 no total).
2. Recebe 1 carta de local curinga e 1 carta de indústria curinga.

### 4.7 Pass

Descarta 1 carta sem efeito.

## 5. Indústrias

Seis tipos: Mina de Carvão, Siderúrgica, Tecelagem de Algodão, Manufatura, Cerâmica,
Cervejaria. Cada tipo tem 4 níveis. O jogador constrói sempre a peça de nível mais baixo
restante no seu tabuleiro pessoal daquele tipo.

### 5.1 Quando uma peça vira (flip)

- Tecelagem, Manufatura, Cerâmica: viram ao serem vendidas (ação Sell).
- Mina de Carvão, Siderúrgica, Cervejaria: viram quando o último recurso sai da peça (pode
  acontecer no turno de outro jogador).
- Toda vez que uma peça vira, a renda do jogador avança pelo valor de renda impresso nela
  (nunca acima do nível 30).

### 5.2 Pontuação de uma peça

Cada peça de indústria tem um único valor de VP impresso, usado em dois contextos:
- Ao final da era, se a peça está virada, seu dono ganha esse VP.
- Ao pontuar links (§8), para cada extremidade de um link que não seja um mercador, o dono do
  *link* ganha o VP de cada peça virada presente naquele local — **de qualquer dono**.

### 5.3 Tabelas de indústria (custo em £, recursos consumidos na construção, produção,
recurso de venda, VP, renda ganha ao virar)

| Indústria | Nível | Custo | Carvão | Ferro | Produção (carvão/ferro/cerveja) | Cerveja p/ vender | VP | Renda |
|---|---|---|---|---|---|---|---|---|
| Mina de Carvão | 1 | £5 | 0 | 0 | 2 carvão | — | 1 | +1 |
| Mina de Carvão | 2 | £7 | 0 | 0 | 3 carvão | — | 2 | +1 |
| Mina de Carvão | 3 | £8 | 0 | 0 | 4 carvão | — | 3 | +2 |
| Mina de Carvão | 4 | £10 | 0 | 0 | 5 carvão | — | 4 | +2 |
| Siderúrgica | 1 | £5 | 0 | 0 | 2 ferro | — | 2 | +1 |
| Siderúrgica | 2 | £7 | 0 | 0 | 3 ferro | — | 3 | +1 |
| Siderúrgica | 3 | £9 | 0 | 0 | 4 ferro | — | 4 | +2 |
| Siderúrgica | 4 | £11 | 0 | 0 | 5 ferro | — | 5 | +2 |
| Tecelagem | 1 | £12 | 1 | 0 | — | 1 | 5 | +1 |
| Tecelagem | 2 | £14 | 1 | 0 | — | 1 | 7 | +2 |
| Tecelagem | 3 | £16 | 1 | 0 | — | 1 | 9 | +3 |
| Tecelagem | 4 | £18 | 1 | 0 | — | 1 | 12 | +4 |
| Manufatura | 1 | £8 | 0 | 0 | — | 1 | 3 | +1 |
| Manufatura | 2 | £10 | 0 | 1 | — | 1 | 5 | +2 |
| Manufatura | 3 | £12 | 0 | 1 | — | 2 | 8 | +3 |
| Manufatura | 4 | £14 | 0 | 1 | — | 2 | 11 | +4 |
| Cerâmica | 1 (bloqueada) | £17 | 0 | 0 | — | 1 | 10 | +1 |
| Cerâmica | 2 | £10 | 0 | 1 | — | 1 | 8 | +2 |
| Cerâmica | 3 | £12 | 0 | 1 | — | 1 | 12 | +2 |
| Cerâmica | 4 | £14 | 0 | 1 | — | 2 | 16 | +3 |
| Cervejaria | 1 | £5 | 0 | 0 | 1/2 cerveja (canal/ferrovia) | — | 4 | +1 |
| Cervejaria | 2 | £7 | 0 | 0 | 1/2 cerveja | — | 5 | +1 |
| Cervejaria | 3 | £9 | 0 | 0 | 1/2 cerveja | — | 7 | +2 |
| Cervejaria | 4 | £11 | 0 | 0 | 1/2 cerveja | — | 8 | +2 |

### 5.4 Cópias por jogador, bloqueio, e restrição de era

Cada jogador possui, por indústria: **Carvão 7, Ferro 4, Tecelagem 11, Manufatura 11, Cerâmica
5, Cervejaria 7** (45 peças no total) — totais lidos diretamente de
`docs/HANDBOOK_RULES.md` (lista de componentes: "180 Indústrias (45 por cor): 11 Manufaturas,
11 Fábricas de Algodão, 7 Cervejarias, 5 Olarias, 4 Siderúrgicas, 7 Minas de Carvão"). A
distribuição exata *dentro* de cada indústria entre os 4 níveis não vem do manual (só o total
por indústria) — é este projeto que decide uma divisão razoável e decrescente por nível; ver
`src/rules/industry-data.ts#initialIndustryStock` e `docs/ASSUMPTIONS.md` #4.

Dois mecanismos diferentes de "peça presa", com direção oposta:

- **Bloqueada** (`IndustryTileDef.locked`): só a peça de Cerâmica nível 1 (a peça com o ícone
  de lâmpada no jogo físico). Não pode ser removida via Develop — a *única* forma de tirá-la
  do tabuleiro pessoal é efetivamente **construí-la** (Build) no tabuleiro, mesmo sendo uma
  peça de baixo valor, antes de acessar as peças de Cerâmica de nível maior por baixo dela.
- **Era-restrita** (`IndustryTileDef.eraRestricted`): a peça de **nível 1 de toda indústria,
  exceto Cerâmica** (Carvão, Ferro, Tecelagem, Manufatura, Cervejaria). Só pode ser construída
  via Build durante a era Canal; se ainda estiver no tabuleiro pessoal quando a era Ferrovia
  começar, não pode mais ser construída — só sai via Develop. Cerâmica nível 1 é a exceção
  documentada explicitamente (`docs/HANDBOOK_RULES.md` §13: "Diferentemente das outras
  Indústrias de nível 1, a Olaria de nível 1 pode ser construída durante a Era das
  Ferrovias").

## 6. Consumo de recursos

### 6.1 Carvão

Para consumir carvão, o link ou a peça que precisa dele deve estar conectado (por uma cadeia
de links, de qualquer dono) a uma fonte, no momento em que o consumo acontece:

1. A mina de carvão não virada mais próxima (menor número de links de distância), de
   qualquer jogador. Em empate, escolha livre. Se ela esgotar, use a próxima mais próxima.
   Consumir assim é grátis.
2. Se não há conexão com nenhuma mina não virada, compre do mercado de carvão (preço mais
   barato disponível primeiro) — exige conexão a um local de mercador. Se o mercado estiver
   vazio, ainda é possível comprar por £8/unidade.

### 6.2 Ferro

Ferro é global — não exige conexão:

1. Qualquer siderúrgica não virada de qualquer jogador (não precisa ser a mais próxima).
   Consumir assim é grátis. Cada unidade pode vir de uma siderúrgica diferente.
2. Se não há siderúrgica não virada, compra-se do mercado de ferro (mais barato primeiro). Se
   vazio, ainda é possível comprar por £6/unidade.

### 6.3 Cerveja

1. Cervejaria não virada do próprio jogador — não precisa estar conectada.
2. Cervejaria não virada de um oponente — precisa estar conectada ao local onde a cerveja é
   usada.
3. Barril ao lado de um mercador ao qual o jogador está vendendo (Sell) — concede o bônus do
   mercador (§4.6 / §7.3). Também usável na ação Network (2 links) — mas nesse caso não pode
   vir de mercador, apenas de cervejaria.

Cada unidade de recurso múltiplo pode vir de uma fonte diferente.

## 7. Mercados

### 7.1 Mercado de carvão

14 espaços, preço por espaço (do mais barato ao mais caro): £1, £1, £2, £2, £3, £3, £4, £4,
£5, £5, £6, £6, £7, £7, £8. Setup: 13 cubos (o espaço de £1 mais caro dos dois fica livre —
na prática, o preço da próxima compra é o do espaço não vazio mais barato).

Fórmula: com `n` cubos presentes antes da compra, o preço é `floor((16 - n) / 2)`, com mínimo
£1 e, se `n = 0` (mercado vazio), o preço fixo é £8. Comprar reduz `n` em 1 (nunca abaixo de
0). Vender ao mercado (construção de mina conectada) aumenta `n` (até o máximo de 14),
pagando ao jogador a soma dos preços de cada espaço preenchido, do mais caro para o mais
barato disponível.

### 7.2 Mercado de ferro

10 espaços, preço por espaço: £1, £1, £2, £2, £3, £3, £4, £4, £5, £6. Setup: 8 cubos (os
2 espaços de £1 ficam livres).

Fórmula: `floor((12 - n) / 2)`, mínimo £1, £6 se vazio (`n = 0`). Mesma mecânica de
compra/venda do carvão.

### 7.3 Mercadores

5 locais fixos: **Warrington** (bônus: +£5), **Shrewsbury** (bônus: +VP, 1 slot de
mercador), **Nottingham** (bônus: +VP, 2 slots, só aparece com 4 jogadores), **Gloucester**
(bônus: Develop grátis — remove 1 peça de nível mais baixo de qualquer indústria não
bloqueada, sem custo de ferro), **Oxford** (bônus: avança a renda 2 espaços na trilha).

- Warrington só recebe peças de mercador com 3+ jogadores; Nottingham só com 4 jogadores.
  Nesses casos o local ainda existe no tabuleiro (dá conexão e pontua como mercador nos
  links), mas nenhuma peça é vendida lá.
- Cada slot de mercador recebe, no setup, uma peça (sorteada) que aceita vender Tecelagem,
  Manufatura, Cerâmica, "curinga" (aceita as 3), ou "nenhuma" (em branco). Barril de cerveja
  só é colocado ao lado de slots não-brancos. Barris são repostos (1 por slot não-branco
  vazio) ao final da era do Canal.
- Um local de mercador conta como "conectado" para efeito de Sell se o jogador tem uma
  cadeia de links até ele, e a peça vendida corresponde ao ícone do slot do mercador (ou o
  slot é curinga).

## 8. Trilha de renda

Trilha de 0 a 99. Nível de renda (dinheiro recebido/pago por rodada) como função da posição
`p`:

- `0 ≤ p < 11`: nível = `p - 10` (níveis -10 a 0, 1 espaço por nível).
- `11 ≤ p < 31`: nível = `floor((p - 9) / 2)` (níveis 1 a 10, 2 espaços por nível).
- `31 ≤ p < 61`: nível = `floor((p + 2) / 3)` (níveis 11 a 20, 3 espaços por nível).
- `61 ≤ p ≤ 99`: nível = `floor((p + 23) / 4)` (níveis 21 a 30, 4 espaços por nível — o
  último nível, 30, tem só 3 espaços porque a trilha termina em 99).

A posição inicial é `p = 10` (nível 0). O nível nunca pode passar de 30 (avanços que
ultrapassariam são limitados a 30). Loan sempre pode ser tomado enquanto o nível resultante
for ≥ -10; ao recuar 3 níveis, o marcador vai para o espaço **mais alto** dentro do novo
nível (a função inversa de nível → maior posição correspondente).

## 9. Fim de era e pontuação

Uma era termina após a rodada em que todos os jogadores usam a última carta da mão.

1. **Pontuação de links**: para cada peça de link do jogador, para cada extremidade: se é um
   mercador, +2 VP; senão, soma o VP de cada peça de indústria virada presente naquele local
   (de qualquer dono). Depois de pontuar, **todos** os links (de todos os jogadores) são
   removidos do tabuleiro.
2. **Pontuação de indústrias**: cada peça de indústria virada no tabuleiro pontua o VP do seu
   dono (peças não viradas não pontuam).

### Fim da era do Canal (passos extras)

3. Remove do tabuleiro (não do estoque pessoal) todas as peças de indústria de **nível 1**.
   Peças de nível 2+ permanecem.
4. Repõe 1 barril de cerveja em cada slot de mercador não-branco vazio.
5. Junta as pilhas de descarte de todos os jogadores, embaralha, forma o novo baralho de
   compra da era Ferrovia.
6. Cada jogador compra 8 cartas.
7. Cada jogador recebe de volta as 14 peças de link para sua reserva pessoal.

### Fim de jogo (fim da era Ferrovia)

Depois da pontuação acima, o jogador com mais VP vence. Empate é resolvido por maior renda;
se persistir, por mais dinheiro em caixa; se persistir ainda, é declarado empate.

## 10. Baralho

Duas categorias de cartas no baralho de compra, com o número exato de cópias de cada uma
lido diretamente da carta de referência "Distribuição de Cartas" impressa junto com o
tabuleiro físico (foto do usuário — `docs/ASSUMPTIONS.md` #22), não de uma fórmula uniforme.
Diferente de uma suposição anterior deste projeto (baseada só na cor do estandarte de cada
localidade no tabuleiro, `docs/ASSUMPTIONS.md` #1/#5), **a contagem de cópias varia por
localidade e por indústria individualmente** — não existe uma fórmula única "N cópias para P
jogadores" que sirva para todas.

- **Cartas de local** (`IndustrialLocationDef.deckCopies`, uma tupla `[2p, 3p, 4p]` por
  localidade — `0` significa que a carta não existe no baralho àquela contagem de jogadores):

  | Localidade | 2p | 3p | 4p | | Localidade | 2p | 3p | 4p |
  |---|---|---|---|---|---|---|---|---|
  | Birmingham | 3 | 3 | 3 | | Coalbrookdale | 3 | 3 | 3 |
  | Wolverhampton | 2 | 2 | 2 | | Stoke-on-Trent | 0 | 3 | 3 |
  | Dudley | 2 | 2 | 2 | | Stone | 0 | 2 | 2 |
  | Walsall | 1 | 1 | 1 | | Leek | 0 | 2 | 2 |
  | Coventry | 3 | 3 | 3 | | Stafford | 2 | 2 | 2 |
  | Tamworth | 1 | 1 | 1 | | Uttoxeter | 0 | 1 | 2 |
  | Nuneaton | 1 | 1 | 1 | | Burton-on-Trent | 2 | 2 | 2 |
  | Redditch | 1 | 1 | 1 | | Belper | 0 | 0 | 2 |
  | Kidderminster | 2 | 2 | 2 | | Derby | 0 | 0 | 3 |
  | Worcester | 2 | 2 | 2 | | | | | |
  | Cannock | 2 | 2 | 2 | | | | | |

  A localidade em si continua sempre no tabuleiro e construível (via carta de indústria, a
  exceção "sem peças no tabuleiro" do §4.1, ou carta curinga), mesmo com sua própria carta de
  local ausente do baralho ou com poucas cópias. Note que Uttoxeter é o único caso onde a
  contagem ainda cresce entre 3p e 4p em vez de simplesmente ligar/desligar — 1 cópia com 3
  jogadores, 2 com 4.
- **Cartas de indústria** (`INDUSTRY_CARD_COPIES` em `deck-data.ts`, também `[2p, 3p, 4p]`):

  | Indústria | 2p | 3p | 4p |
  |---|---|---|---|
  | Minas de carvão | 2 | 2 | 3 |
  | Siderúrgicas (ferro) | 4 | 4 | 4 |
  | Fábrica de algodão | 0 | 6 | 8 |
  | Bens manufaturados | 0 | 6 | 8 |
  | Olarias | 2 | 2 | 3 |
  | Cervejaria | 5 | 5 | 5 |

  Algodão e bens manufaturados compartilham a mesma linha na carta de referência física (mesma
  contagem impressa para os dois) — nenhuma carta de indústria de algodão ou manufaturado
  existe no baralho de compra em partidas de 2 jogadores; essas indústrias só ficam
  disponíveis via carta de local (em slots que aceitem o tipo) ou carta curinga.

Fora do baralho de compra, sempre visíveis e viradas para cima: `playerCount` cartas de local
curinga e `playerCount` cartas de indústria curinga (repostas quando jogadas, tiradas quando
usadas via Scout).

No início de cada era, embaralha-se o baralho de compra (na era Canal, um baralho novo; na
era Ferrovia, as pilhas de descarte de todos combinadas) e cada jogador compra 8 cartas +
1 carta de descarte inicial.

## 11. Tabuleiro

O tabuleiro tem 20 localidades industriais, 5 mercadores e 2 "fazendas cervejeiras" (locais
sem nome, com 1 slot de Cervejaria cada, que só podem ser construídas com carta de indústria
Cervejaria ou indústria curinga). A lista completa de localidades, seus slots (quais
indústrias cada slot aceita) e a lista completa de links (arestas do grafo de conectividade)
estão em `src/rules/board-data.ts`, que é a extensão executável desta seção — reconstruída a
partir de uma foto do tabuleiro físico real (`docs/ASSUMPTIONS.md` #1, #5, #15).

Regras estruturais fixas:
- O link entre Kidderminster e Worcester é especial: uma única peça de link ali conecta
  simultaneamente Kidderminster, Worcester e a Fazenda Cervejeira Sul — não é possível (nem
  necessário) colocar uma segunda peça de link para conectar a fazenda.
  A Fazenda Cervejeira Norte é conectada apenas a Cannock, por um link normal.
- Cada link tem uma era associada (`LinkSlotDef.era`: `'canal'`, `'rail'`, ou `'both'`, lida
  do estilo de linha do tabuleiro físico — ver `docs/ASSUMPTIONS.md` #5): um link marcado
  `'canal'` só pode receber uma peça de canal, um marcado `'rail'` só uma peça de ferrovia, e
  `'both'` aceita qualquer uma dependendo da era atual. Todos os links (de qualquer era) são
  removidos do tabuleiro ao final de cada era (pontuados antes de saírem), então não há
  conflito entre dois tipos de peça ocupando a mesma aresta ao mesmo tempo — a era de um slot
  só importa no momento de construir ali, nunca depois.
- Cada mercador externo tem um número mínimo de jogadores para entrar em jogo
  (`MarketDef.minPlayers`, lido do selo numérico ao lado de cada um no tabuleiro físico — ver
  `docs/ASSUMPTIONS.md` #15): Oxford 2, Nottingham 3, Shrewsbury 4, Warrington 5, Gloucester
  sempre (sem selo). O motor só suporta partidas de 2-4 jogadores, então Warrington nunca
  aparece em jogo com o suporte atual.

## 12. Vitória

Ver §9 — fim de jogo.
