export const LANES = 6;
export const LEVEL_SECONDS = 30;

// Un nuovo numero non nasce in una colonna in cui l'ultimo e' ancora troppo in alto.
const LANE_CLEARANCE = 0.15;
// Frazione dell'altezza del campo percorsa in un secondo al primo livello (0.055: circa 18 secondi per arrivare a terra).
const BASE_FALL_SPEED = 0.055;
// Evita salti enormi se la scheda resta in background o il frame si blocca.
const MAX_STEP_SECONDS = 0.1;
// Modalita' facile: quanto aumenta la probabilita' di numeri utili (fino a un massimo).
const EASY_EXTRA_CHANCE = 0.35;
const MAX_USEFUL_CHANCE = 0.95;
// Nei giochi con bersaglio, quante volte un numero utile e' il compagno di uno gia' in campo.
const PARTNER_CHANCE = 0.5;
const EASY_PARTNER_CHANCE = 0.85;

/** Valore del nuovo numero e, in modalita' facile, il numero in campo vicino al quale farlo cadere. */
type Spawned = { value: number; anchor?: FallingNumber };

export type GameOptions = {
  /**
   * Modalita' facile: piu' numeri utili, compagni vicini al numero piu' recente
   * e, se la variante li prevede, bersagli piu' semplici (easyTargets).
   */
  easy?: boolean;
};

/** Un jolly ha value 0: non toglie punti se tocca terra e si abbina a qualunque numero. */
export type FallingNumber = { id: number; value: number; lane: number; y: number; jolly?: boolean };

export type GameEvent =
  | { type: 'match'; ids: number[]; sum: number; lane: number; y: number }
  /** penalty/lane/y solo nei giochi a tocco singolo, dove un tocco sbagliato costa punti. */
  | { type: 'mismatch'; ids: number[]; penalty?: number; lane?: number; y?: number }
  | { type: 'landed'; id: number; value: number; penalty: number; lane: number };

type Random = () => number;

/** Domanda mostrata sopra il campo (es. "60 × 2 = ?"), con la risposta giusta e quelle sbagliate tipiche. */
export type Question = { text: string; answer: number; distractors: number[] };

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
  /** Modalita' facile: probabilita' di un jolly (assente = jollyChance). */
  easyJollyChance?: number;
  /**
   * Totale del gruppo quando i numeri selezionati sono completati da un jolly,
   * oppure null se il jolly non puo' completarli.
   */
  completeWithJolly: (values: number[], target?: number | null) => number | null;
  /** Punti guadagnati con un gruppo valido, dato il suo totale e quante carte contiene. */
  points: (total: number, cards: number) => number;
  /** Punti persi quando un numero tocca terra (target: bersaglio corrente). */
  penalty: (value: number, target?: number | null) => number;
  /** Bonus da raggiungere per vincere (assente = si gioca finche' il bonus non finisce). */
  winBonus?: number;
  /** Moltiplica la velocita' di caduta (es. 0.7 = numeri piu' lenti, per i giochi che fanno ragionare di piu'). */
  speedFactor?: number;
  /** Giochi con bersaglio: sceglie il prossimo bersaglio, diverso dal precedente. */
  nextTarget?: (random: Random, level: number, previous: number | null) => number;
  /** Giochi con bersaglio: un numero che serve per colpire il bersaglio indicato. */
  usefulValue?: (target: number, random: Random, level: number) => number;
  /** Modalita' facile: bersagli tra cui scegliere sempre, a ogni livello (assente = come in modalita' difficile). */
  easyTargets?: number[];
  /** Gioco a tocco singolo: ogni numero toccato si valuta da solo (es. "e' un multiplo del 7?"). */
  singleTap?: boolean;
  /** Tocco singolo: punti persi toccando un numero sbagliato. */
  wrongTapPenalty?: number;
  /** Quanti centri servono prima che cambi il bersaglio (assente = cambia a ogni centro). */
  hitsPerTarget?: number;
  /** Modalita' facile: quanto aumenta la probabilita' di numeri utili (assente = EASY_EXTRA_CHANCE). */
  easyExtraChance?: number;
  /** Giochi con bersaglio: numero casuale da far cadere quando non serve un numero utile (assente = uno di values). */
  randomValue?: (target: number, random: Random, level: number) => number;
  /**
   * Giochi a domanda: genera la prossima domanda. Il bersaglio diventa la risposta giusta
   * e i numeri "non utili" che cadono sono le risposte sbagliate della domanda.
   */
  nextQuestion?: (random: Random, level: number, easy: boolean) => Question;
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

export type VariantId = 'rain' | 'friends' | 'product' | 'division' | 'subtraction' | 'multiples' | 'zeros';

