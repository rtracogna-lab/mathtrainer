import { describe, expect, it } from 'vitest';
import { GameVariant, LEVEL_SECONDS, NumberRainGame, VARIANTS } from './number-rain.game';

const rain = VARIANTS.rain;
const friends = VARIANTS.friends;

function gameWith(variant: GameVariant, ...values: number[]): NumberRainGame {
  const game = new NumberRainGame(variant, () => 0);
  game.numbers = values.map((value, index) => ({ id: 101 + index, value, lane: index, y: 0.5 }));
  return game;
}

function spawnedValues(variant: GameVariant, count: number): number[] {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const game = new NumberRainGame(variant, random);
  const values: number[] = [];
  while (values.length < count) {
    game.tick(0.1);
    for (const number of game.numbers.filter((item) => !item.jolly)) {
      values.push(number.value);
    }
    game.numbers = [];
  }
  return values;
}

describe('Pioggia di numeri', () => {
  it('never drops multiples of ten', () => {
    const values = spawnedValues(rain, 300);
    expect(values.every((value) => value >= 1 && value <= 99 && value % 10 !== 0)).toBe(true);
  });

  it('accepts two or three numbers whose sum is a multiple of ten', () => {
    expect(rain.isMatch([37, 23])).toBe(true);
    expect(rain.isMatch([55, 55])).toBe(true);
    expect(rain.isMatch([31, 2, 7])).toBe(true);
    expect(rain.isMatch([37, 25])).toBe(false);
  });

  it('starts from one hundred points and is won at three hundred', () => {
    expect(new NumberRainGame(rain).bonus).toBe(100);
    expect(rain.winBonus).toBe(300);
    expect(rain.jollyChance).toBeGreaterThan(0);
  });

  it('waits for a third number when two do not make a multiple of ten', () => {
    const game = gameWith(rain, 37, 25, 8);
    game.select(101);
    expect(game.select(102)).toBeNull();
    expect(game.select(103)).toEqual(expect.objectContaining({ type: 'match', sum: 140 }));
    expect(game.bonus).toBe(rain.startBonus + 140);
  });

  it('rejects three numbers that do not make a multiple of ten', () => {
    const game = gameWith(rain, 37, 25, 9);
    game.select(101);
    game.select(102);
    expect(game.select(103)).toEqual({ type: 'mismatch', ids: [101, 102, 103] });
    expect(game.bonus).toBe(rain.startBonus);
  });

  it('rounds up to the next multiple of ten with a jolly', () => {
    const game = gameWith(rain, 37, 31, 12);
    game.numbers.push({ id: 200, value: 0, lane: 5, y: 0.5, jolly: true });
    game.select(101);
    expect(game.select(200)).toEqual(expect.objectContaining({ type: 'match', sum: 40 }));
    game.numbers.push({ id: 201, value: 0, lane: 5, y: 0.5, jolly: true });
    game.select(102);
    game.select(103);
    expect(game.select(201)).toEqual(expect.objectContaining({ type: 'match', sum: 100 }));
  });

  it('wins at three hundred points', () => {
    const game = gameWith(rain, 37, 23);
    game.bonus = 250;
    game.select(101);
    game.select(102);
    expect(game.isWon).toBe(true);
  });
});

