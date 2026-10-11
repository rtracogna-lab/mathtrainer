export const LANES = 6;
export const LEVEL_SECONDS = 30;

// Un nuovo numero non nasce in una colonna in cui l'ultimo e' ancora troppo in alto.
const LANE_CLEARANCE = 0.15;
// Evita salti enormi se la scheda resta in background o il frame si blocca.
const MAX_STEP_SECONDS = 0.1;

/** Un jolly ha value 0: non toglie punti se tocca terra e si abbina a qualunque numero. */
export type FallingNumber = { id: number; value: number; lane: number; y: number; jolly?: boolean };

export type GameEvent =
  | { type: 'match'; ids: number[]; sum: number; lane: number; y: number }
  | { type: 'mismatch'; ids: number[] }
  | { type: 'landed'; id: number; value: number; lane: number };

export type GameVariant = {
  /** Valori che possono cadere. */
  values: number[];
  startBonus: number;
  /** Quanti numeri si possono selezionare al massimo per formare un gruppo. */
  maxPicks: number;
  /** I numeri selezionati formano un gruppo valido. */
  isMatch: (values: number[]) => boolean;
  /** Ha senso aggiungere un altro numero alla selezione (che ancora non e' valida). */
  canExtend: (values: number[]) => boolean;
  /**
   * Probabilita' che un nuovo numero formi una coppia valida con uno gia' in campo:
   * evita che il campo si riempia di numeri impossibili da abbinare.
   */
  complementChance: number;
  /** Probabilita' che il nuovo elemento sia un jolly (0 = nessun jolly). */
  jollyChance: number;
  /**
   * Totale del gruppo quando i numeri selezionati sono completati da un jolly,
   * oppure null se il jolly non puo' completarli.
   */
  completeWithJolly: (values: number[]) => number | null;
  /** Punti guadagnati con un gruppo valido, dato il suo totale e quante carte contiene. */
  points: (total: number, cards: number) => number;
  /** Bonus da raggiungere per vincere (assente = si gioca finche' il bonus non finisce). */
  winBonus?: number;
};

const sumOf = (values: number[]) => values.reduce((total, value) => total + value, 0);

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

export type VariantId = 'rain' | 'friends';

export const VARIANTS: Record<VariantId, GameVariant> = {
  // Niente multipli di 10: il gruppo si forma solo combinando le unita' (es. 37 + 23).
  rain: {
    values: range(1, 99).filter((value) => value % 10 !== 0),
    startBonus: 100,
    maxPicks: 3,
    isMatch: (values) => values.length >= 2 && sumOf(values) % 10 === 0,
    // Con due numeri che non fanno un multiplo di 10, un terzo puo' sempre sistemare la somma.
    canExtend: () => true,
    complementChance: 0.4,
    jollyChance: 0.08,
    // Il jolly porta la somma al multiplo di 10 successivo (37 + jolly = 40, 31 + 12 + jolly = 50).
    completeWithJolly: (values) => Math.max(10, Math.ceil(sumOf(values) / 10) * 10),
    // Con tre carte (jolly compreso) la somma vale doppio.
    points: (total, cards) => (cards > 2 ? total * 2 : total),
    winBonus: 300,
  },
  // Amici del 10: due o tre numeri da 1 a 9, generati a caso, che insieme fanno esattamente 10.
  friends: {
    values: range(1, 9),
    startBonus: 50,
    maxPicks: 3,
    isMatch: (values) => values.length >= 2 && sumOf(values) === 10,
    canExtend: (values) => sumOf(values) < 10,
    complementChance: 0,
    jollyChance: 0.08,
    // Il jolly vale quanto manca per arrivare a 10 (6 + jolly = 10, 2 + 3 + jolly = 10).
    completeWithJolly: (values) => (sumOf(values) < 10 ? 10 : null),
    // Fare 10 con piu' di due carte (jolly compreso) vale doppio.
    points: (total, cards) => (cards > 2 ? total * 2 : total),
    winBonus: 100,
  },
};

export class NumberRainGame {
  bonus: number;
  elapsed = 0;
  pairs = 0;
  numbers: FallingNumber[] = [];
  selectedIds: number[] = [];
  isOver = false;
  isWon = false;

  private nextId = 1;
  private spawnTimer = 0;

