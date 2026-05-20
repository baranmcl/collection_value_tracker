import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

// $app/navigation is a SvelteKit virtual module; invalidateAll() throws
// outside a running app, so it MUST be mocked for component unit tests.
vi.mock('$app/navigation', () => ({
  invalidateAll: vi.fn(() => Promise.resolve()),
  goto: vi.fn(() => Promise.resolve())
}));

import ConditionButton from './ConditionButton.svelte';

describe('ConditionButton', () => {
  it('shows a plus when not owned', () => {
    const { getByRole } = render(ConditionButton, {
      props: { gameId: 1, condition: 'loose', owned: false, estimate: null }
    });
    expect(getByRole('button').textContent).toContain('+');
  });

  it('shows the estimate when owned', () => {
    const { getByRole } = render(ConditionButton, {
      props: { gameId: 1, condition: 'loose', owned: true, estimate: 4200 }
    });
    expect(getByRole('button').textContent).toContain('$42.00');
  });

  it('posts an add request and reports pending then done — deterministic await', async () => {
    let resolveFetch: (v: Response) => void = () => {};
    const fetchMock = vi.fn(
      () => new Promise<Response>((r) => { resolveFetch = r; })
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getByRole, findByText } = render(ConditionButton, {
      props: { gameId: 1, condition: 'loose', owned: false, estimate: null }
    });
    getByRole('button').click();
    await tick();
    // pending state is observable before the fetch resolves
    expect(getByRole('button').getAttribute('aria-busy')).toBe('true');

    // resolve deterministically — no sleep
    resolveFetch(new Response(JSON.stringify({ itemId: 7 }), { status: 200 }));
    await findByText('owned'); // findBy* retries until the DOM settles

    expect(fetchMock).toHaveBeenCalledWith('/api/collection', expect.objectContaining({ method: 'POST' }));
    vi.unstubAllGlobals();
  });
});
