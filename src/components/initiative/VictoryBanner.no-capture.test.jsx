// @maintained-by-ai
/**
 * Pass-through + placement contract for the victory banner (EN backlog
 * 2026-11-08, hardened by the EP backlog 2026-11-08).
 *
 * History: the full-screen scrim first ate the board's Next → click (fixed by
 * scrim pointer-events:none); the centered card then ate the FIRST click on
 * the fresh board's Clear / + NPC row (dismiss-eats-a-click — Playwright had
 * to retry). Both lanes are now closed together:
 *
 *  - Placement: the banner container aligns `flex-start` with a vh
 *    `padding-top`, so the card rides an upper band of the viewport — never
 *    centered over mid/lower content like the .combat-controls row.
 *  - Capture: NEITHER the scrim NOR the card body intercepts clicks
 *    (both declare `pointer-events: none`); the only capture targets are the
 *    explicit dismiss controls — the corner × (`.victory-close`) and the
 *    Continue button (`.victory-dismiss`) — which re-enable `pointer-events:
 *    auto`. A first click aimed anywhere else lands on whatever is beneath.
 *  - Handler contract: no click handler on the scrim OR the card; only the
 *    two buttons fire onDismiss.
 *
 * jsdom does not apply external stylesheets, so Initiative.css is parsed
 * directly (house pattern from CreatureBadge.test). Z-tier contract lives
 * separately in VictoryBanner.modal-tier.test.jsx (banner stays at 150).
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

describe('victory banner never captures clicks outside its dismiss buttons', () => {
  it('scrim declares pointer-events:none in Initiative.css', () => {
    expect(parseRule('.initiative .victory-banner')).toMatchObject({ 'pointer-events': 'none' });
  });

  it('card body declares pointer-events:none (no dismiss-eats-a-click)', () => {
    const card = parseRule('.initiative .victory-card');
    expect(card).toMatchObject({ 'pointer-events': 'none' });
    expect(card['cursor']).toBeUndefined();
  });

  it('the × and Continue buttons are the only capture targets (pointer-events:auto)', () => {
    expect(parseRule('.initiative .victory-close')).toMatchObject({ 'pointer-events': 'auto' });
    expect(parseRule('.initiative .victory-dismiss')).toMatchObject({ 'pointer-events': 'auto' });
  });

  it('scrim and card clicks never dismiss; only the explicit buttons do', () => {
    const { container, onDismiss } = renderBanner();
    const scrim = container.querySelector('.victory-banner');
    const card = container.querySelector('.victory-card');

    // A first click aimed through the overlay (scrim or card body) must land
    // on the board underneath — no handler attached up there at all.
    fireEvent.click(scrim);
    fireEvent.click(card);
    expect(onDismiss).not.toHaveBeenCalled();

    // Explicit dismissal: corner × and Continue each fire onDismiss once.
    fireEvent.click(screen.getByRole('button', { name: /dismiss victory banner/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});

describe('victory banner card rides an upper band of the viewport', () => {
  it('banner aligns flex-start (never centered over the controls row)', () => {
    expect(parseRule('.initiative .victory-banner')).toMatchObject({ 'align-items': 'flex-start' });
  });

  it('banner offsets the card from the very top with a vh padding band', () => {
    const padding = parseRule('.initiative .victory-banner')['padding-top'];
    expect(padding, 'banner needs a vh top offset, not a 0-height pin').toMatch(/^\d+(\.\d+)?vh$/);
    expect(parseFloat(padding)).toBeGreaterThan(0);
    expect(parseFloat(padding)).toBeLessThan(50); // stays above mid-viewport
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
