import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FactStats } from '../../review/fact-stats';
import { HoleGridComponent } from './hole-grid';
import { HoleGridGame } from './hole-grid.game';

describe('HoleGridComponent', () => {
  let fixture: ComponentFixture<HoleGridComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [HoleGridComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(HoleGridComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  function start(): HoleGridGame {
    (fixture.nativeElement.querySelector('.primary-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    return fixture.componentInstance['game'];
  }

  function type(value: number): void {
    const keys = Array.from(fixture.nativeElement.querySelectorAll('.keypad__key')) as HTMLButtonElement[];
    for (const digit of String(value)) {
      keys.find((key) => key.textContent!.trim() === digit)!.click();
    }
    keys.find((key) => key.textContent!.trim() === 'OK')!.click();
    fixture.detectChanges();
  }

  it('shows the rules before starting', () => {
    expect(fixture.nativeElement.querySelector('.rules')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.grid')).toBeNull();
  });

  it('shows the multiplication table with empty holes and selects the first one', () => {
    const game = start();
    expect(fixture.nativeElement.querySelectorAll('.grid__cell').length).toBe(100);
    expect(fixture.nativeElement.querySelectorAll('.grid__hole').length).toBe(12);
    const first = game.holes[0];
    expect(fixture.nativeElement.querySelector('.grid-question').textContent).toContain(`${first.row} × ${first.col} =`);
  });

  it('counts a wrong answer and keeps the hole open', () => {
    const game = start();
    const hole = game.holes[0];
    type(hole.value + 1);
    expect(fixture.nativeElement.querySelector('.game-info').textContent).toContain('Errori: 1');
    expect(fixture.nativeElement.querySelector('.grid__hole--shake')).toBeTruthy();
    expect(TestBed.inject(FactStats).status(hole.row, hole.col)).toBe('weak');
  });

  it('fills the hole and moves to the next one with the right answer', () => {
    const game = start();
    const [first, second] = game.holes;
    type(first.value);
    expect(fixture.nativeElement.querySelectorAll('.grid__hole').length).toBe(11);
    expect(fixture.nativeElement.querySelector('.grid-question').textContent).toContain(`${second.row} × ${second.col} =`);
  });

  it('accepts answers typed on the keyboard', () => {
    const game = start();
    const hole = game.holes[0];
    for (const key of [...String(hole.value), 'Enter']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key }));
    }
    fixture.detectChanges();
    expect(hole.solved).toBe(true);
  });

  it('shows three stars when the grid is completed without mistakes', () => {
    const game = start();
    for (const hole of game.holes) {
      type(hole.value);
    }
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Griglia completata');
    expect(fixture.nativeElement.querySelectorAll('.grid-stars__off').length).toBe(0);
    expect(TestBed.inject(FactStats).played()).toContain('grid');
  });
});
