import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Fact, FactStats, FactStatus, REVIEW_GAMES } from './fact-stats';

const QUESTIONS = 10;
const MAX_DIGITS = 3;

type Phase = 'map' | 'quiz' | 'done';
type Answered = Fact & { answer: number; correct: boolean };

@Component({
  selector: 'app-review',
  imports: [RouterLink],
  templateUrl: './review.html',
  styleUrls: ['../games/number-rain/number-rain.css', '../games/hole-grid/hole-grid.css', './review.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKeydown($event)' },
})
export class ReviewComponent {
  protected readonly factors = Array.from({ length: 10 }, (_, index) => index + 1);
  protected readonly keypad = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  protected readonly phase = signal<Phase>('map');
  protected readonly queue = signal<Fact[]>([]);
  protected readonly index = signal(0);
  protected readonly typed = signal('');
  protected readonly answered = signal<Answered[]>([]);
  /** Ultima risposta sbagliata, mostrata con la soluzione sotto la domanda successiva. */
  protected readonly mistake = signal<Answered | null>(null);
  protected readonly current = computed(() => this.queue()[this.index()] ?? null);
  protected readonly correctCount = computed(() => this.answered().filter((item) => item.correct).length);
  protected readonly counts = computed(() => {
    const counts: Record<FactStatus, number> = { new: 0, weak: 0, learning: 0, known: 0 };
    for (let first = 1; first <= 10; first += 1) {
      for (let second = first; second <= 10; second += 1) {
        counts[this.factStats.status(first, second)] += 1;
      }
    }
    return counts;
  });

  private readonly factStats = inject(FactStats);
  protected readonly reviewGames = REVIEW_GAMES;
  protected readonly played = this.factStats.played;
  /** Il ripasso si sblocca solo dopo aver finito tutti i giochi del percorso. */
  protected readonly locked = computed(() => this.factStats.missingGames().length > 0);

  protected status(first: number, second: number): FactStatus {
    return this.factStats.status(first, second);
  }

  protected start(): void {
    if (this.locked()) {
      return;
    }
    this.queue.set(this.factStats.reviewQuestions(QUESTIONS));
    this.index.set(0);
    this.typed.set('');
    this.answered.set([]);
    this.mistake.set(null);
    this.phase.set('quiz');
  }

  protected reset(): void {
    if (confirm('Vuoi davvero cancellare tutti i progressi? Anche i giochi fatti andranno rifatti per sbloccare il ripasso.')) {
      this.factStats.reset();
    }
  }

  protected press(digit: string): void {
    if (this.phase() === 'quiz' && this.typed().length < MAX_DIGITS) {
      this.typed.update((typed) => (typed === '0' ? digit : typed + digit));
    }
  }

  protected erase(): void {
    this.typed.update((typed) => typed.slice(0, -1));
  }

  protected confirm(): void {
    const fact = this.current();
    if (this.phase() !== 'quiz' || fact === null || this.typed() === '') {
      return;
    }
    const answer = Number(this.typed());
    const correct = answer === fact.first * fact.second;
    this.factStats.record(fact.first, fact.second, correct);
    const item = { ...fact, answer, correct };
    this.answered.update((answered) => [...answered, item]);
    this.mistake.set(correct ? null : item);
    // Una tabellina sbagliata torna in fondo alla fila, una volta sola: si riprova subito dopo.
    if (!correct && this.queue().filter((other) => other.first === fact.first && other.second === fact.second).length === 1) {
      this.queue.update((queue) => [...queue, fact]);
    }
    this.typed.set('');
    if (this.index() === this.queue().length - 1) {
      this.phase.set('done');
    } else {
      this.index.update((index) => index + 1);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.phase() !== 'quiz') {
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
}