/** Caccia ai multipli: punti per ogni multiplo preso (con il jolly, per ciascun multiplo catturato). */
const MULTIPLE_POINTS = 5;
/** Caccia ai multipli: il bersaglio (la tabellina) cambia dopo questi multipli presi. */
const MULTIPLES_PER_TABLE = 8;
const isMultiple = (value: number, target?: number | null) => target != null && value % target === 0;

/** Quanti zeri ha in fondo un numero (120 → 1, 600 → 2, 12 → 0). */
function trailingZeros(value: number): number {
  let zeros = 0;
  while (value !== 0 && value % 10 === 0) {
    value /= 10;
    zeros += 1;
  }
  return zeros;
}

/**
 * Risposte sbagliate tipiche per un'operazione con gli zeri:
 * uno zero in meno (12) o in piu' (1200), la tabellina sbagliata di uno (110, 130)
 * e i risultati delle operazioni sbagliate passate in wrongOperations (60 + 2 = 62).
 */
function zerosDistractors(answer: number, wrongOperations: number[]): number[] {
  const step = 10 ** trailingZeros(answer);
  const candidates = [answer / 10, answer * 10, answer - step, answer + step, ...wrongOperations];
  return [...new Set(candidates)].filter((value) => Number.isInteger(value) && value > 0 && value !== answer);
}

/**
 * Conta gli zeri: moltiplicazioni e divisioni con decine e centinaia (60 × 2, 600 : 3).
 * Facile: solo decine per un numero a una cifra. Difficile: anche centinaia e decine per decine (20 × 30).
 */
