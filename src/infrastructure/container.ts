/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */
import { createContainer, asClass, asValue, InjectionMode, type AwilixContainer } from 'awilix';
import pino from 'pino';
import type { Env } from './env/env.js';
import { createLoggerOptions } from './logger.js';
import { PdfProvider } from './pdf/pdfProvider.js';
import { IdProvider } from './id/idProvider.js';
import { TtlSweeper } from './storage/ttlSweeper.js';
import { PdfExtractService } from '../application/service/extract.service.js';

export interface Cradle {
  env: Env;
  logger: pino.Logger;

  pdfExtractor: PdfProvider;
  idGenerator: IdProvider;
  pdfExtractService: PdfExtractService;
  ttlSweeper: TtlSweeper;
}

export interface BuiltContainer {
  container: AwilixContainer<Cradle>;
  cleanup: () => Promise<void>;
}

export function buildContainer(env: Env): BuiltContainer {
  const container = createContainer<Cradle>({ injectionMode: InjectionMode.CLASSIC });
  const logger = pino(createLoggerOptions(env));

  container.register({
    env: asValue(env),
    logger: asValue(logger),

    pdfExtractor: asClass(PdfProvider).singleton(),
    idGenerator: asClass(IdProvider).singleton(),
    pdfExtractService: asClass(PdfExtractService).singleton(),
    ttlSweeper: asClass(TtlSweeper).singleton(),
  });

  const stopTtlSweep = container.cradle.ttlSweeper.start();

  return {
    container,
    cleanup: (): Promise<void> => {
      stopTtlSweep();

      return Promise.resolve();
    },
  };
}
