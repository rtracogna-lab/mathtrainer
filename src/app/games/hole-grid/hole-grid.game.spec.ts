import { describe, expect, it } from 'vitest';
import { HoleGridGame } from './hole-grid.game';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('HoleGridGame', () => {
  it('builds the 10 × 10 multiplication table', () => {
    const game = new HoleGridGame({}, seeded(1));
    expect(game.cells.length).toBe(100);
    expect(game.cell(7, 8).value).toBe(56);
    expect(game.cell(10, 10).value).toBe(100);
  });

  it('makes 12 holes in easy mode, never together with their mirror', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = new HoleGridGame({ easy: true }, seeded(seed));
      expect(game.holes.length).toBe(12);
      expect(game.emptyRow).toBeNull();
      for (const hole of game.holes) {
        expect(hole.row).toBeGreaterThan(1);
        expect(hole.col).toBeGreaterThan(1);
        if (hole.row !== hole.col) {
          expect(game.cell(hole.col, hole.row).hole).toBe(false);
        }
      }
    }
  });

  it('empties a whole row plus 15 holes in hard mode', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const game = new HoleGridGame({}, seeded(seed));
      const row = game.emptyRow!;
      expect(row).toBeGreaterThanOrEqual(3);
      expect(row).toBeLessThanOrEqual(9);
      expect(game.cells.filter((cell) => cell.row === row).every((cell) => cell.hole)).toBe(true);
      expect(game.holes.length).toBe(25);
    }
  });

  it('fills a hole with the right product and counts wrong answers', () => {
    const game = new HoleGridGame({ easy: true }, seeded(3));
    const hole = game.holes[0];
    expect(game.answer(hole, hole.value + 1)).toBe(false);
    expect(game.errors).toBe(1);
    expect(game.answer(hole, hole.value)).toBe(true);
    expect(hole.solved).toBe(true);
    expect(game.remaining).toBe(11);
  });

  it('moves to the next open hole and wraps around', () => {
    const game = new HoleGridGame({ easy: true }, seeded(5));
    const [first, second] = game.holes;
    const last = game.holes[game.holes.length - 1];
    expect(game.nextHole(null)).toBe(first);
    expect(game.nextHole(first)).toBe(second);
    expect(game.nextHole(last)).toBe(first);
  });

  it('is complete when every hole is filled', () => {
    const game = new HoleGridGame({ easy: true }, seeded(9));
    game.holes.forEach((hole) => game.answer(hole, hole.value));
    expect(game.isComplete).toBe(true);
    expect(game.nextHole(null)).toBeNull();
  });
});
