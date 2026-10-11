import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdditionComponent } from './addition';

describe('AdditionComponent', () => {
  let fixture: ComponentFixture<AdditionComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [AdditionComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdditionComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('starts the session only after selecting a level', () => {
    expect(fixture.nativeElement.querySelector('.level-list')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.timer')).toBeNull();

    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('1/10');
    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('0 s');
  });

  it('generates operands within each selected difficulty', () => {
    const levels = [
      { selector: '.easy', maximum: 99, secondMaximum: 9 },
      { selector: '.hard', maximum: 99, secondMaximum: 99 },
      { selector: '.very-hard', maximum: 999, secondMaximum: 999 },
    ];

    for (const [index, level] of levels.entries()) {
      if (index > 0) {
        fixture.destroy();
        fixture = TestBed.createComponent(AdditionComponent);
        fixture.detectChanges();
      }
      fixture.detectChanges();
      (fixture.nativeElement.querySelector(level.selector) as HTMLButtonElement).click();
      fixture.detectChanges();

      const factors = fixture.nativeElement.querySelectorAll('.question span');
      const first = Number(factors[0].textContent);
      const second = Number(factors[2].textContent);
      expect(first).toBeGreaterThanOrEqual(1);
      expect(first).toBeLessThanOrEqual(level.maximum);
      expect(second).toBeGreaterThanOrEqual(1);
      expect(second).toBeLessThanOrEqual(level.secondMaximum);
    }
  });

  it('uses forty seconds as the correct-answer score maximum', () => {
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);

    const factors = fixture.nativeElement.querySelectorAll('.question span');
    const answer = Number(factors[0].textContent) + Number(factors[2].textContent);
    const input = fixture.nativeElement.querySelector('#addition-answer') as HTMLInputElement;
    input.value = String(answer);
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('0 s');
    expect(fixture.componentInstance['totalScore']()).toBe(35);
  });

  it('shows the help breakdown for two two-digit addends', () => {
    (fixture.nativeElement.querySelector('.hard') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 23, second: 34 });
    fixture.detectChanges();

    const helpButton = fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement;
    expect(helpButton).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.help-breakdown')).toBeNull();

    helpButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.help-breakdown').textContent).toContain('20 + 30');
    expect(fixture.nativeElement.querySelector('.help-breakdown').textContent).toContain('3 + 4');
  });

  it('marks an incorrect help result in red', () => {
    (fixture.nativeElement.querySelector('.hard') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 23, second: 34 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.help-input') as HTMLInputElement;
    input.value = '99';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.help-row').classList.contains('help-error')).toBe(true);
  });

  it('shows hundreds, tens and units in very hard mode', () => {
    (fixture.nativeElement.querySelector('.very-hard') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 234, second: 567 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.help-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('200 + 500');
    expect(rows[1].textContent).toContain('30 + 60');
    expect(rows[2].textContent).toContain('4 + 7');
  });

  it('allows one, two or three digits independently in very hard mode', () => {
    const random = vi.spyOn(Math, 'random');

    random.mockReturnValue(0);
    const oneDigitQuestion = fixture.componentInstance['createQuestion']('very-hard');
    expect(oneDigitQuestion.first).toBeLessThan(10);
    expect(oneDigitQuestion.second).toBeLessThan(10);

    random.mockReturnValue(0.99);
    const threeDigitQuestion = fixture.componentInstance['createQuestion']('very-hard');
    expect(threeDigitQuestion.first).toBeGreaterThanOrEqual(100);
    expect(threeDigitQuestion.second).toBeGreaterThanOrEqual(100);
    random.mockRestore();
  });

  function chooseChoiceMode(level = '.hard'): void {
    const modeButtons = fixture.nativeElement.querySelectorAll('.mode-switch__option') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(level) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('offers six distinct choices including the correct sum', () => {
    chooseChoiceMode();
    expect(fixture.nativeElement.querySelector('#addition-answer')).toBeNull();
    const factors = fixture.nativeElement.querySelectorAll('.question span');
    const first = Number(factors[0].textContent);
    const second = Number(factors[2].textContent);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.choice-button')) as HTMLButtonElement[];
    const values = buttons.map((button) => Number(button.textContent));

    expect(buttons.length).toBe(6);
    expect(new Set(values).size).toBe(6);
    expect(values).toContain(first + second);
    expect(values.every((value) => value >= 0)).toBe(true);

    buttons.find((button) => Number(button.textContent) === first + second)!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('2/10');
    expect(fixture.componentInstance['correctAnswers']()).toBe(1);
  });

  it('blinks the choices after twenty seconds', () => {
    chooseChoiceMode();
    expect(fixture.nativeElement.querySelector('.choice-grid').classList.contains('blinking')).toBe(false);
    vi.advanceTimersByTime(20000);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.choice-grid').classList.contains('blinking')).toBe(true);
  });

  it('waits for an answer after forty seconds and marks it as timed out', () => {
    chooseChoiceMode();
    vi.advanceTimersByTime(70000);
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
    vi.advanceTimersByTime(39000);
    (fixture.nativeElement.querySelector('.choice-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.answered-operation').textContent).not.toContain('tempo scaduto');
  });
});
