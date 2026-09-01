/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PdfExtractor, ExtractedPage, ExtractPagesOptions } from '../../domain/provider/pdf.provider.js';
import { CorruptInputError, InternalExtractionError } from '../../domain/errors.js';
import type { Env } from '../env/env.js';
import { selectPageNumbers } from './pageSelection.js';

interface CommandResult {
  stdout: Buffer;
  stderr: Buffer;
  code: number | null;
}

const RENDERED_PAGE_EXTENSION = '.png';

/**
 * Reads/writes directly on the shared volume (never base64 over the socket). `pdftoppm` has no
 * arbitrary-page-list mode, so each page renders via its own invocation into a temp dir, then is
 * copied — not renamed, since the temp dir and OUTPUT_DIR may be on different filesystems.
 */
export class PdfProvider implements PdfExtractor {
  constructor(private readonly env: Env) {}

  async extractPages(pdfPath: string, options: ExtractPagesOptions): Promise<ExtractedPage[]> {
    const totalPages = await this.probePageCount(pdfPath);
    const pageNumbers = selectPageNumbers(options.pageSelection, totalPages);

    await mkdir(this.env.OUTPUT_DIR, { recursive: true });

    const pages: ExtractedPage[] = [];
    for (const [index, pageNumber] of pageNumbers.entries()) {
      const outputPath = path.join(this.env.OUTPUT_DIR, `${options.uniqueId}-${String(index)}.png`);
      await this.renderPageTo(pdfPath, pageNumber, options.dpi, outputPath);
      pages.push({ index, pageNumber, path: outputPath });
    }

    return pages;
  }

  private async probePageCount(pdfPath: string): Promise<number> {
    const result = await this.runCommand(this.env.PDFINFO_BIN, [pdfPath]);
    const match = /^Pages:\s+(\d+)/m.exec(result.stdout.toString('utf-8'));

    if (match === null) {
      const stderr = result.stderr.toString('utf-8').trim();
      throw CorruptInputError.pageCountUndetermined(stderr);
    }

    /* v8 ignore next -- match[1] always participates when the regex matches; `?? ''` only satisfies noUncheckedIndexedAccess. */
    const totalPages = Number.parseInt(match[1] ?? '', 10);

    if (totalPages <= 0) {
      /* v8 ignore next -- see the identical note above; match[1] is always defined here. */
      throw CorruptInputError.nonPositivePageCount(match[1] ?? '');
    }

    return totalPages;
  }

  private async renderPageTo(pdfPath: string, pageNumber: number, dpi: number, outputPath: string): Promise<void> {
    const workDir = await mkdtemp(path.join(tmpdir(), 'asset-dedup-pdf-'));

    try {
      const outputPrefix = path.join(workDir, 'page');
      const result = await this.runCommand(this.env.PDFTOPPM_BIN, [
        '-png',
        '-r',
        String(dpi),
        '-f',
        String(pageNumber),
        '-l',
        String(pageNumber),
        pdfPath,
        outputPrefix,
      ]);

      const rendered = await this.findRenderedFile(workDir);

      if (rendered === undefined) {
        const stderr = result.stderr.toString('utf-8').trim();
        throw CorruptInputError.pageRenderFailed(pageNumber, stderr);
      }

      await copyFile(rendered, outputPath);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async findRenderedFile(workDir: string): Promise<string | undefined> {
    const entries = await readdir(workDir);
    const pngFile = entries.find((name) => name.endsWith(RENDERED_PAGE_EXTENSION));

    return pngFile === undefined ? undefined : path.join(workDir, pngFile);
  }

  private runCommand(bin: string, args: string[]): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      const child = spawn(bin, args);

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let settled = false;

      const timer = setTimeout(() => {
        /* v8 ignore next 3 -- fires only once, so `settled` is never already true here; kept for symmetry with 'error'/'close'. */
        if (settled) {
          return;
        }
        settled = true;
        child.kill('SIGKILL');
        reject(InternalExtractionError.timedOut(bin, this.env.PDF_RENDER_TIMEOUT_MS));
      }, this.env.PDF_RENDER_TIMEOUT_MS);

      child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

      child.on('error', (err) => {
        /* v8 ignore next 3 -- would require 'error' to fire after the timeout already settled; not something pdfinfo/pdftoppm does. */
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        reject(InternalExtractionError.spawnFailed(bin, err));
      });

      child.on('close', (code) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);

        resolve({ stdout: Buffer.concat(stdoutChunks), stderr: Buffer.concat(stderrChunks), code });
      });
    });
  }
}
