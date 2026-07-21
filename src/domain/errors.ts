/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */
export abstract class AssetDedupPdfExtensionError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * The PDF file itself is unreadable/malformed (page count can't be determined, pdftoppm
 * rejects the document, a selected page can't be rendered). Maps to the spec's `corrupt_input`
 * per-item error code.
 */
export class CorruptInputError extends AssetDedupPdfExtensionError {
  private constructor(message: string) {
    super(message);
  }

  /** `pdfinfo`'s output didn't contain a parseable "Pages: N" line. */
  static pageCountUndetermined(stderr: string): CorruptInputError {
    return new CorruptInputError(stderr || 'could not determine page count (corrupt or unreadable PDF)');
  }

  /** `pdfinfo` reported a page count of zero or less. */
  static nonPositivePageCount(reported: string): CorruptInputError {
    return new CorruptInputError(`pdfinfo reported a non-positive page count "${reported}"`);
  }

  /** `pdftoppm` produced no output file for the requested page. */
  static pageRenderFailed(pageNumber: number, stderr: string): CorruptInputError {
    return new CorruptInputError(stderr || `failed to render page ${String(pageNumber)} (no output produced)`);
  }
}

/**
 * pdftoppm/pdfinfo failed to start, timed out, or crashed for reasons unrelated to the input
 * file's own validity. Maps to the spec's `internal_error` per-item error code.
 */
export class InternalExtractionError extends AssetDedupPdfExtensionError {
  private constructor(message: string) {
    super(message);
  }

  static timedOut(bin: string, timeoutMs: number): InternalExtractionError {
    return new InternalExtractionError(`${bin} timed out after ${String(timeoutMs)}ms`);
  }

  static spawnFailed(bin: string, cause: Error): InternalExtractionError {
    return new InternalExtractionError(`failed to start ${bin}: ${cause.message}`);
  }
}
