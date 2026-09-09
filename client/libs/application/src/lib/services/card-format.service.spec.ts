import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CardFormatService } from './card-format.service';

describe('CardFormatService', () => {
  it('is providable via DI and delegates to the domain formatting functions', () => {
    const service = TestBed.inject(CardFormatService);
    const card = { kind: 'industry' as const, industry: 'coal' as const };

    expect(service.cardKey(card)).toBe('industry:coal');
    expect(service.label(card)).toBe('coal');
    expect(service.typeLabel(card)).toBe('indústria');
    expect(service.isWild(card)).toBe(false);
    expect(service.icon(card).length).toBeGreaterThan(0);
    expect(service.industryIcon('coal').length).toBeGreaterThan(0);
    expect(service.merchantIcon('wild').length).toBeGreaterThan(0);
    expect(service.merchantBonusLabel({ kind: 'money', amount: 5 })).toBe('+£5');
  });
});
