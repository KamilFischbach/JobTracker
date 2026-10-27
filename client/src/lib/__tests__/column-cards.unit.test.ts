import { describe, expect, it } from 'vitest';
import { COLUMN_CARD_LIMIT, getShownCards } from '../column-cards';

const cards = Array.from({ length: 8 }, (_, index) => index);

describe('getShownCards', () => {
  it('shows only the first cards of a collapsed column', () => {
    expect(getShownCards(cards, { expanded: false, showAll: false })).toEqual(
      cards.slice(0, COLUMN_CARD_LIMIT),
    );
  });

  it('shows every card when the column is expanded or all cards should show', () => {
    expect(getShownCards(cards, { expanded: true, showAll: false })).toEqual(
      cards,
    );
    expect(getShownCards(cards, { expanded: false, showAll: true })).toEqual(
      cards,
    );
  });

  it('leaves short columns alone', () => {
    expect(getShownCards([1, 2], { expanded: false, showAll: false })).toEqual([
      1, 2,
    ]);
  });
});
