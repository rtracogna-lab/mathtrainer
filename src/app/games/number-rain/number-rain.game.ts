export const LANES = 6;
export const LEVEL_SECONDS = 30;

// Un nuovo numero non nasce in una colonna in cui l'ultimo e' ancora troppo in alto.
const LANE_CLEARANCE = 0.15;
// Frazione dell'altezza del campo percorsa in un secondo al primo livello (0.055: circa 18 secondi per arrivare a terra).
const BASE_FALL_SPEED = 0.055;
// Evita salti enormi se la scheda resta in background o il frame si blocca.
const MAX_STEP_SECONDS = 0.1;
// Modalita' facile: quanto aumenta la probabilita' di numeri utili (fino a un massimo).
const EASY_EXTRA_CHANCE = 0.3;
const MAX_USEFUL_CHANCE = 0.9;
// Nei giochi con bersaglio, quante volte un numero utile e' il compagno di uno gia' in campo.
const PARTNER_CHANCE = 0.5;

export type GameOptions = {
  /** Modalita' facile: cadono piu' numeri utili. */
  easy?: boolean;
};

/** Un jolly ha value 0: non toglie punti se tocca terra e si abbina a qualunque numero. */
export type FallingNumber = { id: number; value: number; lane: number; y: number; jolly?: boolean };

export type GameEvent =
  | { type: 'match'; ids: number[]; sum: number; lane: number; y: number }
  | { type: 'mismatch'; ids: number[] }
  | { type: 'landed'; id: number; value: number; penalty: number; lane: number };

type Random = () => number;

export type GameVariant = {
  /** Valori che possono cadere. */
  values: number[];
  startBonus: number;
  /** Quanti numeri si possono selezionare al massimo per formare un gruppo. */
  maxPicks: number;
  /** Simbolo dell'operazione, usato per mostrare la selezione (es. 3 × 8). */
  operator: '+' | '−' | '×' | ':';
  /** Risultato dell'operazione sui numeri selezionati, o null se non e' un numero intero. */
  combine: (values: number[]) => number | null;
  /** I numeri selezionati formano un gruppo valido (target: bersaglio corrente, se il gioco ne ha uno). */
  isMatch: (values: number[], target?: number | null) => boolean;
  /** Ha senso aggiungere un altro numero alla selezione (che ancora non e' valida). */
  canExtend: (values: number[], target?: number | null) => boolean;
  /**
   * Probabilita' che un nuovo numero sia "utile": forma un gruppo valido con uno gia' in campo
   * oppure, nei giochi con bersaglio, serve per colpire il bersaglio corrente.
   */
  complementChance: number;
  /** Probabilita' che il nuovo elemento sia un jolly (0 = nessun jolly). */
  jollyChance: number;
  /**
   * Totale del gruppo quando i numeri selezionati sono completati da un jolly,
   * oppure null se il jolly non puo' completarli.
   */
  completeWithJolly: (values: number[], target?: number | null) => number | null;
  /** Punti guadagnati con un gruppo valido, dato il suo totale e quante carte contiene. */
  points: (total: number, cards: number) => number;
  /** Punti persi quando un numero tocca terra. */
  penalty: (value: number) => number;
  /** Bonus da raggiungere per vincere (assente = si gioca finche' il bonus non finisce). */
  winBonus?: number;
  /** Moltiplica la velocita' di caduta (es. 0.7 = numeri piu' lenti, per i giochi che fanno ragionare di piu'). */
  speedFactor?: number;
  /** Giochi con bersaglio: sceglie il prossimo bersaglio, diverso dal precedente. */
  nextTarget?: (random: Random, level: number, previous: number | null) => number;
  /** Giochi con bersaglio: un numero che serve per colpire il bersaglio indicato. */
  usefulValue?: (target: number, random: Random, level: number) => number;
};

/** Un numero che tocca terra toglie meta' del suo valore, arrotondata per difetto (7 → 3). */
const half = (value: number) => Math.floor(value / 2);
/** Nei giochi con bersaglio la penalita' non supera mai questo valore (i dividendi arrivano a 100). */
const MAX_TARGET_PENALTY = 3;

