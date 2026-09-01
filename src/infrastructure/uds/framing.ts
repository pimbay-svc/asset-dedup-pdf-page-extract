/**
 * This file is part of the PimBay Asset Dedup service.
 *
 * @author Jan Sarmir <sarmir@pimbay.dev>
 * @link   https://pimbay.dev
 *
 * For the full license information, see the LICENSE file.
 */

/**
 * Wire framing for the UDS protocol: `[4 bytes length, BE uint32][N bytes UTF-8 JSON]`.
 * Partial reads are buffered until a full frame is available. Pure logic, no `net` dependency.
 */

const LENGTH_PREFIX_BYTES = 4;

export class FrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  /** Feeds in new bytes; returns any fully-decoded messages found so far (zero, one, or more). */
  push(chunk: Buffer): unknown[] {
    // Stryker disable next-line ConditionalExpression: equivalent mutant — Buffer.concat([Buffer.alloc(0), chunk])
    // is byte-identical to `chunk`; the ternary only avoids an allocation.
    this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);

    const messages: unknown[] = [];

    for (;;) {
      if (this.buffer.length < LENGTH_PREFIX_BYTES) {
        break;
      }

      const payloadLength = this.buffer.readUInt32BE(0);
      const frameLength = LENGTH_PREFIX_BYTES + payloadLength;

      if (this.buffer.length < frameLength) {
        break; // rest of the frame hasn't arrived yet
      }

      const payload = this.buffer.subarray(LENGTH_PREFIX_BYTES, frameLength);
      messages.push(JSON.parse(payload.toString('utf-8')));
      this.buffer = this.buffer.subarray(frameLength);
    }

    return messages;
  }
}

export function encodeFrame(message: unknown): Buffer {
  const payload = Buffer.from(JSON.stringify(message), 'utf-8');
  const header = Buffer.alloc(LENGTH_PREFIX_BYTES);
  header.writeUInt32BE(payload.length, 0);

  return Buffer.concat([header, payload]);
}
