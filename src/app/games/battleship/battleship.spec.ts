import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { FactStats } from '../../review/fact-stats';
import { BattleshipComponent } from './battleship';
import { BattleshipGame } from './battleship.game';

describe('BattleshipComponent', () => {
  let fixture: ComponentFixture<BattleshipComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [BattleshipComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(BattleshipComponent);
    fixture.detectChanges();
  });

  function start(): BattleshipGame {
    (fixture.nativeElement.querySelector('.primary-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    return fixture.componentInstance['game'];
  }

  function aimAndFire(row: number, col: number, answer: number): void {
    (fixture.nativeElement.querySelector(`[aria-label="Spara su ${row} per ${col}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
    const keys = Array.from(fixture.nativeElement.querySelectorAll('.keypad__key')) as HTMLButtonElement[];
    for (const digit of String(answer)) {
      keys.find((key) => key.textContent!.trim() === digit)!.click();
    }
    keys.find((key) => key.textContent!.trim() === 'Fuoco!')!.click();
    fixture.detectChanges();
  }

  function message(): string {
    return fixture.nativeElement.querySelector('.sea-message').textContent;
  }

  it('shows the rules before starting', () => {
    expect(fixture.nativeElement.querySelector('.rules')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.sea')).toBeNull();
  });

  it('shows the sea and asks the multiplication of the chosen square', () => {
    start();
    expect(fixture.nativeElement.querySelectorAll('.sea__square').length).toBe(36);
    (fixture.nativeElement.querySelector('[aria-label="Spara su 7 per 6"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.grid-question').textContent).toContain('7 × 6 =');
  });

  it('loses the shot and shows the solution after a wrong answer', () => {
    start();
    aimAndFire(7, 6, 41);
    expect(message()).toContain('7 × 6 fa 42');
    expect(fixture.nativeElement.querySelector('[aria-label="Spara su 7 per 6"]')).toBeTruthy();
    expect(TestBed.inject(FactStats).status(6, 7)).toBe('weak');
  });

  it('says water or hit after a right answer', () => {
    const game = start();
    const water = game.squares.find((square) => square.ship === null)!;
    aimAndFire(water.row, water.col, water.row * water.col);
    expect(message()).toContain('Acqua');

    const ship = game.squares.find((square) => square.ship === 0)!;
    aimAndFire(ship.row, ship.col, ship.row * ship.col);
    expect(message()).toContain('Colpito');
  });

  it('wins when the whole fleet is sunk and counts as played for the review', () => {
    const game = start();
    for (const square of game.squares.filter((item) => item.ship !== null)) {
      aimAndFire(square.row, square.col, square.row * square.col);
    }
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Flotta affondata');
    expect(TestBed.inject(FactStats).played()).toContain('battleship');
  });
});
