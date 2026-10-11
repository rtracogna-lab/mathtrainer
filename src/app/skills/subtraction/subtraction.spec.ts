import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubtractionComponent } from './subtraction';

describe('SubtractionComponent', () => {
  let fixture: ComponentFixture<SubtractionComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [SubtractionComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SubtractionComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('starts a ten-question session after choosing a level', () => {
    expect(fixture.nativeElement.querySelector('.level-list')).toBeTruthy();
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('1/10');
    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('0 s');
  });

  it('keeps subtraction results non-negative across all levels', () => {
    for (const [index, selector] of ['.easy', '.hard', '.very-hard'].entries()) {
      if (index > 0) {
        fixture.destroy();
        fixture = TestBed.createComponent(SubtractionComponent);
        fixture.detectChanges();
      }
      (fixture.nativeElement.querySelector(selector) as HTMLButtonElement).click();
      fixture.detectChanges();
      const question = fixture.componentInstance['currentQuestion']();
      expect(question.first).toBeGreaterThanOrEqual(question.second);
    }
  });

  it('uses forty seconds as the correct-answer score maximum', () => {
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();
    vi.advanceTimersByTime(5_000);

    const question = fixture.componentInstance['currentQuestion']();
    const input = fixture.nativeElement.querySelector('#subtraction-answer') as HTMLInputElement;
    input.value = String(question.first - question.second);
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(fixture.componentInstance['totalScore']()).toBe(35);
  });

  it('shows vertical help for hundreds, tens and units', () => {
    (fixture.nativeElement.querySelector('.very-hard') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 567, second: 234 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.help-row');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('500 - 200');
    expect(rows[1].textContent).toContain('60 - 30');
    expect(rows[2].textContent).toContain('7 - 4');
  });

  it('marks an incorrect help result in red', () => {
    (fixture.nativeElement.querySelector('.hard') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 23, second: 14 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('.help-input') as HTMLInputElement;
    input.value = '99';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.help-row').classList.contains('help-error')).toBe(true);
  });

  function chooseChoiceMode(level = '.hard'): void {
    const modeButtons = fixture.nativeElement.querySelectorAll('.mode-switch__option') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(level) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('offers six distinct choices including the correct difference', () => {
    chooseChoiceMode();
    expect(fixture.nativeElement.querySelector('#subtraction-answer')).toBeNull();
    const factors = fixture.nativeElement.querySelectorAll('.question span');
    const first = Number(factors[0].textContent);
    const second = Number(factors[2].textContent);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.choice-button')) as HTMLButtonElement[];
    const values = buttons.map((button) => Number(button.textContent));

    expect(buttons.length).toBe(6);
    expect(new Set(values).size).toBe(6);
    expect(values).toContain(first - second);
    expect(values.every((value) => value >= 0)).toBe(true);

    buttons.find((button) => Number(button.textContent) === first - second)!.click();
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
