import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  consoles: [
    { console: 'SNES', count: 2 },
    { console: 'N64', count: 1 }
  ],
  selectedConsole: 'SNES',
  search: '',
  games: [
    { id: 1, title: 'Chrono Trigger', console: 'SNES', region: 'NTSC', releaseYear: 1995,
      ownedConditions: [], estimates: { loose: null, cib: null, new: null } },
    { id: 2, title: 'Super Metroid', console: 'SNES', region: 'NTSC', releaseYear: 1994,
      ownedConditions: ['loose'], estimates: { loose: 4200, cib: null, new: null } }
  ]
};

describe('browse page', () => {
  it('lists consoles with counts and the games for the selected console', () => {
    const { getAllByText, getByText } = render(Page, { props: { data } });
    // 'SNES' appears in both the sidebar link and the page h1
    expect(getAllByText('SNES').length).toBeGreaterThan(0);
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText('Super Metroid')).toBeInTheDocument();
  });
  it('shows the estimate on an owned condition control', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$42.00')).toBeInTheDocument();
  });
  it('filters the game list by title text', async () => {
    const { getByPlaceholderText, queryByText } = render(Page, { props: { data } });
    await fireEvent.input(getByPlaceholderText(/filter by title/i), {
      target: { value: 'metroid' }
    });
    expect(queryByText('Super Metroid')).toBeInTheDocument();
    expect(queryByText('Chrono Trigger')).not.toBeInTheDocument();
  });
  it('filters to owned games only', async () => {
    const { getByLabelText, queryByText } = render(Page, { props: { data } });
    await fireEvent.change(getByLabelText('Show'), { target: { value: 'owned' } });
    expect(queryByText('Super Metroid')).toBeInTheDocument();
    expect(queryByText('Chrono Trigger')).not.toBeInTheDocument();
  });
});
