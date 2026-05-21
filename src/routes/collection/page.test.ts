import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import Page from './+page.svelte';

const data = {
  items: [
    { id: 1, gameId: 1, title: 'Chrono Trigger', console: 'SNES',
      boxartUrl: 'https://cdn.thegamesdb.net/images/thumb/boxart/front/1-1.jpg',
      condition: 'loose', grade: 'mint', notes: 'boxed', acquiredAt: null, manualPrice: null,
      value: 4200, valueSource: 'estimate' as const, estimateAge: '3d ago', estimateStale: false, listingCount: 5 },
    { id: 2, gameId: 2, title: 'GoldenEye', console: 'N64', boxartUrl: null,
      condition: 'cib', grade: null, notes: null, acquiredAt: null, manualPrice: 9000,
      value: 9000, valueSource: 'manual' as const, estimateAge: null, estimateStale: false, listingCount: null }
  ],
  totalValue: 13200,
  averageValue: 6600
};

describe('collection page', () => {
  it('renders a row per item with title and value', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText('$42.00')).toBeInTheDocument();
    expect(getByText('$90.00')).toBeInTheDocument();
  });
  it('shows the collection total and average', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('$132.00')).toBeInTheDocument();
    expect(getByText('$66.00')).toBeInTheDocument();
  });
  it('marks a manually-priced value distinctly from an estimate', () => {
    const { getByTestId } = render(Page, { props: { data } });
    expect(getByTestId('value-source-2').textContent).toMatch(/manual/i);
  });
  it('renders a box-art thumbnail for items that have one', () => {
    const { container } = render(Page, { props: { data } });
    const imgs = [...container.querySelectorAll('img')];
    expect(imgs.some((i) => i.getAttribute('src')?.includes('boxart/front/1-1.jpg'))).toBe(true);
  });
  it('shows the relative age of an estimate-sourced value', () => {
    const { getByText } = render(Page, { props: { data } });
    expect(getByText('est. 3d ago')).toBeInTheDocument();
  });
  it('renders an age line only for estimate-sourced items', () => {
    // data has one estimate item (id 1) and one manual item (id 2)
    const { container } = render(Page, { props: { data } });
    expect(container.querySelectorAll('.age').length).toBe(1);
  });
  it('marks a stale estimate with the stale class', () => {
    const staleData = { ...data, items: [{ ...data.items[0], estimateStale: true }] };
    const { container } = render(Page, { props: { data: staleData } });
    expect(container.querySelector('.age.stale')).not.toBeNull();
  });
  it('flags a low-confidence estimate with its listing count', () => {
    const thinData = { ...data, items: [{ ...data.items[0], listingCount: 1 }] };
    const { getByText } = render(Page, { props: { data: thinData } });
    expect(getByText(/⚠ 1 listing/)).toBeInTheDocument();
  });
  it('shows no low-confidence marker when the estimate has enough listings', () => {
    // data item 1 has listingCount 5 — above the floor of 3
    const { container } = render(Page, { props: { data } });
    expect(container.querySelectorAll('.lowconf').length).toBe(0);
  });
});

const sortData = {
  items: [
    { id: 1, gameId: 1, title: 'Zelda', console: 'GameCube', boxartUrl: null,
      condition: 'new', grade: 'fair', notes: null, acquiredAt: null, manualPrice: null,
      value: 1000, valueSource: 'estimate' as const, estimateAge: '3d ago', estimateStale: false, listingCount: 5 },
    { id: 2, gameId: 2, title: 'Mario', console: 'SNES', boxartUrl: null,
      condition: 'loose', grade: 'mint', notes: null, acquiredAt: null, manualPrice: null,
      value: 3000, valueSource: 'estimate' as const, estimateAge: '3d ago', estimateStale: false, listingCount: 5 },
    { id: 3, gameId: 3, title: 'Kirby', console: 'N64', boxartUrl: null,
      condition: 'cib', grade: 'good', notes: null, acquiredAt: null, manualPrice: null,
      value: 2000, valueSource: 'estimate' as const, estimateAge: '3d ago', estimateStale: false, listingCount: 5 }
  ],
  totalValue: 6000,
  averageValue: 2000
};

const rowTitles = (c: HTMLElement) =>
  [...c.querySelectorAll('.row:not(.header) .title')].map((el) => (el.textContent ?? '').trim());

describe('collection page — sorting and filtering', () => {
  it('sorts by title ascending by default', () => {
    const { container } = render(Page, { props: { data: sortData } });
    expect(rowTitles(container)).toEqual(['Kirby', 'Mario', 'Zelda']);
  });

  it('sorts by a column when its header button is clicked', async () => {
    const { container, getByRole } = render(Page, { props: { data: sortData } });
    getByRole('button', { name: /console/i }).click();
    await tick();
    expect(rowTitles(container)).toEqual(['Zelda', 'Kirby', 'Mario']); // GameCube, N64, SNES
  });

  it('reverses the sort direction when the same header is clicked twice', async () => {
    const { container, getByRole } = render(Page, { props: { data: sortData } });
    const header = getByRole('button', { name: /console/i });
    header.click();
    await tick();
    header.click();
    await tick();
    expect(rowTitles(container)).toEqual(['Mario', 'Kirby', 'Zelda']); // SNES, N64, GameCube
  });

  it('sorts condition in loose→cib→new order, not alphabetically', async () => {
    const { container, getByRole } = render(Page, { props: { data: sortData } });
    getByRole('button', { name: /condition/i }).click();
    await tick();
    expect(rowTitles(container)).toEqual(['Mario', 'Kirby', 'Zelda']); // loose, cib, new
  });

  it('sorts grade in mint→poor order', async () => {
    const { container, getByRole } = render(Page, { props: { data: sortData } });
    getByRole('button', { name: /grade/i }).click();
    await tick();
    expect(rowTitles(container)).toEqual(['Mario', 'Kirby', 'Zelda']); // mint, good, fair
  });

  it('sorts value highest-first when the Value header is clicked', async () => {
    const { container, getByRole } = render(Page, { props: { data: sortData } });
    getByRole('button', { name: /value/i }).click();
    await tick();
    expect(rowTitles(container)).toEqual(['Mario', 'Kirby', 'Zelda']); // 3000, 2000, 1000
  });

  it('filters the collection by console', async () => {
    const { container, getByLabelText } = render(Page, { props: { data: sortData } });
    const select = getByLabelText(/console/i) as HTMLSelectElement;
    select.value = 'N64';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(rowTitles(container)).toEqual(['Kirby']);
  });
});
