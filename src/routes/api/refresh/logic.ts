// ABOUTME: Adapts a price refresh into an NDJSON byte stream — one progress
// ABOUTME: line per pair, then a final result line.
import type { DB } from '$lib/db/client';
import { refreshEstimates, type SearchFn } from '$lib/sources/refresh';

const encoder = new TextEncoder();

/** Encode one value as an NDJSON line (JSON + newline) of UTF-8 bytes. */
function line(value: unknown): Uint8Array {
  return encoder.encode(JSON.stringify(value) + '\n');
}

/** Run a refresh and stream its progress ticks + final result as NDJSON. */
export function refreshStream(db: DB, search: SearchFn): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const result = await refreshEstimates(db, {
        search,
        onProgress: (p) => controller.enqueue(line({ type: 'progress', ...p }))
      });
      controller.enqueue(line({ type: 'result', ...result }));
      controller.close();
    }
  });
}
