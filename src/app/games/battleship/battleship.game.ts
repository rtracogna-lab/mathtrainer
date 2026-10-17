type Random = () => number;

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** Facile: mare 6 × 6 con le tabelline dal 2 al 7 e tre navi. Difficile: mare 8 × 8 dal 3 al 10 e quattro navi. */
const EASY = { factors: range(2, 7), fleet: [3, 2, 2] };
const HARD = { factors: range(3, 10), fleet: [4, 3, 3, 2] };
const MAX_PLACEMENT_ATTEMPTS = 200;

export type GameOptions = { easy?: boolean };

export type Square = {
  row: number;
  col: number;
  /** Indice della nave che occupa la casella (null = acqua). */
  ship: number | null;
  shot: 'hit' | 'miss' | null;
  sunk: boolean;
};

export type FireResult =
  | { type: 'wrong'; answer: number }
  | { type: 'miss' }
  | { type: 'hit' }
  | { type: 'sunk'; length: number };

/** Battaglia navale: per sparare sulla casella (7, 8) bisogna sapere quanto fa 7 × 8. */
export class BattleshipGame {
  readonly factors: number[];
  readonly fleet: number[];
  readonly squares: Square[] = [];
  /** Risposte sbagliate: il colpo va perso. */
  errors = 0;
  /** Colpi sparati (risposte giuste). */
  shots = 0;

  constructor(options: GameOptions = {}, private readonly random: Random = Math.random) {
    const config = options.easy ? EASY : HARD;
    this.factors = config.factors;
    this.fleet = config.fleet;
    for (const row of this.factors) {
      for (const col of this.factors) {
        this.squares.push({ row, col, ship: null, shot: null, sunk: false });
      }
    }
    while (!this.placeFleet()) {
      this.squares.forEach((square) => (square.ship = null));
    }
  }

  square(row: number, col: number): Square {
    const size = this.factors.length;
    return this.squares[(row - this.factors[0]) * size + col - this.factors[0]];
  }

  get sunkShips(): number[] {
    return this.fleet.map((_, ship) => ship).filter((ship) => this.shipSquares(ship).every((square) => square.sunk));
  }

  get isWon(): boolean {
    return this.sunkShips.length === this.fleet.length;
  }

  /** Spara sulla casella se la tabellina e' giusta; null se la casella e' gia' stata colpita. */
  fire(square: Square, answer: number): FireResult | null {
    if (square.shot !== null) {
      return null;
    }
    if (answer !== square.row * square.col) {
      this.errors += 1;
      return { type: 'wrong', answer: square.row * square.col };
    }
    this.shots += 1;
    if (square.ship === null) {
      square.shot = 'miss';
      return { type: 'miss' };
    }
    square.shot = 'hit';
    const ship = this.shipSquares(square.ship);
    if (ship.every((part) => part.shot === 'hit')) {
      ship.forEach((part) => (part.sunk = true));
      return { type: 'sunk', length: ship.length };
    }
    return { type: 'hit' };
  }

  private shipSquares(ship: number): Square[] {
    return this.squares.filter((square) => square.ship === ship);
  }

  /** Piazza le navi a caso, senza che si tocchino (nemmeno in diagonale). false se non ci riesce. */
  private placeFleet(): boolean {
    const size = this.factors.length;
    for (const [ship, length] of this.fleet.entries()) {
      let placed = false;
      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS && !placed; attempt += 1) {
        const horizontal = this.random() < 0.5;
        const startRow = Math.floor(this.random() * (horizontal ? size : size - length + 1));
        const startCol = Math.floor(this.random() * (horizontal ? size - length + 1 : size));
        const cells = range(0, length - 1).map((step) => (horizontal ? [startRow, startCol + step] : [startRow + step, startCol]));
        if (cells.every(([row, col]) => this.isFreeArea(row, col))) {
          cells.forEach(([row, col]) => (this.squares[row * size + col].ship = ship));
          placed = true;
        }
      }
      if (!placed) {
        return false;
      }
    }
    return true;
  }

  /** La casella (in coordinate 0..size-1) e quelle intorno non hanno navi. */
  private isFreeArea(row: number, col: number): boolean {
    const size = this.factors.length;
    for (let r = row - 1; r <= row + 1; r += 1) {
      for (let c = col - 1; c <= col + 1; c += 1) {
        if (r >= 0 && c >= 0 && r < size && c < size && this.squares[r * size + c].ship !== null) {
          return false;
        }
      }
    }
    return true;
  }
}
