import { loadEnv, type Env } from '../../src/infrastructure/env/env.js';

// Allow the local dev machine's PATH-resolved binaries to be picked up when running tests
// outside of Docker, same as pdftoppm/pdfinfo would resolve in production.
const PDFTOPPM_BIN = process.env.PDFTOPPM_BIN ?? 'pdftoppm';
const PDFINFO_BIN = process.env.PDFINFO_BIN ?? 'pdfinfo';

/**
 * Builds a valid `Env` for tests, routed through the real `loadEnv`/zod validation so fixtures
 * stay honest about coercion and defaults instead of hand-rolling the shape. Pass string overrides
 * exactly as they'd appear in `process.env` (e.g. `PDF_RENDER_TIMEOUT_MS: '15000'`).
 */
export function makeEnv(overrides: Partial<Record<string, string>> = {}): Env {
  return loadEnv({
    SOCKET_PATH: '/sockets/x.sock',
    SHARED_VOLUME_DIR: '/shared',
    PDFTOPPM_BIN,
    PDFINFO_BIN,
    PDF_RENDER_TIMEOUT_MS: '15000',
    ...overrides,
  });
}
