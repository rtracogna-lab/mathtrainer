export const SIZE = 10;

const EASY_HOLES = 12;
// In modalita' difficile si svuota una riga intera piu' qualche buco sparso.
const HARD_EXTRA_HOLES = 15;

type Random = () => number;

export type GameOptions = {
  /** Modalita' facile: meno buchi e mai una casella insieme alla sua gemella (3 × 7 e 7 × 3). */
  easy?: boolean;
};

export type Cell = { row: number; col: number; value: number; hole: boolean; solved: boolean };

function shuffle<T>(random: Random, items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.min(index, Math.floor(random() * (index + 1)));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/** Tavola pitagorica 10 × 10 con alcune caselle da riempire. */
export class HoleGridGame {
  /** Caselle in ordine di lettura: la casella (riga, colonna) e' in posizione (riga - 1) * SIZE + colonna - 1. */
  readonly cells: Cell[] = [];
  /** Riga svuotata del tutto (solo in modalita' difficile). */
  readonly emptyRow: number | null = null;
  errors = 0;

  constructor(options: GameOptions = {}, random: Random = Math.random) {
    for (let row = 1; row <= SIZE; row += 1) {
      for (let col = 1; col <= SIZE; col += 1) {
        this.cells.push({ row, col, value: row * col, hole: false, solved: false });
      }
    }
    // Le tabelline dell'1 sono troppo facili per diventare buchi sparsi.
    const candidates = shuffle(random, this.cells.filter((cell) => cell.row > 1 && cell.col > 1));
    if (options.easy) {
      for (const cell of candidates) {
        if (this.holes.length === EASY_HOLES) {
          break;
        }
        if (!this.cell(cell.col, cell.row).hole) {
          cell.hole = true;
        }
      }
    } else {
      this.emptyRow = 3 + Math.min(6, Math.floor(random() * 7));
      this.cells.filter((cell) => cell.row === this.emptyRow).forEach((cell) => (cell.hole = true));
      candidates.filter((cell) => !cell.hole).slice(0, HARD_EXTRA_HOLES).forEach((cell) => (cell.hole = true));
    }
  }

  cell(row: number, col: number): Cell {
    return this.cells[(row - 1) * SIZE + col - 1];
  }

  get holes(): Cell[] {
    return this.cells.filter((cell) => cell.hole);
  }

  get remaining(): number {
    return this.holes.filter((cell) => !cell.solved).length;
  }

  get isComplete(): boolean {
    return this.remaining === 0;
  }

  /** Prossimo buco da riempire dopo quello indicato, in ordine di lettura (ricomincia dall'inizio). */
  nextHole(after: Cell | null): Cell | null {
    const open = this.holes.filter((cell) => !cell.solved);
    if (after === null) {
      return open[0] ?? null;
    }
    const start = this.cells.indexOf(after);
    return open.find((cell) => this.cells.indexOf(cell) > start) ?? open[0] ?? null;
  }

  /** Prova a riempire un buco: true se il numero e' giusto. */
  answer(cell: Cell, value: number): boolean {
    if (!cell.hole || cell.solved) {
      return false;
    }
    if (value === cell.value) {
      cell.solved = true;
      return true;
    }
    this.errors += 1;
    return false;
  }
}
