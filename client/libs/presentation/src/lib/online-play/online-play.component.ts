import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameStateService, RoomLobbyService } from '@brass/application';
import { GameShellComponent } from '../game-shell/game-shell.component';

/**
 * The whole `/online` experience in one component, switching on `RoomLobbyService#status`:
 * create-or-join form (`'idle'`), waiting room (`'lobby'`), a connection problem (`'error'`),
 * and — once the host starts the room — the *exact same* `GameShellComponent` `/offline` uses,
 * completely unchanged; only its `GameGateway` differs (wired at the route level, see
 * `app.routes.ts`, to a `LazyRoomGameGateway` bound to this same room).
 */
@Component({
  selector: 'brass-online-play',
  imports: [FormsModule, GameShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (lobby.status()) {
      @case ('idle') {
        <div class="online-setup">
          <section class="setup-card">
            <h2>Criar sala</h2>
            <label>Seu nome <input type="text" [(ngModel)]="hostName" /></label>
            <label
              >Jogadores
              <select [(ngModel)]="maxPlayers">
                <option [ngValue]="2">2</option>
                <option [ngValue]="3">3</option>
                <option [ngValue]="4">4</option>
              </select>
            </label>
            <button type="button" [disabled]="!hostName().trim()" (click)="create()">Criar sala</button>
          </section>

          <section class="setup-card">
            <h2>Entrar em uma sala</h2>
            <label>Seu nome <input type="text" [(ngModel)]="joinName" /></label>
            <label>Código <input type="text" [(ngModel)]="joinCode" /></label>
            <button type="button" [disabled]="!joinName().trim() || !joinCode().trim()" (click)="join()">Entrar</button>
          </section>
        </div>
      }
      @case ('lobby') {
        @if (lobby.room(); as room) {
          <div class="room-lobby">
            <p class="room-code">
              Código da sala: <strong>{{ room.code }}</strong>
            </p>
            <ul class="room-seats">
              @for (seat of room.seats; track seat.playerId) {
                <li>
                  {{ seat.playerId }}
                  @if (seat.playerId === room.hostId) {
                    <span class="host-badge">anfitrião</span>
                  }
                </li>
              }
              @for (empty of emptySeats(room.seats.length, room.maxPlayers); track empty) {
                <li class="empty-seat">vaga livre (vira bot ao iniciar)</li>
              }
            </ul>
            @if (lobby.isHost()) {
              <button type="button" (click)="lobby.startRoom()">Iniciar partida</button>
            } @else {
              <p>Aguardando o anfitrião iniciar a partida...</p>
            }
          </div>
        }
      }
      @case ('started') {
        <brass-game-shell />
      }
      @case ('error') {
        <div class="online-error">
          <p>{{ lobby.errorMessage() }}</p>
          <button type="button" (click)="lobby.reset()">Voltar</button>
        </div>
      }
    }
  `,
})
export class OnlinePlayComponent implements OnInit {
  protected readonly lobby = inject(RoomLobbyService);
  private readonly gameState = inject(GameStateService);

  protected readonly hostName = signal('');
  protected readonly maxPlayers = signal(4);
  protected readonly joinName = signal('');
  protected readonly joinCode = signal('');

  /** `<brass-game-shell>` below only ever *renders* correctly once `GameStateService#view` has
   * something in it — nothing populates that on its own for the online flow (there's no
   * offline-style "Novo jogo" click to trigger it), so this component is the one place that
   * must call `loadGame` the moment the room actually starts. Guarded so a re-run of the
   * effect (e.g. an unrelated `lobby.room()` update after the game is already loaded) doesn't
   * call `loadGame` again and reset the view back to nothing while a game is in progress. */
  private gameLoadedFor: string | undefined;

  constructor() {
    effect(() => {
      const gameId = this.lobby.room()?.gameId;
      if (this.lobby.status() !== 'started' || gameId === undefined || gameId === this.gameLoadedFor) return;
      this.gameLoadedFor = gameId;
      void this.gameState.loadGame(gameId);
    });
  }

  ngOnInit(): void {
    this.lobby.tryResume();
  }

  protected create(): void {
    this.lobby.createRoom(this.hostName().trim(), this.maxPlayers());
  }

  protected join(): void {
    this.lobby.joinRoom(this.joinCode().trim().toUpperCase(), this.joinName().trim());
  }

  protected emptySeats(seatCount: number, maxPlayers: number): number[] {
    return Array.from({ length: Math.max(0, maxPlayers - seatCount) }, (_, i) => i);
  }
}
