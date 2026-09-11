import { ConnectedSocket, MessageBody, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type WebSocket from 'ws';
import { GameService, RoomService, type MoveEvent } from '@brass/backend-application';
import { CreateRoomMessageDto } from './dto/create-room-message.dto.js';
import { JoinRoomMessageDto } from './dto/join-room-message.dto.js';
import { ReconnectRoomMessageDto } from './dto/reconnect-room-message.dto.js';
import { StartRoomMessageDto } from './dto/start-room-message.dto.js';
import { SubmitRoomActionMessageDto } from './dto/submit-room-action-message.dto.js';
import { roomStateEvent, type RoomServerToClientEvent } from './ws-events.js';

/**
 * The online counterpart to the old `GamesGateway`: unlike that one-human-vs-bots gateway,
 * a room can have several real sockets connected at once, so every reply here is either
 * targeted at the one client that asked (`roomJoined`, lobby `error`s) or explicitly fanned
 * out to every socket the gateway has registered for that room code — each with its *own*
 * `GameService#getView`-redacted view, never a payload shared across players. No business
 * rule lives here: every "is this allowed" question is `RoomService`'s (who may join, who may
 * start) or `GameService`'s (whose turn is it, is this move legal) — this class only routes
 * messages to the right room's sockets and turns whatever comes back into wire events.
 *
 * `bindMessageHandler` (`@nestjs/platform-ws`'s `WsAdapter`) silently swallows a synchronous
 * throw from inside a handler, so every handler's body runs through `run`, which catches and
 * replies with a single `error` event instead of ever letting an exception escape un-sent.
 */
@WebSocketGateway({ path: '/ws/rooms' })
export class RoomsGateway implements OnGatewayDisconnect {
  /** code -> (playerId -> the one live socket currently registered for that seat). */
  private readonly roomSockets = new Map<string, Map<string, WebSocket>>();
  /** The reverse lookup, so a disconnect (which only hands us the socket) can find what to
   * remove without scanning every room. */
  private readonly socketBindings = new Map<WebSocket, { code: string; playerId: string }>();

  constructor(
    private readonly roomService: RoomService,
    private readonly gameService: GameService,
  ) {}

  handleDisconnect(client: WebSocket): void {
    const binding = this.socketBindings.get(client);
    if (binding === undefined) return;
    this.socketBindings.delete(client);
    const sockets = this.roomSockets.get(binding.code);
    // Only remove the mapping if it still points at *this* socket — a reconnect may already
    // have replaced it with a newer one before the old socket's disconnect event arrives.
    if (sockets?.get(binding.playerId) === client) sockets.delete(binding.playerId);
  }

  @SubscribeMessage('createRoom')
  createRoom(@MessageBody() body: CreateRoomMessageDto, @ConnectedSocket() client: WebSocket): void {
    this.run(client, () => {
      const created = this.roomService.createRoom(body.hostName, body.maxPlayers ?? 4);
      this.register(created.code, created.playerId, client);
      this.send(client, { type: 'roomJoined', code: created.code, token: created.token, playerId: created.playerId });
      this.broadcastRoomState(created.code);
    });
  }

  @SubscribeMessage('joinRoom')
  joinRoom(@MessageBody() body: JoinRoomMessageDto, @ConnectedSocket() client: WebSocket): void {
    this.run(client, () => {
      const joined = this.roomService.joinRoom(body.code, body.name);
      this.register(body.code, joined.playerId, client);
      this.send(client, { type: 'roomJoined', code: body.code, token: joined.token, playerId: joined.playerId });
      this.broadcastRoomState(body.code);
    });
  }

  @SubscribeMessage('reconnectRoom')
  reconnectRoom(@MessageBody() body: ReconnectRoomMessageDto, @ConnectedSocket() client: WebSocket): void {
    this.run(client, () => {
      const { playerId } = this.roomService.reconnect(body.code, body.token);
      this.register(body.code, playerId, client);
      this.send(client, { type: 'roomJoined', code: body.code, token: body.token, playerId });

      const room = this.roomService.roomState(body.code);
      if (room.status === 'started' && room.gameId !== undefined) {
        this.send(client, { type: 'roomStarted', gameId: room.gameId, view: this.gameService.getView(room.gameId, playerId) });
      } else {
        this.send(client, roomStateEvent(room));
      }
    });
  }

  @SubscribeMessage('startRoom')
  startRoom(@MessageBody() body: StartRoomMessageDto, @ConnectedSocket() client: WebSocket): void {
    this.run(client, () => {
      const { gameId } = this.roomService.startRoom(body.code, body.token);
      const sockets = this.roomSockets.get(body.code);
      if (sockets === undefined) return;
      for (const [playerId, socket] of sockets) {
        this.send(socket, { type: 'roomStarted', gameId, view: this.gameService.getView(gameId, playerId) });
      }
    });
  }

  @SubscribeMessage('submitAction')
  submitAction(@MessageBody() body: SubmitRoomActionMessageDto, @ConnectedSocket() client: WebSocket): void {
    this.run(client, () => {
      const { playerId } = this.roomService.reconnect(body.code, body.token);
      const room = this.roomService.roomState(body.code);
      if (room.status !== 'started' || room.gameId === undefined) throw new Error('a sala ainda não começou');
      const gameId = room.gameId;

      this.gameService.submitHumanAction(gameId, playerId, body.index, (event) => this.broadcastMove(body.code, gameId, event));
      this.broadcastSequenceComplete(body.code);
    });
  }

  private broadcastMove(code: string, gameId: string, event: MoveEvent): void {
    const sockets = this.roomSockets.get(code);
    if (sockets === undefined) return;
    for (const [viewerId, socket] of sockets) {
      this.send(socket, {
        type: 'moveApplied',
        playerId: event.playerId,
        actionLabel: event.actionLabel,
        targets: event.targets,
        view: this.gameService.getView(gameId, viewerId),
      });
    }
  }

  private broadcastSequenceComplete(code: string): void {
    const sockets = this.roomSockets.get(code);
    if (sockets === undefined) return;
    for (const socket of sockets.values()) this.send(socket, { type: 'sequenceComplete' });
  }

  private broadcastRoomState(code: string): void {
    const sockets = this.roomSockets.get(code);
    if (sockets === undefined) return;
    const event = roomStateEvent(this.roomService.roomState(code));
    for (const socket of sockets.values()) this.send(socket, event);
  }

  private register(code: string, playerId: string, client: WebSocket): void {
    let sockets = this.roomSockets.get(code);
    if (sockets === undefined) {
      sockets = new Map();
      this.roomSockets.set(code, sockets);
    }
    sockets.set(playerId, client);
    this.socketBindings.set(client, { code, playerId });
  }

  private send(client: WebSocket, event: RoomServerToClientEvent): void {
    client.send(JSON.stringify(event));
  }

  private run(client: WebSocket, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      this.send(client, { type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }
}
