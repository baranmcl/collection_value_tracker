import { describe, it, expect } from 'vitest';
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
});
