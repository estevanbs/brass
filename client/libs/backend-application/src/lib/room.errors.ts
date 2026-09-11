export class RoomNotFoundError extends Error {
  constructor() {
    super('sala não encontrada');
    this.name = 'RoomNotFoundError';
  }
}

export class RoomFullError extends Error {
  constructor() {
    super('sala cheia');
    this.name = 'RoomFullError';
  }
}

export class RoomAlreadyStartedError extends Error {
  constructor() {
    super('a partida já começou');
    this.name = 'RoomAlreadyStartedError';
  }
}

export class InvalidRoomTokenError extends Error {
  constructor() {
    super('token inválido');
    this.name = 'InvalidRoomTokenError';
  }
}

export class NotRoomHostError extends Error {
  constructor() {
    super('só o anfitrião pode iniciar a partida');
    this.name = 'NotRoomHostError';
  }
}
