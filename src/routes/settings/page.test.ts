import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  gameCount: 1240,
  lastSyncedAt: null,
  ownedItemCount: 12,
  lastRefreshAt: null,
  credentials: { thegamesdb: true, ebay: false },
  refreshHistory: [],
  platforms: [
    { thegamesdbId: 2, name: 'GameCube' },
    { thegamesdbId: 3, name: 'N64' }
  ]
};

describe('settings page', () => {
  it('shows catalog game count and an unconfigured eBay warning', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText(/1240/)).toBeInTheDocument();
    expect(getByText(/eBay/i)).toBeInTheDocument();
  });
  it('shows Sync catalog and Refresh estimates actions', () => {
    const { getByRole } = render(Page, { props: { data } });
    expect(getByRole('button', { name: /sync catalog/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /refresh estimates/i })).toBeInTheDocument();
  });
  it('lists each console as a checkbox, checked by default', () => {
    const { getByRole } = render(Page, { props: { data } });
    const gamecube = getByRole('checkbox', { name: 'GameCube' });
    expect(gamecube).toBeInTheDocument();
    expect(gamecube).toBeChecked();
    expect(getByRole('checkbox', { name: 'N64' })).toBeChecked();
  });
  it('shows the error summary on a refresh history row', () => {
    const withHistory = {
      ...data,
      refreshHistory: [
        {
          id: 1,
          triggeredAt: new Date('2026-05-20T10:00:00Z'),
          source: 'ebay_browse',
          itemsUpdated: 5,
          errors: 2,
          errorSummary: 'rate_limit×1; other×1 (aborted)'
        }
      ]
    };
    const { getByText } = render(Page, { props: { data: withHistory } });
    expect(getByText(/rate_limit×1; other×1 \(aborted\)/)).toBeInTheDocument();
  });
  it('renders a clean history row without an error summary', () => {
    const cleanRow = {
      ...data,
      refreshHistory: [
        {
          id: 1,
          triggeredAt: new Date('2026-05-20T10:00:00Z'),
          source: 'ebay_browse',
          itemsUpdated: 8,
          errors: 0,
          errorSummary: null
        }
      ]
    };
    const { getByText, queryByText } = render(Page, { props: { data: cleanRow } });
    expect(getByText(/8 updated, 0 errors/)).toBeInTheDocument();
    expect(queryByText(/×/)).not.toBeInTheDocument(); // no error-summary text
  });
  it('reads the refresh stream and shows the categorized result message', async () => {
    const ndjson = (objs: object[]) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            const enc = new TextEncoder();
            for (const o of objs) c.enqueue(enc.encode(JSON.stringify(o) + '\n'));
            c.close();
          }
        }),
        { status: 200, headers: { 'content-type': 'application/x-ndjson' } }
      );
    const fetchMock = vi.fn(async () =>
      ndjson([
        { type: 'progress', done: 0, total: 2, current: 'Pikmin' },
        { type: 'progress', done: 1, total: 2, current: 'GoldenEye' },
        { type: 'result', itemsUpdated: 1, errors: 1, errorsByReason: { auth: 0, rate_limit: 1, other: 0 }, aborted: true, refreshEventId: 7 }
      ])
    );
    vi.stubGlobal('fetch', fetchMock);
    const { getByRole, findByText } = render(Page, { props: { data } });
    getByRole('button', { name: /refresh estimates/i }).click();
    expect(await findByText(/aborted after a rate limit/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
