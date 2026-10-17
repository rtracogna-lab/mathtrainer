import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FactStats } from '../../review/fact-stats';
import { BattleshipGame, Square } from './battleship.game';

const MAX_DIGITS = 3;

type Phase = 'intro' | 'playing' | 'won';
type Message = { kind: 'hit' | 'miss' | 'sunk' | 'wrong'; text: string };

@Component({
  selector: 'app-battleship',
  imports: [RouterLink],
  templateUrl: './battleship.html',
  styleUrls: ['../number-rain/number-rain.css', '../hole-grid/hole-grid.css', './battleship.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class BattleshipComponent {
  protected readonly keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  protected readonly phase = signal<Phase>('intro');
  /** Modalita' facile: mare piu' piccolo e tabelline piu' semplici. */
  protected readonly easy = signal(true);
  protected readonly factors = signal<number[]>([]);
  protected readonly squares = signal<Square[]>([]);
  /** Navi nemiche: parts serve solo a disegnare un quadratino per ogni pezzo. */
  protected readonly fleet = signal<{ parts: number[]; sunk: boolean }[]>([]);
  protected readonly selected = signal<Square | null>(null);
  protected readonly typed = signal('');
  protected readonly message = signal<Message | null>(null);
  protected readonly errors = signal(0);
  protected readonly shots = signal(0);
  protected readonly stars = computed(() => (this.errors() === 0 ? 3 : this.errors() <= 3 ? 2 : 1));

  private game = new BattleshipGame();
  private readonly factStats = inject(FactStats);

  protected start(): void {
    this.game = new BattleshipGame({ easy: this.easy() });
    this.factors.set(this.game.factors);
    this.selected.set(null);
    this.typed.set('');
    this.message.set(null);
    this.sync();
    this.phase.set('playing');
  }

  protected rowSquares(row: number): Square[] {
    return this.squares().filter((square) => square.row === row);
  }

  protected select(square: Square): void {
    if (this.phase() === 'playing' && square.shot === null) {
      this.selected.set(square);
      this.typed.set('');
    }
  }

  protected isSelected(square: Square): boolean {
    const selected = this.selected();
    return selected !== null && selected.row === square.row && selected.col === square.col;
  }

  protected press(digit: string): void {
    if (this.phase() === 'playing' && this.selected() !== null && this.typed().length < MAX_DIGITS) {
      this.typed.update((typed) => (typed === '0' ? digit : typed + digit));
    }
  }

  protected erase(): void {
    this.typed.update((typed) => typed.slice(0, -1));
  }

  protected fire(): void {
    const selected = this.selected();
    if (this.phase() !== 'playing' || selected === null || this.typed() === '') {
      return;
    }
    const square = this.game.square(selected.row, selected.col);
    const result = this.game.fire(square, Number(this.typed()));
    this.typed.set('');
    if (result === null) {
      return;
    }
    this.factStats.record(square.row, square.col, result.type !== 'wrong');
    if (result.type === 'wrong') {
      this.message.set({ kind: 'wrong', text: `No: ${square.row} × ${square.col} fa ${result.answer}. Colpo perso!` });
    } else {
      this.selected.set(null);
      this.message.set(
        result.type === 'miss'
          ? { kind: 'miss', text: '🌊 Acqua!' }
          : result.type === 'hit'
            ? { kind: 'hit', text: '💥 Colpito!' }
            : { kind: 'sunk', text: `🔥 Colpito e affondato! Era una nave da ${result.length}.` },
      );
    }
    this.sync();
    if (this.game.isWon) {
      this.factStats.markPlayed('battleship');
      this.phase.set('won');
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
      this.fire();
    }
  }

  private sync(): void {
    this.squares.set(this.game.squares.map((square) => ({ ...square })));
    const sunk = this.game.sunkShips;
    this.fleet.set(this.game.fleet.map((length, ship) => ({ parts: Array.from({ length }, (_, part) => part), sunk: sunk.includes(ship) })));
    this.errors.set(this.game.errors);
    this.shots.set(this.game.shots);
  }
}
