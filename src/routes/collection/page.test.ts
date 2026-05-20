import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Page from './+page.svelte';

const data = {
  items: [
    { id: 1, gameId: 1, title: 'Chrono Trigger', console: 'SNES',
      boxartUrl: 'https://cdn.thegamesdb.net/images/thumb/boxart/front/1-1.jpg',
      condition: 'loose', grade: 'mint', notes: 'boxed', acquiredAt: null, manualPrice: null,
      value: 4200, valueSource: 'estimate' },
    { id: 2, gameId: 2, title: 'GoldenEye', console: 'N64', boxartUrl: null,
      condition: 'cib', grade: null, notes: null, acquiredAt: null, manualPrice: 9000,
      value: 9000, valueSource: 'manual' }
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
});
