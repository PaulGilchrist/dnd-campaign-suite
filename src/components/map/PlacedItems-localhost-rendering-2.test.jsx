// @maintained-by-ai 2026-11-26
// Lane: remote (visitor) hiding of GM-only chrome on the prop/door renderers.
// Since the data-driven renderProp refactor, every prop type shares ONE
// `isLocalhost && dragChrome` guard (door has its own copy in renderDoor), so
// per-type repetition proves nothing new. This file exercises each distinct
// chrome branch — circle hit (barrel), rect-hit/circle-highlight (firepit),
// wide rotated box (bed), plain rect (chest), and the separate door renderer —
// mid-drag, and pins that a visitor board paints their art with zero GM
// affordances, while the identical GM render arms one hit area per item and
// exactly one highlight (non-vacuous control).
// Owned elsewhere (PlacedItems family — not repeated here):
//   - PlacedItems.test.jsx — per-type GM positive census (icon href, hit area,
//     DRAG_SHAPES highlight geometry), door panes, rotation, grid anchors
//   - PlacedItems-localhost-rendering.test.jsx — NPC-token localhost gating
//     pair + avatar source precedence
//   - PlacedItems-fog.test.jsx — fog culling; PlacedItems-hidden-vs-fog.test.jsx
//     — GM hidden tier (ring/dim) + visitor hidden-absence
//   - PlacedItems-event-handlers.test.jsx — hit-area callback payloads
// Unique here: the secretDoor rule in isVisible (never an icon off localhost,
// whatever `visible` says) and the visitor chrome absence above.
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

const makeItem = (id, type, overrides) => ({
  id,
  type,
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

// One item per chrome branch; the door is always the one being dragged so the
// remote "no highlight" leg is meaningful and the GM control pins the count.
const CHROME_BRANCHES = [
  makeItem('barrel-1', 'barrel'),
  makeItem('firepit-1', 'firepit'),
  makeItem('bed-1', 'bed', { gridX: 1, rotation: 90 }),
  makeItem('chest-1', 'chest', { gridX: 2 }),
  makeItem('door-1', 'door', { gridX: 3 }),
];
const ART_HREFS = ['barrel', 'firepit', 'bed', 'chest', 'door']
  .map((type) => `/images/items/${type}.png`);

const renderBoard = (isLocalhost) =>
  render(
    <PlacedItems
      {...baseProps}
      placedItems={CHROME_BRANCHES}
      isLocalhost={isLocalhost}
      itemDragging={{ itemId: 'door-1' }}
    />,
  );

describe('PlacedItems - GM-only chrome hidden from remote clients', () => {
  it('visitor board renders every prop/door icon with no hit areas or drag highlight', () => {
    const { container } = renderBoard(false);
    for (const href of ART_HREFS) {
      expect(container.querySelector(`image[href="${href}"]`)).toBeInTheDocument();
    }
    // renderProp + renderDoor share the .item-hit-area/.placed-hit-area pair.
    expect(container.querySelector('.item-hit-area')).toBeNull();
    expect(container.querySelector('.placed-hit-area')).toBeNull();
    expect(container.querySelector('.reposition-highlight')).toBeNull();
  });

  it('the same GM board arms one hit area per item and highlights only the dragged door', () => {
    // Control for the assertion above: the chrome machinery is live, so the
    // visitor absence is the gate, not a broken render.
    const { container } = renderBoard(true);
    expect(container.querySelectorAll('.item-hit-area')).toHaveLength(CHROME_BRANCHES.length);
    const highlights = container.querySelectorAll('.reposition-highlight');
    expect(highlights).toHaveLength(1);
    expect(highlights[0].closest('g[title^="door"]')).toBeInTheDocument();
  });

  it('secretDoor icon is GM-only at any visibility, while a normal door stays open to visitors', () => {
    // isVisible special-cases secretDoor BEFORE the shared visible/fog rule:
    // even a discovered (visible:true) secret door never paints for players.
    const items = [
      makeItem('sd-open', 'secretDoor'),
      makeItem('sd-hidden', 'secretDoor', { gridX: 1, visible: false }),
      makeItem('door-1', 'door', { gridX: 2 }),
    ];
    const gm = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost />);
    expect(gm.container.querySelectorAll('image[href="/images/items/secretDoor.png"]')).toHaveLength(2);
    const visitor = render(<PlacedItems {...baseProps} placedItems={items} isLocalhost={false} />);
    expect(visitor.container.querySelector('image[href="/images/items/secretDoor.png"]')).toBeNull();
    // The door in the same render proves visitors are not being blanked wholesale.
    expect(visitor.container.querySelector('image[href="/images/items/door.png"]')).toBeInTheDocument();
  });
});
