import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { factKey, FactStats } from './fact-stats';

describe('FactStats', () => {
  let stats: FactStats;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    stats = TestBed.inject(FactStats);
  });

  it('treats 3 × 7 and 7 × 3 as the same fact', () => {
    expect(factKey(7, 3)).toBe(factKey(3, 7));
    stats.record(7, 3, false);
    expect(stats.status(3, 7)).toBe('weak');
  });

  it('needs more right answers than wrong ones to learn a fact', () => {
    expect(stats.status(7, 8)).toBe('new');
    stats.record(7, 8, false);
    stats.record(7, 8, true);
    expect(stats.status(7, 8)).toBe('weak');
    stats.record(7, 8, true);
    expect(stats.status(7, 8)).toBe('learning');
    stats.record(7, 8, true);
    stats.record(7, 8, true);
    stats.record(7, 8, true);
    expect(stats.status(7, 8)).toBe('known');
  });

  it('remembers the answers in the browser', () => {
    stats.record(6, 9, false);
    TestBed.resetTestingModule();
    expect(TestBed.inject(FactStats).status(9, 6)).toBe('weak');
  });

  it('asks the wrong facts first', () => {
    stats.record(6, 9, false);
    stats.record(4, 7, false);
    const questions = stats.reviewQuestions(10, () => 0.3);
    expect(questions.length).toBe(10);
    expect(questions.slice(0, 2).map((fact) => factKey(fact.first, fact.second)).sort()).toEqual(['4x7', '6x9']);
  });

  it('remembers which games of the review path are done', () => {
    expect(stats.missingGames().length).toBe(4);
    stats.markPlayed('grid');
    stats.markPlayed('grid');
    expect(stats.played()).toEqual(['grid']);
    TestBed.resetTestingModule();
    expect(TestBed.inject(FactStats).missingGames().map((game) => game.id)).toEqual(['tables', 'missing', 'battleship']);
  });

  it('forgets everything on reset, games included', () => {
    stats.record(6, 9, false);
    stats.markPlayed('grid');
    stats.reset();
    expect(stats.status(6, 9)).toBe('new');
    expect(stats.played()).toEqual([]);
  });
});
