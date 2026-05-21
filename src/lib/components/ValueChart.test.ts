import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ValueChart from './ValueChart.svelte';

describe('ValueChart', () => {
  it('shows an empty-state message when there is no history', () => {
    const { getByText } = render(ValueChart, { props: { history: [] } });
    expect(getByText(/no value history yet/i)).toBeInTheDocument();
  });

  it('shows a single-value message when there is one refresh', () => {
    const { getByText } = render(ValueChart, {
      props: { history: [{ at: new Date('2026-05-01T00:00:00Z'), value: 5000 }] }
    });
    expect(getByText(/first value recorded/i)).toBeInTheDocument();
  });

  it('draws a polyline and one circle per point for 2+ refreshes', () => {
    const history = [
      { at: new Date('2026-05-01T00:00:00Z'), value: 5000 },
      { at: new Date('2026-05-10T00:00:00Z'), value: 6000 },
      { at: new Date('2026-05-20T00:00:00Z'), value: 5500 }
    ];
    const { container } = render(ValueChart, { props: { history } });
    expect(container.querySelector('polyline')).not.toBeNull();
    expect(container.querySelectorAll('circle')).toHaveLength(3);
  });
});
