import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TablesComponent } from './tables';

describe('TablesComponent', () => {
  let fixture: ComponentFixture<TablesComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [TablesComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TablesComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  function chooseClassicMode(): void {
    (fixture.nativeElement.querySelectorAll('.level-card')[0] as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function chooseChoiceMode(): void {
    (fixture.nativeElement.querySelectorAll('.level-card')[1] as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('shows a mode picker before the quiz starts', () => {
    expect(fixture.nativeElement.querySelectorAll('.level-card').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.question')).toBeFalsy();
  });

  it('increments the visible timer', () => {
    chooseClassicMode();
    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('0 s');

    vi.advanceTimersByTime(2000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('2 s');
  });

  it('keeps the same quiz until a numeric answer is confirmed with Enter', () => {
    chooseClassicMode();
    const question = fixture.nativeElement.querySelector('.question').textContent;
    const input = fixture.nativeElement.querySelector('#answer') as HTMLInputElement;

    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.question').textContent).toBe(question);
    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('1/10');

    input.value = '1';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.question').textContent).not.toBe(question);
    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('2');
    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('0 s');
  });

  it('shows ten results and calculates the final score', () => {
    chooseClassicMode();
    for (let index = 0; index < 10; index += 1) {
      const factors = fixture.nativeElement.querySelectorAll('.question span');
      const first = Number(factors[0].textContent);
      const second = Number(factors[2].textContent);
      const input = fixture.nativeElement.querySelector('#answer') as HTMLInputElement;

      if (index === 0) {
        vi.advanceTimersByTime(3000);
      }
      input.value = String(first * second);
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
    }

    expect(fixture.nativeElement.querySelectorAll('.result-row').length).toBe(10);
    expect(fixture.nativeElement.querySelector('.final-score').textContent).toContain('197');
    expect(fixture.nativeElement.querySelectorAll('.result-status.correct').length).toBe(10);
  });

  it('excludes the one table and guarantees three priority questions', () => {
    chooseClassicMode();
    const questions = Array.from(fixture.nativeElement.querySelectorAll('.question span')) as HTMLElement[];
    const firstQuestion = questions[0].textContent;
    const secondQuestion = questions[2].textContent;
    const collectedQuestions = [`${firstQuestion}x${secondQuestion}`];
    const input = fixture.nativeElement.querySelector('#answer') as HTMLInputElement;

    for (let index = 0; index < 10; index += 1) {
      const factors = fixture.nativeElement.querySelectorAll('.question span');
      const first = Number(factors[0].textContent);
      const second = Number(factors[2].textContent);
      if (index > 0) {
        collectedQuestions.push(`${first}x${second}`);
      }
      input.value = String(first * second);
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
    }

    const priorityQuestions = new Set(['7x6', '6x7', '7x7', '7x8', '8x7', '8x6', '6x8', '8x8']);
    expect(collectedQuestions.every((question) => {
      const [first, second] = question.split('x').map(Number);
      return first !== 1 && second !== 1;
    })).toBe(true);
    expect(collectedQuestions.filter((question) => priorityQuestions.has(question)).length).toBeGreaterThanOrEqual(3);
    expect(collectedQuestions.filter((question) => question.startsWith('10x') || question.endsWith('x10')).length).toBeLessThanOrEqual(1);
  });

  it('offers six choices with one matching the correct product', () => {
    chooseChoiceMode();
    const factors = fixture.nativeElement.querySelectorAll('.question span');
    const first = Number(factors[0].textContent);
    const second = Number(factors[2].textContent);
    const buttons = fixture.nativeElement.querySelectorAll('.choice-button') as NodeListOf<HTMLButtonElement>;

    expect(buttons.length).toBe(6);
    const values = Array.from(buttons).map((button) => Number(button.textContent));
    expect(new Set(values).size).toBe(6);
    expect(values).toContain(first * second);

    const correctButton = Array.from(buttons).find((button) => Number(button.textContent) === first * second)!;
    correctButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('2');
    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('0 s');
  });

  it('starts blinking the choices after ten seconds', () => {
    chooseChoiceMode();
    expect(fixture.nativeElement.querySelector('.choice-grid').classList.contains('blinking')).toBe(false);

    vi.advanceTimersByTime(10000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.choice-grid').classList.contains('blinking')).toBe(true);
  });

  it('waits for an answer after twenty seconds and marks it as timed out', () => {
    chooseChoiceMode();
    vi.advanceTimersByTime(50000);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('1/10');
    expect(fixture.nativeElement.querySelectorAll('.answered-operation').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('.choice-button').length).toBe(6);

    (fixture.nativeElement.querySelector('.choice-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('2/10');
    expect(fixture.nativeElement.querySelector('.answered-operation').textContent).toContain('tempo scaduto');
  });

  it('does not mark answers given in time as timed out', () => {
    chooseChoiceMode();
    vi.advanceTimersByTime(19000);
    (fixture.nativeElement.querySelector('.choice-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.answered-operation').textContent).not.toContain('tempo scaduto');
  });
});
