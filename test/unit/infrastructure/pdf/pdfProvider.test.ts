import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PdfProvider } from '../../../../src/infrastructure/pdf/pdfProvider.js';
import { PageSelection } from '../../../../src/domain/model/strategy.model.js';
import { CorruptInputError, InternalExtractionError } from '../../../../src/domain/errors.js';
import { makeEnv } from '../../../helpers/env.js';

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures');
const MULTI_PAGE_PDF = path.join(FIXTURES_DIR, 'multi-page.pdf'); // 5 pages
const SINGLE_PAGE_PDF = path.join(FIXTURES_DIR, 'single-page.pdf'); // 1 page
const TWO_PAGE_PDF = path.join(FIXTURES_DIR, 'two-page.pdf'); // 2 pages
const CORRUPT_PDF = path.join(FIXTURES_DIR, 'corrupt.pdf'); // not a real PDF

const FAKE_PDFTOPPM_HANGS = path.join(FIXTURES_DIR, 'bin/fake-pdftoppm-hangs.sh');
const FAKE_PDFTOPPM_NO_OUTPUT = path.join(FIXTURES_DIR, 'bin/fake-pdftoppm-no-output.sh');
const FAKE_PDFINFO_HANGS = path.join(FIXTURES_DIR, 'bin/fake-pdfinfo-hangs.sh');
const FAKE_PDFINFO_ZERO_PAGES = path.join(FIXTURES_DIR, 'bin/fake-pdfinfo-zero-pages.sh');
const FAKE_PDFINFO_NO_PAGES_NO_STDERR = path.join(FIXTURES_DIR, 'bin/fake-pdfinfo-no-pages-no-stderr.sh');

