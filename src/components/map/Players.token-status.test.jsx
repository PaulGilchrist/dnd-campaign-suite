// @maintained-by-ai
// Lane: token status + ownership tint on the player-token layer (roadmap
// Item 6). Seeded via the REAL runtime store so the same SSE-echo lane the
// app uses is what arms the indicators; tint cases pin the visitor-vs-GM
// decision (Players.jsx isTokenOwnedHere).
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

describe('Players — token status indicators', () => {
  beforeEach(() => {
    getStore('Thorin').clear();
    getStore('Gimli').clear();
    getStore('campaign').clear();
  });

  it('paints the Prone/Poisoned chips on the token for GM and visitor alike (acceptance)', () => {
    setRuntimeObject('Thorin', { activeConditions: ['prone', 'poisoned'] }, CAMPAIGN, true);
    for (const isLocalhost of [true, false]) {
      const { container, unmount } = renderLayer({ isLocalhost });
      const chips = tokenGroup(container, 0).querySelectorAll('g.token-status-chip');
      expect(chips, `isLocalhost=${isLocalhost}`).toHaveLength(2);
      expect(chips[0]).toHaveAttribute('data-label', 'Prone');
      expect(chips[1]).toHaveAttribute('data-label', 'Poisoned');
      unmount();
    }
  });

  it('leaves tokens with a clear status free of indicator DOM', () => {
    setRuntimeObject('Gimli', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const { container } = renderLayer();
    expect(tokenGroup(container, 0).querySelectorAll('g.token-status-chip')).toHaveLength(0);
    expect(tokenGroup(container, 1).querySelectorAll('g.token-status-chip')).toHaveLength(1);
  });

  it('shows campaign targetEffect chips on the creature they target', () => {
    setRuntimeObject('campaign', { targetEffects: [{ target: 'Gimli', effect: 'web', source: 'Spider' }] }, CAMPAIGN, true);
    const { container } = renderLayer();
    const chip = tokenGroup(container, 1).querySelector('g.token-status-chip');
    expect(chip).toHaveAttribute('data-label', 'Web');
    expect(chip.querySelector('title').textContent).toContain('from Spider');
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
