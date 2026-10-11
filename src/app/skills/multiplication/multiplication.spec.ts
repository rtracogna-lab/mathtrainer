import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiplicationComponent } from './multiplication';

describe('MultiplicationComponent', () => {
  let fixture: ComponentFixture<MultiplicationComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [MultiplicationComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(MultiplicationComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('starts a ten-question session after selecting a level', () => {
    expect(fixture.nativeElement.querySelector('.level-list')).toBeTruthy();
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.progress').textContent).toContain('1/10');
    expect(fixture.nativeElement.querySelector('.timer').textContent).toContain('0 s');
  });

  it('uses forty seconds as the correct-answer score maximum', () => {
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();
    vi.advanceTimersByTime(5000);
    const question = fixture.componentInstance['currentQuestion']();
    const input = fixture.nativeElement.querySelector('#multiplication-answer') as HTMLInputElement;
    input.value = String(question.first * question.second);
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(fixture.componentInstance['totalScore']()).toBe(35);
  });

  it('shows column multiplication with products, digits and carries', () => {
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 83, second: 9 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.paper-step');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.fixed-zero').length).toBe(1);
    expect((fixture.nativeElement.querySelector('.fixed-zero') as HTMLInputElement).value).toBe('0');
    expect((fixture.nativeElement.querySelector('.fixed-zero') as HTMLInputElement).disabled).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.partial-digits').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.paper-operation-display')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.paper-top-number').textContent).toContain('83');
    expect(fixture.nativeElement.querySelector('.paper-top-multiplier').textContent).toContain('9');

    const input = fixture.nativeElement.querySelector('.partial-input') as HTMLInputElement;
    input.value = '99';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(input.classList.contains('paper-error')).toBe(true);

    const partialInputs = fixture.nativeElement.querySelectorAll('.partial-input') as NodeListOf<HTMLInputElement>;
    ['2', '7', '7', '2'].forEach((value, index) => {
      partialInputs[index].value = value;
      partialInputs[index].dispatchEvent(new Event('input'));
    });
    const finalInputs = fixture.nativeElement.querySelectorAll('.final-input') as NodeListOf<HTMLInputElement>;
    ['7', '4', '7'].forEach((value, index) => {
      finalInputs[index].value = value;
      finalInputs[index].dispatchEvent(new Event('input'));
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.final-input').length).toBe(3);
  });

  it('shows help when the multiplier has two digits', () => {
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 13, second: 3 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.help-button')).toBeTruthy();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.paper-step');
    expect(rows.length).toBe(2);
  });

  it('uses the full first factor for a two-digit multiplier', () => {
    (fixture.nativeElement.querySelector('.hard') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 99, second: 72 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.paper-step');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.querySelectorAll('.fixed-zero').length).toBe(1);
  });

  it('supports a one-digit first factor and a two-digit multiplier', () => {
    (fixture.nativeElement.querySelector('.easy') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentInstance['currentQuestion'].set({ first: 7, second: 11 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.help-button')).toBeTruthy();
    (fixture.nativeElement.querySelector('.help-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.paper-step');
    expect(rows.length).toBe(2);
  });

  function chooseChoiceMode(level = '.hard'): void {
    const modeButtons = fixture.nativeElement.querySelectorAll('.mode-switch__option') as NodeListOf<HTMLButtonElement>;
    modeButtons[1].click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector(level) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  it('offers six distinct choices including the correct product', () => {
    chooseChoiceMode();
    expect(fixture.nativeElement.querySelector('#multiplication-answer')).toBeNull();
    const factors = fixture.nativeElement.querySelectorAll('.question span');
    const first = Number(factors[0].textContent);
    const second = Number(factors[2].textContent);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.choice-button')) as HTMLButtonElement[];
    const values = buttons.map((button) => Number(button.textContent));

    expect(buttons.length).toBe(6);
    expect(new Set(values).size).toBe(6);
    expect(values).toContain(first * second);
    expect(values.every((value) => value >= 0)).toBe(true);

    buttons.find((button) => Number(button.textContent) === first * second)!.click();
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
