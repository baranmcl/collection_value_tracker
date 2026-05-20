import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  totalValue: 13000, itemCount: 2, unvaluedCount: 0,
  byConsole: [{ console: 'SNES', value: 13000 }],
  movers: [], lastRefreshAt: null, refreshDelta: 2000
};

describe('dashboard', () => {
  it('shows total value and item count tiles', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$130.00')).toBeInTheDocument();
    expect(getByText('2')).toBeInTheDocument();
  });
  it('shows the delta since the last refresh', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText(/\+\$20\.00/)).toBeInTheDocument();
  });
});
