import { describe, expect, it } from 'vitest';
import { playerColorFor } from './player-color';

describe('playerColorFor', () => {
  it('always gives the human player the same accent color, regardless of their id', () => {
    expect(playerColorFor('p1', 'p1')).toBe(playerColorFor('human', 'human'));
  });

  it('gives bots a color independent of the human id', () => {
    const colorAsP1Human = playerColorFor('bot2', 'p1');
    const colorAsHumanHuman = playerColorFor('bot2', 'human');
    expect(colorAsP1Human).toBe(colorAsHumanHuman);
  });

  it('gives the same bot id the same color every time (stable across renders)', () => {
    expect(playerColorFor('bot3', 'human')).toBe(playerColorFor('bot3', 'human'));
  });

  it('gives different-numbered bots different colors when possible', () => {
    expect(playerColorFor('bot1', 'human')).not.toBe(playerColorFor('bot2', 'human'));
  });
});
