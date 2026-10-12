import { describe, expect, it } from 'vitest';
import { GameVariant, LEVEL_SECONDS, NumberRainGame, VARIANTS } from './number-rain.game';

const rain = VARIANTS.rain;
const friends = VARIANTS.friends;
const product = VARIANTS.product;
const division = VARIANTS.division;
const subtraction = VARIANTS.subtraction;

function gameWith(variant: GameVariant, ...values: number[]): NumberRainGame {
  const game = new NumberRainGame(variant, () => 0);
  game.numbers = values.map((value, index) => ({ id: 101 + index, value, lane: index, y: 0.5 }));
  return game;
}

function targetGameWith(variant: GameVariant, target: number, ...values: number[]): NumberRainGame {
  const game = gameWith(variant, ...values);
  game.target = target;
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
    expect(events).toContainEqual(expect.objectContaining({ penalty: 21 }));
    expect(game.bonus).toBe(rain.startBonus - 21);
    expect(game.numbers.some((item) => item.value === 42)).toBe(false);
  });

  it('ends the game when the bonus reaches zero', () => {
    const game = gameWith(rain, 99);
    game.bonus = 49;
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

describe('Prodotto bersaglio', () => {
  it('starts with a target that is a product of two easy factors', () => {
    const game = new NumberRainGame(product, () => 0.5);
    expect(game.target).not.toBeNull();
    const target = game.target!;
    const factors = [2, 3, 4, 5, 6];
    expect(factors.some((a) => factors.some((b) => a * b === target))).toBe(true);
  });

  it('hits the target with two factors and picks a new target', () => {
    const game = targetGameWith(product, 24, 3, 8, 5);
    game.select(101);
    expect(game.select(102)).toEqual(expect.objectContaining({ type: 'match', sum: 10 }));
    expect(game.bonus).toBe(product.startBonus + 10);
    expect(game.target).not.toBe(24);
  });

  it('gives 20 points with three factors', () => {
    const game = targetGameWith(product, 24, 2, 3, 4);
    game.select(101);
    expect(game.select(102)).toBeNull();
    expect(game.select(103)).toEqual(expect.objectContaining({ type: 'match', sum: 20 }));
  });

  it('rejects factors whose product does not divide the target', () => {
    const game = targetGameWith(product, 24, 4, 5);
    game.select(101);
    expect(game.select(102)).toEqual({ type: 'mismatch', ids: [101, 102] });
  });

  it('uses the jolly as the missing factor only when it is between 2 and 10', () => {
    expect(product.completeWithJolly([6], 24)).toBe(24);
    expect(product.completeWithJolly([2, 3], 24)).toBe(24);
    expect(product.completeWithJolly([2], 24)).toBeNull();
    expect(product.completeWithJolly([5], 24)).toBeNull();
  });

  it('only drops factors from 2 to 10', () => {
    const values = spawnedValues(product, 300);
    expect(values.every((value) => value >= 2 && value <= 10)).toBe(true);
  });

  it('often drops a factor of the current target', () => {
    // 0.1: niente jolly (soglia 0.08) e numero utile (soglia 0.5).
    const game = new NumberRainGame(product, () => 0.1);
    game.target = 24;
    game.tick(0.016);
    expect(24 % game.numbers[0].value).toBe(0);
  });

  it('loses three points when a number reaches the ground', () => {
    const game = targetGameWith(product, 24, 9);
    game.numbers[0].y = 0.999;
    const events = game.tick(0.1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'landed', value: 9, penalty: 3 }));
    expect(game.bonus).toBe(product.startBonus - 3);
  });
});

