import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FallingNumber, GameEvent, LANES, NumberRainGame, VARIANTS, VariantId } from './number-rain.game';

const POPUP_MS = 900;
const SHAKE_MS = 400;

type Phase = 'intro' | 'playing' | 'paused' | 'over' | 'won';
type Popup = { id: number; text: string; lane: number; y: number; kind: 'gain' | 'loss' };

const TEXTS: Record<VariantId, { title: string; symbol: string; range: string; pick: string; goal: string; example: string; hint: string; groups: string; triple: string; jolly: string }> = {
  rain: {
    title: 'Pioggia di numeri',
    symbol: '10',
    range: 'da <strong>1</strong> a <strong>99</strong> (mai multipli di 10)',
    pick: 'due o tre numeri',
    goal: 'la cui somma è un multiplo di 10 (10, 20, 30…)',
    example: 'Esempio: 37 + 23 = 60 → +60 · 31 + 12 + 17 = 60 → +120 · 37 + 25 = 62 ❌',
    hint: 'Tocca due o tre numeri che insieme fanno 10, 20, 30…',
    groups: 'gruppi',
    triple: 'il <strong>doppio</strong> della somma',
    jolly: 'porta la somma al multiplo di 10 successivo (37 + ★ = 40)',
  },
  friends: {
    title: 'Amici del 10',
    symbol: '🤝',
    range: 'da <strong>1</strong> a <strong>9</strong>',
    pick: 'due o tre numeri',
    goal: 'che insieme fanno esattamente <strong>10</strong>',
    example: 'Esempio: 3 + 7 = 10 → +10 · 2 + 3 + 5 = 10 → +20 · 4 + 5 = 9 ❌',
    hint: 'Tocca due o tre numeri che insieme fanno 10',
    groups: 'gruppi',
    triple: 'il doppio: <strong>20 punti</strong>',
    jolly: 'completa il 10 con qualunque numero (6 + ★ = 10)',
  },
};

@Component({
  selector: 'app-number-rain',
  imports: [RouterLink],
  templateUrl: './number-rain.html',
  styleUrl: './number-rain.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberRainComponent {
  /** Impostata dalla route (data: { variant }). */
  readonly variant = input<VariantId>('rain');

  protected readonly lanes = LANES;
  protected readonly texts = computed(() => TEXTS[this.variant()]);
  protected readonly startBonus = computed(() => VARIANTS[this.variant()].startBonus);
  protected readonly winBonus = computed<number | undefined>(() => VARIANTS[this.variant()].winBonus);
  protected readonly hasJolly = computed(() => VARIANTS[this.variant()].jollyChance > 0);
  protected readonly phase = signal<Phase>('intro');
  protected readonly numbers = signal<FallingNumber[]>([]);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly selectedValues = signal<number[]>([]);
  protected readonly selectedLabels = signal<string[]>([]);
  protected readonly selectedSum = computed(() => this.selectedValues().reduce((total, value) => total + value, 0));
  protected readonly selectionHasJolly = computed(() => this.selectedLabels().length > this.selectedValues().length);
  protected readonly bonus = signal(0);
  protected readonly bestBonus = signal(0);
  protected readonly pairs = signal(0);
  protected readonly seconds = signal(0);
  protected readonly level = signal(1);
  protected readonly shakingIds = signal<number[]>([]);
  protected readonly popups = signal<Popup[]>([]);

  private game = new NumberRainGame();
  private frameId: number | undefined;
  private lastFrame = 0;
  private nextPopupId = 1;
  private readonly timeouts = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopLoop();
      this.timeouts.forEach((timeout) => clearTimeout(timeout));
    });
  }

  protected start(): void {
    this.stopLoop();
    this.game = new NumberRainGame(VARIANTS[this.variant()]);
    this.popups.set([]);
    this.shakingIds.set([]);
    this.bestBonus.set(this.game.bonus);
    this.sync();
    this.phase.set('playing');
    this.startLoop();
  }

  protected togglePause(): void {
    if (this.phase() === 'playing') {
      this.stopLoop();
      this.phase.set('paused');
    } else if (this.phase() === 'paused') {
      this.phase.set('playing');
      this.startLoop();
    }
  }

  protected selectNumber(id: number): void {
    if (this.phase() !== 'playing') {
      return;
    }
    const event = this.game.select(id);
    if (event !== null) {
      this.handleEvent(event);
    }
    this.sync();
    this.finishIfOver();
  }

  /** Avanza il gioco di un passo: usato dal ciclo di animazione (e dai test). */
  protected advance(seconds: number): void {
    for (const event of this.game.tick(seconds)) {
      this.handleEvent(event);
    }
    this.sync();
    this.finishIfOver();
  }

  private finishIfOver(): void {
    if (this.game.isOver) {
      this.stopLoop();
      this.phase.set(this.game.isWon ? 'won' : 'over');
    }
  }

  protected tileTop(item: { y: number }): string {
    return `calc(${item.y} * (100% - var(--tile-height)))`;
  }

  protected laneLeft(lane: number): string {
    return `calc(${lane} * 100% / ${LANES})`;
  }

  private handleEvent(event: GameEvent): void {
    if (event.type === 'match') {
      this.addPopup(`+${event.sum}`, event.lane, event.y, 'gain');
    } else if (event.type === 'landed') {
      if (event.value === 0) {
        return;
      }
      this.addPopup(`-${event.value}`, event.lane, 1, 'loss');
    } else {
      this.shakingIds.set(event.ids);
      this.later(() => this.shakingIds.set([]), SHAKE_MS);
    }
  }

  private addPopup(text: string, lane: number, y: number, kind: Popup['kind']): void {
    const popup = { id: this.nextPopupId++, text, lane, y, kind };
    this.popups.update((popups) => [...popups, popup]);
    this.later(() => this.popups.update((popups) => popups.filter((item) => item.id !== popup.id)), POPUP_MS);
  }

  private later(action: () => void, ms: number): void {
    const timeout = setTimeout(() => {
      this.timeouts.delete(timeout);
      action();
    }, ms);
    this.timeouts.add(timeout);
  }

  private sync(): void {
    this.numbers.set(this.game.numbers.map((number) => ({ ...number })));
    this.selectedIds.set(this.game.selectedIds);
    this.selectedValues.set(this.game.selectedValues);
    this.selectedLabels.set(this.game.selectedNumbers.map((item) => (item.jolly ? '★' : String(item.value))));
    this.bonus.set(this.game.bonus);
    this.bestBonus.update((best) => Math.max(best, this.game.bonus));
    this.pairs.set(this.game.pairs);
    this.seconds.set(Math.floor(this.game.elapsed));
    this.level.set(this.game.level);
  }

  private startLoop(): void {
    if (typeof requestAnimationFrame !== 'function') {
      return;
    }
    this.lastFrame = performance.now();
    const frame = (now: number) => {
      this.advance((now - this.lastFrame) / 1000);
      this.lastFrame = now;
      if (this.phase() === 'playing') {
        this.frameId = requestAnimationFrame(frame);
      }
    };
    this.frameId = requestAnimationFrame(frame);
  }

  private stopLoop(): void {
    if (this.frameId !== undefined) {
      cancelAnimationFrame(this.frameId);
      this.frameId = undefined;
    }
  }
}
