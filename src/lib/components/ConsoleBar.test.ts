import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ConsoleBar from './ConsoleBar.svelte';

describe('ConsoleBar', () => {
  it('shows each console with its item count', () => {
    const { getByText } = render(ConsoleBar, {
      props: {
        byConsole: [
          { console: 'SNES', count: 12, value: 7500 },
          { console: 'N64', count: 3, value: 2500 }
        ]
      }
    });
    expect(getByText('SNES')).toBeInTheDocument();
    expect(getByText('12 items')).toBeInTheDocument();
    expect(getByText('3 items')).toBeInTheDocument();
  });
  it('sizes each value segment by its share of the total', () => {
    const { getByTestId } = render(ConsoleBar, {
      props: {
        byConsole: [
          { console: 'SNES', count: 12, value: 7500 },
          { console: 'N64', count: 3, value: 2500 }
        ]
      }
    });
    expect(getByTestId('seg-SNES').style.width).toBe('75%');
    expect(getByTestId('seg-N64').style.width).toBe('25%');
  });
  it('still shows counts when nothing is priced yet', () => {
    const { getByText, queryByTestId } = render(ConsoleBar, {
      props: { byConsole: [{ console: 'Game Boy', count: 45, value: 0 }] }
    });
    expect(getByText('45 items')).toBeInTheDocument();
    // no value bar when no console has a value
    expect(queryByTestId('seg-Game Boy')).not.toBeInTheDocument();
  });
  it('renders an empty-state message for an empty collection', () => {
    const { getByText } = render(ConsoleBar, { props: { byConsole: [] } });
    expect(getByText(/no items/i)).toBeInTheDocument();
  });
});
