import { describe, it, expect } from 'vitest';
import { CorruptInputError, InternalExtractionError } from '../../../src/domain/errors.js';

describe('CorruptInputError', () => {
  describe('pageCountUndetermined()', () => {
    it.each([
      {
        name: 'uses pdfinfo stderr as the message when present',
        stderr: 'Syntax Error: Document stream is empty',
        expected: 'Syntax Error: Document stream is empty',
      },
      {
        name: 'falls back to a generic message when stderr is empty',
        stderr: '',
        expected: 'could not determine page count (corrupt or unreadable PDF)',
      },
    ])('$name', ({ stderr, expected }) => {
      const err = CorruptInputError.pageCountUndetermined(stderr);

      expect(err).toBeInstanceOf(CorruptInputError);
      expect(err.name).toBe('CorruptInputError');
      expect(err.message).toBe(expected);
    });
  });

  it('nonPositivePageCount() includes the reported value', () => {
    const err = CorruptInputError.nonPositivePageCount('0');

    expect(err.message).toBe('pdfinfo reported a non-positive page count "0"');
  });

  describe('pageRenderFailed()', () => {
    it.each([
      {
        name: 'uses pdftoppm stderr as the message when present',
        pageNumber: 3,
        stderr: 'pdftoppm: unsupported filter',
        expected: 'pdftoppm: unsupported filter',
      },
      {
        name: 'falls back to a generic message with the page number when stderr is empty',
        pageNumber: 3,
        stderr: '',
        expected: 'failed to render page 3 (no output produced)',
      },
    ])('$name', ({ pageNumber, stderr, expected }) => {
      const err = CorruptInputError.pageRenderFailed(pageNumber, stderr);

      expect(err.message).toBe(expected);
    });
  });
});

describe('InternalExtractionError', () => {
  it('timedOut() includes the binary name and the configured timeout in milliseconds', () => {
    const err = InternalExtractionError.timedOut('pdftoppm', 15_000);

    expect(err).toBeInstanceOf(InternalExtractionError);
    expect(err.name).toBe('InternalExtractionError');
    expect(err.message).toBe('pdftoppm timed out after 15000ms');
  });

  it('spawnFailed() includes the binary name and the underlying spawn error message', () => {
    const err = InternalExtractionError.spawnFailed('pdfinfo', new Error('ENOENT'));

    expect(err.message).toBe('failed to start pdfinfo: ENOENT');
  });
});
