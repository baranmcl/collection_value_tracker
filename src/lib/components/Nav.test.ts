import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Nav from './Nav.svelte';

describe('Nav', () => {
  it('renders links to all four screens', () => {
    const { getByRole } = render(Nav, { props: { pathname: '/' } });
    for (const name of ['Dashboard', 'Browse', 'Collection', 'Settings']) {
      expect(getByRole('link', { name })).toBeInTheDocument();
    }
  });
  it('marks the link matching the current pathname active', () => {
    const { getByRole } = render(Nav, { props: { pathname: '/browse' } });
    expect(getByRole('link', { name: 'Browse' })).toHaveClass('active');
  });
});
