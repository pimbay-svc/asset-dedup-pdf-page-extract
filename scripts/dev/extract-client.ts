import net from 'node:net';
import { FrameDecoder, encodeFrame } from '../../src/infrastructure/uds/framing.js';

const [, , socketPath, pdfPath, pageSelection, dpiRaw] = process.argv;

if (socketPath === undefined || pdfPath === undefined) {
  console.error('usage: extract-client.ts <socket_path> <pdf_path> [page_selection] [dpi]');
  console.error('(invoked positionally by scripts/dev/extract.sh — use its --pdf/--page-selection/--dpi/--socket-path flags instead)');
  process.exit(1);
}

const dpiRawOrDefault = dpiRaw ?? '150';
const dpi = Number.parseInt(dpiRawOrDefault, 10);

if (Number.isNaN(dpi)) {
  console.error(`invalid --dpi value: "${dpiRawOrDefault}" (must be a number)`);
  process.exit(1);
}

const request = {
  op: 'extract',
  config: {
    page_selection: pageSelection ?? 'first-middle-last',
    dpi,
  },
  inputs: {
    id1: { path: pdfPath },
  },
};

const socket = net.connect({ path: socketPath }, () => {
  socket.write(encodeFrame(request));
});

const decoder = new FrameDecoder();

socket.on('data', (chunk: Buffer) => {
  for (const message of decoder.push(chunk)) {
    console.log(JSON.stringify(message, null, 2));
  }
  socket.end();
});

socket.on('error', (err) => {
  console.error(`connection failed: ${err.message}`);
  process.exit(1);
});
