// @maintained-by-ai
// Lane: the placed-creature-token lane after the chip hoist (backlog
// RG 2026-11-19 occlusion fix). Monster/NPC status chips moved to the shared
// hoisted TokenStatusLayer (chip laws + visibility/ghost cull pinned by
// TokenStatusLayer.test.jsx). This file pins that PlacedItems itself keeps
// ZERO chip DOM on every face — live tokens, ghosts, hidden rows and props —
// so no second, occludable chip mechanism can creep back into the token
// groups.
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';
import { getStore, setRuntimeObject } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

const monster = (over) => ({
  id: 'token-1', name: 'Goblin 2', type: 'monster',
  gridX: 3, gridY: 3, visible: true, ...over,
});

const renderItems = (items, over = {}) =>
  render(<PlacedItems {...baseProps} {...over} placedItems={items} />);

describe('PlacedItems — no chip DOM in the token lane (chips hoisted)', () => {
  beforeEach(() => {
    getStore('Goblin 2').clear();
    getStore('campaign').clear();
  });

  it('GM lane: a seeded monster group carries no indicator DOM', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['blinded'] }, CAMPAIGN, true);
    setRuntimeObject('campaign', { targetEffects: [{ target: 'Goblin 2', effect: 'sanctuary', source: 'Cleric' }] }, CAMPAIGN, true);
    const { container } = renderItems([monster()]);
    expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
    expect(container.querySelectorAll('g.token-status-indicators')).toHaveLength(0);
    expect(container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
  });

  it('ghost face: the frozen .token-ghost paints art but zero chips', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    // The parent's hoisted pass (Map.jsx) hands down the last-seen memory;
    // with the truth cell fogged the group re-renders as a ghost.
    const { container } = render(
      <PlacedItems
        {...baseProps}
        isLocalhost={false}
        campaignName={CAMPAIGN}
        fog={new Set(['3,3'])}
        ghostCells={new Map([['token-1', { gridX: 3, gridY: 3 }]])}
        placedItems={[monster()]}
      />
    );
    expect(container.querySelectorAll('g.npc-group.token-ghost')).toHaveLength(1);
    expect(container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
  });

  it('props (non-creature rows) carry no indicator DOM', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const { container } = renderItems([
      { id: 'barrel-1', name: 'Barrel', type: 'barrel', gridX: 1, gridY: 1, visible: true },
    ]);
    expect(container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
  });
});
