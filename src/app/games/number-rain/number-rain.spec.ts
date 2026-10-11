import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NumberRainComponent } from './number-rain';
import { NumberRainGame } from './number-rain.game';

describe('NumberRainComponent', () => {
  let fixture: ComponentFixture<NumberRainComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [NumberRainComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(NumberRainComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  function startWith(...values: number[]): NumberRainGame {
    (fixture.nativeElement.querySelector('.primary-button') as HTMLButtonElement).click();
    const game: NumberRainGame = fixture.componentInstance['game'];
    game.numbers = values.map((value, index) => ({ id: 101 + index, value, lane: index, y: 0.3 }));
    fixture.componentInstance['sync']();
    fixture.detectChanges();
    return game;
  }

  function tap(index: number): void {
    const tiles = fixture.nativeElement.querySelectorAll('.rain-number') as NodeListOf<HTMLButtonElement>;
    tiles[index].dispatchEvent(new Event('pointerdown'));
    fixture.detectChanges();
  }

  it('shows the rules before starting', () => {
    expect(fixture.nativeElement.querySelector('.rules')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.game-field')).toBeNull();
  });

  it('adds the sum to the bonus when two tapped numbers make a multiple of ten', () => {
    startWith(37, 23, 8);
    expect(fixture.nativeElement.querySelector('.game-bonus').textContent).toContain('100');

    tap(0);
    expect(fixture.nativeElement.querySelector('.rain-number--selected')).toBeTruthy();
    tap(1);

    expect(fixture.nativeElement.querySelector('.game-bonus').textContent).toContain('160');
    expect(fixture.nativeElement.querySelectorAll('.rain-number').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.rain-popup').textContent).toContain('+60');
  });

  it('shakes the numbers when the group is wrong', () => {
    startWith(37, 25, 9);
    tap(0);
    tap(1);
    tap(2);

    expect(fixture.nativeElement.querySelectorAll('.rain-number--shake').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.game-bonus').textContent).toContain('100');
  });

  it('shows the game over screen when the bonus runs out', () => {
    const game = startWith(99);
    game.bonus = 99;
    game.numbers[0].y = 0.999;
    fixture.componentInstance['advance'](0.1);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.game-field')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Bonus esaurito');
  });

  it('plays the Amici del 10 variant when the route asks for it', () => {
    fixture.componentRef.setInput('variant', 'friends');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Amici del 10');
    expect(fixture.nativeElement.querySelector('.rules').textContent).toContain('50 punti');

    startWith(2, 3, 5);
    expect(fixture.nativeElement.querySelector('.game-bonus').textContent).toContain('50');
    tap(0);
    tap(1);
    expect(fixture.nativeElement.querySelector('.selection-sum').textContent).toContain('2 + 3 = 5');
    tap(2);

    expect(fixture.nativeElement.querySelector('.game-bonus').textContent).toContain('70');
    expect(fixture.nativeElement.querySelector('.rain-popup').textContent).toContain('+20');
    expect(fixture.nativeElement.querySelectorAll('.rain-number').length).toBe(0);
  });

  it('shows the victory screen when Amici del 10 reaches one hundred', () => {
    fixture.componentRef.setInput('variant', 'friends');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.rules').textContent).toContain('jolly');

    const game = startWith(4, 6);
    game.bonus = 95;
    fixture.componentInstance['sync']();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.game-bonus').textContent).toContain('/ 100');

    tap(0);
    tap(1);

    expect(fixture.nativeElement.querySelector('.game-field')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Hai vinto');
  });

  it('shows the jolly as a star', () => {
    fixture.componentRef.setInput('variant', 'friends');
    fixture.detectChanges();
    const game = startWith(6);
    game.numbers.push({ id: 200, value: 0, lane: 5, y: 0.3, jolly: true });
    fixture.componentInstance['sync']();
    fixture.detectChanges();

    const jolly = fixture.nativeElement.querySelector('.rain-number--jolly') as HTMLButtonElement;
    expect(jolly.textContent).toContain('★');
    tap(1);
    expect(fixture.nativeElement.querySelector('.selection-sum').textContent).toContain('★');
  });
});