describe('Amici del 10', () => {
  it('drops only numbers from 1 to 9', () => {
    const values = spawnedValues(friends, 300);
    expect(values.every((value) => value >= 1 && value <= 9)).toBe(true);
    expect(new Set(values).size).toBe(9);
  });

  it('accepts two or three numbers that make exactly ten', () => {
    expect(friends.isMatch([3, 7])).toBe(true);
    expect(friends.isMatch([5, 5])).toBe(true);
    expect(friends.isMatch([2, 3, 5])).toBe(true);
    expect(friends.isMatch([4, 5])).toBe(false);
  });

  it('starts from fifty points', () => {
    expect(new NumberRainGame(friends).bonus).toBe(50);
  });

  it('removes a pair of friends and adds ten to the bonus', () => {
    const game = gameWith(friends, 3, 7);
    game.select(101);
    expect(game.select(102)).toEqual(expect.objectContaining({ type: 'match', sum: 10 }));
    expect(game.bonus).toBe(friends.startBonus + 10);
  });

  it('gives double points (20) when ten is made with three numbers', () => {
    const game = gameWith(friends, 2, 3, 5, 9);
    expect(game.select(101)).toBeNull();
    expect(game.select(102)).toBeNull();
    expect(game.selectedValues).toEqual([2, 3]);

    expect(game.select(103)).toEqual(expect.objectContaining({ type: 'match', ids: [101, 102, 103], sum: 20 }));
    expect(game.bonus).toBe(friends.startBonus + 20);
    expect(game.numbers.map((item) => item.value)).toEqual([9]);
    expect(game.selectedIds).toEqual([]);
  });

  it('rejects a selection that goes over ten', () => {
    const game = gameWith(friends, 6, 5);
    game.select(101);
    expect(game.select(102)).toEqual({ type: 'mismatch', ids: [101, 102] });
    expect(game.selectedIds).toEqual([]);
  });

  it('rejects three numbers that do not make ten', () => {
    const game = gameWith(friends, 2, 3, 4);
    game.select(101);
    game.select(102);
    expect(game.select(103)).toEqual({ type: 'mismatch', ids: [101, 102, 103] });
    expect(game.bonus).toBe(friends.startBonus);
  });

  it('lets the player deselect one of the chosen numbers', () => {
    const game = gameWith(friends, 2, 3);
    game.select(101);
    game.select(102);
    game.select(101);
    expect(game.selectedValues).toEqual([3]);
  });

  it('generates numbers at random without helping with friends', () => {
    expect(friends.complementChance).toBe(0);
    const game = new NumberRainGame(friends, () => 0.5);
    game.numbers = [{ id: 101, value: 3, lane: 0, y: 0.9 }];
    game.tick(0.016);

    const spawned = game.numbers.find((item) => item.id !== 101)!;
    expect(spawned.value).toBe(5);
  });

  it('sometimes drops a jolly', () => {
    const game = new NumberRainGame(friends, () => 0);
    game.tick(0.016);
    expect(game.numbers[0]).toEqual(expect.objectContaining({ jolly: true, value: 0 }));
  });

  it('completes ten with a jolly and any number', () => {
    const game = gameWith(friends, 6, 9);
    game.numbers.push({ id: 200, value: 0, lane: 5, y: 0.5, jolly: true });
    game.select(200);
    expect(game.select(101)).toEqual(expect.objectContaining({ type: 'match', ids: [200, 101], sum: 10 }));
    expect(game.bonus).toBe(friends.startBonus + 10);
  });

  it('gives 20 points when a jolly completes ten after two numbers', () => {
    const game = gameWith(friends, 2, 3);
    game.numbers.push({ id: 200, value: 0, lane: 5, y: 0.5, jolly: true });
    game.select(101);
    game.select(102);
    expect(game.select(200)).toEqual(expect.objectContaining({ type: 'match', sum: 20 }));
    expect(game.bonus).toBe(friends.startBonus + 20);
    expect(game.numbers).toEqual([]);
  });

  it('does not lose points when a jolly reaches the ground', () => {
    const game = gameWith(friends);
    game.numbers.push({ id: 200, value: 0, lane: 5, y: 0.999, jolly: true });
    game.tick(0.1);
    expect(game.bonus).toBe(friends.startBonus);
    expect(game.numbers.some((item) => item.id === 200)).toBe(false);
  });

  it('wins when the bonus reaches one hundred', () => {
    const game = gameWith(friends, 4, 6);
    game.bonus = 95;
    game.select(101);
    game.select(102);

    expect(game.bonus).toBe(105);
    expect(game.isWon).toBe(true);
    expect(game.isOver).toBe(true);
    expect(game.tick(0.1)).toEqual([]);
  });
});

describe('NumberRainGame', () => {
  it('spawns a number on the first tick', () => {
    const game = new NumberRainGame(rain, () => 0.5);
    game.tick(0.016);
    expect(game.numbers.length).toBe(1);
  });

  it('removes a valid pair and adds its sum to the bonus', () => {
    const game = gameWith(rain, 37, 23, 5);
    game.select(101);
    const event = game.select(102);

    expect(event).toEqual(expect.objectContaining({ type: 'match', sum: 60 }));
    expect(game.bonus).toBe(rain.startBonus + 60);
    expect(game.pairs).toBe(1);
    expect(game.numbers.map((item) => item.value)).toEqual([5]);
  });

  it('keeps the numbers and the bonus on an invalid group', () => {
    const game = gameWith(friends, 6, 5);
    game.select(101);
    const event = game.select(102);

    expect(event).toEqual({ type: 'mismatch', ids: [101, 102] });
    expect(game.bonus).toBe(friends.startBonus);
    expect(game.numbers.length).toBe(2);
    expect(game.selectedIds).toEqual([]);
  });

  it('deselects a number when it is selected twice', () => {
    const game = gameWith(rain, 37);
    game.select(101);
    game.select(101);
    expect(game.selectedIds).toEqual([]);
  });

  it('subtracts the value of a number that reaches the ground', () => {
    const game = gameWith(rain, 42);
    game.numbers[0].y = 0.999;

    const events = game.tick(0.1);

    expect(events).toContainEqual(expect.objectContaining({ type: 'landed', value: 42 }));
    expect(game.bonus).toBe(rain.startBonus - 42);
    expect(game.numbers.some((item) => item.value === 42)).toBe(false);
  });

  it('ends the game when the bonus reaches zero', () => {
    const game = gameWith(rain, 99);
    game.bonus = 99;
    game.numbers[0].y = 0.999;

    game.tick(0.1);

    expect(game.bonus).toBe(0);
    expect(game.isOver).toBe(true);
    expect(game.tick(0.1)).toEqual([]);
  });

  it('never moves numbers by more than a short step after a long pause', () => {
    const game = gameWith(rain, 11);
    game.tick(5);
    expect(game.numbers[0].y).toBeLessThan(0.52);
  });

  it('gets faster as levels go up', () => {
    const game = new NumberRainGame(rain, () => 0.5);
    const startSpeed = game.fallSpeed;
    const startInterval = game.spawnInterval;
    game.elapsed = LEVEL_SECONDS * 2;

    expect(game.level).toBe(3);
    expect(game.fallSpeed).toBeGreaterThan(startSpeed);
    expect(game.spawnInterval).toBeLessThan(startInterval);
  });

  it('can spawn a complement of a number already in the field', () => {
    // 0.1: niente jolly (soglia 0.08) ma aiuto sul complemento attivo (soglia 0.4).
    const game = new NumberRainGame(rain, () => 0.1);
    game.numbers = [{ id: 101, value: 37, lane: 0, y: 0.9 }];

    game.tick(0.016);

    const spawned = game.numbers.find((item) => item.id !== 101)!;
    expect(rain.isMatch([37, spawned.value])).toBe(true);
  });
});
