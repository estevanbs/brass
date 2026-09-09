import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { GameView, LegalActionView, PopupPosition } from '@brass/domain';
import { GameGateway } from '../ports/game-gateway';

export interface PopupState {
  readonly title: string;
  readonly actions: readonly LegalActionView[];
  readonly position: PopupPosition;
}

/**
 * Single source of truth for the whole game screen, exposed as signals. Every feature
 * component reads from and calls into this service instead of talking to `GameGateway`
 * directly or holding its own copy of the selection state — that keeps the "which card is
 * selected, which actions does that unlock" logic in one testable place instead of scattered
 * across components. Depends only on the `GameGateway` port, never on a concrete HTTP client,
 * so it can be unit-tested with a fake gateway.
 */
@Injectable({ providedIn: 'root' })
export class GameStateService {
  private readonly gateway = inject(GameGateway);

  private readonly _view = signal<GameView | null>(null);
  private readonly _selectedCard = signal<string | null>(null);
  private readonly _scoutMode = signal(false);
  private readonly _scoutPicks = signal<readonly string[]>([]);
  private readonly _selectedMatPlayer = signal<string | null>(null);
  private readonly _statusMessage = signal('');
  private readonly _popup = signal<PopupState | null>(null);

  readonly view = this._view.asReadonly();
  readonly selectedCard = this._selectedCard.asReadonly();
  readonly scoutMode = this._scoutMode.asReadonly();
  readonly scoutPicks = this._scoutPicks.asReadonly();
  readonly statusMessage = this._statusMessage.asReadonly();
  readonly popup = this._popup.asReadonly();

  readonly selectedMatPlayer = computed(() => this._selectedMatPlayer() ?? this.view()?.humanId ?? null);

  readonly hasSelection = computed(() => this._selectedCard() !== null || this._scoutMode());

  /** Legal actions currently "in play" given the selection state: every action usable with
   * the selected card, or (in scout mode) actions matching the card plus the picks so far. */
  readonly filteredActions = computed<readonly LegalActionView[]>(() => {
    const view = this._view();
    if (view === null) return [];
    if (this._scoutMode()) {
      const selected = this._selectedCard();
      if (selected === null) return [];
      const required = [selected, ...this._scoutPicks()];
      return view.legalActions.filter((a) => a.type === 'scout' && required.every((k) => a.cardKeys.includes(k)));
    }
    const selected = this._selectedCard();
    if (selected === null) return [];
    return view.legalActions.filter((a) => a.cardKeys.includes(selected));
  });

  async newGame(playerCount: number, seed: number | undefined): Promise<void> {
    this._statusMessage.set('Criando partida...');
    try {
      const request = seed === undefined ? { playerCount } : { playerCount, seed };
      const view = await firstValueFrom(this.gateway.createGame(request));
      this._selectedMatPlayer.set(null);
      this.applyView(view);
      this._statusMessage.set('');
    } catch (err) {
      this._statusMessage.set(`Erro: ${errorMessage(err)}`);
    }
  }

  async submitAction(index: number): Promise<void> {
    const view = this._view();
    if (view === null) return;
    this._statusMessage.set('Aguardando bots...');
    this.closePopup();
    try {
      const updated = await firstValueFrom(this.gateway.submitAction(view.gameId, index));
      this.applyView(updated);
      this._statusMessage.set('');
    } catch (err) {
      this._statusMessage.set(`Erro: ${errorMessage(err)}`);
    }
  }

  /** Submits the single matching action for `key`'s selection context, if there is exactly
   * one; otherwise leaves the caller to open a popup with the alternatives. */
  selectCard(key: string): void {
    this.closePopup();
    if (this._scoutMode()) {
      this.toggleScoutPick(key);
      return;
    }
    this._selectedCard.set(this._selectedCard() === key ? null : key);
  }

  startScout(): void {
    this._scoutMode.set(true);
    this._scoutPicks.set([]);
    this.closePopup();
  }

  cancelScout(): void {
    this._scoutMode.set(false);
    this._scoutPicks.set([]);
    this._selectedCard.set(null);
  }

  isScoutPick(key: string): boolean {
    return this._scoutPicks().includes(key);
  }

  private toggleScoutPick(key: string): void {
    if (key === this._selectedCard()) return;
    const picks = this._scoutPicks();
    if (picks.includes(key)) {
      this._scoutPicks.set(picks.filter((k) => k !== key));
      return;
    }
    if (picks.length >= 2) return;
    const nextPicks = [...picks, key];
    this._scoutPicks.set(nextPicks);
    if (nextPicks.length === 2) {
      const match = this.filteredActions()[0];
      if (match !== undefined) void this.submitAction(match.index);
    }
  }

  selectMatPlayer(playerId: string): void {
    this._selectedMatPlayer.set(playerId);
  }

  openPopup(title: string, actions: readonly LegalActionView[], position: PopupPosition): void {
    this._popup.set({ title, actions, position });
  }

  closePopup(): void {
    this._popup.set(null);
  }

  private applyView(view: GameView): void {
    this._view.set(view);
    this._selectedCard.set(null);
    this._scoutMode.set(false);
    this._scoutPicks.set([]);
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'error' in err) {
    const inner = (err as { error?: unknown }).error;
    if (typeof inner === 'object' && inner !== null && 'error' in inner) {
      const message = (inner as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    }
  }
  return String(err);
}
