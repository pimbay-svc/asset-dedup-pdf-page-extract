import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadEnv, NodeEnv } from '../../../../src/infrastructure/env/env.js';
import { EnvError } from '../../../../src/infrastructure/env/errors.js';

const validEnv = {
  SOCKET_PATH: '/sockets/pdf-page-extract.sock',
  SHARED_VOLUME_DIR: '/shared',
};

describe('loadEnv', () => {
  it('accepts a minimal valid environment and fills in defaults', () => {
    const env = loadEnv(validEnv);

    expect(env.SOCKET_PATH).toBe('/sockets/pdf-page-extract.sock');
    expect(env.SHARED_VOLUME_DIR).toBe('/shared');
    expect(env.NODE_ENV).toBe(NodeEnv.PRODUCTION);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.OUTPUT_DIR).toBe(path.join('/shared', 'pdf-page-extract'));
    expect(env.PDFTOPPM_BIN).toBe('pdftoppm');
    expect(env.PDFINFO_BIN).toBe('pdfinfo');
    expect(env.PDF_RENDER_TIMEOUT_MS).toBe(15_000);
    expect(env.TTL_SWEEP_INTERVAL_MS).toBe(5 * 60 * 1000);
    expect(env.TTL_RETENTION_MS).toBe(60 * 60 * 1000);
  });

  it('coerces numeric env vars from strings', () => {
    const env = loadEnv({
      ...validEnv,
      PDF_RENDER_TIMEOUT_MS: '5000',
    });

    expect(env.PDF_RENDER_TIMEOUT_MS).toBe(5000);
  });

  it('accepts an explicit OUTPUT_DIR override', () => {
    const env = loadEnv({ ...validEnv, OUTPUT_DIR: '/shared/custom-output' });

    expect(env.OUTPUT_DIR).toBe('/shared/custom-output');
  });

  describe('rejects an invalid environment with EnvError', () => {
    it.each([
      { name: 'SOCKET_PATH is missing', overrides: { SHARED_VOLUME_DIR: '/shared' } },
      { name: 'SHARED_VOLUME_DIR is missing', overrides: { SOCKET_PATH: '/sockets/x.sock' } },
      { name: 'NODE_ENV has an invalid value', overrides: { ...validEnv, NODE_ENV: 'staging' } },
      {
        name: 'PDF_RENDER_TIMEOUT_MS is non-numeric',
        overrides: { ...validEnv, PDF_RENDER_TIMEOUT_MS: 'not-a-number' },
      },
    ])('$name', ({ overrides }) => {
      expect(() => loadEnv(overrides)).toThrow(EnvError);
    });
  });
});
