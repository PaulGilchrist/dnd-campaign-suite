// @maintained-by-ai 2026-11-22
//
// .ct-* design-kit convergence (tranche 2): Log view chrome rides the shared
// App.css kit. OWNED HERE (unique): the scoping + variant-hierarchy class
// contracts —
//   - view root carries .ct-container (every kit rule in App.css is
//     descendant-scoped under it — the tranche-1 dead-kit lesson);
//   - composer post button rides .ct-btn .ct-btn-primary alongside its pinned
//     .log-add-btn locator token (title/aria copy law untouched);
//   - loading/empty faces ride .ct-empty-state alongside the pinned
//     .log-loading/.log-empty tokens;
//   - the filter "Clear filters" and "Load older entries" buttons ride
//     .ct-btn .ct-btn-sm (their bespoke skins were retired — the old class
//     names must not come back);
//   - the bespoke .log-add-btn/.log-filter-clear/.log-load-older-btn/
//     .log-loading/.log-empty styling rules are GONE from Log.css.
// Behaviour pins (author census, filters, disabled gates) stay in
// LogToolbar.test.jsx / LogFilters.test.jsx — do not duplicate them here.

import { fireEvent } from '@testing-library/react';
import { beforeEach } from 'vitest';
import { q, setup, beforeEachSetup, mockState, note } from './log-test-utils.jsx';

import Log from './Log.jsx';

describe('Log .ct-* kit classes (tranche 2 convergence)', () => {
  beforeEach(() => {
    beforeEachSetup();
  });

  it('view root carries the kit scoping container and the stable testid', () => {
    setup(Log, []);
    const root = q('.log-view');
    expect(root).toHaveClass('ct-container');
    // Stable container hook (improvement XY 2026-11-23): the Log root is the
    // ONLY [data-testid="campaign-log-view"] node in the view — e2e probes
    // count exactly one here and zero on other views.
    expect(root).toHaveAttribute('data-testid', 'campaign-log-view');
    expect(document.querySelectorAll('[data-testid="campaign-log-view"]')).toHaveLength(1);
  });

  it('composer post button rides ct-btn ct-btn-primary alongside the pinned token', () => {
    setup(Log, []);
    const post = q('.log-add-btn');
    expect(post).toHaveClass('ct-btn', 'ct-btn-primary');
    // Pinned byte-copy law: composer face unchanged by the convergence.
    expect(post).toHaveAttribute('title', 'Post note');
    expect(post).toHaveAttribute('aria-label', 'Post note');
    // F12 (Item 7): the unlabeled `+` became a labeled primary — the visible
    // verb text carries the pinned copy too (icon stays decorative).
    expect(post.textContent).toContain('Post');
    expect(post.querySelector('i[aria-hidden="true"]')).not.toBeNull();
  });

  it('loading and empty faces ride ct-empty-state alongside the pinned tokens', () => {
    setup(Log, [], false);
    const loading = q('.log-loading');
    expect(loading).toBeInTheDocument();
    expect(loading).toHaveClass('ct-empty-state');

    setup(Log, [], true);
    const empty = q('.log-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveClass('ct-empty-state');
    expect(empty.textContent).toContain('No entries yet.');
  });

  it('filter clear button rides the kit tier and the retired class is gone', () => {
    setup(Log, [note()]);
    fireEvent.change(q('#log-filter-text'), { target: { value: 'no-such-text' } });
    const clear = [...document.querySelectorAll('.log-filters button')][0];
    expect(clear).toHaveTextContent('Clear filters');
    expect(clear).toHaveClass('ct-btn', 'ct-btn-sm');
    expect(q('.log-filter-clear')).toBeNull();
    expect(q('.log-empty')).toHaveClass('ct-empty-state');
  });

  it('load-older button rides the kit tier and the retired class is gone', () => {
    const many = Array.from({ length: 101 }, (_, i) => note({ id: `n${i}` }));
    mockState.logEntries.length = 0;
    mockState.logEntries.push(...many);
    setup(Log, many);
    const row = q('.log-load-older-row');
    expect(row).toBeInTheDocument();
    const btn = row.querySelector('button');
    expect(btn).toHaveClass('ct-btn', 'ct-btn-sm');
    expect(q('.log-load-older-btn')).toBeNull();
  });

  it('retired bespoke styling rules are removed from Log.css', async () => {
    const { readFileSync } = await import('node:fs');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'Log.css'),
      'utf-8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const selector of [
      '.log-add-btn',
      '.log-add-btn:disabled',
      '.log-filter-clear',
      '.log-load-older-btn',
      '.log-loading',
      '.log-empty',
    ]) {
      expect(css).not.toContain(`${selector} {`);
    }
    // The kit-compound padding re-anchor rule is the surviving layout piece.
    expect(css).toMatch(/\.log-view\.ct-container\s*{/);
  });
});