describe('PdfProvider', () => {
  let outputDir: string;

  beforeAll(async () => {
    outputDir = await mkdtemp(path.join(tmpdir(), 'pdf-provider-test-'));
  });

  afterAll(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it.each([
    {
      name: 'extracts every page for page_selection "all", named {uniqid}-{index}.png',
      pdf: MULTI_PAGE_PDF,
      pageSelection: PageSelection.ALL,
      uniqueId: 'all-test',
      expectedPageNumbers: [1, 2, 3, 4, 5],
    },
    {
      name: 'selects first, middle, and last physical pages for page_selection "first-middle-last"',
      pdf: MULTI_PAGE_PDF,
      pageSelection: PageSelection.FIRST_MIDDLE_LAST,
      uniqueId: 'fml-test',
      expectedPageNumbers: [1, 3, 5],
    },
    {
      name: 'deduplicates to a single page for a 1-page document instead of padding',
      pdf: SINGLE_PAGE_PDF,
      pageSelection: PageSelection.FIRST_MIDDLE_LAST,
      uniqueId: 'fml-single-test',
      expectedPageNumbers: [1],
    },
    {
      name: 'deduplicates to two pages for a 2-page document',
      pdf: TWO_PAGE_PDF,
      pageSelection: PageSelection.FIRST_MIDDLE_LAST,
      uniqueId: 'fml-two-test',
      expectedPageNumbers: [1, 2],
    },
  ])('$name', async ({ pdf, pageSelection, uniqueId, expectedPageNumbers }) => {
    const provider = new PdfProvider(makeEnv({ OUTPUT_DIR: outputDir }));

    const pages = await provider.extractPages(pdf, { pageSelection, dpi: 72, uniqueId });

    expect(pages.map((p) => p.pageNumber)).toEqual(expectedPageNumbers);
    pages.forEach((page, index) => {
      expect(page.index).toBe(index);
      expect(page.path).toBe(path.join(outputDir, `${uniqueId}-${String(index)}.png`));
    });

    const files = await readdir(outputDir);
    expect(files).toEqual(expect.arrayContaining(pages.map((p) => path.basename(p.path))));
  });

  it('creates OUTPUT_DIR on demand when it does not exist yet (pdftoppm never creates it itself)', async () => {
    const freshOutputDir = path.join(outputDir, 'not-created-yet', 'nested');
    const provider = new PdfProvider(makeEnv({ OUTPUT_DIR: freshOutputDir }));

    const pages = await provider.extractPages(SINGLE_PAGE_PDF, {
      pageSelection: PageSelection.ALL,
      dpi: 72,
      uniqueId: 'fresh-dir-test',
    });

    expect(pages).toHaveLength(1);
    const files = await readdir(freshOutputDir);
    expect(files).toEqual(expect.arrayContaining(pages.map((p) => path.basename(p.path))));
  });

  it('rejects an unreadable/corrupt file with CorruptInputError', async () => {
    const provider = new PdfProvider(makeEnv({ OUTPUT_DIR: outputDir }));

    await expect(
      provider.extractPages(CORRUPT_PDF, {
        pageSelection: PageSelection.ALL,
        dpi: 72,
        uniqueId: 'corrupt-test',
      }),
    ).rejects.toThrow(CorruptInputError);
  });

  it('rejects with CorruptInputError when pdftoppm exits cleanly but produces no output file', async () => {
    const provider = new PdfProvider(makeEnv({ OUTPUT_DIR: outputDir, PDFTOPPM_BIN: FAKE_PDFTOPPM_NO_OUTPUT }));

    await expect(
      provider.extractPages(SINGLE_PAGE_PDF, {
        pageSelection: PageSelection.ALL,
        dpi: 72,
        uniqueId: 'no-output-test',
      }),
    ).rejects.toThrow(CorruptInputError);
  });

  it('uses a generic message when the page count is unparseable but pdfinfo wrote nothing to stderr', async () => {
    const provider = new PdfProvider(makeEnv({ OUTPUT_DIR: outputDir, PDFINFO_BIN: FAKE_PDFINFO_NO_PAGES_NO_STDERR }));

    await expect(
      provider.extractPages(MULTI_PAGE_PDF, {
        pageSelection: PageSelection.ALL,
        dpi: 72,
        uniqueId: 'no-pages-no-stderr-test',
      }),
    ).rejects.toThrow('could not determine page count (corrupt or unreadable PDF)');
  });

  it('rejects with CorruptInputError when pdfinfo reports a non-positive page count', async () => {
    const provider = new PdfProvider(makeEnv({ OUTPUT_DIR: outputDir, PDFINFO_BIN: FAKE_PDFINFO_ZERO_PAGES }));

    await expect(
      provider.extractPages(MULTI_PAGE_PDF, {
        pageSelection: PageSelection.ALL,
        dpi: 72,
        uniqueId: 'zero-pages-test',
      }),
    ).rejects.toThrow(CorruptInputError);
  });

  it.each([
    {
      name: 'the pdfinfo binary cannot be found',
      envOverrides: { PDFINFO_BIN: 'this-binary-does-not-exist' },
    },
    {
      name: 'the pdftoppm binary cannot be found',
      envOverrides: { PDFTOPPM_BIN: 'this-binary-does-not-exist' },
    },
    {
      name: 'the page-count probe (pdfinfo) exceeds its timeout',
      envOverrides: { PDFINFO_BIN: FAKE_PDFINFO_HANGS, PDF_RENDER_TIMEOUT_MS: '300' },
    },
    {
      name: 'a page render (pdftoppm) exceeds its timeout',
      envOverrides: { PDFTOPPM_BIN: FAKE_PDFTOPPM_HANGS, PDF_RENDER_TIMEOUT_MS: '300' },
    },
  ])('throws InternalExtractionError when $name', async ({ envOverrides }) => {
    const provider = new PdfProvider(makeEnv({ OUTPUT_DIR: outputDir, ...envOverrides }));

    await expect(
      provider.extractPages(MULTI_PAGE_PDF, {
        pageSelection: PageSelection.ALL,
        dpi: 72,
        uniqueId: 'internal-error-test',
      }),
    ).rejects.toThrow(InternalExtractionError);
  });
});