  constructor(
    private readonly variant: GameVariant = VARIANTS.rain,
    private readonly random: () => number = Math.random,
  ) {
    this.bonus = variant.startBonus;
  }

  get level(): number {
    return 1 + Math.floor(this.elapsed / LEVEL_SECONDS);
  }

  /** Frazione dell'altezza del campo percorsa in un secondo. */
  get fallSpeed(): number {
    return 0.07 * 1.15 ** (this.level - 1);
  }

  get spawnInterval(): number {
    return Math.max(0.7, 2 - (this.level - 1) * 0.25);
  }

  tick(seconds: number): GameEvent[] {
    if (this.isOver) {
      return [];
    }
    const step = Math.min(Math.max(seconds, 0), MAX_STEP_SECONDS);
    const events: GameEvent[] = [];
    this.elapsed += step;

    for (const number of this.numbers) {
      number.y += this.fallSpeed * step;
    }
    for (const number of this.numbers.filter((item) => item.y >= 1)) {
      this.remove(number.id);
      this.bonus -= number.value;
      events.push({ type: 'landed', id: number.id, value: number.value, lane: number.lane });
    }
    if (this.bonus <= 0) {
      this.bonus = 0;
      this.isOver = true;
      return events;
    }

    this.spawnTimer -= step;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawn() ? this.spawnInterval : 0.1;
    }
    return events;
  }

  /** Elementi selezionati (jolly compresi), nell'ordine in cui sono stati toccati. */
  get selectedNumbers(): FallingNumber[] {
    return this.selectedIds.map((id) => this.numbers.find((item) => item.id === id)!);
  }

  /** Valori dei numeri selezionati, esclusi i jolly. */
  get selectedValues(): number[] {
    return this.selectedNumbers.filter((item) => !item.jolly).map((item) => item.value);
  }

  select(id: number): GameEvent | null {
    const number = this.numbers.find((item) => item.id === id);
    if (this.isOver || number === undefined) {
      return null;
    }
    if (this.selectedIds.includes(id)) {
      this.selectedIds = this.selectedIds.filter((selected) => selected !== id);
      return null;
    }

    this.selectedIds = [...this.selectedIds, id];
    const ids = this.selectedIds;
    const values = this.selectedValues;
    const hasJolly = this.selectedNumbers.some((item) => item.jolly);
    if (ids.length < 2) {
      return null;
    }
    const total = hasJolly ? this.variant.completeWithJolly(values) : this.variant.isMatch(values) ? sumOf(values) : null;
    if (total !== null) {
      const points = this.variant.points(total, ids.length);
      ids.forEach((selected) => this.remove(selected));
      this.bonus += points;
      this.pairs += 1;
      if (this.variant.winBonus !== undefined && this.bonus >= this.variant.winBonus) {
        this.isWon = true;
        this.isOver = true;
      }
      return { type: 'match', ids, sum: points, lane: number.lane, y: number.y };
    }
    if (!hasJolly && ids.length < this.variant.maxPicks && this.variant.canExtend(values)) {
      return null;
    }
    this.selectedIds = [];
    return { type: 'mismatch', ids };
  }

  private spawn(): boolean {
    const freeLanes = Array.from({ length: LANES }, (_, lane) => lane).filter(
      (lane) => !this.numbers.some((item) => item.lane === lane && item.y < LANE_CLEARANCE),
    );
    if (freeLanes.length === 0) {
      return false;
    }
    const lane = this.pick(freeLanes);
    if (this.random() < this.variant.jollyChance) {
      this.numbers.push({ id: this.nextId++, value: 0, lane, y: 0, jolly: true });
    } else {
      this.numbers.push({ id: this.nextId++, value: this.nextValue(), lane, y: 0 });
    }
    return true;
  }

  private nextValue(): number {
    const partners = this.numbers.filter((item) => !item.jolly);
    if (partners.length > 0 && this.random() < this.variant.complementChance) {
      const partner = this.pick(partners).value;
      return this.pick(this.variant.values.filter((value) => this.variant.isMatch([partner, value])));
    }
    return this.pick(this.variant.values);
  }

  private pick<T>(items: T[]): T {
    return items[Math.min(items.length - 1, Math.floor(this.random() * items.length))];
  }

  private remove(id: number): void {
    this.numbers = this.numbers.filter((item) => item.id !== id);
    this.selectedIds = this.selectedIds.filter((selected) => selected !== id);
  }
}
