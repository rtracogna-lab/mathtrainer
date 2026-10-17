import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FactStats, REVIEW_GAMES } from './fact-stats';
import { ReviewComponent } from './review';

describe('ReviewComponent', () => {
  let fixture: ComponentFixture<ReviewComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [ReviewComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(ReviewComponent);
    fixture.detectChanges();
  });

  function unlock(): void {
    const stats = TestBed.inject(FactStats);
    REVIEW_GAMES.forEach((game) => stats.markPlayed(game.id));
    fixture.detectChanges();
  }

  function startButton(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.primary-button');
  }

  function question(): [number, number] {
    const [, first, second] = /(\d+) × (\d+)/.exec(fixture.nativeElement.querySelector('.review-question').textContent)!;
    return [Number(first), Number(second)];
  }

  function type(value: number): void {
    const keys = Array.from(fixture.nativeElement.querySelectorAll('.keypad__key')) as HTMLButtonElement[];
    for (const digit of String(value)) {
      keys.find((key) => key.textContent!.trim() === digit)!.click();
    }
    keys.find((key) => key.textContent!.trim() === 'OK')!.click();
    fixture.detectChanges();
  }

  it('colours the multiplication table by what has been learned', () => {
    TestBed.inject(FactStats).record(7, 8, false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.grid .review-cell--weak').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.review-legend').textContent).toContain('Da ripassare: 1');
  });

  it('stays locked and lists the games still to play', () => {
    TestBed.inject(FactStats).markPlayed('grid');
    fixture.detectChanges();
    expect(startButton().disabled).toBe(true);
    const todo = Array.from(fixture.nativeElement.querySelectorAll('.review-games a') as NodeListOf<HTMLAnchorElement>).map((link) => link.getAttribute('href'));
    expect(todo).toEqual(['/tabelline', '/fattore-mancante', '/battaglia-navale']);

    startButton().click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.review-question')).toBeNull();
  });

  it('unlocks once every game of the path is done', () => {
    unlock();
    expect(startButton().disabled).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.review-games a').length).toBe(0);
  });

  it('starts with the facts that were wrong', () => {
    unlock();
    TestBed.inject(FactStats).record(7, 8, false);
    startButton().click();
    fixture.detectChanges();
    expect(question().sort()).toEqual([7, 8]);
  });

  it('asks a wrong fact again at the end and shows the solution', () => {
    unlock();
    startButton().click();
    fixture.detectChanges();
    const [first, second] = question();
    type(first * second + 1);
    expect(fixture.nativeElement.querySelector('.review-feedback').textContent).toContain(`fa ${first * second}`);
    expect(fixture.nativeElement.querySelector('.game-bonus').textContent).toContain('/ 11');

    for (let index = 1; index < 11; index += 1) {
      const [a, b] = question();
      type(a * b);
    }
    expect(fixture.nativeElement.querySelector('.result-score').textContent).toContain('10 su 11');
  });
});
