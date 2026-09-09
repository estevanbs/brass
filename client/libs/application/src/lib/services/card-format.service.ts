import { Injectable } from '@angular/core';
import {
  cardIcon as cardIconOf,
  cardKey as cardKeyOf,
  cardLabel as cardLabelOf,
  cardTypeLabel as cardTypeLabelOf,
  industryIcon as industryIconOf,
  isWildCard,
} from '@brass/domain';
import type { Card, IndustryType } from '@brass/domain';

/**
 * Thin injectable wrapper around `domain`'s pure card-formatting functions — every component
 * that renders a card (hand, popups, tooltips) injects this instead of importing the pure
 * functions directly, so presentation always depends on `application` and never reaches past
 * it into `domain` for anything beyond plain types.
 */
@Injectable({ providedIn: 'root' })
export class CardFormatService {
  cardKey(card: Card): string {
    return cardKeyOf(card);
  }

  label(card: Card): string {
    return cardLabelOf(card);
  }

  icon(card: Card): string {
    return cardIconOf(card);
  }

  isWild(card: Card): boolean {
    return isWildCard(card);
  }

  typeLabel(card: Card): string {
    return cardTypeLabelOf(card);
  }

  industryIcon(industry: IndustryType): string {
    return industryIconOf(industry);
  }
}
