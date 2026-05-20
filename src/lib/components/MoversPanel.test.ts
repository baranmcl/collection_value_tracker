import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import MoversPanel from './MoversPanel.svelte';

describe('MoversPanel', () => {
  it('shows each mover with its signed dollar change', () => {
    const { getByText } = render(MoversPanel, {
      props: { movers: [
        { gameId: 1, title: 'Chrono Trigger', condition: 'loose', previous: 5000, current: 6200, delta: 1200 },
        { gameId: 2, title: 'GoldenEye', condition: 'cib', previous: 8000, current: 7900, delta: -100 }
      ] }
    });
    expect(getByText('Chrono Trigger')).toBeInTheDocument();
    expect(getByText(/\+\$12\.00/)).toBeInTheDocument();
    expect(getByText(/−\$1\.00/)).toBeInTheDocument();
  });
  it('shows an empty-state message when there are no movers', () => {
    const { getByText } = render(MoversPanel, { props: { movers: [] } });
    expect(getByText(/no movement|need at least two refreshes/i)).toBeInTheDocument();
  });
});