const sumOf = (values: number[]) => values.reduce((total, value) => total + value, 0);
const productOf = (values: number[]) => values.reduce((total, value) => total * value, 1);

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

function pickWith<T>(random: Random, items: T[]): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

function pickTarget(random: Random, candidates: number[], previous: number | null): number {
  const others = candidates.filter((value) => value !== previous);
  return pickWith(random, others.length > 0 ? others : candidates);
}

/** Massimo fattore usato per prodotti e divisioni: al primo livello solo tabelline facili. */
const maxFactor = (level: number) => (level <= 1 ? 6 : 10);

/** Prodotti a × b con fattori da 2 a max (es. 12, 24, 56...). */
function products(max: number): number[] {
  const values = new Set<number>();
  for (const first of range(2, max)) {
    for (const second of range(first, max)) {
      values.add(first * second);
    }
  }
  return [...values].sort((a, b) => a - b);
}

const FACTORS = range(2, 10);

/** Il numero piu' grande meno tutti gli altri (20 − 7 − 3 = 10). */
function difference(values: number[]): number {
  const [largest, ...rest] = [...values].sort((a, b) => b - a);
  return (largest ?? 0) - sumOf(rest);
}

/** Valore massimo dei numeri che cadono nella sottrazione bersaglio. */
const SUBTRACTION_MAX = 30;

/** Risultato della divisione del numero piu' grande per il piu' piccolo, se esatta. */
function quotient(values: number[]): number | null {
  if (values.length !== 2) {
    return null;
  }
  const [divisor, dividend] = [...values].sort((a, b) => a - b);
  return dividend % divisor === 0 ? dividend / divisor : null;
}

export type VariantId = 'rain' | 'friends' | 'product' | 'division' | 'subtraction';

