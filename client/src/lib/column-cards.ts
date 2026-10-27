/** Cards a column shows before its "Show more" button. */
export const COLUMN_CARD_LIMIT = 5;

/**
 * The cards a column shows: the first few, unless the column is expanded or
 * every card should show (e.g. while searching, so matches are never hidden).
 */
export function getShownCards<T>(
  cards: T[],
  { expanded, showAll }: { expanded: boolean; showAll: boolean },
): T[] {
  return expanded || showAll ? cards : cards.slice(0, COLUMN_CARD_LIMIT);
}
