import { describe, expect, it } from 'vitest';
import { BattleshipGame } from './battleship.game';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function shipCells(game: BattleshipGame, ship: number) {
  return game.squares.filter((square) => square.ship === ship);
}

describe('BattleshipGame', () => {
  it('uses a 6 × 6 sea with three ships in easy mode', () => {
    const game = new BattleshipGame({ easy: true }, seeded(1));
    expect(game.factors).toEqual([2, 3, 4, 5, 6, 7]);
    expect(game.squares.length).toBe(36);
    expect(game.fleet).toEqual([3, 2, 2]);
  });

  it('uses an 8 × 8 sea with four ships in hard mode', () => {
    const game = new BattleshipGame({}, seeded(1));
    expect(game.factors).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
    expect(game.fleet).toEqual([4, 3, 3, 2]);
  });

  it('places straight ships that never touch each other', () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const game = new BattleshipGame({ easy: seed % 2 === 0 }, seeded(seed));
      game.fleet.forEach((length, ship) => {
        const cells = shipCells(game, ship);
        expect(cells.length).toBe(length);
        const rows = new Set(cells.map((cell) => cell.row));
        const cols = new Set(cells.map((cell) => cell.col));
        expect(rows.size === 1 || cols.size === 1).toBe(true);
        for (const cell of cells) {
          const neighbours = game.squares.filter((other) => Math.abs(other.row - cell.row) <= 1 && Math.abs(other.col - cell.col) <= 1);
          expect(neighbours.every((other) => other.ship === null || other.ship === ship)).toBe(true);
        }
      });
    }
  });

  it('loses the shot when the multiplication is wrong', () => {
    const game = new BattleshipGame({ easy: true }, seeded(2));
    const square = game.square(7, 6);
    expect(game.fire(square, 41)).toEqual({ type: 'wrong', answer: 42 });
    expect(game.errors).toBe(1);
    expect(game.shots).toBe(0);
    expect(square.shot).toBeNull();
  });

  it('hits, misses and sinks ships with the right answers', () => {
    const game = new BattleshipGame({ easy: true }, seeded(3));
    const water = game.squares.find((square) => square.ship === null)!;
    expect(game.fire(water, water.row * water.col)).toEqual({ type: 'miss' });
    expect(game.fire(water, water.row * water.col)).toBeNull();

    const [first, ...rest] = shipCells(game, 0);
    expect(game.fire(first, first.row * first.col)).toEqual({ type: 'hit' });
    const last = rest.pop()!;
    rest.forEach((part) => game.fire(part, part.row * part.col));
    expect(game.fire(last, last.row * last.col)).toEqual({ type: 'sunk', length: 3 });
    expect(game.sunkShips).toEqual([0]);
    expect(game.isWon).toBe(false);
  });

  it('is won when every ship is sunk', () => {
    const game = new BattleshipGame({ easy: true }, seeded(4));
    game.squares.filter((square) => square.ship !== null).forEach((square) => game.fire(square, square.row * square.col));
    expect(game.isWon).toBe(true);
  });
});
