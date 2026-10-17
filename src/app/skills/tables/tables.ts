import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FactStats } from '../../review/fact-stats';

const CHOICE_BLINK_SECONDS = 10;
const CHOICE_TIME_LIMIT_SECONDS = 20;

@Component({ selector: 'app-tables', imports: [RouterLink], templateUrl: './tables.html', styleUrl: './tables.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class TablesComponent {
	protected readonly skill = { name: 'Tabelline', symbol: 'x', color: '#ffad9c' };
	protected readonly totalQuestions = 10;
	protected readonly currentQuestionIndex = signal(0);
	protected readonly answer = signal('');
	protected readonly elapsedSeconds = signal(0);
	protected readonly correctAnswers = signal(0);
	protected readonly totalScore = signal(0);
	protected readonly isFinished = signal(false);
	protected readonly selectedMode = signal<TablesMode | null>(null);
	protected readonly currentQuestion = signal<Question>({ first: 2, second: 2 });
	protected readonly choices = signal<number[]>([]);
	protected readonly answeredQuestions = signal<AnsweredQuestion[]>([]);
	protected readonly answerInputRef = viewChild<ElementRef<HTMLInputElement>>('answerInput');
	protected readonly choicesBlinking = computed(() => this.selectedMode() === 'choice' && this.elapsedSeconds() >= CHOICE_BLINK_SECONDS);

	private questionPool: Question[] = [];
	private timerId: ReturnType<typeof setInterval> | undefined;
	private readonly destroyRef = inject(DestroyRef);
	private readonly factStats = inject(FactStats);

	constructor() {
		this.destroyRef.onDestroy(() => this.stopTimer());
	}

	protected chooseMode(mode: TablesMode): void {
		this.selectedMode.set(mode);
		this.currentQuestionIndex.set(0);
		this.answer.set('');
		this.correctAnswers.set(0);
		this.totalScore.set(0);
		this.answeredQuestions.set([]);
		this.isFinished.set(false);
		this.questionPool = this.createQuestionPool();
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

	protected focusAnswerInput(): void {
		this.answerInputRef()?.nativeElement.focus();
	}

	protected restart(): void {
		const mode = this.selectedMode();
		if (mode !== null) {
			this.chooseMode(mode);
		}
	}

	protected changeMode(): void {
		this.stopTimer();
		this.selectedMode.set(null);
		this.answer.set('');
		this.isFinished.set(false);
	}

	private recordAnswer(value: number): void {
		const question = this.currentQuestion();
		const timedOut = this.selectedMode() === 'choice' && this.elapsedSeconds() >= CHOICE_TIME_LIMIT_SECONDS;
		const isCorrect = value === question.first * question.second;
		this.factStats.record(question.first, question.second, isCorrect);
		const score = isCorrect ? Math.max(0, 20 - this.elapsedSeconds()) : -10;
		this.answeredQuestions.update((questions) => [
			...questions,
			{
				first: question.first,
				second: question.second,
				answer: value,
				seconds: this.elapsedSeconds(),
				isCorrect,
				score,
				timedOut,
			},
		]);
		this.totalScore.update((currentScore) => currentScore + score);
		if (isCorrect) {
			this.correctAnswers.update((score) => score + 1);
		}

		if (this.currentQuestionIndex() === this.totalQuestions - 1) {
			this.isFinished.set(true);
			this.factStats.markPlayed('tables');
			this.stopTimer();
			return;
		}

		this.currentQuestionIndex.update((index) => index + 1);
		this.answer.set('');
		this.currentQuestion.set(this.questionPool[this.currentQuestionIndex()]);
		this.refreshChoices();
		this.startTimer();
		if (this.selectedMode() === 'classic') {
			this.focusAnswerInput();
		}
	}

	private refreshChoices(): void {
		if (this.selectedMode() === 'choice') {
			this.choices.set(this.createChoices(this.currentQuestion()));
		}
	}

	private createChoices(question: Question): number[] {
		const correct = question.first * question.second;
		const options = new Set<number>([correct]);
		while (options.size < 6) {
			options.add(Math.floor(Math.random() * 100) + 1);
		}
		return this.shuffle([...options]);
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

	private createQuestionPool(): Question[] {
		const questions: Question[] = [];
		const difficultQuestions = this.shuffle([
			{ first: 7, second: 6 },
			{ first: 6, second: 7 },
			{ first: 7, second: 7 },
			{ first: 7, second: 8 },
			{ first: 8, second: 7 },
			{ first: 8, second: 6 },
			{ first: 6, second: 8 },
			{ first: 8, second: 8 },
		]);

		for (let index = 0; index < this.totalQuestions; index += 1) {
			const positionInBlock = index % 10;
			const blockStart = index - positionInBlock;
			const questionsInBlock = Math.min(10, this.totalQuestions - blockStart);
			const minimumDifficultQuestions = Math.min(3, questionsInBlock);
			const difficultCount = questions.slice(blockStart, index).filter((question) => this.isDifficult(question)).length;
			const remainingSlots = questionsInBlock - positionInBlock;
			const mustChooseDifficult = difficultCount < minimumDifficultQuestions && remainingSlots <= minimumDifficultQuestions - difficultCount;

			if (mustChooseDifficult || (difficultCount < minimumDifficultQuestions && Math.random() < 0.55)) {
				questions.push(difficultQuestions[index % difficultQuestions.length]);
			} else {
				questions.push(this.createStandardQuestion());
			}
		}

		const standardIndexes = questions
			.map((question, index) => ({ question, index }))
			.filter(({ question }) => !this.isDifficult(question))
			.map(({ index }) => index);
		if (standardIndexes.length > 0) {
			const index = standardIndexes[Math.floor(Math.random() * standardIndexes.length)];
			questions[index] = this.createStandardQuestion(true);
		}

		return questions;
	}

	private createStandardQuestion(includeTen = false): Question {
		const maximum = includeTen ? 10 : 9;
		return {
			first: Math.floor(Math.random() * (maximum - 1)) + 2,
			second: Math.floor(Math.random() * (maximum - 1)) + 2,
		};
	}

	private isDifficult(question: Question): boolean {
		return [7, 8].includes(question.first) && [6, 7, 8].includes(question.second)
			|| [7, 8].includes(question.second) && [6, 7, 8].includes(question.first);
	}

	private shuffle<T>(items: T[]): T[] {
		return [...items].sort(() => Math.random() - 0.5);
	}
}

type TablesMode = 'classic' | 'choice';

type Question = {
	first: number;
	second: number;
};

type AnsweredQuestion = {
	first: number;
	second: number;
	answer: number;
	seconds: number;
	isCorrect: boolean;
	score: number;
	timedOut: boolean;
};
