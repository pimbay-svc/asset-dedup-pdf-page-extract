import { describe, it, expect, vi } from 'vitest';
import { handleExtract } from '../../../../../src/presentation/uds/socket/extract.socket.js';
import type { Cradle } from '../../../../../src/infrastructure/container.js';
import { UdsServerMessage } from '../../../../../src/presentation/uds/messages.js';
import { fakeCradle } from '../../../../helpers/cradle.js';
import { fakeLogger } from '../../../../helpers/logger.js';

describe('handleExtract', () => {
  it('delegates a valid request to pdfExtractService.extractBatch', async () => {
    const extractBatch = vi.fn().mockResolvedValue({ id1: { paths: ['/shared/out/a-0.png'] } });
    const cradle = fakeCradle({ pdfExtractService: { extractBatch } as unknown as Cradle['pdfExtractService'] });

    const response = await handleExtract(
      {
        op: 'extract',
        config: { page_selection: 'first-middle-last', dpi: 150 },
        inputs: { id1: { path: '/shared/a.pdf' } },
      },
      cradle,
    );

    expect(extractBatch).toHaveBeenCalledWith(
      { pageSelection: 'first-middle-last', dpi: 150 },
      { id1: { path: '/shared/a.pdf' } },
    );
    expect(response).toEqual({ outputs: { id1: { paths: ['/shared/out/a-0.png'] } } });
  });

  describe('fails every input with internal_error for a bad request-level config, without calling the service', () => {
    it.each([
      {
        name: 'an unrecognized page_selection',
        config: { page_selection: 'bogus-selection', dpi: 150 },
        expected: 'unsupported page_selection "bogus-selection"',
      },
      {
        name: 'a zero dpi',
        config: { page_selection: 'all', dpi: 0 },
        expected: 'unsupported dpi "0" (must be a positive integer)',
      },
      {
        name: 'a negative dpi',
        config: { page_selection: 'all', dpi: -150 },
        expected: 'unsupported dpi "-150" (must be a positive integer)',
      },
      {
        name: 'a non-integer dpi',
        config: { page_selection: 'all', dpi: 150.5 },
        expected: 'unsupported dpi "150.5" (must be a positive integer)',
      },
    ])('$name', async ({ config, expected }) => {
      const extractBatch = vi.fn();
      const cradle = fakeCradle({ pdfExtractService: { extractBatch } as unknown as Cradle['pdfExtractService'] });

      const response = await handleExtract(
        {
          op: 'extract',
          config,
          inputs: { id1: { path: '/shared/a.pdf' }, id2: { path: '/shared/b.pdf' } },
        },
        cradle,
      );

      expect(extractBatch).not.toHaveBeenCalled();
      expect(response?.outputs.id1).toEqual({ error: { code: 'internal_error', message: expected } });
      expect(response?.outputs.id2).toEqual({ error: { code: 'internal_error', message: expected } });
    });
  });

  describe('returns null and logs a warning for a structurally malformed message, without calling the service', () => {
    it.each([
      { name: 'message is null', message: null },
      { name: 'message is a bare string', message: 'not an object' },
      { name: 'message is an array', message: [] },
      {
        name: 'op is missing',
        message: { config: { page_selection: 'all', dpi: 150 }, inputs: {} },
      },
      {
        name: 'op is not "extract"',
        message: { op: 'ping', config: { page_selection: 'all', dpi: 150 }, inputs: {} },
      },
      { name: 'config is missing entirely', message: { op: 'extract', inputs: {} } },
      {
        name: 'config.page_selection is missing',
        message: { op: 'extract', config: { dpi: 150 }, inputs: {} },
      },
      {
        name: 'config.dpi is a string instead of a number',
        message: { op: 'extract', config: { page_selection: 'all', dpi: '150' }, inputs: {} },
      },
      {
        name: 'inputs is missing entirely',
        message: { op: 'extract', config: { page_selection: 'all', dpi: 150 } },
      },
      {
        name: 'an inputs entry has no path',
        message: { op: 'extract', config: { page_selection: 'all', dpi: 150 }, inputs: { id1: {} } },
      },
    ])('$name', async ({ message }) => {
      const extractBatch = vi.fn();
      const logger = fakeLogger();
      const cradle = fakeCradle({
        pdfExtractService: { extractBatch } as unknown as Cradle['pdfExtractService'],
        logger,
      });

      const response = await handleExtract(message, cradle);

      expect(response).toBeNull();
      expect(extractBatch).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.anything() as unknown }),
        UdsServerMessage.MALFORMED_EXTRACT_REQUEST,
      );
    });
  });
});
