/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */
import { z } from 'zod';
import type { Cradle } from '../../../infrastructure/container.js';
import { PageSelection } from '../../../domain/model/strategy.model.js';
import { UdsServerMessage } from '../messages.js';

const ExtractRequestSchema = z.object({
  op: z.literal('extract'),
  config: z.object({
    page_selection: z.string(),
    dpi: z.number(),
  }),
  inputs: z.record(z.string(), z.object({ path: z.string() })),
});

export type ExtractRequestMessage = z.infer<typeof ExtractRequestSchema>;

export interface ExtractResponseMessage {
  outputs: Record<string, unknown>;
}

const VALID_PAGE_SELECTIONS: string[] = Object.values(PageSelection);

/** Request-level `config` problems that must fail every item in the batch rather than being handled per-item. */
function findConfigError(config: { page_selection: string; dpi: number }): string | undefined {
  if (!VALID_PAGE_SELECTIONS.includes(config.page_selection)) {
    return `unsupported page_selection "${config.page_selection}"`;
  }
  if (!Number.isInteger(config.dpi) || config.dpi <= 0) {
    return `unsupported dpi "${String(config.dpi)}" (must be a positive integer)`;
  }

  return undefined;
}

export async function handleExtract(message: unknown, cradle: Cradle): Promise<ExtractResponseMessage | null> {
  const parsed = ExtractRequestSchema.safeParse(message);

  if (!parsed.success) {
    cradle.logger.warn({ err: parsed.error }, UdsServerMessage.MALFORMED_EXTRACT_REQUEST);

    return null;
  }

  const { config, inputs } = parsed.data;
  const configError = findConfigError(config);

  if (configError !== undefined) {
    // Malformed at the request level (not per-item) — report every input as internal_error rather than defaulting.
    const errorEntry = { error: { code: 'internal_error', message: configError } };

    return { outputs: Object.fromEntries(Object.keys(inputs).map((id) => [id, errorEntry])) };
  }

  const outputs = await cradle.pdfExtractService.extractBatch(
    {
      pageSelection: config.page_selection as PageSelection,
      dpi: config.dpi,
    },
    inputs,
  );

  return { outputs };
}
