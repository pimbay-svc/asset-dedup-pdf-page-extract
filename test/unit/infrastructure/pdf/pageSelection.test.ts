import { describe, it, expect } from 'vitest';
import { selectPageNumbers } from '../../../../src/infrastructure/pdf/pageSelection.js';
import { PageSelection } from '../../../../src/domain/model/strategy.model.js';

describe('selectPageNumbers', () => {
  describe('all', () => {
    it('returns every page number from 1 to totalPages', () => {
      expect(selectPageNumbers(PageSelection.ALL, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns a single-entry array for a 1-page document', () => {
      expect(selectPageNumbers(PageSelection.ALL, 1)).toEqual([1]);
    });
  });

  describe('first-middle-last', () => {
    it.each([
      { name: 'returns first, middle, and last for a document with enough pages', totalPages: 5, expected: [1, 3, 5] },
      {
        name: 'rounds the middle page up for an even page count',
        // totalPages=6 -> middle = ceil(6/2) = 3
        totalPages: 6,
        expected: [1, 3, 6],
      },
      { name: 'deduplicates to a single page for a 1-page document', totalPages: 1, expected: [1] },
      {
        name: 'deduplicates to two pages for a 2-page document',
        // candidates: 1, ceil(2/2)=1, 2 -> unique [1, 2]
        totalPages: 2,
        expected: [1, 2],
      },
      {
        name: 'deduplicates to two pages for a 3-page document where middle coincides with an edge',
        // candidates: 1, ceil(3/2)=2, 3 -> already unique [1, 2, 3]
        totalPages: 3,
        expected: [1, 2, 3],
      },
    ])('$name', ({ totalPages, expected }) => {
      expect(selectPageNumbers(PageSelection.FIRST_MIDDLE_LAST, totalPages)).toEqual(expected);
    });

    it('returns results sorted ascending regardless of internal candidate order', () => {
      const result = selectPageNumbers(PageSelection.FIRST_MIDDLE_LAST, 10);
      expect(result).toEqual([...result].sort((a, b) => a - b));
    });
  });
});
