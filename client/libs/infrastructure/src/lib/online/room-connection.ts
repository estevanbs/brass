import { Observable, Subject } from 'rxjs';
import type { RoomServerToClientEvent } from '@brass/domain';

export type WebSocketFactory = () => WebSocket;

function defaultWebSocketFactory(): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return new WebSocket(`${protocol}//${window.location.host}/ws/rooms`);
}

/**
 * One persistent WebSocket to `/ws/rooms`, shared across an online session's entire lifetime —
 * from the lobby (`createRoom`/`joinRoom`/`reconnectRoom`/`startRoom`) through actual gameplay
 * (`RoomGameGateway`'s `submitAction`/`watchMoves`, built on this same connection). `events$`
 * is a multicast `Subject`, not a fresh `Observable` per call, specifically so several
 * independent subscribers (the lobby's own state, a live in-game move feed, a single
 * in-flight `submitAction` call) can all listen to the same incoming messages at once —
 * opening a fresh socket per call (as the offline-server adapter this replaced once did)
 * wouldn't work here, since a room's moves can arrive with no call of this client's own in
 * flight to correlate them to.
 */
export class RoomConnection {
  private readonly ws: WebSocket;
  private readonly incoming = new Subject<RoomServerToClientEvent>();

  readonly events$: Observable<RoomServerToClientEvent> = this.incoming.asObservable();

  constructor(wsFactory: WebSocketFactory = defaultWebSocketFactory) {
    this.ws = wsFactory();
    this.ws.onmessage = (raw) => {
      this.incoming.next(JSON.parse(raw.data as string) as RoomServerToClientEvent);
    };
    this.ws.onerror = () => {
      this.incoming.next({ type: 'error', message: 'erro de conexão com o servidor' });
    };
  }

  send(event: string, data: unknown): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }));
      return;
    }
    this.ws.addEventListener('open', () => this.ws.send(JSON.stringify({ event, data })), { once: true });
  }

  close(): void {
    this.ws.close();
  }
}
