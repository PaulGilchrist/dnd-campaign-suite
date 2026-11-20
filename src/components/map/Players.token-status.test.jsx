// @maintained-by-ai
// Lane: the player-token lane after the chip hoist (backlog RG 2026-11-19
// occlusion fix). Status chips no longer live inside the token <g> — the
// shared derived row set lives in TokenStatusLayer.jsx (chip laws pinned by
// TokenStatusLayer.test.jsx + TokenStatusIndicators.test.jsx). This file
// pins that Players itself keeps ZERO chip DOM (a reintroduced in-group row
// would re-open the occlusion face) and the ownership-tint decision
// (Players.jsx isTokenOwnedHere: visitor-vs-GM).
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Players from './Players.jsx';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';
const CELL = 40;
const gridCenterX = (gx) => gx * CELL + CELL / 2;
const gridCenterY = (gy) => gy * CELL + CELL / 2;

const players = [
  { id: 'p1', name: 'Thorin', gridX: 2, gridY: 3 },
  { id: 'p2', name: 'Gimli', gridX: 4, gridY: 3 },
];

const renderLayer = (props = {}) =>
  render(
    <svg>
      <Players
        players={players}
        characters={[]}
        gridCenterX={gridCenterX}
        gridCenterY={gridCenterY}
        isLocalhost
        handlePointerDown={vi.fn()}
        setSelectedPlayer={vi.fn()}
        campaignName={CAMPAIGN}
        {...props}
      />
    </svg>
  );

const tokenGroup = (container, playerIndex) => container.querySelectorAll('g.creature-group')[playerIndex];

describe('Players — no chip DOM in the token lane (chips hoisted)', () => {
  beforeEach(() => {
    getStore('Thorin').clear();
    getStore('Gimli').clear();
    getStore('campaign').clear();
  });

  it('a seeded creature paints NO indicator DOM inside (or beside) Players', () => {
    setRuntimeObject('Thorin', { activeConditions: ['prone', 'poisoned'] }, CAMPAIGN, true);
    setRuntimeObject('campaign', { targetEffects: [{ target: 'Gimli', effect: 'web', source: 'Spider' }] }, CAMPAIGN, true);
    for (const isLocalhost of [true, false]) {
      const { container, unmount } = renderLayer({ isLocalhost });
      expect(container.querySelectorAll('g.token-status-indicators')).toHaveLength(0);
      expect(container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
      unmount();
    }
  });
});

describe('Players — ownership tint (visitor vs localhost)', () => {
  beforeEach(() => {
    getStore('Thorin').clear();
    getStore('Gimli').clear();
    getStore('campaign').clear();
  });

  it('visitor client: ring on the locally-selected character only', () => {
    const { container } = renderLayer({ isLocalhost: false, localCharacterName: 'Thorin' });
    expect(tokenGroup(container, 0).querySelector('circle.owned-token-ring')).toBeInTheDocument();
    expect(tokenGroup(container, 1).querySelector('circle.owned-token-ring')).toBeNull();
  });

  it('GM (localhost) sees every token neutral — the tint is a visitor-only affordance', () => {
    const { container } = renderLayer({ isLocalhost: true, localCharacterName: 'Thorin' });
    expect(container.querySelectorAll('circle.owned-token-ring')).toHaveLength(0);
  });

  it('no tint without a local selection (nobody is "yours" by default)', () => {
    const { container } = renderLayer({ isLocalhost: false });
    expect(container.querySelectorAll('circle.owned-token-ring')).toHaveLength(0);
  });

  it('rings fogged-away tokens never paint (fog cull runs before the tint)', () => {
    const { container } = renderLayer({
      isLocalhost: false,
      localCharacterName: 'Thorin',
      fog: new Set(['2,3']),
    });
    expect(container.querySelectorAll('g.creature-group')).toHaveLength(1); // only Gimli survives
    expect(container.querySelectorAll('circle.owned-token-ring')).toHaveLength(0);
  });
});
