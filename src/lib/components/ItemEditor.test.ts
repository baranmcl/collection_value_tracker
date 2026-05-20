import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

// $app/navigation is a SvelteKit virtual module — mock it for unit tests.
vi.mock('$app/navigation', () => ({
  invalidateAll: vi.fn(() => Promise.resolve()),
  goto: vi.fn(() => Promise.resolve())
}));

import ItemEditor from './ItemEditor.svelte';

const item = {
  id: 5, gameId: 1, title: 'Chrono Trigger', condition: 'loose',
  grade: null, notes: null, acquiredAt: null, manualPrice: null
};

describe('ItemEditor', () => {
  it('renders fields for grade, notes, acquired date and manual price', () => {
    const { getByLabelText } = render(ItemEditor, { props: { item, onclose: () => {} } });
    expect(getByLabelText(/grade/i)).toBeInTheDocument();
    expect(getByLabelText(/notes/i)).toBeInTheDocument();
    expect(getByLabelText(/manual price/i)).toBeInTheDocument();
  });
  it('PATCHes the item on save', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { findByRole } = render(ItemEditor, { props: { item, onclose: () => {} } });
    (await findByRole('button', { name: /save/i })).click();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith('/api/collection/5', expect.objectContaining({ method: 'PATCH' }));
    vi.unstubAllGlobals();
  });
  it('DELETEs the item when Remove is clicked', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { findByRole } = render(ItemEditor, { props: { item, onclose: () => {} } });
    (await findByRole('button', { name: /remove/i })).click();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith('/api/collection', expect.objectContaining({ method: 'DELETE' }));
    vi.unstubAllGlobals();
  });
  it('POSTs another copy when "Add another copy" is clicked', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ itemId: 9 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { findByRole } = render(ItemEditor, { props: { item, onclose: () => {} } });
    (await findByRole('button', { name: /add another copy/i })).click();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith('/api/collection', expect.objectContaining({ method: 'POST' }));
    vi.unstubAllGlobals();
  });
});
