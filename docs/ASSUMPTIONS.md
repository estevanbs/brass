# Assumptions

Registro de decisões tomadas diante de ambiguidade nas regras de Brass: Birmingham
ou no processo de construção. Formato: **Regra**, **Decisão**, **Confiança**, **Impacto se errado**.

## Por que os números exatos não são uma cópia literal do jogo físico

Antes das entradas: o fluxo de turno, as 7 ações, as fórmulas de mercado (carvão/ferro), a
trilha de renda e as regras de conexão/consumo de recursos em `RULES.md` foram verificados
contra o resumo de regras oficial da Roxley (via orderofgamers.com, que redistribui o
rulebook oficial com permissão) e batem exatamente, inclusive nos casos-limite ("mercado de
ferro vazio custa £6", "mercado de carvão vazio custa £8", limite de renda no nível 30). Essa
parte tem confiança **alta**.

Já a topologia exata do tabuleiro físico (quais das ~25 localidades reais se conectam a
quais, o layout exato dos slots de cada localidade) e as tabelas numéricas exatas impressas
em cada uma das ~48 peças de indústria (custo, VP, renda, produção) **não foram
reconstruídas a partir dos componentes físicos reais** — não havia uma fonte confiável e
completa para extrair esses números com precisão dentro do processo autônomo deste projeto
(o repositório de referência que mais se aproximou de ter esses dados os excluía
deliberadamente do controle de versão, por serem os componentes proprietários do jogo). Em
vez de arriscar uma reconstrução errada e inconsistente vinda de fontes fragmentadas, optei
por **desenhar minha própria tabela de tabuleiro e de indústrias**, seguindo fielmente a
estrutura e as proporções do jogo original (mesmo número de indústrias e níveis, mesma
forma geral de custo crescente e retorno decrescente, mesmos 5 mercadores com os mesmos
bônus e as mesmas restrições por número de jogadores, mesma regra de peça bloqueada em
alguma indústria). Isso mantém o motor jogável, testável e balanceado, mas os valores
numéricos específicos de `board-data.ts` / `industry-data.ts` / `deck-data.ts` são uma
criação própria, não uma transcrição do produto da Roxley.

## Entradas

1. **Regra**: Topologia exata do tabuleiro (quais localidades reais se conectam a quais).
   **Decisão**: Desenhei um grafo próprio com 18 localidades industriais (nomes reais de
   cidades da região de Birmingham/Black Country, que são fatos geográficos, não
   propriedade intelectual do jogo) + 5 mercadores (nomes citados textualmente nas regras
   oficiais: Warrington, Shrewsbury, Nottingham, Gloucester, Oxford) + 2 fazendas
   cervejeiras, com 43 links, mantendo grau de conectividade e ciclos suficientes para
   decisões de rota interessantes. Ver `RULES.md` §11.
   **Confiança**: média (a estrutura qualitativa segue o jogo real; a topologia exata não).
   **Impacto se errado**: nenhum na correção do motor (o grafo é internamente consistente);
   afeta apenas o quão "fiel" a experiência de jogo é ao produto original.

2. **Regra**: Custo, VP, renda e produção de cada peça de indústria em cada nível.
   **Decisão**: Tabela própria em `RULES.md` §5.3, com custo crescente por nível e retorno
   (VP/renda) também crescente, mas com eficiência marginal decrescente — segue o "feel" de
   jogos econômicos de desenvolvimento tecnológico como o original.
   **Confiança**: média. **Impacto se errado**: afeta o equilíbrio entre bots (M6/M7), não a
   corretude do motor — os testes de propriedade continuam validando invariantes
   independentemente dos valores exatos.

3. **Regra**: Quantas cópias de cada nível de indústria cada jogador possui.
   **Decisão**: 3/2/2/1 cópias dos níveis 1/2/3/4 para a maioria das indústrias (8 peças),
   exceto Cerâmica (1/2/2/2 = 7 peças, com o nível 1 bloqueado). Ver `RULES.md` §5.4.
   **Confiança**: média. **Impacto se errado**: só de equilíbrio, não de corretude.

4. **Regra**: Quais peças de indústria são "bloqueadas" (só removíveis via Develop, nunca
   construídas via Build) — o rulebook menciona esse ícone genericamente nas seções de Build
   de ambas as eras, mas só documenta o exemplo concreto para Cerâmica.
   **Decisão**: Apliquei o bloqueio apenas à Cerâmica nível 1, por ser o único caso
   concretamente descrito no texto das regras.
   **Confiança**: média-alta para "cerâmica nível 1 é bloqueada" (citado explicitamente no
   rulebook), baixa para "é o único caso". **Impacto se errado**: se outras indústrias
   também deveriam ter peças bloqueadas no jogo real, o motor seria mais permissivo que o
   original — não quebra nenhuma invariante, só simplifica a árvore de decisão.

5. **Regra**: Se as linhas de canal e de ferrovia usam a mesma topologia de grafo ou
   conjuntos de arestas diferentes (no jogo físico, os dois lados do tabuleiro mostram
   layouts de linha diferentes).
   **Decisão**: Uso o mesmo grafo para as duas eras. Como todos os links são removidos e
   pontuados ao final de cada era antes da próxima começar, não há conflito de peças
   ocupando a mesma aresta simultaneamente entre eras.
   **Confiança**: média. **Impacto se errado**: simplifica a diferença estratégica entre
   Canal e Ferrovia (no jogo real, a expansão ferroviária abre novas rotas geográficas); não
   afeta corretude.

6. **Regra**: Composição exata do baralho de compra (quantas cópias de cada carta de local e
   de indústria, por número de jogadores).
   **Decisão**: 1/2/3 cópias de cada uma das 18 cartas de local (2/3/4 jogadores) e 2/3/4
   cópias de cada uma das 6 cartas de indústria. Ver `RULES.md` §10.
   **Confiança**: média. **Impacto se errado**: afeta o ritmo de esgotamento do baralho e
   portanto a duração da era; os testes fixam a contagem esperada a partir desta tabela, então
   nenhuma inconsistência interna resulta disso.

7. **Regra**: Mecânica exata de atribuição de peças de mercador (quais ícones de indústria
   cada slot de mercador aceita) no setup.
   **Decisão**: bag aleatória de ícones (Tecelagem, Manufatura, Cerâmica, curinga, em branco)
   dimensionada pelo número de slots disponíveis para o número de jogadores, sorteada com o
   RNG semeado da partida. Ver `RULES.md` §7.3.
   **Confiança**: média. **Impacto se errado**: nenhum na corretude — é só o conteúdo
   aleatório do setup.

8. **Regra** (M3): "Escolha do carvão mais próximo" e "qualquer siderúrgica" (RULES.md §6.1,
   §6.2) descrevem de onde o recurso *deve* vir, não uma preferência do jogador.
   **Decisão**: `applyAction` valida que a fonte de carvão informada é de fato a mina
   conectada não virada mais próxima (ou o mercado, só se nenhuma existir e houver conexão a
   um mercador); para ferro, valida que é uma siderúrgica não virada existente (ou o mercado,
   só se nenhuma existir). Uma ação com fonte errada é rejeitada com erro, não corrigida
   silenciosamente.
   **Confiança**: alta (é a leitura literal do texto oficial). **Impacto se errado**: bots que
   não souberem calcular a fonte correta teriam ações rejeitadas com mais frequência do que
   deveriam — mitigado pois `legalActions` (M4) vai gerar a ação já com a fonte certa.

9. **Regra** (M3): a peça de indústria tem um único valor de VP impresso, usado tanto na
   pontuação de fim de era (para o dono) quanto na pontuação de links (para quem é dono do
   *link*, que pode ser outro jogador) — ver `RULES.md` §5.2.
   **Decisão**: modelo com um campo `victoryPoints` só, reaproveitado nos dois contextos, em
   vez de dois campos separados (valor de posse vs. valor de link) como algumas
   implementações de fãs fazem por precaução.
   **Confiança**: média. **Impacto se errado**: mudaria o equilíbrio da pontuação de rotas
   (`src/engine/scoring.ts`), não a estrutura do código — trivial de separar em dois campos
   depois, caso `RULES.md` §5.2 seja revisado.

10. **Regra** (M3): política determinística de "vender peças para cobrir déficit de renda"
    (RULES.md §3b) quando o jogador não tem dinheiro suficiente — a regra oficial deixa a
    escolha de qual peça remover a critério do jogador.
    **Decisão**: `engine/cycle.ts` remove peças na ordem crescente de custo de construção
    (mais baratas primeiro) até cobrir o déficit, em vez de expor essa escolha como uma
    decisão externa. Isso é adequado para os bots (M5+), que precisam de uma política
    determinística de qualquer forma; um modo "humano" no CLI (M8) pode reabrir essa escolha
    mais tarde se necessário.
    **Confiança**: média. **Impacto se errado**: um jogador humano perderia a escolha de
    *qual* peça sacrificar durante o jogo interativo — não afeta a corretude do motor nem os
    bots, que precisam de uma regra fixa de qualquer forma.

11. **Regra** (M4): o que conta como "escolhas equivalentes que devem colapsar numa única
    ação" versus escolhas genuinamente distintas, ao gerar `legalActions`.
    **Decisão**: colapso apenas quando as opções são estritamente intercambiáveis:
    - Cartas duplicadas (2+ cópias idênticas na mão) colapsam em 1 (`engine/cards.ts`).
    - Empates de distância na mina de carvão mais próxima colapsam em 1 representante
      canônico (menor `locationId`/`slotIndex`) — a regra já exige "a mais próxima", então
      empates são simetria pura, não uma decisão estratégica real.
    Mantive como escolhas **distintas** (não colapsadas), mesmo custando mais ramificações:
    qual siderúrgica usar (afeta a renda de quem quer que a possua), qual cervejaria usar,
    e qual combinação de cartas descartar no Scout (afeta o descarte público visível).
    Para o caso combinatoriamente mais perigoso — a ação de Rede dupla (2 trilhos + cerveja +
    2 carvões) — restrinjo os pares candidatos a links alcançáveis a partir da rede atual do
    jogador (em vez de todos os pares entre as ~43 linhas do tabuleiro), o que sub-representa
    ligeiramente o espaço real (perde o caso raro em que o segundo link só fica alcançável
    *depois* do primeiro ser colocado). Do mesmo modo, a ação de Vender com mais de 4 peças
    vendáveis simultâneas usa apenas subconjuntos de 1 peça e "vender tudo" (não o conjunto de
    partes completo), e com mais de 2 peças no mesmo Sell usa uma única fonte de cerveja
    representativa por peça em vez do produto cartesiano completo de fontes.
    **Confiança**: média. **Impacto se errado**: em posições de tabuleiro muito desenvolvidas
    e raras, `legalActions` pode omitir uma ação legal de Rede-dupla ou uma combinação
    específica de venda — não gera nenhuma ação ilegal (toda ação retornada é sempre
    verificada de fato aplicando-a com o código real da ação antes de ser devolvida). Fica
    registrado como possível refinamento futuro se os bots (M6/M7) mostrarem lacunas
    perceptíveis de desempenho por causa disso.

12. **Regra** (M4): o que acontece quando é a vez de um jogador, mas a mão dele já está vazia
    (toda ação exige descartar ao menos 1 carta) — o texto oficial só diz "sua mão vai
    diminuir a cada rodada até você não ter mais cartas", sem detalhar o turno em que isso
    acontece no meio da era.
    **Decisão**: `engine/cycle.ts` detecta essa situação e pula o turno inteiro do jogador
    (ou as ações restantes, se a mão esvaziar no meio do turno) sem nenhum efeito, em vez de
    travar por falta de ação legal. Isso expôs — e corrigiu — uma consequência prática da
    decisão #6 (minha composição própria do baralho): diferente do jogo real, cujas
    quantidades de carta são calibradas para todos os jogadores esgotarem a mão exatamente na
    mesma rodada final, minha composição às vezes deixa um jogador sem cartas um pouco antes
    dos outros.
    **Confiança**: alta para a correção em si (skip é o único jeito sensato de continuar o
    jogo); média para a composição do baralho que causa a assimetria.
    **Impacto se errado**: nenhum jogador trava mais o motor; o único efeito é que, em raras
    partidas, um jogador pode ficar 1-2 turnos "de fora" perto do fim de uma era.

13. **Regra** (M6): pesos da função de avaliação do bot heurístico (`bots/heuristic.ts`) —
    o plano pede "avaliação posicional simples" sem especificar números.
    **Decisão**: termo dominante é a pontuação projetada se a era acabasse agora (reaproveita
    `scoring.ts#scoreEra` de forma não destrutiva — isso já cobre "evitar peça sem virar",
    pois só peças viradas contam); dinheiro e nível de renda entram como desempate leve;
    bônus fixo por ter uma siderúrgica não virada nas primeiras rodadas da era Canal
    ("prioriza ferro cedo"); bônus pequeno por peça já removida do estoque inicial (via Build
    ou Develop), incentivando progressão tecnológica. Pesos escolhidos por tentativa direta
    (ver `heuristic-vs-random.test.ts`: 998/1000 vitórias, bem acima do limite de 80%), não
    por busca sistemática de hiperparâmetros.
    **Confiança**: média — os pesos claramente funcionam bem o suficiente para bater o
    aleatório folgadamente, mas não foram otimizados além disso. **Impacto se errado**: só
    afeta a força do bot heurístico, não a corretude; o teste do M6 pega qualquer regressão
    que derrube a taxa de vitória abaixo de 80%.

14. **Regra** (M7): forma exata de "Information Set MCTS com determinização" — o texto
    original do algoritmo (Cowling/Powley/Whitehouse 2012) mantém **uma única árvore**
    compartilhada entre determinizações, com checagem de compatibilidade de ações por nó.
    **Decisão**: implementei a variante mais simples que o próprio `docs/PLANO.md` descreve
    literalmente ("roda MCTS em cada mundo, agrega as visitas"): a cada mundo sorteado
    (`engine/determinize.ts` redistribui aleatoriamente as cartas que não são da própria mão
    nem de pilhas de descarte visíveis, preservando tamanhos de mão/baralho), constrói-se uma
    árvore de busca **nova e independente**, roda-se um orçamento fixo de simulações nela, e
    os visits dos filhos da raiz são somados entre mundos — a ação mais visitada no total
    vence. Isso é mais simples de implementar corretamente, ao custo de não compartilhar
    conhecimento entre mundos durante a própria busca (só na agregação final).
    - **Achado real durante a implementação**: com o fator de ramificação típico de Brass
      (100-600+ ações legais por turno, `docs/PROGRESS.md` M4), um orçamento de simulações
      modesto (dezenas a poucas centenas) não alcança nem para experimentar cada ação da raiz
      uma vez — a escolha final virava, na prática, quase aleatória. A correção foi restringir
      as ações da raiz às `rootTopK` (padrão 8) melhores segundo uma passada gulosa de 1 ply
      (a mesma lógica do bot heurístico do M6, calculada uma única vez por jogada, não por
      mundo, já que não depende das mãos dos oponentes), e só então rodar o ISMCTS entre essas
      candidatas. Isso fez a taxa de vitória saltar de 0% para ~65-67% em amostras pequenas.
    - Os rollouts usam uma política barata ponderada por tipo de ação (`bots/rollout-policy.ts`,
      que nunca simula uma ação para pontuá-la) em vez do heurístico completo do M6 (caro
      demais para chamar centenas de vezes por jogada), com profundidade curta (`rolloutDepth`,
      padrão 4) e depois avalia o estado resultante com a mesma `evaluate()` do M6 — ou seja, a
      "orientação heurística" pedida pelo plano entra tanto no viés da política de rollout
      quanto na função de avaliação da folha, não numa simulação completa até o fim do jogo
      (que seria caro demais dentro do orçamento de 1s/jogada).
    **Confiança**: média-baixa — a validação completa de 300 partidas com orçamento de 1s por
    jogada não coube no tempo desta sessão (uma única partida ISMCTS×heurístico leva
    ~20-30s; 300 partidas seriam horas). Rodei uma amostra reduzida (ver `docs/PROGRESS.md`
    M7) que ficou acima de 65%, e deixei `scripts/run-ismcts-validation.ts` pronto para rodar
    a validação completa de 300 partidas separadamente. **Impacto se errado**: o bot ISMCTS
    pode não bater o heurístico em 65% na validação completa de 300 partidas — não afeta a
    corretude do motor (todas as ações que o ISMCTS escolhe já passam pela mesma validação
    real de `applyAction` que qualquer outra), só a força do bot.
