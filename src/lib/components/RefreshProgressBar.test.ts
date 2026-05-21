import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import RefreshProgressBar from './RefreshProgressBar.svelte';

describe('RefreshProgressBar', () => {
  it('shows the current game and the done/total count', () => {
    const { getByText } = render(RefreshProgressBar, {
      props: { progress: { done: 12, total: 40, current: 'Chrono Trigger' } }
    });
    expect(getByText(/Chrono Trigger/)).toBeInTheDocument();
    expect(getByText(/12 \/ 40/)).toBeInTheDocument();
  });
  it('sizes the bar fill to the done/total fraction', () => {
    const { getByTestId } = render(RefreshProgressBar, {
      props: { progress: { done: 10, total: 40, current: 'X' } }
    });
    expect(getByTestId('progress-fill').style.width).toBe('25%');
  });
  it('renders a 0%-wide fill at the start of a run', () => {
    const { getByTestId } = render(RefreshProgressBar, {
      props: { progress: { done: 0, total: 40, current: 'X' } }
    });
    expect(getByTestId('progress-fill').style.width).toBe('0%');
  });
});
