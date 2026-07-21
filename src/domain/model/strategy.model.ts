/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */
export const PageSelection = {
  FIRST_MIDDLE_LAST: 'first-middle-last',
  ALL: 'all',
} as const;

export type PageSelection = (typeof PageSelection)[keyof typeof PageSelection];