function zerosQuestion(random: Random, _level: number, easy: boolean): Question {
  const a = pickWith(random, range(2, 9));
  const b = pickWith(random, range(2, 9));
  const pattern = easy ? 'tens' : pickWith(random, ['tens', 'hundreds', 'tensByTens']);
  const [first, second] = pattern === 'tens' ? [a * 10, b] : pattern === 'hundreds' ? [a * 100, b] : [a * 10, b * 10];
  const product = first * second;
  if (random() < 0.5) {
    const [left, right] = random() < 0.5 ? [first, second] : [second, first];
    return { text: `${left} × ${right} = ?`, answer: product, distractors: zerosDistractors(product, [left + right, Math.abs(left - right)]) };
  }
  // La divisione e' la moltiplicazione al contrario: 120 : 2 = 60 oppure 120 : 60 = 2.
  const [divisor, quotient] = random() < 0.5 ? [second, first] : [first, second];
  return { text: `${product} : ${divisor} = ?`, answer: quotient, distractors: zerosDistractors(quotient, [product - divisor]) };
}

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
    // In facile i numeri utili salgono solo al 70%: con l'aumento standard (95%) quasi ogni numero colpirebbe il bersaglio.
    easyExtraChance: 0.1,
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
    easyTargets: range(1, 10),
    // Meta' di una sottrazione giusta: il sottraendo (7) o il minuendo (13) per il bersaglio 6.
    usefulValue: (target, random) => {
      const subtrahend = pickWith(random, range(1, SUBTRACTION_MAX - target));
      return random() < 0.5 ? subtrahend : subtrahend + target;
    },
  },
  // Caccia ai multipli: si tocca un numero alla volta, solo se e' un multiplo del bersaglio (7: 14, 35, 63...).
  multiples: {
    values: range(1, 100),
    startBonus: 50,
    maxPicks: 1,
    operator: '×',
    combine: (values) => values[0] ?? null,
    isMatch: (values, target) => values.length === 1 && isMultiple(values[0], target),
    canExtend: () => false,
    complementChance: 0.5,
    jollyChance: 0.06,
    // Il jolly non completa un gruppo: cattura tutti i multipli in campo (vedi tap).
    completeWithJolly: () => null,
    points: (_total, cards) => MULTIPLE_POINTS * Math.max(1, cards),
    // Solo i multipli lasciati cadere costano punti: gli intrusi vanno lasciati andare.
    penalty: (value, target) => (isMultiple(value, target) ? MAX_TARGET_PENALTY : 0),
    winBonus: 100,
    speedFactor: 0.7,
    singleTap: true,
    wrongTapPenalty: 5,
    hitsPerTarget: MULTIPLES_PER_TABLE,
    // In facile i multipli sono circa 2 su 3: con l'aumento standard cadrebbero quasi solo multipli.
    easyExtraChance: 0.15,
    nextTarget: (random, _level, previous) => pickTarget(random, FACTORS, previous),
    easyTargets: [2, 3, 4, 5, 10],
    // Un multiplo della tabellina: da 1 × 7 a 10 × 7.
    usefulValue: (target, random) => target * pickWith(random, range(1, 10)),
    // Un numero qualunque fino a 10 volte la tabellina: quasi sempre un intruso.
    randomValue: (target, random) => pickWith(random, range(1, target * 10)),
  },
  // Conta gli zeri: si tocca il risultato giusto di 60 × 2 o 600 : 3, evitando 12, 1200, 62...
  zeros: {
    values: [],
    startBonus: 50,
    maxPicks: 1,
    operator: '×',
    combine: (values) => values[0] ?? null,
    isMatch: (values, target) => values.length === 1 && values[0] === target,
    canExtend: () => false,
    // Circa un numero su tre e' la risposta giusta, gli altri sono gli errori tipici.
    complementChance: 0.35,
    easyExtraChance: 0.15,
    jollyChance: 0.05,
    // In facile i jolly sono rari: il gioco deve allenare a contare gli zeri, non a prendere jolly.
    easyJollyChance: 0.02,
    completeWithJolly: () => null,
    points: (_total, cards) => 10 * Math.max(1, cards),
    penalty: (value, target) => (value === target ? MAX_TARGET_PENALTY : 0),
    winBonus: 100,
    speedFactor: 0.55,
    singleTap: true,
    wrongTapPenalty: 5,
    nextQuestion: zerosQuestion,
    // Il numero utile e' la risposta giusta; gli altri arrivano dalle risposte sbagliate della domanda.
    usefulValue: (target) => target,
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
  /** Bersaglio corrente, solo per i giochi che ne hanno uno (nei giochi a domanda: la risposta giusta). */
  target: number | null;
  /** Domanda corrente, solo per i giochi a domanda (vedi nextQuestion). */
  question: Question | null = null;

  private nextId = 1;
  private spawnTimer = 0;
  /** Centri fatti con il bersaglio corrente (vedi hitsPerTarget). */
  private targetHits = 0;

  /** Probabilita' che un nuovo numero sia utile (piu' alta in modalita' facile). */
  readonly usefulChance: number;
  private readonly easy: boolean;
  /** Probabilita' che il nuovo elemento sia un jolly (piu' bassa in facile, se la variante lo prevede). */
  private readonly jollyChance: number;

  constructor(
    private readonly variant: GameVariant = VARIANTS.rain,
    private readonly random: Random = Math.random,
    options: GameOptions = {},
  ) {
    this.easy = options.easy ?? false;
    this.jollyChance = this.easy ? (variant.easyJollyChance ?? variant.jollyChance) : variant.jollyChance;
    this.bonus = variant.startBonus;
    this.target = this.chooseTarget(null);
    this.usefulChance = this.easy
      ? Math.min(MAX_USEFUL_CHANCE, variant.complementChance + (variant.easyExtraChance ?? EASY_EXTRA_CHANCE))
      : variant.complementChance;
  }

  /** Prossimo bersaglio (null per i giochi senza bersaglio). */
  private chooseTarget(previous: number | null): number | null {
    if (this.variant.nextQuestion !== undefined) {
      // Una domanda nuova con una risposta diversa dalla precedente (bastano pochi tentativi).
      let question = this.variant.nextQuestion(this.random, this.level, this.easy);
      for (let attempt = 0; attempt < 5 && question.answer === previous; attempt += 1) {
        question = this.variant.nextQuestion(this.random, this.level, this.easy);
      }
      this.question = question;
      return question.answer;
    }
    if (this.easy && this.variant.easyTargets !== undefined) {
      return pickTarget(this.random, this.variant.easyTargets, previous);
    }
    return this.variant.nextTarget?.(this.random, this.level, previous) ?? null;
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
      const penalty = number.jolly ? 0 : this.variant.penalty(number.value, this.target);
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
    if (this.variant.singleTap) {
      return this.tap(number);
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
      this.addHits(points, 1);
      return { type: 'match', ids, sum: points, lane: number.lane, y: number.y };
    }
    if (!hasJolly && ids.length < this.variant.maxPicks && this.variant.canExtend(values, this.target)) {
      return null;
    }
    this.selectedIds = [];
    return { type: 'mismatch', ids };
  }

  /** Gioco a tocco singolo: un multiplo vale punti, un intruso li toglie, il jolly cattura tutti i multipli. */
  private tap(number: FallingNumber): GameEvent {
    if (number.jolly) {
      const caught = this.numbers.filter((item) => !item.jolly && this.variant.isMatch([item.value], this.target));
      const ids = [number.id, ...caught.map((item) => item.id)];
      const points = this.variant.points(0, caught.length);
      ids.forEach((id) => this.remove(id));
      this.addHits(points, caught.length);
      return { type: 'match', ids, sum: points, lane: number.lane, y: number.y };
    }
    this.remove(number.id);
    if (this.variant.isMatch([number.value], this.target)) {
      const points = this.variant.points(number.value, 1);
      this.addHits(points, 1);
      return { type: 'match', ids: [number.id], sum: points, lane: number.lane, y: number.y };
    }
    const penalty = this.variant.wrongTapPenalty ?? 0;
    this.bonus -= penalty;
    if (this.bonus <= 0) {
      this.bonus = 0;
      this.isOver = true;
    }
    return { type: 'mismatch', ids: [number.id], penalty, lane: number.lane, y: number.y };
  }

  /** Aggiunge i punti di un centro, cambia il bersaglio quando serve e controlla la vittoria. */
  private addHits(points: number, hits: number): void {
    this.bonus += points;
    this.pairs += hits;
    if (this.target !== null) {
      this.targetHits += Math.max(1, hits);
      if (this.targetHits >= (this.variant.hitsPerTarget ?? 1)) {
        this.targetHits = 0;
        this.target = this.chooseTarget(this.target);
      }
    }
    if (this.variant.winBonus !== undefined && this.bonus >= this.variant.winBonus) {
      this.isWon = true;
      this.isOver = true;
    }
  }

  private spawn(): boolean {
    const freeLanes = Array.from({ length: LANES }, (_, lane) => lane).filter(
      (lane) => !this.numbers.some((item) => item.lane === lane && item.y < LANE_CLEARANCE),
    );
    if (freeLanes.length === 0) {
      return false;
    }
    const lane = this.pick(freeLanes);
    if (this.random() < this.jollyChance) {
      this.numbers.push({ id: this.nextId++, value: 0, lane, y: 0, jolly: true });
    } else {
      const { value, anchor } = this.nextValue();
      // In modalita' facile il compagno cade nella colonna libera piu' vicina al suo numero.
      const nearLane = anchor === undefined ? lane : this.nearestLane(freeLanes, anchor.lane);
      this.numbers.push({ id: this.nextId++, value, lane: nearLane, y: 0 });
    }
    return true;
  }

  private nextValue(): Spawned {
    if (this.variant.usefulValue !== undefined && this.target !== null) {
      if (this.random() >= this.usefulChance) {
        if (this.question !== null && this.question.distractors.length > 0) {
          return { value: this.pick(this.question.distractors) };
        }
        const random = this.variant.randomValue?.(this.target, this.random, this.level);
        return { value: random ?? this.pick(this.variant.values) };
      }
      if (this.variant.singleTap) {
        return { value: this.variant.usefulValue(this.target, this.random, this.level) };
      }
      // Meglio ancora del numero utile: il compagno esatto di un numero gia' in campo.
      const partners = this.partnersInField(this.target);
      if (partners.length > 0 && this.random() < (this.easy ? EASY_PARTNER_CHANCE : PARTNER_CHANCE)) {
        return this.easy ? this.partnerOfNewest(partners) : { value: this.pick(partners.map((partner) => partner.value)) };
      }
      return { value: this.variant.usefulValue(this.target, this.random, this.level) };
    }
    const inField = this.numbers.filter((item) => !item.jolly);
    if (inField.length > 0 && this.random() < this.usefulChance) {
      const partner = this.easy ? this.newest(inField) : this.pick(inField);
      const value = this.pick(this.variant.values.filter((candidate) => this.variant.isMatch([partner.value, candidate], this.target)));
      return this.easy ? { value, anchor: partner } : { value };
    }
    return { value: this.pick(this.variant.values) };
  }

  /** Coppie (numero in campo, valore che lo completa) per il bersaglio indicato. */
  private partnersInField(target: number): { item: FallingNumber; value: number }[] {
    return this.numbers
      .filter((item) => !item.jolly)
      .flatMap((item) =>
        this.variant.values.filter((value) => this.variant.isMatch([item.value, value], target)).map((value) => ({ item, value })),
      );
  }

  /** Modalita' facile: il compagno del numero entrato per ultimo, cosi' i due cadono quasi alla stessa altezza. */
  private partnerOfNewest(partners: { item: FallingNumber; value: number }[]): Spawned {
    const anchor = this.newest(partners.map((partner) => partner.item));
    const values = partners.filter((partner) => partner.item === anchor).map((partner) => partner.value);
    return { value: this.pick(values), anchor };
  }

  /** Il numero piu' in alto, cioe' entrato in campo per ultimo. */
  private newest(items: FallingNumber[]): FallingNumber {
    return items.reduce((highest, item) => (item.y < highest.y ? item : highest));
  }

  /** La colonna libera piu' vicina a quella indicata (a parita' di distanza, una delle due a caso). */
  private nearestLane(freeLanes: number[], lane: number): number {
    const distance = Math.min(...freeLanes.map((free) => Math.abs(free - lane)));
    return this.pick(freeLanes.filter((free) => Math.abs(free - lane) === distance));
  }

  private pick<T>(items: T[]): T {
    return pickWith(this.random, items);
  }

  private remove(id: number): void {
    this.numbers = this.numbers.filter((item) => item.id !== id);
    this.selectedIds = this.selectedIds.filter((selected) => selected !== id);
  }
}
