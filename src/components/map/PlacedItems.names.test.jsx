// @maintained-by-ai: 2026-11-01
// Naming-surface contract (backlog 2026-11-01 AW): every placed-item marker
// carries title={placedItemLabel(item)} so two same-type props are
// distinguishable by a mouseless DOM probe — no hover/click discovery.
// Parity with the click dock / delete confirm is pinned by asserting the
// same placedItemLabel source of truth. Owned elsewhere (PlacedItems family):
//   - PlacedItems.test.jsx — type dispatch, hit areas, drag shapes, rotation
//   - PlacedItems-fog.test.jsx — fog/visibility hiding
//   - PlacedItems-localhost-rendering{,-2}.test.jsx — NPC bytes, remote hiding
//   - PlacedItems-event-handlers.test.jsx — hit-area event wiring

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';
import { placedItemLabel } from './hooks/usePlacedItems.js';

const makeItem = (overrides) => ({
  id: 'item-1',
  type: 'barrel',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

const renderItems = (items) => render(<PlacedItems {...baseProps} placedItems={items} />);

describe('PlacedItems - marker name surface (title attrs)', () => {
  it('titles two same-type props with their distinct names (no hover needed)', () => {
    const { getByTitle } = renderItems([
      makeItem({ id: 'a', type: 'chest', gridX: 4, gridY: 4, name: 'Ration Chest' }),
      makeItem({ id: 'b', type: 'chest', gridX: 9, gridY: 2, name: 'Gold Chest' }),
    ]);
    expect(getByTitle('Ration Chest')).toHaveClass('placed-item');
    expect(getByTitle('Gold Chest')).toHaveClass('placed-item');
  });

  it('unnamed props title as type + cell (placedItemLabel fallback)', () => {
    const { getByTitle } = renderItems([makeItem({ type: 'barrel', gridX: 2, gridY: 3 })]);
    expect(getByTitle('barrel (2,3)')).toBeInTheDocument();
  });

  it('titles markers in BOTH lanes — indoor decor and outdoor grid props', () => {
    const { getByTitle } = renderItems([
      makeItem({ id: 'in', type: 'bed', name: 'Four-poster' }),
      makeItem({ id: 'out', type: 'tree', gridX: 5, gridY: 6, name: 'Old Oak' }),
    ]);
    expect(getByTitle('Four-poster')).toBeInTheDocument();
    expect(getByTitle('Old Oak')).toBeInTheDocument();
  });

  it('NPC markers carry the label too', () => {
    const { getByTitle } = renderItems([makeItem({ type: 'npc', name: 'Gollum' })]);
    expect(getByTitle('Gollum')).toHaveClass('npc-group');
  });

  it('every rendered marker title equals placedItemLabel (dock/confirm parity)', () => {
    const types = ['altar', 'barrel', 'bed', 'bookshelf', 'boulder', 'bush', 'chair',
      'chest', 'crate', 'door', 'firepit', 'fountain', 'pillar', 'secretDoor',
      'skeleton', 'stairs', 'statue', 'table', 'torch', 'trap', 'tree', 'web',
      'arrowSlitWall'];
    const items = types.map((type, i) => makeItem({ id: `i${i}`, type, gridX: i, gridY: i }));
    items.push(makeItem({ id: 'npc-1', type: 'npc', name: 'Marta', gridX: 1, gridY: 9 }));
    const { container } = renderItems(items);
    const markers = container.querySelectorAll('g.placed-item, g.npc-group');
    expect(markers).toHaveLength(items.length);
    const rendered = Array.from(markers, (m) => m.getAttribute('title')).sort();
    expect(rendered).toEqual(items.map(placedItemLabel).sort());
  });
});
