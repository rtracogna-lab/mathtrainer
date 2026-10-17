import { computed, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'mathTrainer.factStats';
const PLAYED_KEY = 'mathTrainer.reviewGamesPlayed';
/** Una risposta sbagliata pesa come due giuste: per "imparare" un errore bisogna rispondere giusto piu' volte. */
const WRONG_WEIGHT = 2;
/** Punteggio da cui una tabellina si considera imparata. */
const KNOWN_STRENGTH = 3;

export type FactStat = { right: number; wrong: number };
export type FactStatus = 'new' | 'weak' | 'learning' | 'known';
export type Fact = { first: number; second: number };

export type ReviewGameId = 'tables' | 'grid' | 'missing' | 'battleship';
export type ReviewGame = { id: ReviewGameId; name: string; description: string; symbol: string; route: string };

/** Giochi che alimentano il ripasso finale: vanno finiti tutti almeno una volta per sbloccarlo. */
export const REVIEW_GAMES: ReviewGame[] = [
  { id: 'tables', name: 'Tabelline', description: 'Dieci tabelline da scrivere o scegliere', symbol: '×', route: '/tabelline' },
  { id: 'grid', name: 'La griglia a buchi', description: 'Riempi le caselle vuote della tavola pitagorica', symbol: '▦', route: '/griglia-a-buchi' },
  { id: 'missing', name: 'Fattore mancante', description: 'Trova il numero che manca: 7 × ? = 56', symbol: '?', route: '/fattore-mancante' },
  { id: 'battleship', name: 'Battaglia navale', description: 'Spara risolvendo le tabelline e affonda la flotta', symbol: '⚓', route: '/battaglia-navale' },
];

/** 3 × 7 e 7 × 3 sono la stessa tabellina: si salvano sotto la stessa chiave. */
export function factKey(first: number, second: number): string {
  return first <= second ? `${first}x${second}` : `${second}x${first}`;
}

export function factStatus(stat: FactStat | undefined): FactStatus {
  if (stat === undefined) {
    return 'new';
  }
  const strength = stat.right - WRONG_WEIGHT * stat.wrong;
  return strength < 0 ? 'weak' : strength < KNOWN_STRENGTH ? 'learning' : 'known';
}

/** Ricorda, nel browser, quali tabelline sono state sbagliate e quali indovinate. */
@Injectable({ providedIn: 'root' })
export class FactStats {
  readonly stats = signal<Record<string, FactStat>>(this.load(STORAGE_KEY, {}));
  /** Giochi del ripasso finiti almeno una volta. */
  readonly played = signal<ReviewGameId[]>(this.load(PLAYED_KEY, []));
  readonly missingGames = computed(() => REVIEW_GAMES.filter((game) => !this.played().includes(game.id)));

  markPlayed(id: ReviewGameId): void {
    if (!this.played().includes(id)) {
      this.played.update((played) => [...played, id]);
      this.save(PLAYED_KEY, this.played());
    }
  }

  record(first: number, second: number, correct: boolean): void {
    if (first < 1 || second < 1 || first > 10 || second > 10) {
      return;
    }
    const key = factKey(first, second);
    this.stats.update((stats) => {
      const stat = stats[key] ?? { right: 0, wrong: 0 };
      return { ...stats, [key]: correct ? { ...stat, right: stat.right + 1 } : { ...stat, wrong: stat.wrong + 1 } };
    });
    this.save(STORAGE_KEY, this.stats());
  }

  status(first: number, second: number): FactStatus {
    return factStatus(this.stats()[factKey(first, second)]);
  }

  /** Cancella tutto, anche i giochi fatti: il ripasso finale torna bloccato. */
  reset(): void {
    this.stats.set({});
    this.played.set([]);
    this.save(STORAGE_KEY, {});
    this.save(PLAYED_KEY, []);
  }

  /**
   * Domande per il ripasso: prima le tabelline sbagliate, poi quelle in via di apprendimento,
   * poi le piu' difficili mai viste (6, 7, 8, 9) e infine le altre.
   */
  reviewQuestions(count: number, random: () => number = Math.random): Fact[] {
    const facts: { fact: Fact; priority: number }[] = [];
    for (let first = 2; first <= 10; first += 1) {
      for (let second = first; second <= 10; second += 1) {
        const status = this.status(first, second);
        const hard = first >= 6 && second >= 6 && second <= 9;
        const priority = status === 'weak' ? 0 : status === 'learning' ? 1 : status === 'new' ? (hard ? 2 : 3) : 4;
        facts.push({ fact: { first, second }, priority: priority + random() * 0.9 });
      }
    }
    return facts
      .sort((a, b) => a.priority - b.priority)
      .slice(0, count)
      .map(({ fact }) => (random() < 0.5 ? fact : { first: fact.second, second: fact.first }));
  }

  private load<T>(key: string, fallback: T): T {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : (JSON.parse(stored) ?? fallback);
    } catch {
      return fallback;
    }
  }

  private save(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Senza localStorage (navigazione privata) il ripasso vale solo per questa sessione.
    }
  }
}
