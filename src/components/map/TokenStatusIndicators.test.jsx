// @maintained-by-ai 2026-11-19
// Lane: TokenStatusIndicators (roadmap Item 6 — token status rings). Rides
// the REAL runtime store (seeded like the GM-Screen lane) so the live-SSE
// subscription behavior is proven, with the tokenStatus service wrapped in a
// counting spy (memoization oracle: unaffected tokens must not recompute
// during a position storm or an unrelated creature's store write).
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/combat/conditions/tokenStatus.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    buildTokenStatusIndicators: vi.fn(actual.buildTokenStatusIndicators),
  };
});

import TokenStatusIndicators from './TokenStatusIndicators.jsx';
import { buildTokenStatusIndicators } from '../../services/combat/conditions/tokenStatus.js';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const CX = 120;
const CY = 140;

const seedConditions = (name, keys) => {
  setRuntimeObject(name, { activeConditions: keys }, CAMPAIGN, true);
};
const seedTargetEffects = (rows) => {
  setRuntimeObject('campaign', { targetEffects: rows }, CAMPAIGN, true);
};

const renderOne = (props = {}) =>
  render(
    <svg>
      <TokenStatusIndicators campaignName={CAMPAIGN} creatureName="Thorin" cx={CX} cy={CY} {...props} />
    </svg>
  );

const chips = () => screen.queryAllByTestId('token-status-chip');

describe('TokenStatusIndicators', () => {
  beforeEach(() => {
    getStore('Thorin').clear();
    getStore('Gimli').clear();
    getStore('campaign').clear();
    vi.mocked(buildTokenStatusIndicators).mockClear();
  });

  it('renders nothing while the creature carries no conditions or effects', () => {
    renderOne();
    expect(chips()).toHaveLength(0);
    expect(screen.queryByTestId('token-status-indicators')).toBeNull();
  });

  it('renders a tone-classed chip per condition with the tracker tooltip', () => {
    seedConditions('Thorin', ['prone', 'poisoned']);
    renderOne();
    const all = chips();
    expect(all).toHaveLength(2);
    expect(all[0]).toHaveAttribute('data-label', 'Prone');
    expect(all[0]).toHaveClass('effect-condition');
    expect(all[0].querySelector('title').textContent).toContain('crawl');
    expect(all[0].querySelector('text.token-status-glyph').textContent).toBe('P');
    expect(all[1]).toHaveAttribute('data-label', 'Poisoned');
  });

  it('renders campaign targetEffects aimed at the creature with registry tone', () => {
    seedTargetEffects([
      { target: 'Thorin', effect: 'bless_bonus', source: 'Wizard' },
      { target: 'Gimli', effect: 'bane_penalty', source: 'Hag' },
    ]);
    renderOne();
    const all = chips();
    expect(all).toHaveLength(1); // Gimli's row never paints on Thorin
    expect(all[0]).toHaveAttribute('data-label', 'Bless (+1d4)');
    expect(all[0]).toHaveClass('effect-bless'); // registry cls — green, like the badge
    expect(all[0].querySelector('title').textContent).toContain('from Wizard');
  });

  it('caps at 3 chips and folds the rest into a "+N" overflow naming the hidden labels', () => {
    seedConditions('Thorin', ['prone', 'poisoned', 'blinded', 'restrained', 'stunned']);
    renderOne();
    const all = chips();
    expect(all).toHaveLength(4); // 3 visible + overflow
    expect(all.slice(0, 3).map(c => c.getAttribute('data-label')))
      .toEqual(['Prone', 'Poisoned', 'Blinded']);
    const overflow = all[3];
    expect(overflow).toHaveClass('token-status-overflow');
    expect(overflow.querySelector('text.token-status-glyph').textContent).toBe('+2');
    expect(overflow.querySelector('title').textContent).toBe('2 more: Restrained, Stunned');
  });

  it('live store updates flow both ways: adding arms the chip, removing clears it', () => {
    renderOne();
    expect(chips()).toHaveLength(0);
    act(() => seedConditions('Thorin', ['prone']));
    expect(chips()).toHaveLength(1);
    act(() => seedConditions('Thorin', []));
    expect(chips()).toHaveLength(0);
    act(() => seedTargetEffects([{ target: 'Thorin', effect: 'web', source: 'Spider' }]));
    expect(chips()).toHaveLength(1);
    act(() => seedTargetEffects([]));
    expect(chips()).toHaveLength(0);
  });

  it('renders nothing for a nameless token (never reads a bogus store)', () => {
    renderOne({ creatureName: '' });
    expect(chips()).toHaveLength(0);
  });

  it('memoizes per creature: a position storm and an unrelated store write never recompute a still token', () => {
    seedConditions('Thorin', ['prone']);
    seedConditions('Gimli', ['poisoned']);
    // Two indicators under one parent, simulating the token layer re-render.
    const tree = (thorinCx) => (
      <svg>
        <TokenStatusIndicators campaignName={CAMPAIGN} creatureName="Thorin" cx={thorinCx} cy={CY} />
        <TokenStatusIndicators campaignName={CAMPAIGN} creatureName="Gimli" cx={200} cy={CY} />
      </svg>
    );
    const { rerender } = render(tree(CX));
    expect(vi.mocked(buildTokenStatusIndicators).mock.calls.map(c => c[0])).toEqual(['Thorin', 'Gimli']);
    vi.mocked(buildTokenStatusIndicators).mockClear();

    // SSE position storm: Thorin moves (its subtree re-renders to repaint at
    // the new cell, but the condition/effect deps are unchanged so the memo
    // skips a rebuild) and Gimli's props are identical — memo skips that
    // subtree entirely. Neither recomputes the indicator list.
    rerender(tree(CX + 40));
    expect(buildTokenStatusIndicators).not.toHaveBeenCalled();
    vi.mocked(buildTokenStatusIndicators).mockClear();

    // Unrelated store write on Thorin's bucket (e.g. HP tick): the
    // activeConditions subscription's value-equality guard means neither
    // token recomputes.
    act(() => setRuntimeObject('Thorin', { currentHitPoints: 22 }, CAMPAIGN, true));
    expect(buildTokenStatusIndicators).not.toHaveBeenCalled();
  });
});
