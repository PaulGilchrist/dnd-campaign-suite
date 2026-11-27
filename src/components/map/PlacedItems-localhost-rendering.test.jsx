// @maintained-by-ai 2026-11-26
// PlacedItems NPC-token lane: the isLocalhost true/false pair for NPCs — token
// bytes survive identically for network clients, while GM-only affordances
// (transparent grab hit rect, drag highlight) render on localhost only, per the
// app's localhost-only GM features rule. Also pins the avatar source the NPC
// renderer consumes: per-token item.imagePath (campaign-prefixed, plan D) >
// npcImages cache > emoji > initial letter, and a mixed NPC/prop board proving
// each item keeps its own anchored group (the cache map itself is built in
// hooks/useNpcImageCache.test.js, #909).
//
//   Element                localhost            network
//   g.npc-group circle+name exact bytes         same bytes (survivors)
//   grab hit rect 40×40    exact bytes+cursor   absent
//   drag highlight         circle r=24, once    absent even mid-drag
//
// Owned elsewhere (PlacedItems family — not repeated here):
//   - PlacedItems.test.jsx — per-type prop dispatch, positive DRAG_SHAPES
//     census (GM hit area + highlight geometry), door panes, rotation, grid
//     anchors (single-item renders), empty list
//   - PlacedItems-fog.test.jsx — fog hiding and invisible-item opacity pair
//   - PlacedItems-event-handlers.test.jsx (#929) — hit-area event wiring and
//     exact callback payloads (render-level gating above is distinct: it
//     asserts the affordance DOM is absent for network clients, not that
//     events transport bytes on localhost)
//   - PlacedItems-localhost-rendering-2.test.jsx — visitor-board chrome
//     absence + GM non-vacuity control for the shared prop/door renderers and
//     the secretDoor GM-only rule (npc excluded there — owned here)
//   - PlacedItems.tokens.test.jsx — monster-row marker leg (☠ glyph, ring)
//   - drop payload consumption: #906 (drop-level npc gate); hook mutations #909

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

const npc = (overrides = {}) => ({
  id: 'npc-1',
  type: 'npc',
  name: 'Goblin',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

// isLocalhost is threaded explicitly as a prop — never read from real location.
// Mock grid centers map 0 → 25 (x*50+25).
const renderNpc = ({ isLocalhost, items = [npc()], ...extra }) =>
  render(
    <PlacedItems {...baseProps} placedItems={items} isLocalhost={isLocalhost} {...extra} />,
  );

describe('PlacedItems - NPC localhost gating', () => {
  it.each([true, false])('renders NPC token bytes for network and localhost alike (isLocalhost=%s), GM chrome on localhost only', (isLocalhost) => {
    // Drag state always set so the network "no highlight" leg is meaningful.
    const { container } = renderNpc({ isLocalhost, itemDragging: { itemId: 'npc-1' } });

    // Token survives both legs with exact bytes, in npc-group not placed-item.
    expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
    expect(container.querySelectorAll('g.placed-item')).toHaveLength(0);
    const circle = container.querySelector('circle.npc-circle');
    expect(circle).toHaveAttribute('cx', '25');
    expect(circle).toHaveAttribute('cy', '25');
    expect(circle).toHaveAttribute('r', '20');
    expect(container.querySelector('text.npc-name')).toHaveTextContent('Goblin');

    const hitRect = container.querySelector('g.npc-group rect');
    const highlight = container.querySelector('.reposition-highlight');
    if (isLocalhost) {
      expect(hitRect).toHaveAttribute('x', '5');
      expect(hitRect).toHaveAttribute('y', '5');
      expect(hitRect).toHaveAttribute('width', '40');
      expect(hitRect).toHaveAttribute('height', '40');
      expect(hitRect.getAttribute('style')).toContain('grab');
      expect(highlight).toBe(container.querySelector('circle.reposition-highlight'));
      expect(highlight).toHaveAttribute('r', '24');
      expect(container.querySelector('rect.reposition-highlight')).toBeNull();
    } else {
      // Network clients get no GM affordances, even mid-drag.
      expect(hitRect).toBeNull();
      expect(highlight).toBeNull();
    }
  });

  // Precedence chain from the source: imagePath > npcImages cache > emoji >
  // initial. imagePath-with-populated-cache dominates the imagePath-with-empty-
  // cache leg (same ternary branch), so only the distinguishing rows run.
  it.each([
    ['item.imagePath beats the npcImages cache', { npcImages: { Goblin: '/cached.png' }, item: npc({ imagePath: 'images/gob.png' }) }, 'campaigns/test-campaign/images/gob.png', null],
    ['npcImages cache used when the row carries no art', { npcImages: { Goblin: '/cached.png' }, item: npc() }, '/cached.png', null],
    ['initial letter when no image at all', { npcImages: {}, item: npc() }, null, 'G'],
    ['emoji rides the initial slot (plan D)', { npcImages: {}, item: npc({ emoji: '🧙' }) }, null, '🧙'],
  ])('avatar source: %s', (_label, { npcImages, item }, expectedHref, expectedMark) => {
    const { container } = renderNpc({ isLocalhost: true, items: [item], npcImages, campaignName: 'test-campaign' });
    const image = container.querySelector('image.creature-image');
    const mark = container.querySelector('text.npc-initial');
    if (expectedHref) {
      expect(image).toHaveAttribute('xlink:href', expectedHref);
      expect(image).toHaveAttribute('width', '36');
      expect(image).toHaveAttribute('height', '36');
      expect(image).toHaveAttribute('clip-path', 'url(#npc-clip-npc-1)');
      expect(container.querySelector('clipPath#npc-clip-npc-1 circle')).toHaveAttribute('r', '20');
      expect(mark).toBeNull();
    } else {
      expect(image).toBeNull();
      expect(mark).toHaveTextContent(expectedMark);
    }
  });

  it('census: same-type items keep separate positioned groups; NPCs never join placed-item groups', () => {
    const { container } = renderNpc({
      isLocalhost: true,
      items: [
        { id: 'barrel-1', type: 'barrel', gridX: 0, gridY: 0, visible: true },
        { id: 'barrel-2', type: 'barrel', gridX: 1, gridY: 0, visible: true },
        npc({ gridX: 2 }),
      ],
    });
    // Each barrel anchors from its OWN gridX (7 = 25−18, 57 = 75−18) — the
    // single-item grid-anchor tests in PlacedItems.test.jsx cannot prove this.
    const barrels = container.querySelectorAll('g.placed-item');
    expect(barrels).toHaveLength(2);
    expect(barrels[0].querySelector('image')).toHaveAttribute('href', '/images/items/barrel.png');
    expect(barrels[0].querySelector('image')).toHaveAttribute('x', '7');
    expect(barrels[1].querySelector('image')).toHaveAttribute('href', '/images/items/barrel.png');
    expect(barrels[1].querySelector('image')).toHaveAttribute('x', '57');
    // Mixed board: the NPC lane stays partitioned from the prop groups.
    expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
    expect(container.querySelector('g.npc-group image[href*="barrel"]')).toBeNull();
  });
});
