import { describe, expect, it } from 'vitest';
import { InMemoryGameRepository } from '../../src/lib/game.model.js';
import { GameService } from '../../src/lib/game.service.js';
import { InvalidRoomTokenError, NotRoomHostError, RoomAlreadyStartedError, RoomFullError, RoomNotFoundError } from '../../src/lib/room.errors.js';
import { InMemoryRoomRepository } from '../../src/lib/room.model.js';
import { RoomService } from '../../src/lib/room.service.js';

function makeService(): { rooms: RoomService; games: GameService } {
  const games = new GameService(new InMemoryGameRepository());
  const rooms = new RoomService(new InMemoryRoomRepository(), games);
  return { rooms, games };
}

describe('RoomService', () => {
  describe('createRoom', () => {
    it('creates a lobby room with the host as its only seat', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);

      expect(created.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(created.playerId).toBe('Ana');
      expect(created.token).toBeTruthy();

      const view = rooms.roomState(created.code);
      expect(view.status).toBe('lobby');
      expect(view.maxPlayers).toBe(3);
      expect(view.hostId).toBe('Ana');
      expect(view.seats).toEqual([{ playerId: 'Ana', isBot: false }]);
    });

    it('clamps maxPlayers to the 2-4 range the engine supports', () => {
      const { rooms } = makeService();
      const tooFew = rooms.createRoom('Ana', 1);
      expect(rooms.roomState(tooFew.code).maxPlayers).toBe(2);
      const tooMany = rooms.createRoom('Beto', 10);
      expect(rooms.roomState(tooMany.code).maxPlayers).toBe(4);
    });
  });

  describe('joinRoom', () => {
    it('adds a new seat and returns a fresh token for it', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);
      const joined = rooms.joinRoom(created.code, 'Beto');

      expect(joined.playerId).toBe('Beto');
      expect(joined.token).toBeTruthy();
      expect(joined.token).not.toBe(created.token);

      const view = rooms.roomState(created.code);
      expect(view.seats.map((s) => s.playerId)).toEqual(['Ana', 'Beto']);
    });

    it('dedupes a display name that collides with a seat already in the room', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);
      const joined = rooms.joinRoom(created.code, 'Ana');
      expect(joined.playerId).toBe('Ana (2)');
    });

    it('throws RoomNotFoundError for an unknown code', () => {
      const { rooms } = makeService();
      expect(() => rooms.joinRoom('NOPE00', 'Ana')).toThrow(RoomNotFoundError);
    });

    it('throws RoomFullError once the room reaches maxPlayers', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 2);
      rooms.joinRoom(created.code, 'Beto');
      expect(() => rooms.joinRoom(created.code, 'Carla')).toThrow(RoomFullError);
    });

    it('throws RoomAlreadyStartedError once the host has started the room', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);
      rooms.startRoom(created.code, created.token);
      expect(() => rooms.joinRoom(created.code, 'Beto')).toThrow(RoomAlreadyStartedError);
    });
  });

  describe('reconnect', () => {
    it('returns the playerId for a valid seat token, host or guest', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);
      const joined = rooms.joinRoom(created.code, 'Beto');

      expect(rooms.reconnect(created.code, created.token).playerId).toBe('Ana');
      expect(rooms.reconnect(created.code, joined.token).playerId).toBe('Beto');
    });

    it('throws InvalidRoomTokenError for a token that does not belong to the room', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);
      expect(() => rooms.reconnect(created.code, 'not-a-real-token')).toThrow(InvalidRoomTokenError);
    });

    it('throws RoomNotFoundError for an unknown code', () => {
      const { rooms } = makeService();
      expect(() => rooms.reconnect('NOPE00', 'whatever')).toThrow(RoomNotFoundError);
    });

    it('still works to reconnect a seat after the room has started', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 2);
      rooms.startRoom(created.code, created.token);
      expect(rooms.reconnect(created.code, created.token).playerId).toBe('Ana');
    });
  });

  describe('startRoom', () => {
    it('throws NotRoomHostError when called with a non-host token', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);
      const joined = rooms.joinRoom(created.code, 'Beto');
      expect(() => rooms.startRoom(created.code, joined.token)).toThrow(NotRoomHostError);
    });

    it('throws NotRoomHostError for a garbage token', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 3);
      expect(() => rooms.startRoom(created.code, 'garbage')).toThrow(NotRoomHostError);
    });

    it('throws RoomNotFoundError for an unknown code', () => {
      const { rooms } = makeService();
      expect(() => rooms.startRoom('NOPE00', 'whatever')).toThrow(RoomNotFoundError);
    });

    it('throws RoomAlreadyStartedError when called twice', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 2);
      rooms.startRoom(created.code, created.token);
      expect(() => rooms.startRoom(created.code, created.token)).toThrow(RoomAlreadyStartedError);
    });

    it('fills every empty seat with a bot and starts a real GameService game', () => {
      const { rooms, games } = makeService();
      const created = rooms.createRoom('Ana', 3);
      rooms.joinRoom(created.code, 'Beto');

      const { gameId } = rooms.startRoom(created.code, created.token);
      expect(gameId).toBeTruthy();

      const view = rooms.roomState(created.code);
      expect(view.status).toBe('started');
      expect(view.gameId).toBe(gameId);
      expect(view.seats).toEqual([
        { playerId: 'Ana', isBot: false },
        { playerId: 'Beto', isBot: false },
        { playerId: 'bot1', isBot: true },
      ]);

      // The room handed a real seat list to GameService — every seat can ask for its view.
      const anaView = games.getView(gameId, 'Ana') as { humanId: string };
      expect(anaView.humanId).toBe('Ana');
    });

    it('starting with a fully-empty extra seats still dedupes a bot name against a human named "bot1"', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('bot1', 2);
      rooms.startRoom(created.code, created.token);

      const view = rooms.roomState(created.code);
      expect(view.seats.map((s) => s.playerId)).toEqual(['bot1', 'bot1 (2)']);
    });

    it('starting an already-full room adds no bots at all', () => {
      const { rooms } = makeService();
      const created = rooms.createRoom('Ana', 2);
      rooms.joinRoom(created.code, 'Beto');
      rooms.startRoom(created.code, created.token);

      const view = rooms.roomState(created.code);
      expect(view.seats.every((s) => !s.isBot)).toBe(true);
    });
  });

  describe('roomState', () => {
    it('throws RoomNotFoundError for an unknown code', () => {
      const { rooms } = makeService();
      expect(() => rooms.roomState('NOPE00')).toThrow(RoomNotFoundError);
    });
  });
});
