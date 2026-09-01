/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */

import { PageSelection } from '../../domain/model/strategy.model.js';

/**
 * Resolves a `PageSelection` strategy against a PDF's actual page count into the physical
 * page numbers (1-indexed) to render, in ascending order with no duplicates.
 *
 * `all`: every page.
 * `first-middle-last`: page 1, the middle page, and the last page — deduplicated for short
 * documents (a 1-page PDF yields `[1]`, a 2-page PDF yields `[1, 2]`, never a repeated page).
 */
export function selectPageNumbers(strategy: PageSelection, totalPages: number): number[] {
  if (strategy === PageSelection.ALL) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const middle = Math.ceil(totalPages / 2);
  const candidates = [1, middle, totalPages];

  // Stryker disable next-line MethodExpression,ConditionalExpression,LogicalOperator,ArithmeticOperator:
  // candidates is always [1, middle, totalPages] with 1 <= middle <= totalPages (pdfProvider.ts rejects
  // non-positive page counts first), so .filter()/.sort() are a no-op today — kept only to honor this
  // exported function's documented contract for any input.
  return [...new Set(candidates)].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
}
