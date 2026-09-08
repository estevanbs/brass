# PROMPT — Bot pessoal de Brass: Birmingham (TypeScript, execução autônoma)

> Cole o conteúdo abaixo (a partir de "## Missão") como primeira mensagem no Claude Code, numa pasta vazia.

---

## Missão

Construa, do zero e sem minha intervenção, um bot jogável de **Brass: Birmingham** em TypeScript. O produto final é um programa de terminal onde eu jogo contra o bot, mais uma suíte de testes que prova que o motor está correto.

## Regras de operação (leia com atenção)

1. **Não me faça perguntas.** Não pare para pedir confirmação, escolha de biblioteca, ou esclarecimento de regra. Trabalhe até o fim.
2. Quando uma regra do jogo for ambígua ou você não tiver certeza, **decida você mesmo**, implemente, e registre a decisão em `docs/ASSUMPTIONS.md` no formato: regra, decisão tomada, grau de confiança (alta/média/baixa), impacto se estiver errada. Nunca trave por causa de ambiguidade.
3. **Não invente que algo funciona.** Toda afirmação de "pronto" precisa ter teste passando por trás. Rode os testes de verdade antes de declarar um marco concluído.
4. Trabalhe em marcos (abaixo). Ao final de cada marco, rode `npm run verify`. Se falhar, conserte antes de seguir. Não avance com suíte vermelha.
5. Faça commits pequenos e frequentes, um por unidade lógica de trabalho, com mensagens descritivas.
6. Atualize `docs/PROGRESS.md` ao final de cada marco: o que ficou pronto, o que foi cortado, o que está frágil.

## Stack obrigatória

