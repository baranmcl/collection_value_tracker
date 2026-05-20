import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  consoles: [
    { console: 'Game Boy', count: 3 },
    { console: 'N64', count: 1 }
  ],
  selectedConsole: 'Game Boy',
  search: '',
  games: [
    { id: 1, title: 'Chrono Trigger', console: 'Game Boy', region: 'NTSC', releaseYear: 1995,
      boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } },
    { id: 2, title: 'Super Metroid', console: 'Game Boy', region: 'NTSC', releaseYear: 1994,
      boxartUrl: 'https://cdn.thegamesdb.net/images/thumb/boxart/front/2-1.jpg',
      ownedConditions: ['loose'], estimates: { loose: 4200, cib: null, new: null } },
    { id: 3, title: 'Homebrew Quest', console: 'Game Boy', region: null, releaseYear: 2023,
      boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } },
    { id: 4, title: 'Pokémon Ruby Version', console: 'Game Boy', region: 'NTSC', releaseYear: 2003,
      boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } }
  ]
};

describe('browse page', () => {
  it('lists consoles with counts and the games for the selected console', () => {
    const { getAllByText, getByText } = render(Page, { props: { data } });
    // 'Game Boy' appears in both the sidebar link and the page h1
    expect(getAllByText('Game Boy').length).toBeGreaterThan(0);
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
  it('filters the game list by title text', async () => {
    const { getByPlaceholderText, queryByText } = render(Page, { props: { data } });
    await fireEvent.input(getByPlaceholderText(/filter by title/i), {
      target: { value: 'metroid' }
    });
    expect(queryByText('Super Metroid')).toBeInTheDocument();
    expect(queryByText('Chrono Trigger')).not.toBeInTheDocument();
  });
  it('matches accented titles when the search omits the accent', async () => {
    const { getByPlaceholderText, queryByText } = render(Page, { props: { data } });
    await fireEvent.input(getByPlaceholderText(/filter by title/i), {
      target: { value: 'pokemon ruby' }
    });
    // "Pokémon Ruby Version" (accented é) must match a plain-ASCII search.
    expect(queryByText('Pokémon Ruby Version')).toBeInTheDocument();
  });
  it('filters to owned games only', async () => {
    const { getByLabelText, queryByText } = render(Page, { props: { data } });
    await fireEvent.change(getByLabelText('Show'), { target: { value: 'owned' } });
    expect(queryByText('Super Metroid')).toBeInTheDocument();
    expect(queryByText('Chrono Trigger')).not.toBeInTheDocument();
  });
  it('hides games released after the console era by default and reveals them when toggled off', async () => {
    const { queryByText, getByLabelText } = render(Page, { props: { data } });
    // Game Boy's commercial era ended ~2009 — the 2023 entry is hidden.
    expect(queryByText('Homebrew Quest')).not.toBeInTheDocument();
    expect(queryByText('Chrono Trigger')).toBeInTheDocument();
    await fireEvent.click(getByLabelText(/homebrew/i));
    expect(queryByText('Homebrew Quest')).toBeInTheDocument();
  });
  it('hides games dated before the console existed', async () => {
    const gbData = {
      consoles: [{ console: 'Game Boy', count: 2 }],
      selectedConsole: 'Game Boy',
      search: '',
      games: [
        { id: 10, title: 'Tetris', console: 'Game Boy', region: 'NTSC', releaseYear: 1989,
          boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } },
        { id: 11, title: 'Epoch Junk Hack', console: 'Game Boy', region: null, releaseYear: 1970,
          boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } }
      ]
    };
    const { queryByText, getByLabelText } = render(Page, { props: { data: gbData } });
    // Game Boy launched in 1989; a 1970 date is impossible, so it is hidden.
    expect(queryByText('Tetris')).toBeInTheDocument();
    expect(queryByText('Epoch Junk Hack')).not.toBeInTheDocument();
    await fireEvent.click(getByLabelText(/homebrew/i));
    expect(queryByText('Epoch Junk Hack')).toBeInTheDocument();
  });
  it('keeps current-era games for a console still in production', () => {
    const switchData = {
      consoles: [{ console: 'Switch', count: 1 }],
      selectedConsole: 'Switch',
      search: '',
      games: [
        { id: 20, title: 'Recent Switch Game', console: 'Switch', region: 'NTSC', releaseYear: 2024,
          boxartUrl: null, ownedConditions: [], estimates: { loose: null, cib: null, new: null } }
      ]
    };
    // Switch has no end year, so a 2024 game is NOT treated as homebrew.
    const { queryByText } = render(Page, { props: { data: switchData } });
    expect(queryByText('Recent Switch Game')).toBeInTheDocument();
  });
});
