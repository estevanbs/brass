import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PlayerColorService } from './player-color.service';

describe('PlayerColorService', () => {
  it('delegates to the domain player-color assignment', () => {
    const service = TestBed.inject(PlayerColorService);
    expect(service.colorFor('p1', 'p1')).toBe(service.colorFor('human', 'human'));
    expect(service.colorFor('bot2', 'human')).not.toBe(service.colorFor('human', 'human'));
  });
});
