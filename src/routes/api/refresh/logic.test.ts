import { describe, it, expect, vi } from 'vitest';
import { makeTestDb } from '$lib/db/test-db';
import { upsertGames } from '$lib/db/queries/games';
import { addItem } from '$lib/db/queries/collection';
import { refreshStream } from './logic';

/** Read an entire NDJSON byte stream into parsed objects. */
async function drain(stream: ReadableStream<Uint8Array>): Promise<Record<string, unknown>[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
  }
  return buf
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

describe('refreshStream', () => {
  it('streams progress lines then a single final result line', async () => {
    const db = makeTestDb();
    upsertGames(db, [
      { id: 1, console: 'GameCube', title: 'Pikmin', region: null, releaseYear: null },
      { id: 2, console: 'N64', title: 'GoldenEye', region: null, releaseYear: null }
    ]);
    addItem(db, { gameId: 1, condition: 'loose' });
    addItem(db, { gameId: 2, condition: 'cib' });
    const search = vi.fn(async (q: string) => [{ priceCents: 2500, title: q, conditionId: 3000 }]);

    const lines = await drain(refreshStream(db, search));

    const progress = lines.filter((l) => l.type === 'progress');
    const results = lines.filter((l) => l.type === 'result');
    expect(progress.length).toBeGreaterThanOrEqual(1);
    expect(results).toHaveLength(1);
    expect(progress[0]).toMatchObject({ total: 2 });
    expect(typeof progress[0].current).toBe('string');
    expect(results[0]).toMatchObject({ type: 'result', itemsUpdated: 2, errors: 0, aborted: false });
    expect(typeof results[0].refreshEventId).toBe('number');
  });
});
