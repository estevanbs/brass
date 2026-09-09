import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { IncomeService } from './income.service';

describe('IncomeService', () => {
  it('delegates to the domain income formula', () => {
    const service = TestBed.inject(IncomeService);
    expect(service.levelForPosition(10)).toBe(0);
    expect(service.levelForPosition(13)).toBe(2);
  });
});
