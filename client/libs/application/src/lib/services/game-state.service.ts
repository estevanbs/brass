import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, type Subscription } from 'rxjs';
import type { ActionTargets, GameMoveEvent, GameView, LegalActionView, PopupPosition } from '@brass/domain';
import { GameGateway } from '../ports/game-gateway';
import { nextResourceChoice, type ResourceChoiceStep } from './resource-choice';

/** How long a bot-move ping stays on the map before auto-clearing — long enough to notice,
 * short enough not to still be running when the next move streams in in a fast game. */
const BOT_HIGHLIGHT_DURATION_MS = 1800;

/** How long the "botX jogou: ..." toast stays up — a bit longer than the map ping since it
 * has text to actually read, not just a shape to notice. */
const BOT_MOVE_TOAST_DURATION_MS = 2400;

export interface PopupState {
  readonly title: string;
  readonly actions: readonly LegalActionView[];
  readonly position: PopupPosition;
}

/** Mid-flow state for "which mine/works does this draw from" — `step` is whichever resource
 * slot is currently being asked about; `title`/`position` are carried through unchanged from
 * whatever triggered this (a map click or an "other actions" button) so the eventual confirm
 * popup opens exactly where the original one would have. */
export interface ResourceChoiceState extends ResourceChoiceStep {
  readonly title: string;
  readonly position: PopupPosition;
}

export interface BotMoveToast {
  readonly playerId: string;
  readonly actionLabel: string;
  /** Increments on every toast — even two back-to-back bot moves with an identical label stay
   * distinguishable, so the UI can key an `@for` on it and always replay the animation instead
   * of silently reusing the same (already-mid-animation) DOM node. */
  readonly key: number;
}

/**
 * Single source of truth for the whole game screen, exposed as signals. Every feature
 * component reads from and calls into this service instead of talking to `GameGateway`
 * directly or holding its own copy of the selection state — that keeps the "which card is
 * selected, which actions does that unlock" logic in one testable place instead of scattered
 * across components. Depends only on the `GameGateway` port, never on a concrete HTTP client,
 * so it can be unit-tested with a fake gateway.
 *
 * Deliberately *not* `providedIn: 'root'`: a root-provided service is a true singleton whose
 * own `inject()` calls resolve against the root injector, no matter which route triggered its
 * first creation — so a root-singleton `GameStateService` would resolve `GameGateway` from the
 * root too, never seeing a route's own per-route binding (`/offline` vs. `/online` each bind a
 * different concrete `GameGateway` — see `app.routes.ts`). Each route that renders
 * `GameShellComponent` provides `GameStateService` itself, alongside its `GameGateway`, so both
 * resolve from the same injector and each route gets its own fresh instance (also correct on
 * its own terms: switching modes shouldn't carry over stale game/selection state).
 */
@Injectable()
export class GameStateService {
  private readonly gateway = inject(GameGateway);

  private readonly _view = signal<GameView | null>(null);
  private readonly _selectedCard = signal<string | null>(null);
  private readonly _scoutMode = signal(false);
  private readonly _scoutPicks = signal<readonly string[]>([]);
  private readonly _selectedMatPlayer = signal<string | null>(null);
  private readonly _statusMessage = signal('');
  private readonly _popup = signal<PopupState | null>(null);
  private readonly _resourceChoice = signal<ResourceChoiceState | null>(null);
  private readonly _botHighlight = signal<ActionTargets | null>(null);
  private botHighlightTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly _botMoveToast = signal<BotMoveToast | null>(null);
  private botMoveToastTimer: ReturnType<typeof setTimeout> | undefined;
  private botMoveToastCounter = 0;
  private movesSubscription: Subscription | undefined;

