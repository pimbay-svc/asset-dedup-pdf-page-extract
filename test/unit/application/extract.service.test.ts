import { describe, it, expect } from 'vitest';
import { PdfExtractService } from '../../../src/application/service/extract.service.js';
import { ExtractServiceMessage } from '../../../src/application/messages.js';
import { PageSelection } from '../../../src/domain/model/strategy.model.js';
import { CorruptInputError, InternalExtractionError } from '../../../src/domain/errors.js';
import type { PdfExtractor, ExtractedPage, ExtractPagesOptions } from '../../../src/domain/provider/pdf.provider.js';
import type { IdGenerator } from '../../../src/domain/provider/id.provider.js';
import { fakeLogger } from '../../helpers/logger.js';

class FakeUniqidGenerator implements IdGenerator {
  private counter = 0;

  generateUnique(): string {
    this.counter += 1;

    return `uid-${String(this.counter)}`;
  }
}

class FakePdfExtractor implements PdfExtractor {
  constructor(private readonly behavior: (pdfPath: string, options: ExtractPagesOptions) => Promise<ExtractedPage[]>) {}

  extractPages(pdfPath: string, options: ExtractPagesOptions): Promise<ExtractedPage[]> {
    return this.behavior(pdfPath, options);
  }
}

describe('PdfExtractService', () => {
  it('returns paths for every successful item, mirroring the input keys', async () => {
    const extractor = new FakePdfExtractor((pdfPath, options) =>
      Promise.resolve([
        { index: 0, pageNumber: 1, path: `/shared/out/${options.uniqueId}-0.png` },
        { index: 1, pageNumber: 3, path: `/shared/out/${options.uniqueId}-1.png` },
      ]),
    );
    const service = new PdfExtractService(extractor, new FakeUniqidGenerator(), fakeLogger());

    const outputs = await service.extractBatch(
      { pageSelection: PageSelection.FIRST_MIDDLE_LAST, dpi: 150 },
      { id1: { path: '/shared/a.pdf' } },
    );

    expect(outputs).toEqual({
      id1: { paths: ['/shared/out/uid-1-0.png', '/shared/out/uid-1-1.png'] },
    });
  });

  it('reports one item failing without affecting the rest of the batch, without logging a corrupt_input failure', async () => {
    const extractor = new FakePdfExtractor((pdfPath) => {
      if (pdfPath === '/shared/bad.pdf') {
        return Promise.reject(CorruptInputError.pageCountUndetermined('could not determine page count'));
      }

      return Promise.resolve([{ index: 0, pageNumber: 1, path: '/shared/out/uid-0.png' }]);
    });
    const logger = fakeLogger();
    const service = new PdfExtractService(extractor, new FakeUniqidGenerator(), logger);

    const outputs = await service.extractBatch(
      { pageSelection: PageSelection.ALL, dpi: 150 },
      { id1: { path: '/shared/good.pdf' }, id2: { path: '/shared/bad.pdf' } },
    );

    expect(outputs.id1).toEqual({ paths: ['/shared/out/uid-0.png'] });
    expect(outputs.id2).toEqual({ error: { code: 'corrupt_input', message: 'could not determine page count' } });
    // corrupt_input's message already carries the detail sent back to the client — nothing extra to log.
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps InternalExtractionError to a generic internal_error message (no internal detail leaked) and logs the real cause', async () => {
    const cause = InternalExtractionError.spawnFailed('pdftoppm', new Error('ENOENT: /tmp/x'));
    const extractor = new FakePdfExtractor(() => Promise.reject(cause));
    const logger = fakeLogger();
    const service = new PdfExtractService(extractor, new FakeUniqidGenerator(), logger);

    const outputs = await service.extractBatch(
      { pageSelection: PageSelection.ALL, dpi: 150 },
      { id1: { path: '/shared/a.pdf' } },
    );

    expect(outputs.id1).toEqual({
      error: { code: 'internal_error', message: 'internal error during page extraction' },
    });
    expect(logger.error).toHaveBeenCalledWith({ err: cause }, ExtractServiceMessage.EXTRACTION_FAILED);
  });

  it('maps an unexpected non-domain error to internal_error as a safety net, and logs it', async () => {
    const cause = new Error('unexpected');
    const extractor = new FakePdfExtractor(() => Promise.reject(cause));
    const logger = fakeLogger();
    const service = new PdfExtractService(extractor, new FakeUniqidGenerator(), logger);

    const outputs = await service.extractBatch(
      { pageSelection: PageSelection.ALL, dpi: 150 },
      { id1: { path: '/shared/a.pdf' } },
    );

    expect(outputs.id1).toEqual({
      error: { code: 'internal_error', message: 'internal error during page extraction' },
    });
    expect(logger.error).toHaveBeenCalledWith({ err: cause }, ExtractServiceMessage.EXTRACTION_FAILED);
  });

  it('produces exactly one output entry per input key, no more no fewer', async () => {
    const extractor = new FakePdfExtractor(() => Promise.resolve([]));
    const service = new PdfExtractService(extractor, new FakeUniqidGenerator(), fakeLogger());

    const outputs = await service.extractBatch(
      { pageSelection: PageSelection.ALL, dpi: 150 },
      { id1: { path: '/shared/a.pdf' }, id2: { path: '/shared/b.pdf' } },
    );

    expect(Object.keys(outputs).sort()).toEqual(['id1', 'id2']);
  });
});