- TypeScript em modo `strict` (mais `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Node 20+, ESM.
- **Vitest** para testes. **fast-check** para testes baseados em propriedades.
- ESLint + Prettier configurados e rodando no `verify`.
- Zero dependências pesadas. Sem framework de jogo, sem ORM, sem rede. RNG próprio e semeado (`mulberry32` ou similar) — `Math.random` é proibido no código de produção.
- Sem UI gráfica. Terminal apenas.

## Estrutura do repositório

```
src/
  core/        # tipos, estado, RNG, utilitários puros
  rules/       # tabuleiro, cartas, ações, mercados, pontuação, virada de era
  engine/      # aplicação de ações, geração de ações legais, ciclo de partida
  bots/        # random, heuristic, ismcts
  cli/         # partida interativa no terminal
tests/
  unit/
  properties/
  golden/      # partidas gravadas + pontuação esperada
docs/
  ASSUMPTIONS.md
  PROGRESS.md
  RULES.md
```

`npm run verify` = typecheck + lint + testes + cobertura.

## Marcos

### M0 — Fundação
Projeto inicializado, tsconfig strict, Vitest rodando, ESLint/Prettier, script `verify`, RNG semeado com teste de reprodutibilidade, CI local funcionando.

**Pronto quando:** `npm run verify` passa num projeto praticamente vazio.

---

### M1 — Regras em texto antes de código
Escreva `docs/RULES.md`: sua transcrição própria e completa das regras de Brass: Birmingham como você vai implementá-las — tabuleiro, cidades, slots, indústrias e seus níveis, custos, baralho por número de jogadores, as sete ações, mercados de carvão e ferro, consumo de recursos e conectividade, virada de era, pontuação.

Este arquivo é a **fonte única de verdade**. Se depois o código divergir dele, um dos dois está errado e você corrige a divergência explicitamente.

**Pronto quando:** `RULES.md` cobre o jogo inteiro e cada incerteza virou entrada em `ASSUMPTIONS.md`.

---

### M2 — Modelo de dados e tabuleiro
Tipos do estado do jogo. Tabuleiro completo: cidades, slots de indústria com tipos permitidos, links de canal e ferrovia, cidades comerciais e seus barris. Baralho completo por contagem de jogadores. Estado serializável para JSON e com hash estável.

**Testes exigidos:**
- Contagem de cidades, slots e links bate com o tabuleiro real.
- Serializar → desserializar → serializar é idempotente.
- Estados iguais produzem hashes iguais; qualquer mutação muda o hash.

---

### M3 — Ações e motor
As sete ações: construir, vender, desenvolver, construir conexão, empréstimo, explorar, passar. Mercados de carvão e ferro com preço dinâmico. Consumo de recursos com busca em grafo (ferro é global, carvão exige conectividade, cerveja segue suas próprias regras). Virada de era. Pontuação de era e final.

`applyAction(state, action) -> state` **puro**: nunca muta a entrada.

**Testes exigidos:**
- Um teste por ação, incluindo caminhos de erro (recurso insuficiente, slot ocupado, sem conexão).
- Mercado: compra esvaziando, venda enchendo, preço no limite superior e inferior.
- Empréstimo com renda baixa e negativa.
- Virada de era: remoção de peças nível 1, descarte de mãos, novo baralho.
- Pontuação: casos montados à mão com resultado calculado manualmente no comentário do teste.
- **Propriedade (fast-check):** para qualquer estado alcançável e qualquer ação legal, `applyAction` produz estado válido — dinheiro nunca negativo, recursos nunca negativos, invariantes de tabuleiro preservadas.

---

### M4 — Geração de ações legais
`legalActions(state) -> Action[]`, canônica e **desduplicada**. Este é o ponto mais delicado do projeto. Uma ação inclui a origem de cada unidade de carvão, ferro e cerveja consumida; escolhas equivalentes devem colapsar numa única ação. Sem isso o espaço explode e o MCTS não funciona.

**Testes exigidos:**
- Nenhuma ação duplicada em nenhum estado gerado.
- Toda ação retornada é de fato aplicável sem erro.
- **Propriedade:** nenhuma ação legal construída à mão em cenários montados fica de fora da lista.
- Benchmark registrado: tamanho médio e máximo da lista ao longo de uma partida.

---

### M5 — Bot aleatório e harness
Bot que escolhe uniformemente entre ações legais. Harness que roda N partidas em lote com semente.

**Pronto quando:** 10.000 partidas rodam sem exceção, sem estado inválido e sem loop infinito. Registre em `PROGRESS.md` a distribuição de pontuações e a duração média.

---

### M6 — Bot heurístico
Avaliação posicional simples: prioriza ferro cedo, desenvolve antes de construir nível baixo, evita deixar peça sem virar, gerencia renda e ordem de turno.

**Pronto quando:** vence o bot aleatório em pelo menos 80% de 1.000 partidas, com o resultado registrado num teste que falha se a taxa cair.

---

### M7 — ISMCTS
Information Set MCTS com determinização: sorteia mãos plausíveis dos oponentes a partir das cartas não vistas, roda MCTS em cada mundo, agrega as visitas. Rollouts guiados pela heurística do M6, não puramente aleatórios. Orçamento configurável por tempo e por número de simulações.

**Pronto quando:** vence o heurístico em pelo menos 65% de 300 partidas com orçamento de 1 segundo por jogada. Teste registrando o resultado.

---

### M8 — CLI jogável
Partida no terminal: tabuleiro em texto legível, mão do jogador, lista numerada de ações legais, jogada por número. Ao final de cada turno meu, mostre o que o bot fez e por quê (jogada escolhida e VP estimado). Salvar e carregar partida. Replay a partir do log de ações.

**Pronto quando:** consigo jogar uma partida completa contra o ISMCTS sem crash, e o replay reproduz a partida byte a byte.

---

## Exigências de teste (valem para todos os marcos)

- Cobertura mínima: **90% de linhas em `src/rules` e `src/engine`**, imposta pelo `verify`.
- Testes golden: pelo menos 5 partidas completas gravadas como fixture, com pontuação final esperada. Qualquer mudança de comportamento quebra esses testes de propósito.
- Nenhum teste depende de tempo real, aleatoriedade não semeada, rede ou ordem de execução.
- Testes de propriedade em: validade de estado, desduplicação de ações, e invariância de pontuação sob reordenação de jogadas independentes.

## Ordem de trabalho

Faça M0 até M8 em sequência. Se ficar sem tempo ou contexto, **corte escopo do fim, nunca de testes**: um M6 bem testado vale mais que um M7 quebrado. Registre em `PROGRESS.md` exatamente onde parou e qual é o próximo passo concreto.

## Entrega final

Ao terminar, escreva `README.md` com: como instalar, como rodar os testes, como jogar, arquitetura em cinco parágrafos, e uma seção honesta de limitações conhecidas.