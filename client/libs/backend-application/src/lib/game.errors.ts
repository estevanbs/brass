export class GameNotFoundError extends Error {
  constructor() {
    super('jogo não encontrado');
    this.name = 'GameNotFoundError';
  }
}

export class GameAlreadyOverError extends Error {
  constructor() {
    super('a partida já terminou');
    this.name = 'GameAlreadyOverError';
  }
}

export class InvalidActionIndexError extends Error {
  constructor() {
    super('índice de ação inválido');
    this.name = 'InvalidActionIndexError';
  }
}

/** `legalActions(state, playerId)` reflects what's in `playerId`'s hand regardless of whose
 * turn it actually is (see `GameService#view`'s own comment on the same gap) — so a
 * wrong-turn submission does get rejected, just as a raw `applyAction` "it is not X's turn"
 * error deep inside `submitHumanAction`, not this purpose-built one, *unless* the caller (a
 * multi-human room) checks first and throws this instead for a clearer message. */
export class NotYourTurnError extends Error {
  constructor() {
    super('não é a sua vez');
    this.name = 'NotYourTurnError';
  }
}
