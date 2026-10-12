import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FallingNumber, GameEvent, LANES, NumberRainGame, VARIANTS, VariantId } from './number-rain.game';

const POPUP_MS = 900;
const SHAKE_MS = 400;

type Phase = 'intro' | 'playing' | 'paused' | 'over' | 'won';
type Popup = { id: number; text: string; lane: number; y: number; kind: 'gain' | 'loss' };

type Texts = {
  title: string;
  symbol: string;
  range: string;
  pick: string;
  goal: string;
  reward: string;
  landing: string;
  /** Regola per i gruppi di tre carte (null se il gioco accetta solo coppie). */
  triple: string | null;
  jolly: string;
  /** Spiegazione del bersaglio (solo per i giochi che ne hanno uno). */
  target: string | null;
  /** Cosa cambia in modalita' facile. */
  easy: string;
  example: string;
  hint: string;
  groups: string;
};

const TEXTS: Record<VariantId, Texts> = {
  rain: {
    title: 'Pioggia di numeri',
    symbol: '10',
    range: 'da <strong>1</strong> a <strong>99</strong> (mai multipli di 10)',
    pick: 'due o tre numeri',
    goal: 'la cui somma è un multiplo di 10 (10, 20, 30…)',
    reward: 'la somma si aggiunge al bonus',
    landing: 'perdi <strong>metà</strong> del suo valore, arrotondata per difetto (7 → −3)',
    triple: 'il <strong>doppio</strong> della somma',
    jolly: 'porta la somma al multiplo di 10 successivo (37 + ★ = 40)',
    target: null,
    easy: 'cadono più numeri che ti servono, vicini tra loro',
    example: 'Esempio: 37 + 23 = 60 → +60 · 31 + 12 + 17 = 60 → +120 · 37 + 25 = 62 ❌',
    hint: 'Tocca due o tre numeri che insieme fanno 10, 20, 30…',
    groups: 'gruppi',
  },
  friends: {
    title: 'Amici del 10',
    symbol: '🤝',
    range: 'da <strong>1</strong> a <strong>9</strong>',
    pick: 'due o tre numeri',
    goal: 'che insieme fanno esattamente <strong>10</strong>',
    reward: 'la somma si aggiunge al bonus',
    landing: 'perdi <strong>metà</strong> del suo valore, arrotondata per difetto (7 → −3)',
    triple: 'il doppio: <strong>20 punti</strong>',
    jolly: 'completa il 10 con qualunque numero (6 + ★ = 10)',
    target: null,
    easy: 'cadono più numeri che ti servono, vicini tra loro',
    example: 'Esempio: 3 + 7 = 10 → +10 · 2 + 3 + 5 = 10 → +20 · 4 + 5 = 9 ❌',
    hint: 'Tocca due o tre numeri che insieme fanno 10',
    groups: 'gruppi',
  },
  product: {
    title: 'Prodotto bersaglio',
    symbol: '×',
    range: 'da <strong>2</strong> a <strong>10</strong>',
    pick: 'due o tre numeri',
    goal: 'che moltiplicati fanno il <strong>bersaglio</strong> 🎯',
    reward: 'guadagni <strong>10 punti</strong>',
    landing: 'perdi <strong>metà</strong> del suo valore, arrotondata per difetto, ma <strong>al massimo 3 punti</strong>',
    triple: 'il doppio: <strong>20 punti</strong>',
    jolly: 'vale il fattore che manca (bersaglio 24: 6 × ★ → ★ = 4)',
    target: 'Il bersaglio è scritto sopra il campo: ogni volta che lo colpisci ne arriva uno nuovo. Dopo 30 secondi arrivano le tabelline più difficili.',
    easy: 'cadono più numeri che ti servono, vicini tra loro',
    example: 'Bersaglio 24: 3 × 8 → +10 · 2 × 3 × 4 → +20 · 4 × 5 = 20 ❌',
    hint: 'Tocca due o tre numeri che moltiplicati fanno il bersaglio',
    groups: 'bersagli',
  },
  subtraction: {
    title: 'Sottrazione bersaglio',
    symbol: '−',
    range: 'da <strong>1</strong> a <strong>30</strong>',
    pick: 'due o tre numeri',
    goal: 'che sottratti fanno il <strong>bersaglio</strong> 🎯 (il più grande meno gli altri)',
    reward: 'guadagni <strong>10 punti</strong>',
    landing: 'perdi <strong>metà</strong> del suo valore, arrotondata per difetto, ma <strong>al massimo 3 punti</strong>',
    triple: 'il doppio: <strong>20 punti</strong>',
    jolly: 'è il numero che manca (bersaglio 6: 13 − ★ → ★ = 7)',
    target: 'Il bersaglio è scritto sopra il campo: ogni volta che lo colpisci ne arriva uno nuovo. Dopo 30 secondi arrivano bersagli più grandi.',
    easy: 'cadono più numeri che ti servono, vicini tra loro, e il bersaglio è sempre tra 1 e 10',
    example: 'Bersaglio 6: 13 − 7 → +10 · 20 − 9 − 5 → +20 · 13 − 8 = 5 ❌',
    hint: 'Tocca due o tre numeri: il più grande meno gli altri deve fare il bersaglio',
    groups: 'bersagli',
  },
  division: {
    title: 'Divisione bersaglio',
    symbol: ':',
    range: 'da <strong>2</strong> a <strong>100</strong>',
    pick: 'due numeri',
    goal: 'che divisi fanno il <strong>bersaglio</strong> 🎯 (il più grande diviso il più piccolo)',
    reward: 'guadagni <strong>10 punti</strong>',
    landing: 'perdi <strong>metà</strong> del suo valore, arrotondata per difetto, ma <strong>al massimo 3 punti</strong>',
    triple: null,
    jolly: 'fa da divisore o da dividendo (bersaglio 6: 42 : ★ → ★ = 7)',
    target: 'Il bersaglio è scritto sopra il campo: ogni volta che lo colpisci ne arriva uno nuovo. Dopo 30 secondi arrivano divisioni più difficili.',
    easy: 'cadono più numeri che ti servono, vicini tra loro',
    example: 'Bersaglio 6: 42 : 7 → +10 (puoi toccarli in qualunque ordine) · 42 : 6 = 7 ❌',
    hint: 'Tocca un dividendo e un divisore che fanno il bersaglio',
    groups: 'bersagli',
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
  /** Modalita' facile: piu' numeri utili. */
  protected readonly easy = signal(false);
  protected readonly numbers = signal<FallingNumber[]>([]);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly selectedValues = signal<number[]>([]);
  protected readonly selectedLabels = signal<string[]>([]);
  protected readonly selectionHasJolly = computed(() => this.selectedLabels().length > this.selectedValues().length);
  /** Selezione scritta come operazione, es. "3 × 8 = 24" o "42 : 7 = 6". */
  protected readonly selectionText = computed(() => {
    const variant = VARIANTS[this.variant()];
    const labels = this.selectedLabels();
    if (this.selectionHasJolly() || labels.length < 2) {
      return { operation: labels.join(` ${variant.operator} `), result: null as string | null };
    }
    // Nella divisione e nella sottrazione si scrive prima il numero piu' grande (42 : 7, 13 − 7).
    const values = variant.operator === ':' || variant.operator === '−' ? [...this.selectedValues()].sort((a, b) => b - a) : this.selectedValues();
    const result = variant.combine(values);
    return { operation: values.join(` ${variant.operator} `), result: result === null ? '?' : String(result) };
  });
  protected readonly target = signal<number | null>(null);
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
    this.game = new NumberRainGame(VARIANTS[this.variant()], Math.random, { easy: this.easy() });
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
      if (event.penalty === 0) {
        return;
      }
      this.addPopup(`-${event.penalty}`, event.lane, 1, 'loss');
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
    this.target.set(this.game.target);
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
