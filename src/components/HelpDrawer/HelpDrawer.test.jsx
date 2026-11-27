// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HelpDrawer from './HelpDrawer.jsx';

// The guide is a build-time raw import (docs/users-guide.md?raw) — the test
// pins the drawer BEHAVIOUR and the drift guard (section titles come from the
// real file), not the full markdown bytes (owned by MarkdownPreview.test.jsx).
// DOM cleanup is handled globally by src/test/setup.js.

describe('HelpDrawer', () => {
  const open = (props = {}) =>
    render(<HelpDrawer open onClose={vi.fn()} activeView="initiative" {...props} />);

  it('renders nothing when closed', () => {
    const { container } = render(<HelpDrawer open={false} onClose={() => {}} activeView="initiative" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the per-view About-this-screen summary above the guide', () => {
    open();
    const about = screen.getByRole('note', { name: 'About this screen' });
    expect(about).toHaveTextContent('shared initiative board');
  });

  it('omits the About card for views without a summary', () => {
    open({ activeView: 'no-such-view' });
    expect(screen.queryByRole('note', { name: 'About this screen' })).not.toBeInTheDocument();
  });

  it('lists guide sections (no Table of Contents) as disclosures', () => {
    open();
    expect(screen.queryByText('Table of Contents')).not.toBeInTheDocument();
    // Canonical section titles from the real users-guide (drift guard: the
    // drawer bundles the actual docs file, not a copy).
    expect(screen.getByText('7. Running combat')).toBeInTheDocument();
    expect(screen.getByText('11. Maps, tokens and fog of war')).toBeInTheDocument();
    expect(screen.getByText('20. Tips, quirks and troubleshooting')).toBeInTheDocument();
  });

  it('search narrows to matching sections, shows an honest line on no match, and resets on reopen', () => {
    const view = open();
    const search = screen.getByRole('searchbox', { name: 'Search the users guide' });
    fireEvent.change(search, { target: { value: 'victory banner' } });
    expect(screen.getByText('7. Running combat')).toBeInTheDocument();
    expect(screen.queryByText('11. Maps, tokens and fog of war')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzzz-no-such-thing' } });
    expect(screen.getByText(/Nothing in the guide matches/)).toBeInTheDocument();

    // Closing and re-opening must clear the filter so the guide is whole again.
    view.rerender(<HelpDrawer open={false} onClose={vi.fn()} activeView="initiative" />);
    view.rerender(<HelpDrawer open onClose={vi.fn()} activeView="initiative" />);
    expect(screen.queryByText(/Nothing in the guide matches/)).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search the users guide' })).toHaveValue('');
    expect(screen.getByText('11. Maps, tokens and fog of war')).toBeInTheDocument();
  });

  it('closes via backdrop click, ×, and Escape — but not on clicks inside the drawer', () => {
    const onClose = vi.fn();
    const { container } = open({ onClose });
    fireEvent.click(container.querySelector('.help-drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // A click inside the panel must NOT bubble to the backdrop's close handler.
    fireEvent.click(screen.getByRole('dialog', { name: 'Help' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTitle('Close help (Esc)'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
