// @maintained-by-ai
// PlacedItems event-lane contract: DOM events on GM hit areas transport
// exact bytes to the callbacks received as props.
//
//   Hit area              Event         Callback (exact args, once)
//   circle.item-hit-area     pointerdown   handleItemPointerDown(e, item.id)   barrel-owned circle
//   g.npc-group rect[fill]   pointerdown   handleItemPointerDown(e, item.id)   NPC-owned rect
//   rect.item-hit-area       pointerdown   handleItemPointerDown(e, item.id)   shared rectHitArea (20+ types)
//   any of the above         contextmenu   setSelectedItem({ id, gridX, gridY }) + preventDefault
//
// Payload shape is pinned by deep equality: items carry extra fields
// (type, visible, name) that must NOT leak into the selection payload.
//
// Owned elsewhere (PlacedItems family):
//   - PlacedItems.test.jsx — structure, drag highlights, door panes, rotation
//   - PlacedItems-fog.test.jsx — fog/visibility hiding
//   - PlacedItems-localhost-rendering{,-2}.test.jsx — NPC decor bytes, remote hiding
//   - hooks/usePlacedItems.test.js (#909) — hook-internal mutation state and
//     setSelectedItem(null) semantics (the forwarded-overlap rec is adjudicated
//     here: no overlap — that lane never dispatches DOM events; this lane
//     never drives hook internals).

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlacedItems, { baseProps, mockHandleItemPointerDown } from './PlacedItems.test-utils';

const makeItem = (overrides) => ({
  id: 'item-1',
  type: 'barrel',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

const renderItems = (items) =>
  render(<PlacedItems {...baseProps} placedItems={items} />);

// Each case exercises a distinct hit-area construction site in the source.
const HIT_AREAS = [
  ['barrel circle', 'barrel', { id: 'barrel-42' }, 'circle.item-hit-area'],
  ['NPC rect', 'npc', { id: 'npc-7', name: 'Goblin' }, 'g.npc-group rect[fill="transparent"]'],
  ['shared rect', 'chest', { id: 'chest-3', gridX: 1 }, 'rect.item-hit-area'],
];

describe('PlacedItems - event handler wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(HIT_AREAS)(
    'pointerdown on the %s reports the item id to handleItemPointerDown',
    (_label, type, overrides, selector) => {
      const { container } = renderItems([makeItem({ type, ...overrides })]);
      container.querySelector(selector).dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true }),
      );
      expect(mockHandleItemPointerDown).toHaveBeenCalledTimes(1);
      expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.anything(), overrides.id);
    },
  );

  it.each(HIT_AREAS)(
    'contextmenu on the %s selects exactly {id, gridX, gridY} and suppresses the native menu',
    (_label, type, overrides, selector) => {
      const item = makeItem({ type, gridX: 3, gridY: 5, ...overrides });
      const { container } = renderItems([item]);
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      container.querySelector(selector).dispatchEvent(event);
      expect(baseProps.setSelectedItem).toHaveBeenCalledTimes(1);
      expect(baseProps.setSelectedItem).toHaveBeenCalledWith({
        id: item.id,
        gridX: item.gridX,
        gridY: item.gridY,
      });
      expect(event.defaultPrevented).toBe(true);
    },
  );
});
