import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { Card } from '@brass/domain';
import { HandCardComponent } from './hand-card.component';

describe('HandCardComponent', () => {
  it('renders the card label and reacts to selection state via classes', () => {
    const fixture = TestBed.createComponent(HandCardComponent);
    const card: Card = { kind: 'industry', industry: 'coal' };
    fixture.componentRef.setInput('card', card);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.hand-card') as HTMLButtonElement;
    expect(button.textContent).toContain('coal');
    expect(button.classList.contains('selected')).toBe(false);

    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();
    expect(button.classList.contains('selected')).toBe(true);
  });

  it('marks wild cards with the wild class', () => {
    const fixture = TestBed.createComponent(HandCardComponent);
    fixture.componentRef.setInput('card', { kind: 'wildLocation' } as Card);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button.hand-card') as HTMLButtonElement;
    expect(button.classList.contains('wild')).toBe(true);
  });

  it('emits cardClick on click', () => {
    const fixture = TestBed.createComponent(HandCardComponent);
    fixture.componentRef.setInput('card', { kind: 'industry', industry: 'iron' } as Card);
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.cardClick.subscribe(() => (emitted = true));
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(emitted).toBe(true);
  });
});
