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
