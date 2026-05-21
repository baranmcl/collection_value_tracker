import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

// vi.mock is hoisted above all imports/top-level code, so its factory cannot
// see an ordinary `const`. vi.hoisted runs first and makes `goto` available.
const { goto } = vi.hoisted(() => ({ goto: vi.fn(() => Promise.resolve()) }));
vi.mock('$app/navigation', () => ({ goto }));

import type { PageData } from './$types';
import Page from './+page.svelte';

// Typed as PageData so the `show` union field and the game shape are checked
// (a bare object literal would widen `show: 'all'` to `string`). Tests that
// vary fields spread this base with typed overrides.
const data: PageData = {
  consoles: [{ console: 'Game Boy', count: 3 }, { console: 'N64', count: 1 }],
  selectedConsole: 'Game Boy',
  games: [
    { id: 1, title: 'Chrono Trigger', console: 'Game Boy', region: 'NTSC', releaseYear: 1995,
      boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } },
    { id: 2, title: 'Super Metroid', console: 'Game Boy', region: 'NTSC', releaseYear: 1994,
      boxartUrl: 'https://cdn.thegamesdb.net/images/thumb/boxart/front/2-1.jpg',
      ownedConditions: ['loose'], estimates: { loose: 4200, cib: null, new: null } }
  ],
  totalCount: 250,
  page: 1,
  pageSize: 100,
  query: '',
  show: 'all',
  hideHomebrew: true
};

describe('browse page', () => {
  it('renders the games it is given', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText('Super Metroid')).toBeInTheDocument();
  });

  it('shows the estimate on an owned condition control', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$42.00')).toBeInTheDocument();
  });

  it('renders a box-art thumbnail for games that have one', () => {
    const { container } = render(Page, { props: { data } });
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs.some((i) => i.getAttribute('src')?.includes('boxart/front/2-1.jpg'))).toBe(true);
  });

  it('shows the page range and total count', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText(/Showing 1–100 of 250/)).toBeInTheDocument();
  });

  it('shows an empty state when the page has no games', () => {
    const { getByText } = render(Page, { props: { data: { ...data, games: [], totalCount: 0 } } });
    expect(getByText(/no games match/i)).toBeInTheDocument();
  });

  it('disables Prev on the first page and enables Next when more pages exist', () => {
    const { getByRole } = render(Page, { props: { data } });
    expect(getByRole('button', { name: 'Prev' })).toBeDisabled();
    expect(getByRole('button', { name: 'Next' })).not.toBeDisabled();
  });

  it('disables Next on the last page', () => {
    // page 3 × 100 = 300 ≥ 250 → no next page
    const { getByRole } = render(Page, { props: { data: { ...data, page: 3 } } });
    expect(getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('navigates to the next page when Next is clicked', () => {
    goto.mockClear();
    const { getByRole } = render(Page, { props: { data } });
    getByRole('button', { name: 'Next' }).click();
    // Prev/Next call goto(url) with a single argument — no options object.
    expect(goto).toHaveBeenCalledWith(expect.stringContaining('page=2'));
  });

  it('debounced search navigates with the query and resets the page', () => {
    vi.useFakeTimers();
    goto.mockClear();
    const { getByPlaceholderText } = render(Page, { props: { data: { ...data, page: 2 } } });
    const input = getByPlaceholderText(/filter by title/i) as HTMLInputElement;
    input.value = 'metroid';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(300);
    // The search goto passes an options object as its second argument.
    expect(goto).toHaveBeenCalledWith(expect.stringContaining('q=metroid'), expect.anything());
    const lastUrl = (goto.mock.calls.at(-1) as [string, ...unknown[]] | undefined)?.[0];
    expect(lastUrl).not.toContain('page='); // page dropped on filter change
    vi.useRealTimers();
  });
});
