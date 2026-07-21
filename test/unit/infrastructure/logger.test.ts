import { describe, it, expect } from 'vitest';
import { resolveTransport, createLoggerOptions } from '../../../src/infrastructure/logger.js';
import { NodeEnv } from '../../../src/infrastructure/env/env.js';
import { makeEnv } from '../../helpers/env.js';

describe('logger', () => {
  describe('resolveTransport', () => {
    it('returns undefined in production', () => {
      expect(resolveTransport(makeEnv({ NODE_ENV: NodeEnv.PRODUCTION }))).toBeUndefined();
    });

    it('returns a file transport in test', () => {
      expect(resolveTransport(makeEnv({ NODE_ENV: NodeEnv.TEST }))).toEqual({
        target: 'pino/file',
        options: { destination: 'var/test/test.log', mkdir: true },
      });
    });

    it('returns pino-pretty for development', () => {
      expect(resolveTransport(makeEnv({ NODE_ENV: NodeEnv.DEVELOPMENT }))).toEqual({ target: 'pino-pretty' });
    });
  });

  describe('createLoggerOptions', () => {
    it('defaults to log level "info" when LOG_LEVEL is unset', () => {
      expect(createLoggerOptions(makeEnv({ NODE_ENV: NodeEnv.PRODUCTION }))).toEqual({
        level: 'info',
        transport: undefined,
      });
    });

    it('uses LOG_LEVEL when set', () => {
      expect(createLoggerOptions(makeEnv({ NODE_ENV: NodeEnv.PRODUCTION, LOG_LEVEL: 'debug' }))).toEqual({
        level: 'debug',
        transport: undefined,
      });
    });
  });
});
