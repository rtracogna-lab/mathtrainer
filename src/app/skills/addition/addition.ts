import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnswerMode, createChoices } from '../choices';

const CHOICE_BLINK_SECONDS = 20;
const CHOICE_TIME_LIMIT_SECONDS = 40;

@Component({ selector: 'app-addition', imports: [RouterLink], templateUrl: './addition.html', styleUrl: './addition.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class AdditionComponent {
	protected readonly skill = { name: 'Addizione', symbol: '+', color: '#ffe18a' };
	protected readonly totalQuestions = 10;
	protected readonly currentQuestionIndex = signal(0);
	protected readonly answer = signal('');
	protected readonly elapsedSeconds = signal(0);
	protected readonly correctAnswers = signal(0);
	protected readonly totalScore = signal(0);
	protected readonly isFinished = signal(false);
	protected readonly selectedLevel = signal<AdditionLevel | null>(null);
	protected readonly currentQuestion = signal<Question>({ first: 1, second: 1 });
	protected readonly showHelp = signal(false);
	protected readonly canShowHelp = computed(() => this.currentQuestion().first >= 10 && this.currentQuestion().second >= 10);
	protected readonly helpParts = computed(() => this.createHelpParts(this.currentQuestion()));
	protected readonly helpAnswers = signal<Record<string, string>>({});
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

	constructor() {
		this.destroyRef.onDestroy(() => this.stopTimer());
	}

	protected chooseLevel(level: AdditionLevel): void {
		this.selectedLevel.set(level);
		this.currentQuestionIndex.set(0);
		this.answer.set('');
		this.correctAnswers.set(0);
		this.totalScore.set(0);
		this.answeredQuestions.set([]);
		this.isFinished.set(false);
		this.showHelp.set(false);
		this.helpAnswers.set({});
		this.questionPool = this.createQuestionPool(level);
		this.currentQuestion.set(this.questionPool[0]);
		this.refreshChoices();
		this.startTimer();
	}

	protected submitAnswer(): void {
		const value = this.answer().trim();
		if (!/^\d+$/.test(value)) {
			return;
		}

		this.recordAnswer(Number(value));
	}

	protected selectChoice(value: number): void {
		this.recordAnswer(value);
	}

	private recordAnswer(value: number): void {
		const question = this.currentQuestion();
		const timedOut = this.selectedMode() === 'choice' && this.elapsedSeconds() >= CHOICE_TIME_LIMIT_SECONDS;
		const isCorrect = value === question.first + question.second;
		const score = isCorrect ? Math.max(0, 40 - this.elapsedSeconds()) : -10;
		this.answeredQuestions.update((questions) => [
			...questions,
			{ first: question.first, second: question.second, answer: value, seconds: this.elapsedSeconds(), isCorrect, score, timedOut },
		]);
		this.totalScore.update((currentScore) => currentScore + score);
		if (isCorrect) {
			this.correctAnswers.update((score) => score + 1);
		}

		if (this.currentQuestionIndex() === this.totalQuestions - 1) {
			this.isFinished.set(true);
			this.stopTimer();
			return;
		}

		this.currentQuestionIndex.update((index) => index + 1);
		this.answer.set('');
		this.showHelp.set(false);
		this.helpAnswers.set({});
		this.currentQuestion.set(this.questionPool[this.currentQuestionIndex()]);
		this.refreshChoices();
		this.startTimer();
		if (this.selectedMode() === 'classic') {
			this.focusAnswerInput();
		}
	}

	protected focusAnswerInput(): void {
		this.answerInputRef()?.nativeElement.focus();
	}

	protected toggleHelp(): void {
		this.showHelp.update((visible) => !visible);
	}

	protected setHelpAnswer(key: string, event: Event): void {
		const value = (event.target as HTMLInputElement).value;
		this.helpAnswers.update((answers) => ({ ...answers, [key]: value }));
	}

	protected isHelpAnswerIncorrect(part: HelpPart): boolean {
		const value = this.helpAnswers()[part.key];
		return value !== undefined && value !== '' && Number(value) !== part.expected;
	}

	protected restart(): void {
		const level = this.selectedLevel();
		if (level !== null) {
			this.chooseLevel(level);
		}
	}

	protected changeLevel(): void {
		this.stopTimer();
		this.selectedLevel.set(null);
		this.answer.set('');
		this.showHelp.set(false);
		this.helpAnswers.set({});
		this.isFinished.set(false);
	}

	private refreshChoices(): void {
		if (this.selectedMode() === 'choice') {
			const question = this.currentQuestion();
			this.choices.set(createChoices(question.first + question.second));
		}
	}

	private startTimer(): void {
		this.stopTimer();
		this.elapsedSeconds.set(0);
		this.timerId = setInterval(() => this.elapsedSeconds.update((seconds) => seconds + 1), 1000);
	}

	private stopTimer(): void {
		if (this.timerId !== undefined) {
			clearInterval(this.timerId);
			this.timerId = undefined;
		}
	}

	private createQuestionPool(level: AdditionLevel): Question[] {
		return Array.from({ length: this.totalQuestions }, () => this.createQuestion(level));
	}

	private createQuestion(level: AdditionLevel): Question {
		const firstDigits = level === 'easy' ? 2 : level === 'hard' ? this.randomDigitLimit(2) : this.randomDigitLimit(3);
		const secondDigits = level === 'easy' ? 1 : level === 'hard' ? this.randomDigitLimit(2) : this.randomDigitLimit(3);
		return {
			first: this.randomNumber(firstDigits),
			second: this.randomNumber(secondDigits),
		};
	}

	private randomNumber(maxDigits: number): number {
		const minimum = maxDigits === 1 ? 1 : 10 ** (maxDigits - 1);
		return Math.floor(Math.random() * (10 ** maxDigits - minimum)) + minimum;
	}

	private randomDigitLimit(maxDigits: number): number {
		return Math.floor(Math.random() * maxDigits) + 1;
	}

	private createHelpParts(question: Question): HelpPart[] {
		const parts: HelpPart[] = [];
		const maxDigits = Math.max(String(question.first).length, String(question.second).length);
		for (let power = maxDigits - 1; power >= 0; power -= 1) {
			const placeValue = 10 ** power;
			const firstPart = Math.floor(question.first / placeValue) % 10 * placeValue;
			const secondPart = Math.floor(question.second / placeValue) % 10 * placeValue;
			const placeName = power === 2 ? 'Centinaia' : power === 1 ? 'Decine' : 'Unita';
			parts.push({
				key: placeName.toLowerCase(),
				label: placeName,
				first: firstPart,
				second: secondPart,
				expected: firstPart + secondPart,
			});
		}
		return parts;
	}
}

type AdditionLevel = 'easy' | 'hard' | 'very-hard';

type LevelOption = {
	id: AdditionLevel;
	name: string;
	description: string;
	color: string;
};

type Question = {
	first: number;
	second: number;
};

type AnsweredQuestion = Question & {
	answer: number;
	seconds: number;
	isCorrect: boolean;
	score: number;
	timedOut: boolean;
};

type HelpPart = {
	key: string;
	label: string;
	first: number;
	second: number;
	expected: number;
};
