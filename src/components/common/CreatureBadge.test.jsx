// @maintained-by-ai
/**
 * Contract tests for the unified CreatureBadge leaf component (#826).
 *
 * Owned here (the leaf previously had no direct lane; consumers pinned
 * through their own suites):
 *
 *  - Wrapper contract: the wrapper <div> carries the scoped
 *    `creature-badge-wrapper` class and NO inline style attribute
 *    (AGENTS.md: NEVER use inline styles). The wrapper is the anchor for
 *    the absolutely-positioned remove button, so CreatureBadge.css must
 *    declare position:relative + display:inline-block on that class —
 *    jsdom does not apply external stylesheets, so the CSS file is parsed
 *    directly (house pattern from src/App.css.test.jsx).
 *  - Tag contract: clickable badges render <button type="button">,
 *    non-clickable badges render <span>.
 *  - Remove contract: removable + onRemove renders `.creature-badge-remove`
 *    inside the same wrapper, titled "Remove effect", and clicking it
 *    fires onRemove without firing onClick.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, fireEvent } from '@testing-library/react';
import CreatureBadge from './CreatureBadge.jsx';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a stylesheet and strip /* ... *\/ comments before parsing. */
const readCss = (file) => readFileSync(join(SRC_DIR, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

const css = readCss('CreatureBadge.css');

function parseRule(selector) {
  const norm = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'i');
  const match = css.match(re);
  if (!match) return null;
  const props = {};
  for (const decl of match[1].split(';')) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    props[decl.slice(0, colon).trim().toLowerCase()] = norm(decl.slice(colon + 1));
  }
  return props;
}

describe('CreatureBadge wrapper (no inline styles)', () => {
  it('wrapper carries the scoped creature-badge-wrapper class and no style attribute', () => {
    render(<CreatureBadge label='Blessed' cls='effect-buff' />);
    const wrapper = screen.getByTestId('creature-badge').parentElement;
    expect(wrapper.tagName).toBe('DIV');
    expect(wrapper).toHaveClass('creature-badge-wrapper');
    expect(wrapper.getAttribute('style')).toBeNull();
  });

  it('CreatureBadge.css anchors the wrapper for the absolute remove button', () => {
    expect(parseRule('.creature-badge-wrapper')).toMatchObject({
      position: 'relative',
      display: 'inline-block',
    });
    expect(parseRule('.creature-badge-remove')).toMatchObject({ position: 'absolute' });
  });

  it('no inline style remains anywhere in CreatureBadge.jsx', () => {
    const jsx = readFileSync(join(SRC_DIR, 'CreatureBadge.jsx'), 'utf-8');
    expect(jsx).not.toMatch(/style=\{\{/);
  });
});

describe('CreatureBadge tag contract', () => {
  it('renders a button with type=button when clickable', () => {
    render(<CreatureBadge label='Prone DC 10' cls='effect-condition' onClick={() => {}} />);
    const badge = screen.getByRole('button', { name: /prone dc 10/i });
    expect(badge).toHaveClass('creature-badge', 'effect-condition');
    expect(badge.getAttribute('type')).toBe('button');
  });

  it('renders a span when not clickable', () => {
    render(<CreatureBadge label='Wild Shape' cls='effect-buff' />);
    const badge = screen.getByTestId('creature-badge');
    expect(badge.tagName).toBe('SPAN');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('CreatureBadge remove contract', () => {
  it('remove button lives in the wrapper and fires onRemove only', () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(<CreatureBadge label='Hunter’s Mark' cls='effect-neutral' removable onRemove={onRemove} onClick={onClick} />);
    const wrapper = screen.getByTestId('creature-badge').parentElement;
    const removeBtn = wrapper.querySelector('.creature-badge-remove');
    expect(removeBtn).toBeInTheDocument();
    expect(removeBtn.getAttribute('title')).toBe('Remove effect');
    fireEvent.click(removeBtn);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders no remove button when not removable', () => {
    render(<CreatureBadge label='Sanctuary' cls='effect-buff' />);
    expect(document.querySelector('.creature-badge-remove')).toBeNull();
  });
});
