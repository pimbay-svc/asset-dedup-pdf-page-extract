/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */
import type { PageSelection } from '../model/strategy.model.js';

export interface ExtractedPage {
  index: number;
  pageNumber: number;
  /** Absolute path of the written PNG page on the shared volume. */
  path: string;
}

export interface ExtractPagesOptions {
  pageSelection: PageSelection;
  dpi: number;
  uniqueId: string;
}

export interface PdfExtractor {
  extractPages(pdfPath: string, options: ExtractPagesOptions): Promise<ExtractedPage[]>;
}
