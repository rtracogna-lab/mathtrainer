import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FactStats } from '../../review/fact-stats';
import { Cell, HoleGridGame, SIZE } from './hole-grid.game';

const SHAKE_MS = 400;
const MAX_DIGITS = 3;

type Phase = 'intro' | 'playing' | 'done';

@Component({
  selector: 'app-hole-grid',
  imports: [RouterLink],
  templateUrl: './hole-grid.html',
  styleUrls: ['../number-rain/number-rain.css', './hole-grid.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class HoleGridComponent {
  protected readonly factors = Array.from({ length: SIZE }, (_, index) => index + 1);
  protected readonly keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  protected readonly phase = signal<Phase>('intro');
  /** Modalita' facile: meno buchi e ogni buco ha la sua gemella scritta. */
  protected readonly easy = signal(true);
  protected readonly cells = signal<Cell[]>([]);
  protected readonly selected = signal<Cell | null>(null);
  protected readonly typed = signal('');
  protected readonly shaking = signal<Cell | null>(null);
  protected readonly errors = signal(0);
  protected readonly remaining = signal(0);
  protected readonly total = signal(0);
  protected readonly seconds = signal(0);
  protected readonly emptyRow = signal<number | null>(null);
  protected readonly stars = computed(() => (this.errors() === 0 ? 3 : this.errors() <= 3 ? 2 : 1));

  private game = new HoleGridGame();
  private readonly factStats = inject(FactStats);
  private timerId: ReturnType<typeof setInterval> | undefined;
  private shakeId: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.stopTimer();
      clearTimeout(this.shakeId);
    });
  }

  protected start(): void {
    this.game = new HoleGridGame({ easy: this.easy() });
    this.emptyRow.set(this.game.emptyRow);
    this.total.set(this.game.holes.length);
    this.typed.set('');
    this.shaking.set(null);
    this.sync();
    this.selected.set(this.game.nextHole(null));
    this.phase.set('playing');
    this.startTimer();
  }

  protected rowCells(row: number): Cell[] {
    return this.cells().slice((row - 1) * SIZE, row * SIZE);
  }

  protected select(cell: Cell): void {
    if (this.phase() === 'playing' && cell.hole && !cell.solved) {
      this.selected.set(cell);
      this.typed.set('');
    }
  }

  protected isSame(other: Cell | null, cell: Cell): boolean {
    return other !== null && other.row === cell.row && other.col === cell.col;
  }

  /** Riga e colonna del buco scelto, per aiutare a seguire la tabellina. */
  protected isCrossed(cell: Cell): boolean {
    const selected = this.selected();
    return selected !== null && (selected.row === cell.row || selected.col === cell.col);
  }

  protected press(digit: string): void {
    if (this.phase() === 'playing' && this.typed().length < MAX_DIGITS) {
      this.typed.update((typed) => (typed === '0' ? digit : typed + digit));
    }
  }

  protected erase(): void {
    this.typed.update((typed) => typed.slice(0, -1));
  }

  protected confirm(): void {
    const cell = this.selected();
    if (this.phase() !== 'playing' || cell === null || this.typed() === '') {
      return;
    }
    const correct = this.game.answer(this.game.cell(cell.row, cell.col), Number(this.typed()));
    this.factStats.record(cell.row, cell.col, correct);
    this.typed.set('');
    if (correct) {
      this.sync();
      this.selected.set(this.game.nextHole(this.game.cell(cell.row, cell.col)));
      if (this.game.isComplete) {
        this.stopTimer();
        this.factStats.markPlayed('grid');
        this.phase.set('done');
      }
    } else {
      this.errors.set(this.game.errors);
      this.shaking.set(cell);
      clearTimeout(this.shakeId);
      this.shakeId = setTimeout(() => this.shaking.set(null), SHAKE_MS);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.phase() !== 'playing') {
      return;
    }
    if (/^\d$/.test(event.key)) {
      this.press(event.key);
    } else if (event.key === 'Backspace') {
      this.erase();
    } else if (event.key === 'Enter') {
      // Evita che Invio "clicchi" anche il pulsante che ha il focus.
      event.preventDefault();
      this.confirm();
    }
  }

  private sync(): void {
    this.cells.set(this.game.cells.map((cell) => ({ ...cell })));
    this.remaining.set(this.game.remaining);
    this.errors.set(this.game.errors);
  }

  private startTimer(): void {
    this.stopTimer();
    this.seconds.set(0);
    this.timerId = setInterval(() => this.seconds.update((seconds) => seconds + 1), 1000);
  }

  private stopTimer(): void {
    if (this.timerId !== undefined) {
      clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }
}