describe('Divisione bersaglio', () => {
  it('hits the target with a dividend and a divisor in any order', () => {
    const game = targetGameWith(division, 6, 7, 42);
    game.select(101);
    expect(game.select(102)).toEqual(expect.objectContaining({ type: 'match', sum: 10 }));
    expect(game.target).not.toBe(6);
  });

  it('rejects a division that gives another result', () => {
    const game = targetGameWith(division, 6, 42, 6);
    game.select(101);
    expect(game.select(102)).toEqual({ type: 'mismatch', ids: [101, 102] });
    expect(game.bonus).toBe(division.startBonus);
  });

  it('writes the division with the bigger number first', () => {
    expect(division.combine([7, 42])).toBe(6);
    expect(division.combine([5, 42])).toBeNull();
  });

  it('uses the jolly as divisor or dividend', () => {
    expect(division.completeWithJolly([42], 6)).toBe(6);
    expect(division.completeWithJolly([7], 6)).toBe(6);
    expect(division.completeWithJolly([45], 6)).toBeNull();
  });

  it('starts with easy targets from 2 to 5', () => {
    for (const seed of [0, 0.3, 0.6, 0.99]) {
      const target = new NumberRainGame(division, () => seed).target!;
      expect(target).toBeGreaterThanOrEqual(2);
      expect(target).toBeLessThanOrEqual(5);
    }
  });

  it('drops half of a correct division for the current target', () => {
    // 0.1: niente jolly, numero utile, divisore 2 e scelta del divisore (0.1 < 0.5).
    const game = new NumberRainGame(division, () => 0.1);
    game.target = 6;
    game.tick(0.016);
    expect(game.numbers[0].value).toBe(2);
  });
});

describe('Sottrazione bersaglio', () => {
  it('hits the target with two numbers in any order', () => {
    const game = targetGameWith(subtraction, 6, 7, 13);
    game.select(101);
    expect(game.select(102)).toEqual(expect.objectContaining({ type: 'match', sum: 10 }));
    expect(game.target).not.toBe(6);
  });

  it('gives 20 points when the biggest number minus two others makes the target', () => {
    const game = targetGameWith(subtraction, 10, 20, 7, 3);
    game.select(101);
    expect(game.select(102)).toBeNull();
    expect(game.select(103)).toEqual(expect.objectContaining({ type: 'match', sum: 20 }));
  });

  it('rejects a difference that is already smaller than the target', () => {
    const game = targetGameWith(subtraction, 6, 13, 8);
    game.select(101);
    expect(game.select(102)).toEqual({ type: 'mismatch', ids: [101, 102] });
  });

  it('subtracts the smaller numbers from the biggest', () => {
    expect(subtraction.combine([7, 13])).toBe(6);
    expect(subtraction.combine([3, 20, 7])).toBe(10);
  });

  it('uses the jolly as the missing number', () => {
    expect(subtraction.completeWithJolly([13], 6)).toBe(6);
    expect(subtraction.completeWithJolly([20, 7], 10)).toBe(10);
    expect(subtraction.completeWithJolly([13, 8], 6)).toBeNull();
  });

  it('only drops numbers from 1 to 30', () => {
    const values = spawnedValues(subtraction, 300);
    expect(values.every((value) => value >= 1 && value <= 30)).toBe(true);
  });

  it('drops half of a correct subtraction for the current target', () => {
    // 0.1: niente jolly, numero utile, sottraendo 3 e scelta del sottraendo (0.1 < 0.5).
    const game = new NumberRainGame(subtraction, () => 0.1);
    game.target = 6;
    game.tick(0.016);
    expect(game.numbers[0].value).toBe(3);
  });
});

describe('Velocita di caduta', () => {
  it('is slower in the target games', () => {
    const rainSpeed = new NumberRainGame(rain).fallSpeed;
    for (const variant of [product, division, subtraction]) {
      expect(new NumberRainGame(variant).fallSpeed).toBeCloseTo(rainSpeed * 0.55);
    }
    expect(new NumberRainGame(friends).fallSpeed).toBe(rainSpeed);
  });

  it('takes about 18 seconds to fall at the first level, about 33 in the target games', () => {
    expect(1 / new NumberRainGame(rain).fallSpeed).toBeCloseTo(18.2, 0);
    expect(1 / new NumberRainGame(product).fallSpeed).toBeCloseTo(33.1, 0);
  });
});


describe('Penalita quando un numero tocca terra', () => {
  it('takes away half of the number, rounded down', () => {
    expect(rain.penalty(42)).toBe(21);
    expect(rain.penalty(37)).toBe(18);
    expect(friends.penalty(7)).toBe(3);
    expect(friends.penalty(1)).toBe(0);
  });

  it('never takes away more than 3 points in the target games', () => {
    expect(product.penalty(4)).toBe(2);
    expect(product.penalty(9)).toBe(3);
    expect(division.penalty(100)).toBe(3);
    expect(subtraction.penalty(1)).toBe(0);
  });
});

