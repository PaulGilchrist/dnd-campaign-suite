//@maintained-by-ai
// PlacedItems localhost-gating render lane: the isLocalhost true/false pair for
// NPCs — token bytes survive identically for network clients, while GM-only
// affordances (transparent grab hit rect, drag highlight) render on localhost
// only, per the app's localhost-only GM features rule. Also pins the avatar
// source consumed here: npcImages cache > item.imageUrl > initial letter
// (the cache map itself is built in hooks/useNpcImageCache.test.js, #909).
//
//   Element                localhost            network
//   g.npc-group circle+name exact bytes         same bytes (survivors)
//   grab hit rect 40×40    exact bytes+cursor  absent
//   drag highlight         circle r=24, once    absent even mid-drag
//
// Owned elsewhere (PlacedItems family — not repeated here):
//   - PlacedItems.test.jsx — decor type dispatch, GM hit area + drag-shape
//     census (DRAG_SHAPES), door panes, rotation, grid anchors, empty list
//   - PlacedItems-fog.test.jsx — fog hiding and invisible-item opacity pair
//   - PlacedItems-event-handlers.test.jsx (#929) — hit-area event wiring and
//     exact callback payloads (render-level gating above is distinct: it
//     asserts the affordance DOM is absent for network clients, not that
//     events transport bytes on localhost)
//   - PlacedItems-localhost-rendering-2.test.jsx — remote hiding + GM-only
//     secretDoor for the 22 <use>-decor types (npc excluded there — owned here)
//   - drop payload consumption: #906 (drop-level npc gate); hook mutations #909
//
// Old (11 tests) → new (3 blocks / 6 cases):
//   npc-group class, circle cx/cy/r, name text, highlight circle-not-rect,
//   highlight r=24                                   → T1 (localhost/network pair)
//   npc-initial text, clipPath id, image clip-ref, image dims
//                                                  → T2 (+ new: cache priority,
//                                                    mutual-exclusion of image/initial)
//   own-group census, mixed-types census         → T3 (one mixed render)

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

  it.each([
    ['npcImages cache beats item.imageUrl', { npcImages: { Goblin: '/cached.png' }, item: npc({ imageUrl: '/inline.png' }) }, '/cached.png'],
    ['item.imageUrl used when cache has no entry', { npcImages: {}, item: npc({ imageUrl: '/inline.png' }) }, '/inline.png'],
    ['initial letter when no image at all', { npcImages: {}, item: npc() }, null],
  ])('avatar source: %s', (_label, { npcImages, item }, expectedHref) => {
    const { container } = renderNpc({ isLocalhost: true, items: [item], npcImages });
    const image = container.querySelector('image.creature-image');
    if (expectedHref) {
      expect(image).toHaveAttribute('xlink:href', expectedHref);
      expect(image).toHaveAttribute('width', '36');
      expect(image).toHaveAttribute('height', '36');
      expect(image).toHaveAttribute('clip-path', 'url(#npc-clip-npc-1)');
      expect(container.querySelector('clipPath#npc-clip-npc-1 circle')).toHaveAttribute('r', '20');
      expect(container.querySelector('text.npc-initial')).toBeNull();
    } else {
      expect(image).toBeNull();
      expect(container.querySelector('text.npc-initial')).toHaveTextContent('G');
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
    const barrels = container.querySelectorAll('g.placed-item');
    expect(barrels).toHaveLength(2);
    expect(barrels[0].querySelector('use')).toHaveAttribute('href', '#barrel');
    expect(barrels[0].querySelector('use')).toHaveAttribute('x', '7');
    expect(barrels[1].querySelector('use')).toHaveAttribute('href', '#barrel');
    expect(barrels[1].querySelector('use')).toHaveAttribute('x', '57');
    expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
  });
});
