import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnswerMode, createChoices } from '../choices';

const CHOICE_BLINK_SECONDS = 20;
const CHOICE_TIME_LIMIT_SECONDS = 40;

@Component({ selector: 'app-multiplication', imports: [RouterLink], templateUrl: './multiplication.html', styleUrl: './multiplication.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class MultiplicationComponent {
  protected readonly totalQuestions = 10;
  protected readonly currentQuestionIndex = signal(0);
  protected readonly answer = signal('');
  protected readonly elapsedSeconds = signal(0);
  protected readonly correctAnswers = signal(0);
  protected readonly totalScore = signal(0);
  protected readonly isFinished = signal(false);
  protected readonly selectedLevel = signal<MultiplicationLevel | null>(null);
  protected readonly currentQuestion = signal<Question>({ first: 2, second: 2 });
  protected readonly showHelp = signal(false);
  protected readonly canShowHelp = computed(() => this.currentQuestion().first >= 10 || this.currentQuestion().second >= 10);
  protected readonly paperSteps = computed(() => this.createPaperSteps(this.currentQuestion()));
  protected readonly finalDigits = computed(() => String(this.currentQuestion().first * this.currentQuestion().second).split(''));
  protected readonly paperAnswers = signal<Record<string, string>>({});
  protected readonly answerInputRef = viewChild<ElementRef<HTMLInputElement>>('answerInput');
  protected readonly answeredQuestions = signal<AnsweredQuestion[]>([]);
  protected readonly selectedMode = signal<AnswerMode>('classic');
  protected readonly choices = signal<number[]>([]);
  protected readonly choicesBlinking = computed(() => this.selectedMode() === 'choice' && this.elapsedSeconds() >= CHOICE_BLINK_SECONDS);
  protected readonly levels: LevelOption[] = [
    { id: 'easy', name: 'Facile', description: 'Un numero a due cifre e uno a una cifra', color: 'easy' },
    { id: 'hard', name: 'Difficile', description: 'Due numeri fino a due cifre', color: 'hard' },
    { id: 'very-hard', name: 'Molto difficile', description: 'Due numeri fino a tre cifre', color: 'very-hard' },
  ];

  private questionPool: Question[] = [];
  private timerId: ReturnType<typeof setInterval> | undefined;
  private readonly destroyRef = inject(DestroyRef);

  constructor() { this.destroyRef.onDestroy(() => this.stopTimer()); }

  protected chooseLevel(level: MultiplicationLevel): void {
    this.selectedLevel.set(level); this.currentQuestionIndex.set(0); this.answer.set(''); this.correctAnswers.set(0); this.totalScore.set(0); this.answeredQuestions.set([]); this.isFinished.set(false); this.showHelp.set(false); this.paperAnswers.set({}); this.questionPool = this.createQuestionPool(level); this.currentQuestion.set(this.questionPool[0]); this.refreshChoices(); this.startTimer();
  }

  protected submitAnswer(): void {
    const value = this.answer().trim();
    if (!/^\d+$/.test(value)) return;
    this.recordAnswer(Number(value));
  }

  protected selectChoice(value: number): void { this.recordAnswer(value); }

  private recordAnswer(value: number): void {
    const question = this.currentQuestion();
    const timedOut = this.selectedMode() === 'choice' && this.elapsedSeconds() >= CHOICE_TIME_LIMIT_SECONDS;
    const isCorrect = value === question.first * question.second;
    const score = isCorrect ? Math.max(0, 40 - this.elapsedSeconds()) : -10;
    this.answeredQuestions.update((questions) => [...questions, { first: question.first, second: question.second, answer: value, seconds: this.elapsedSeconds(), isCorrect, score, timedOut }]);
    this.totalScore.update((currentScore) => currentScore + score);
    if (isCorrect) this.correctAnswers.update((current) => current + 1);
    if (this.currentQuestionIndex() === this.totalQuestions - 1) { this.isFinished.set(true); this.stopTimer(); return; }
    this.currentQuestionIndex.update((index) => index + 1); this.answer.set(''); this.showHelp.set(false); this.paperAnswers.set({}); this.currentQuestion.set(this.questionPool[this.currentQuestionIndex()]); this.refreshChoices(); this.startTimer(); if (this.selectedMode() === 'classic') this.focusAnswerInput();
  }

  protected focusAnswerInput(): void { this.answerInputRef()?.nativeElement.focus(); }

  protected toggleHelp(): void { this.showHelp.update((visible) => !visible); }
  protected setPaperAnswer(key: string, event: Event): void { this.paperAnswers.update((answers) => ({ ...answers, [key]: (event.target as HTMLInputElement).value })); }

  protected handleDigitInput(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (value.length > 1) {
      input.value = value.slice(0, 1);
      const overflow = value.slice(1);
      const next = this.findNextDigitInput(input);
      if (next !== null) {
        next.value = overflow;
        next.focus();
        next.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    this.setPaperAnswer(key, event);
  }

  protected copyPaperResultToAnswer(): void {
    this.answer.set(this.finalDigits().join(''));
    this.focusAnswerInput();
  }

  private findNextDigitInput(current: HTMLInputElement): HTMLInputElement | null {
    let sibling = current.nextElementSibling;
    while (sibling !== null) {
      if (sibling instanceof HTMLInputElement && !sibling.disabled) return sibling;
      sibling = sibling.nextElementSibling;
    }
    return null;
  }
  protected productDigits(value: number): string[] { return String(value).split(''); }
  protected isPaperAnswerIncorrect(key: string, expected: number | string): boolean { const value = this.paperAnswers()[key]; return value !== undefined && value !== '' && String(value) !== String(expected); }
  protected restart(): void { const level = this.selectedLevel(); if (level !== null) this.chooseLevel(level); }
  protected changeLevel(): void { this.stopTimer(); this.selectedLevel.set(null); this.answer.set(''); this.showHelp.set(false); this.paperAnswers.set({}); this.isFinished.set(false); }

  private refreshChoices(): void {
    if (this.selectedMode() === 'choice') {
      const { first, second } = this.currentQuestion();
      this.choices.set(createChoices(first * second, [first, second]));
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.elapsedSeconds.set(0);
    this.timerId = setInterval(() => this.elapsedSeconds.update((seconds) => seconds + 1), 1000);
  }
  private stopTimer(): void { if (this.timerId !== undefined) { clearInterval(this.timerId); this.timerId = undefined; } }
  private createQuestionPool(level: MultiplicationLevel): Question[] { return Array.from({ length: this.totalQuestions }, () => this.createQuestion(level)); }
  private createQuestion(level: MultiplicationLevel): Question { const maxDigits = level === 'easy' ? 2 : level === 'hard' ? 2 : 3; const firstDigits = level === 'easy' ? 2 : this.randomDigitLimit(maxDigits); const secondDigits = level === 'easy' ? 1 : this.randomDigitLimit(maxDigits); return { first: this.randomNumber(firstDigits), second: this.randomNumber(secondDigits) }; }
  private randomNumber(maxDigits: number): number { const minimum = maxDigits === 1 ? 1 : 10 ** (maxDigits - 1); return Math.floor(Math.random() * (10 ** maxDigits - minimum)) + minimum; }
  private randomDigitLimit(maxDigits: number): number { return Math.floor(Math.random() * maxDigits) + 1; }

  private createPaperSteps(question: Question): PaperStep[] {
    if (question.second >= 10) {
      return String(question.second).split('').reverse().map((digit, index) => ({
        key: `step-${index}`,
        first: question.first,
        second: Number(digit),
        displayFirst: index === 0 ? question.first : Number(digit),
        displaySecond: index === 0 ? Number(digit) : question.first,
        product: question.first * Number(digit),
        shift: index,
      }));
    }

    return String(question.first).split('').reverse().map((digit, index) => ({
      key: `step-${index}`,
      first: Number(digit),
      second: question.second,
      displayFirst: Number(digit),
      displaySecond: question.second,
      product: question.second * Number(digit),
      shift: index,
    }));
  }
}

type MultiplicationLevel = 'easy' | 'hard' | 'very-hard';
type LevelOption = { id: MultiplicationLevel; name: string; description: string; color: string };
type Question = { first: number; second: number };
type AnsweredQuestion = Question & { answer: number; seconds: number; isCorrect: boolean; score: number; timedOut: boolean };
type PaperStep = { key: string; first: number; second: number; displayFirst: number; displaySecond: number; product: number; shift: number };