describe('Modalita difficile', () => {
  it('only uses the base chance of useful numbers', () => {
    expect(new NumberRainGame(product).usefulChance).toBe(product.complementChance);
    expect(new NumberRainGame(friends).usefulChance).toBe(0);
  });

  it('can drop the exact partner of a number already in the field', () => {
    // 0.1: niente jolly, numero utile e compagno di un numero in campo.
    const game = new NumberRainGame(product, () => 0.1);
    game.target = 24;
    game.numbers = [{ id: 101, value: 3, lane: 0, y: 0.9 }];
    game.tick(0.016);

    const spawned = game.numbers.find((item) => item.id !== 101)!;
    expect(spawned.value).toBe(8);
  });

  it('keeps choosing random lanes', () => {
    const game = new NumberRainGame(product, () => 0.1);
    game.target = 24;
    game.numbers = [{ id: 101, value: 6, lane: 4, y: 0.5 }];
    game.tick(0.016);

    const spawned = game.numbers.find((item) => item.id !== 101)!;
    expect(spawned.value).toBe(4);
    expect(spawned.lane).toBe(0);
  });

  it('uses bigger subtraction targets later', () => {
    const game = new NumberRainGame(subtraction, () => 0.99);
    game.elapsed = 300;
    game.numbers = [
      { id: 900, value: game.target! + 1, lane: 0, y: 0.5 },
      { id: 901, value: 1, lane: 1, y: 0.5 },
    ];
    game.select(900);
    game.select(901);
    expect(game.target).toBe(20);
  });
});

describe('Modalita facile', () => {
  it('drops more useful numbers in every game', () => {
    expect(new NumberRainGame(product, Math.random, { easy: true }).usefulChance).toBeCloseTo(product.complementChance + 0.35);
    expect(new NumberRainGame(division, Math.random, { easy: true }).usefulChance).toBeLessThanOrEqual(0.95);
    expect(new NumberRainGame(friends, Math.random, { easy: true }).usefulChance).toBeCloseTo(0.35);
  });

  it('drops the partner of the newest number in the next free lane', () => {
    const game = new NumberRainGame(product, () => 0.1, { easy: true });
    game.target = 24;
    game.numbers = [
      { id: 101, value: 3, lane: 0, y: 0.8 },
      { id: 102, value: 6, lane: 4, y: 0.1 },
    ];
    game.tick(0.016);

    const spawned = game.numbers.find((item) => item.id !== 101 && item.id !== 102)!;
    // Il 6 e' entrato per ultimo (e' piu' in alto): cade il suo compagno 4,
    // nella colonna 3 o 5 perche' la 4 e' ancora occupata dal 6.
    expect(spawned.value).toBe(4);
    expect([3, 5]).toContain(spawned.lane);
  });

  it('drops the partner right next to the newest number in Amici del 10', () => {
    const game = new NumberRainGame(friends, () => 0.1, { easy: true });
    game.numbers = [{ id: 101, value: 3, lane: 2, y: 0.05 }];
    game.tick(0.016);

    const spawned = game.numbers.find((item) => item.id !== 101)!;
    expect(spawned.value).toBe(7);
    expect([1, 3]).toContain(spawned.lane);
  });

  it('keeps the subtraction target between 1 and 10 at every level', () => {
    const game = new NumberRainGame(subtraction, () => 0.99, { easy: true });
    game.elapsed = 300;
    for (let round = 0; round < 20; round += 1) {
      expect(game.target).toBeGreaterThanOrEqual(1);
      expect(game.target).toBeLessThanOrEqual(10);
      game.numbers = [
        { id: 900 + round * 2, value: game.target! + 1, lane: 0, y: 0.5 },
        { id: 901 + round * 2, value: 1, lane: 1, y: 0.5 },
      ];
      game.selectedIds = [];
      game.select(900 + round * 2);
      game.select(901 + round * 2);
    }
  });

  it('can pick a target of 1 in easy subtraction', () => {
    expect(new NumberRainGame(subtraction, () => 0, { easy: true }).target).toBe(1);
  });

  it('keeps the usual targets in the other games', () => {
    const easy = new NumberRainGame(product, () => 0.5, { easy: true });
    const hard = new NumberRainGame(product, () => 0.5);
    expect(easy.target).toBe(hard.target);
  });
});