export const VARIANTS: Record<VariantId, GameVariant> = {
  // Niente multipli di 10: il gruppo si forma solo combinando le unita' (es. 37 + 23).
  rain: {
    values: range(1, 99).filter((value) => value % 10 !== 0),
    startBonus: 100,
    maxPicks: 3,
    operator: '+',
    combine: sumOf,
    isMatch: (values) => values.length >= 2 && sumOf(values) % 10 === 0,
    // Con due numeri che non fanno un multiplo di 10, un terzo puo' sempre sistemare la somma.
    canExtend: () => true,
    complementChance: 0.4,
    jollyChance: 0.08,
    // Il jolly porta la somma al multiplo di 10 successivo (37 + jolly = 40, 31 + 12 + jolly = 50).
    completeWithJolly: (values) => Math.max(10, Math.ceil(sumOf(values) / 10) * 10),
    // Con tre carte (jolly compreso) la somma vale doppio.
    points: (total, cards) => (cards > 2 ? total * 2 : total),
    penalty: half,
    winBonus: 300,
  },
  // Amici del 10: due o tre numeri da 1 a 9, generati a caso, che insieme fanno esattamente 10.
  friends: {
    values: range(1, 9),
    startBonus: 50,
    maxPicks: 3,
    operator: '+',
    combine: sumOf,
    isMatch: (values) => values.length >= 2 && sumOf(values) === 10,
    canExtend: (values) => sumOf(values) < 10,
    complementChance: 0,
    jollyChance: 0.08,
    // Il jolly vale quanto manca per arrivare a 10 (6 + jolly = 10, 2 + 3 + jolly = 10).
    completeWithJolly: (values) => (sumOf(values) < 10 ? 10 : null),
    // Fare 10 con piu' di due carte (jolly compreso) vale doppio.
    points: (total, cards) => (cards > 2 ? total * 2 : total),
    penalty: half,
    winBonus: 100,
  },
  // Prodotto bersaglio: due o tre fattori da 2 a 10 il cui prodotto e' il bersaglio (3 × 8 = 24, 2 × 3 × 4 = 24).
  product: {
    values: FACTORS,
    startBonus: 50,
    maxPicks: 3,
    operator: '×',
    combine: productOf,
    isMatch: (values, target) => values.length >= 2 && productOf(values) === target,
    // Un terzo fattore ha senso solo se il prodotto parziale divide ancora il bersaglio.
    canExtend: (values, target) => target != null && productOf(values) < target && target % productOf(values) === 0,
    complementChance: 0.5,
    jollyChance: 0.08,
    // Il jolly vale il fattore mancante, se e' un numero da 2 a 10 (6 × jolly = 24: il jolly vale 4).
    completeWithJolly: (values, target) => {
      const missing = target == null ? 0 : target / productOf(values);
      return target != null && Number.isInteger(missing) && missing >= 2 && missing <= 10 ? target : null;
    },
    points: (_total, cards) => (cards > 2 ? 20 : 10),
    penalty: (value) => Math.min(MAX_TARGET_PENALTY, half(value)),
    winBonus: 100,
    speedFactor: 0.55,
    nextTarget: (random, level, previous) => pickTarget(random, products(maxFactor(level)), previous),
    // Un fattore del bersaglio che ha un "compagno" tra 2 e 10 (per 24: 3, 4, 6 o 8).
    usefulValue: (target, random) =>
      pickWith(random, FACTORS.filter((factor) => target % factor === 0 && FACTORS.includes(target / factor))),
  },
  // Divisione bersaglio: un dividendo e un divisore il cui quoziente e' il bersaglio (42 : 7 = 6).
  division: {
    values: [...new Set([...FACTORS, ...products(10)])].sort((a, b) => a - b),
    startBonus: 50,
    maxPicks: 2,
    operator: ':',
    combine: quotient,
    isMatch: (values, target) => quotient(values) === target,
    canExtend: () => false,
    complementChance: 0.6,
    jollyChance: 0.08,
    // Il jolly fa da divisore (42 : jolly = 6) o da dividendo (jolly : 7 = 6), se il risultato e' possibile.
    completeWithJolly: (values, target) => {
      if (target == null || values.length > 1) {
        return null;
      }
      if (values.length === 0) {
        return target;
      }
      const [value] = values;
      const asDividend = value % target === 0 && value / target >= 2;
      const asDivisor = value <= 10 && value * target <= 100;
      return asDividend || asDivisor ? target : null;
    },
    points: () => 10,
    penalty: (value) => Math.min(MAX_TARGET_PENALTY, half(value)),
    winBonus: 100,
    speedFactor: 0.55,
    nextTarget: (random, level, previous) => pickTarget(random, range(2, maxFactor(level) <= 6 ? 5 : 10), previous),
    // Meta' di una divisione giusta: il divisore (7) o il dividendo (42) per il bersaglio 6.
    usefulValue: (target, random, level) => {
      const divisor = pickWith(random, range(2, maxFactor(level)));
      return random() < 0.5 ? divisor : divisor * target;
    },
  },
  // Sottrazione bersaglio: il numero piu' grande meno gli altri fa il bersaglio (13 − 7 = 6, 20 − 7 − 3 = 10).
  subtraction: {
    values: range(1, SUBTRACTION_MAX),
    startBonus: 50,
    maxPicks: 3,
    operator: '−',
    combine: difference,
    isMatch: (values, target) => values.length >= 2 && difference(values) === target,
    // Un terzo numero ha senso solo se c'e' ancora qualcosa da togliere per arrivare al bersaglio.
    canExtend: (values, target) => target != null && difference(values) > target,
    complementChance: 0.6,
    jollyChance: 0.08,
    // Il jolly e' il numero che manca: con un numero fa da minuendo o sottraendo (13 − jolly = 6),
    // con due numeri toglie quello che resta (20 − 7 − jolly = 10).
    completeWithJolly: (values, target) => {
      if (target == null || values.length > 2) {
        return null;
      }
      return values.length < 2 || difference(values) > target ? target : null;
    },
    points: (_total, cards) => (cards > 2 ? 20 : 10),
    penalty: (value) => Math.min(MAX_TARGET_PENALTY, half(value)),
    winBonus: 100,
    speedFactor: 0.55,
    nextTarget: (random, level, previous) => pickTarget(random, range(2, level <= 1 ? 10 : 20), previous),
    // Meta' di una sottrazione giusta: il sottraendo (7) o il minuendo (13) per il bersaglio 6.
    usefulValue: (target, random) => {
      const subtrahend = pickWith(random, range(1, SUBTRACTION_MAX - target));
      return random() < 0.5 ? subtrahend : subtrahend + target;
    },
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
  /** Bersaglio corrente, solo per i giochi che ne hanno uno. */
  target: number | null;

  private nextId = 1;
  private spawnTimer = 0;

  /** Probabilita' che un nuovo numero sia utile (piu' alta in modalita' facile). */
  readonly usefulChance: number;

  constructor(
    private readonly variant: GameVariant = VARIANTS.rain,
    private readonly random: Random = Math.random,
    options: GameOptions = {},
  ) {
    this.bonus = variant.startBonus;
    this.target = variant.nextTarget?.(random, 1, null) ?? null;
    this.usefulChance = options.easy
      ? Math.min(MAX_USEFUL_CHANCE, variant.complementChance + EASY_EXTRA_CHANCE)
      : variant.complementChance;
  }

  get level(): number {
    return 1 + Math.floor(this.elapsed / LEVEL_SECONDS);
  }

  /** Frazione dell'altezza del campo percorsa in un secondo. */
  get fallSpeed(): number {
    return BASE_FALL_SPEED * 1.15 ** (this.level - 1) * (this.variant.speedFactor ?? 1);
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
      const penalty = number.jolly ? 0 : this.variant.penalty(number.value);
      this.remove(number.id);
      this.bonus -= penalty;
      events.push({ type: 'landed', id: number.id, value: number.value, penalty, lane: number.lane });
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
    const total = hasJolly
      ? this.variant.completeWithJolly(values, this.target)
      : this.variant.isMatch(values, this.target)
        ? this.variant.combine(values)
        : null;
    if (total !== null) {
      const points = this.variant.points(total, ids.length);
      ids.forEach((selected) => this.remove(selected));
      this.bonus += points;
      this.pairs += 1;
      if (this.variant.nextTarget !== undefined) {
        this.target = this.variant.nextTarget(this.random, this.level, this.target);
      }
      if (this.variant.winBonus !== undefined && this.bonus >= this.variant.winBonus) {
        this.isWon = true;
        this.isOver = true;
      }
      return { type: 'match', ids, sum: points, lane: number.lane, y: number.y };
    }
    if (!hasJolly && ids.length < this.variant.maxPicks && this.variant.canExtend(values, this.target)) {
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
    if (this.variant.usefulValue !== undefined && this.target !== null) {
      if (this.random() >= this.usefulChance) {
        return this.pick(this.variant.values);
      }
      // Meglio ancora del numero utile: il compagno esatto di un numero gia' in campo.
      const partners = this.partnersInField(this.target);
      return partners.length > 0 && this.random() < PARTNER_CHANCE
        ? this.pick(partners)
        : this.variant.usefulValue(this.target, this.random, this.level);
    }
    const partners = this.numbers.filter((item) => !item.jolly);
    if (partners.length > 0 && this.random() < this.usefulChance) {
      const partner = this.pick(partners).value;
      return this.pick(this.variant.values.filter((value) => this.variant.isMatch([partner, value], this.target)));
    }
    return this.pick(this.variant.values);
  }

  /** Valori che formerebbero subito una coppia valida con un numero gia' in campo. */
  private partnersInField(target: number): number[] {
    return this.numbers
      .filter((item) => !item.jolly)
      .flatMap((item) => this.variant.values.filter((value) => this.variant.isMatch([item.value, value], target)));
  }

  private pick<T>(items: T[]): T {
    return pickWith(this.random, items);
  }

  private remove(id: number): void {
    this.numbers = this.numbers.filter((item) => item.id !== id);
    this.selectedIds = this.selectedIds.filter((selected) => selected !== id);
  }
}
