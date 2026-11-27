// @maintained-by-ai 2026-11-26
// ─── Lane: fog culling on the visitor board ──────────────────────────────────
// This file OWNS fog hiding for PlacedItems (per PlacedItems-hidden-vs-fog's
// lane note): absent/empty fog must not hide, fogged cells must cull every
// item kind, and clear cells must survive. The GM hidden-marker tier (dim +
// ring, and visitors never seeing visible:false items) is owned by
// PlacedItems-hidden-vs-fog.test.jsx — not re-pinned here.

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

function makeItem(type, overrides = {}) {
  return {
    id: `${type}-1`,
    type,
    gridX: 0,
    gridY: 0,
    visible: true,
    ...overrides,
  };
}

const placedItemsEl = (items, fog, isLocalhost = false) => (
  <PlacedItems {...baseProps} placedItems={items} fog={fog} isLocalhost={isLocalhost} />
);

describe('PlacedItems - Fog of war hiding', () => {
  it.each([
    { name: 'undefined', fog: undefined },
    { name: 'null', fog: null },
    { name: 'empty Map', fog: new Map() },
  ])('shows items to remote clients when fog is $name', ({ fog }) => {
    const { container } = render(placedItemsEl([makeItem('barrel')], fog));
    expect(container.querySelector('image[href="/images/items/barrel.png"]')).toBeInTheDocument();
  });

  it('hides every item kind on fogged cells and shows them on clear cells', () => {
    const items = [
      makeItem('barrel', { gridX: 0, gridY: 0 }),
      makeItem('chest', { gridX: 1, gridY: 1 }),
      makeItem('npc', { name: 'Goblin', gridX: 2, gridY: 2 }),
      // Open door rides the same cull as prop art; assert it EXISTS first so
      // the fully-fogged wipe below cannot pass vacuously.
      makeItem('door', { open: true, gridX: 3, gridY: 3 }),
    ];
    const { container, rerender } = render(placedItemsEl(items, new Map([['0,0', true]])));
    expect(container.querySelector('image[href="/images/items/barrel.png"]')).toBeNull();
    expect(container.querySelector('image[href="/images/items/chest.png"]')).toBeInTheDocument();
    expect(container.querySelector('circle.npc-circle')).toBeInTheDocument();
    expect(container.querySelector('g.placed-item[title="door (3,3)"]')).toBeInTheDocument();

    // Fog covering every cell hides everything, including the open-door group.
    rerender(placedItemsEl(items, new Map(['0,0', '1,1', '2,2', '3,3'].map(k => [k, true]))));
    expect(container.querySelectorAll('.placed-item, .npc-group')).toHaveLength(0);
  });
});
