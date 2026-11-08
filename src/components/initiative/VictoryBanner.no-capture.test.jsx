// @maintained-by-ai
/**
 * Pass-through contract for the victory banner (EN backlog 2026-11-08).
 *
 * Right after Initiative "Clear" the full-screen scrim sits over the freshly
 * mounted board and silently ate the first `Next →` click until the banner
 * was click-dismissed. Fixes locked here:
 *
 *  - CSS contract: the scrim (`.initiative .victory-banner`) declares
 *    `pointer-events: none` so clicks outside the card fall through to the
 *    board; the card itself re-enables `pointer-events: auto` so it remains
 *    the only capture target. jsdom does not apply external stylesheets, so
 *    Initiative.css is parsed directly (house pattern from CreatureBadge.test).
 *  - Handler contract: the dismiss handler lives on the CARD (with the
 *    "Click to dismiss" title), not the scrim — the container no longer
 *    carries a click handler, mirroring what a real browser can hit.
 *  - Copy/dismiss UX unchanged: honest lines render, card click and the
 *    Continue button still fire onDismiss.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, fireEvent } from '@testing-library/react';
import VictoryBanner from './VictoryBanner.jsx';

const SRC_DIR = dirname(fileURLToPath(import.meta.url));

/** Read a stylesheet and strip /* ... *\/ comments before parsing. */
const readCss = (file) => readFileSync(join(SRC_DIR, file), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '');

const css = readCss('Initiative.css');

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

const RESULT = { stamp: 42, rounds: 2, foes: 1, defeated: 0, survivors: 3, partySize: 3, wipe: false };

const renderBanner = (onDismiss = vi.fn()) => {
  const { container } = render(<VictoryBanner visible result={RESULT} onDismiss={onDismiss} />);
  return { container, onDismiss };
};

describe('victory banner does not capture board clicks', () => {
  it('scrim declares pointer-events:none in Initiative.css', () => {
    expect(parseRule('.initiative .victory-banner')).toMatchObject({ 'pointer-events': 'none' });
  });

  it('celebration card re-enables pointer-events:auto (and keeps the pointer cursor)', () => {
    const card = parseRule('.initiative .victory-card');
    expect(card).toMatchObject({ 'pointer-events': 'auto', cursor: 'pointer' });
  });

  it('dismiss handler lives on the card, not the scrim container', () => {
    const { container, onDismiss } = renderBanner();
    const scrim = container.querySelector('.victory-banner');
    const card = container.querySelector('.victory-card');

    // Scrim clicks never fire onDismiss (a real browser routes them to the
    // board underneath; jsdom proves no handler is attached up there).
    fireEvent.click(scrim);
    expect(onDismiss).not.toHaveBeenCalled();

    // The card still dismisses exactly as before.
    fireEvent.click(card);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('victory banner display and dismissal unchanged', () => {
  it('renders the honest stamped copy with a working Continue button', () => {
    const { onDismiss } = renderBanner();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Victory!')).toBeInTheDocument();
    expect(screen.getByText('The party survived 2 rounds!')).toBeInTheDocument();
    expect(screen.getByText('3 of 3 heroes standing')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('renders nothing when hidden or unstamped', () => {
    const { container } = render(<VictoryBanner visible={false} result={RESULT} onDismiss={() => {}} />);
    expect(container.querySelector('.victory-banner')).toBeNull();
    const { container: empty } = render(<VictoryBanner visible result={null} onDismiss={() => {}} />);
    expect(empty.querySelector('.victory-banner')).toBeNull();
  });
});
