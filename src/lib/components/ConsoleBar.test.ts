import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ConsoleBar from './ConsoleBar.svelte';

describe('ConsoleBar', () => {
  it('renders a labelled segment per console', () => {
    const { getByText } = render(ConsoleBar, {
      props: { byConsole: [{ console: 'SNES', value: 7500 }, { console: 'N64', value: 2500 }] }
    });
    expect(getByText('SNES')).toBeInTheDocument();
    expect(getByText('N64')).toBeInTheDocument();
  });
  it('sizes each segment by its share of the total', () => {
    const { getByTestId } = render(ConsoleBar, {
      props: { byConsole: [{ console: 'SNES', value: 7500 }, { console: 'N64', value: 2500 }] }
    });
    expect(getByTestId('seg-SNES').style.width).toBe('75%');
    expect(getByTestId('seg-N64').style.width).toBe('25%');
  });
  it('renders nothing meaningful for an empty collection', () => {
    const { getByText } = render(ConsoleBar, { props: { byConsole: [] } });
    expect(getByText(/no value/i)).toBeInTheDocument();
  });
});
