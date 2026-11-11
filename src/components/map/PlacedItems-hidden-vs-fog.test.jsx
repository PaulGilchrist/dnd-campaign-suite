// @maintained-by-ai: 2026-11-11
// ─── Lane: GM hidden-vs-fog tier differentiation ─────────────────────────────
// Backlog 2026-11-11 (IE): on the 2D GM board a visible:false item (dimmed to
// HIDDEN_MARKER_OPACITY) read identically to a fogged-but-visible item (full-
// opacity art under the translucent .fog-cell veil) — "I hid this" was
// indistinguishable from "nobody has seen this". The hidden tier now also
// carries a dashed amber ring (.hidden-item-ring, Map.css). Pinned here:
//   • the two tiers are DOM-distinct (ring presence + opacity attribute),
//   • the ring rides every GM-hidden marker (props, doors, creature tokens),
//   • visitor gating UNCHANGED: hidden AND fogged items stay fully absent to
//     LAN clients — the ring is GM-only chrome that never leaks.
// Fog hiding itself stays owned by PlacedItems-fog.test.jsx; the shared dim
// value by mapConfig + the 3D/hex lanes' own tests.

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';
import { HIDDEN_MARKER_OPACITY } from '../../config/mapConfig';

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

// Side-by-side rig on the GM board: hidden barrel in clear LOS, fogged-but-
// visible chest under fog, plus a clear in-LOS visible crate as control.
const TIERS = [
  makeItem('barrel', { visible: false }),
  makeItem('chest', { gridX: 1, gridY: 1 }),
  makeItem('crate', { gridX: 2, gridY: 2 }),
];
const FOG = new Map([['1,1', true]]);

const renderTiers = (isLocalhost = true) =>
  render(<PlacedItems {...baseProps} placedItems={TIERS} fog={FOG} isLocalhost={isLocalhost} />);

const RING = '.hidden-item-ring';

describe('PlacedItems - GM hidden vs fogged tiers are distinct', () => {
  it('hidden prop: shared dim + dashed ring; fogged-visible prop: full opacity, no ring', () => {
    const { container } = renderTiers();
    const hidden = container.querySelector('image[href="/images/items/barrel.png"]');
    const fogged = container.querySelector('image[href="/images/items/chest.png"]');
    const clear = container.querySelector('image[href="/images/items/crate.png"]');

    expect(hidden.getAttribute('opacity')).toBe(String(HIDDEN_MARKER_OPACITY));
    expect(fogged.getAttribute('opacity')).toBe('1');
    expect(clear.getAttribute('opacity')).toBe('1');

    // ONE ring for the whole board — the hidden barrel's group only.
    const rings = container.querySelectorAll(RING);
    expect(rings).toHaveLength(1);
    expect(rings[0].closest('.placed-item')?.getAttribute('title')).toBe('barrel (0,0)');
    // Ring is sibling chrome, never dimmed with the art.
    expect(rings[0].hasAttribute('opacity')).toBe(false);
  });

  it('the ring rides creature tokens and doors too (one law for every GM-hidden marker)', () => {
    const { container } = render(
      <PlacedItems
        {...baseProps}
        placedItems={[
          makeItem('npc', { name: 'Goblin', visible: false }),
          makeItem('door', { visible: false, gridX: 1, gridY: 1 }),
        ]}
        fog={new Map()}
      />,
    );
    expect(container.querySelector('g.npc-group .hidden-item-ring')).toBeInTheDocument();
    expect(container.querySelector('circle.npc-circle')).toHaveStyle({ opacity: HIDDEN_MARKER_OPACITY });
    // Two hidden markers -> exactly two rings, none on visible rows.
    expect(container.querySelectorAll(RING)).toHaveLength(2);
  });

  it('visible items never get the ring — fog alone is not "hidden"', () => {
    const { container } = render(
      <PlacedItems {...baseProps} placedItems={[TIERS[1], TIERS[2]]} fog={FOG} />,
    );
    expect(container.querySelectorAll(RING)).toHaveLength(0);
  });

  it('visitor gating unchanged: hidden and fogged items stay fully absent, no ring leaks', () => {
    const { container } = renderTiers(false);
    // hidden (in and out of fog) and fogged-visible all stripped for LAN
    expect(container.querySelector('image[href="/images/items/barrel.png"]')).toBeNull();
    expect(container.querySelector('image[href="/images/items/chest.png"]')).toBeNull();
    expect(container.querySelector('image[href="/images/items/crate.png"]')).toBeInTheDocument();
    // the GM ring chrome never exists on a visitor board
    expect(container.querySelectorAll(RING)).toHaveLength(0);
  });

  it('a hidden item deep under fog stays absent for visitors but keeps its ring for the GM', () => {
    const items = [makeItem('barrel', { gridX: 1, gridY: 1, visible: false })];
    const lan = render(<PlacedItems {...baseProps} placedItems={items} fog={FOG} isLocalhost={false} />);
    expect(lan.container.querySelectorAll('.placed-item')).toHaveLength(0);
    const gm = render(<PlacedItems {...baseProps} placedItems={items} fog={FOG} />);
    expect(gm.container.querySelector('image[href="/images/items/barrel.png"]')).toBeInTheDocument();
    expect(gm.container.querySelector(RING)).toBeInTheDocument();
  });
});