  readonly view = this._view.asReadonly();
  readonly selectedCard = this._selectedCard.asReadonly();
  readonly scoutMode = this._scoutMode.asReadonly();
  readonly scoutPicks = this._scoutPicks.asReadonly();
  readonly statusMessage = this._statusMessage.asReadonly();
  readonly popup = this._popup.asReadonly();
  /** Non-null while the player is mid-way through picking which mine/works a coal/iron slot
   * draws from — set by `chooseAction` instead of opening the popup outright whenever the
   * matches it was given still differ only by resource source (see `nextResourceChoice`). */
  readonly resourceChoice = this._resourceChoice.asReadonly();
  /** Board locations/links a bot's move just touched, straight from that move's own
   * `GameMoveEvent.targets` (`GameGateway#submitAction` streams one such event per move) —
   * drives a one-shot "ping" animation on the map; auto-clears after
   * `BOT_HIGHLIGHT_DURATION_MS`, and restarts if another bot move streams in before that. */
  readonly botHighlight = this._botHighlight.asReadonly();
  /** "botX jogou: ..." — one per bot `GameMoveEvent`, for a toast that animates in as each
   * move streams in and auto-clears after `BOT_MOVE_TOAST_DURATION_MS`. */
  readonly botMoveToast = this._botMoveToast.asReadonly();

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
      this.watchMoves(view.gameId, view.humanId);
    } catch (err) {
      this._statusMessage.set(`Erro: ${errorMessage(err)}`);
    }
  }

  /** Attaches to a game that already exists — the online room flow's entry point, once its
   * lobby has a `gameId` (the room already started, or a reconnect found it already started),
   * as opposed to `newGame`'s "make a brand new local game". Reuses the same `GameGateway#getGame`
   * every gateway already implements for resync. */
  async loadGame(gameId: string): Promise<void> {
    this._statusMessage.set('Carregando partida...');
    try {
      const view = await firstValueFrom(this.gateway.getGame(gameId));
      this._selectedMatPlayer.set(null);
      this.applyView(view);
      this._statusMessage.set('');
      this.watchMoves(view.gameId, view.humanId);
    } catch (err) {
      this._statusMessage.set(`Erro: ${errorMessage(err)}`);
    }
  }

  /** Subscribes (once per game) to every move `gateway.watchMoves` pushes that this client
   * didn't itself trigger via `submitAction` — an offline gateway never emits here, so this is
   * a no-op there; an online room gateway pushes every seat's move live, which is what lets
   * this client's board update the instant another real player acts. */
  private watchMoves(gameId: string, humanId: string): void {
    this.movesSubscription?.unsubscribe();
    this.movesSubscription = this.gateway.watchMoves(gameId).subscribe((event: GameMoveEvent) => {
      this.applyView(event.view);
      if (event.playerId !== humanId) {
        this.triggerBotHighlight(event.targets);
        this.triggerBotMoveToast(event.playerId, event.actionLabel);
      }
    });
  }

  /** Streams the human's move and every bot move that follows it (`GameGateway#submitAction`)
   * — applies each one's view as it arrives, so the board/log/hand update move by move instead
   * of jumping straight to the final state once every bot has played. */
  submitAction(index: number): void {
    const view = this._view();
    if (view === null) return;
    const humanId = view.humanId;
    this._statusMessage.set('Aguardando bots...');
    this.closePopup();
    this.cancelResourceChoice();
    this.gateway.submitAction(view.gameId, index).subscribe({
      next: (event) => {
        this.applyView(event.view);
        if (event.playerId !== humanId) {
          this.triggerBotHighlight(event.targets);
          this.triggerBotMoveToast(event.playerId, event.actionLabel);
        }
      },
      error: (err: unknown) => this._statusMessage.set(`Erro: ${errorMessage(err)}`),
      complete: () => this._statusMessage.set(''),
    });
  }

  /** Pings whatever a single bot move just touched on the map — restarts the timer if another
   * move streams in before the previous ping finished fading. */
  private triggerBotHighlight(targets: ActionTargets): void {
    if (targets.locationIds.length === 0 && targets.linkSlotIds.length === 0) return;
    clearTimeout(this.botHighlightTimer);
    this._botHighlight.set(targets);
    this.botHighlightTimer = setTimeout(() => this._botHighlight.set(null), BOT_HIGHLIGHT_DURATION_MS);
  }

  /** Shows "botX jogou: ..." for one bot move — restarts the timer (and bumps `key`, so the
   * animation replays even for a repeated label) if another move streams in before the
   * previous toast finished fading. */
  private triggerBotMoveToast(playerId: string, actionLabel: string): void {
    clearTimeout(this.botMoveToastTimer);
    this.botMoveToastCounter += 1;
    this._botMoveToast.set({ playerId, actionLabel, key: this.botMoveToastCounter });
    this.botMoveToastTimer = setTimeout(() => this._botMoveToast.set(null), BOT_MOVE_TOAST_DURATION_MS);
  }

  /** Submits the single matching action for `key`'s selection context, if there is exactly
   * one; otherwise leaves the caller to open a popup with the alternatives. */
  selectCard(key: string): void {
    this.closePopup();
    this.cancelResourceChoice();
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
    this.cancelResourceChoice();
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
      if (match !== undefined) this.submitAction(match.index);
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

  /** The entry point every map click and "other actions" button should use instead of
   * `openPopup` directly: if `matches` still differ only by which coal/iron tile to draw from
   * (`nextResourceChoice`), this asks the player to click that tile on the map instead of
   * opening the confirm popup outright — re-narrowing (via `chooseResourceSource`) until either
   * a further resource slot needs picking too, or none do, at which point the popup opens
   * exactly as it always has. A no-op if `matches` is empty. */
  chooseAction(title: string, matches: readonly LegalActionView[], position: PopupPosition): void {
    if (matches.length === 0) return;
    const step = nextResourceChoice(matches);
    if (step === null) {
      this.openPopup(title, matches, position);
      return;
    }
    this._resourceChoice.set({ title, position, ...step });
  }

  /** Narrows the pending resource choice by the tile the player just clicked — either advances
   * to the next resource slot still needing a pick, or (once none do) opens the confirm popup.
   * A no-op if there is no pending choice, or `locationId` isn't one of its options (the map
   * only ever offers `chooseResourceSource` a location it already knows is valid, but a stray
   * call — e.g. a stale click racing a state update — should do nothing, not throw). */
  chooseResourceSource(locationId: string): void {
    const pending = this._resourceChoice();
    if (pending === null) return;
    const narrowed = pending.options.get(locationId);
    if (narrowed === undefined) return;
    this._resourceChoice.set(null);
    this.chooseAction(pending.title, narrowed, pending.position);
  }

  /** Backs out of a pending resource choice without submitting anything — returns to the plain
   * "here's everywhere this card can act" view, same as before the triggering click/button. */
  cancelResourceChoice(): void {
    this._resourceChoice.set(null);
  }

  private applyView(view: GameView): void {
    this._view.set(view);
    this._selectedCard.set(null);
    this._scoutMode.set(false);
    this._scoutPicks.set([]);
    this._resourceChoice.set(null);
    clearTimeout(this.botHighlightTimer);
    this._botHighlight.set(null);
    clearTimeout(this.botMoveToastTimer);
    this._botMoveToast.set(null);
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
