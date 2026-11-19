// @maintained-by-ai
// Lane: token status indicators on the placed creature-token layer (roadmap
// Item 6) — NPC and monster rows ride the same derived chips as player
// tokens, keyed by the token name (the runtime bucket conditions are
// granted to). Visibility law unchanged: a token a LAN player can't see
// (hidden/fogged) also paints no chips.
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
  render(<PlacedItems {...baseProps} campaignName={CAMPAIGN} {...over} placedItems={items} />);

describe('PlacedItems — creature-token status chips', () => {
  beforeEach(() => {
    getStore('Goblin 2').clear();
    getStore('campaign').clear();
  });

  it('renders condition + targetEffect chips inside the monster token group', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['blinded'] }, CAMPAIGN, true);
    setRuntimeObject('campaign', { targetEffects: [{ target: 'Goblin 2', effect: 'sanctuary', source: 'Cleric' }] }, CAMPAIGN, true);
    const { container } = renderItems([monster()]);
    const chips = container.querySelectorAll('g.npc-group g.token-status-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveAttribute('data-label', 'Blinded');
    expect(chips[0]).toHaveClass('effect-condition');
    expect(chips[1]).toHaveAttribute('data-label', 'Sanctuary');
    expect(chips[1]).toHaveClass('effect-buff');
  });

  it('NPC tokens get the same treatment', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const { container } = renderItems([monster({ id: 'npc-1', type: 'npc' })]);
    expect(container.querySelectorAll('g.npc-group g.token-status-chip')).toHaveLength(1);
  });

  it('a token LAN players cannot see paints no chips (visibility law first)', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const lan = renderItems([monster({ visible: false })], { isLocalhost: false });
    expect(lan.container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
  });

  it('props (non-creature rows) carry no indicator DOM', () => {
    setRuntimeObject('Goblin 2', { activeConditions: ['poisoned'] }, CAMPAIGN, true);
    const { container } = renderItems([
      { id: 'barrel-1', name: 'Barrel', type: 'barrel', gridX: 1, gridY: 1, visible: true },
    ]);
    expect(container.querySelectorAll('g.token-status-chip')).toHaveLength(0);
  });
});
