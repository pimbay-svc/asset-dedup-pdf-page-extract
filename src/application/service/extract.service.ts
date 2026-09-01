/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */
import type pino from 'pino';
import type { PdfExtractor } from '../../domain/provider/pdf.provider.js';
import type { IdGenerator } from '../../domain/provider/id.provider.js';
import type { PageSelection } from '../../domain/model/strategy.model.js';
import { CorruptInputError } from '../../domain/errors.js';
import { ExtractServiceMessage } from '../messages.js';

export interface ExtractPagesConfig {
  pageSelection: PageSelection;
  dpi: number;
}

export interface ExtractPagesInputItem {
  path: string;
}

export interface ExtractPagesSuccess {
  paths: string[];
}

export interface ExtractPagesFailure {
  error: { code: string; message: string };
}

export type ExtractPagesItemResult = ExtractPagesSuccess | ExtractPagesFailure;

export class PdfExtractService {
  constructor(
    private readonly pdfExtractor: PdfExtractor,
    private readonly idGenerator: IdGenerator,
    private readonly logger: pino.Logger,
  ) {}

  /**
   * Extracts pages for every item in `inputs` independently — one item's failure never blocks the
   * rest — reporting each result (success or error) under its own key, mirroring `inputs` exactly.
   */
  async extractBatch(
    config: ExtractPagesConfig,
    inputs: Record<string, ExtractPagesInputItem>,
  ): Promise<Record<string, ExtractPagesItemResult>> {
    const entries = await Promise.all(
      Object.entries(inputs).map(async ([id, item]): Promise<[string, ExtractPagesItemResult]> => {
        return [id, await this.extractOne(config, item)];
      }),
    );

    return Object.fromEntries(entries);
  }

  private async extractOne(config: ExtractPagesConfig, item: ExtractPagesInputItem): Promise<ExtractPagesItemResult> {
    try {
      const pages = await this.pdfExtractor.extractPages(item.path, {
        dpi: config.dpi,
        pageSelection: config.pageSelection,
        uniqueId: this.idGenerator.generateUnique(),
      });

      return { paths: pages.map((page) => page.path) };
    } catch (err) {
      const payload = toErrorPayload(err);

      if (payload.code === 'internal_error') {
        this.logger.error({ err }, ExtractServiceMessage.EXTRACTION_FAILED);
      }

      return { error: payload };
    }
  }
}

function toErrorPayload(err: unknown): { code: string; message: string } {
  if (err instanceof CorruptInputError) {
    return { code: 'corrupt_input', message: err.message };
  }

  return { code: 'internal_error', message: 'internal error during page extraction' };
}
