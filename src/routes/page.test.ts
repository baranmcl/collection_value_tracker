import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  totalValue: 13000,
  itemCount: 7,
  unvaluedCount: 0,
  byConsole: [
    { console: 'SNES', count: 5, value: 8000 },
    { console: 'N64', count: 2, value: 5000 }
  ],
  movers: [],
  lastRefreshAt: null,
  refreshDelta: 2000
};

describe('dashboard', () => {
  it('shows total value and item count tiles', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$130.00')).toBeInTheDocument();
    expect(getByText('7')).toBeInTheDocument();
  });
  it('shows the delta since the last refresh', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText(/\+\$20\.00/)).toBeInTheDocument();
  });
  it('breaks the collection down by console with item counts', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('5 items')).toBeInTheDocument();
    expect(getByText('2 items')).toBeInTheDocument();
  });
});
