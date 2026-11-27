// @maintained-by-ai 2026-11-26
// PlacedItems structural contracts: the full non-NPC per-type census (sprite
// href, hit-area shape, drag-highlight shape), rotation dispatch across every
// type, door open/closed shapes, grid anchoring, empty input. Owned elsewhere:
// fog visibility (PlacedItems-fog.test.jsx), shared `placed-hit-area` class +
// contextmenu dispatch (PlacedItems.hit-area-classes.test.jsx), remote hiding
// and NPC rendering details (PlacedItems-localhost-rendering {,-2}.test.jsx),
// callback wiring (PlacedItems-event-handlers.test.jsx), token stacking
// (PlacedItems.token-stacking.test.jsx).

import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

const makeItem = (overrides) => ({
  id: 'item-1',
  type: 'barrel',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

const renderItems = (items, extra = {}) =>
  render(<PlacedItems {...baseProps} placedItems={items} {...extra} />);

// Full non-NPC type census (NPCs owned by -localhost-rendering). Each row
// pins BOTH GM shapes: the persistent hit area and the drag highlight.
// Exceptions: the barrel's hit area and highlight are both circles; the
// firepit is the one mismatched pair — rect hit area, circle highlight.
const DRAG_SHAPES = [
  ['barrel', 'circle', 'circle'],
  ['firepit', 'rect', 'circle'],
  ...['altar', 'arrowSlitWall', 'bed', 'bookshelf', 'boulder', 'bush',
    'chair', 'chest', 'crate', 'door', 'fountain', 'pillar', 'secretDoor',
    'skeleton', 'stairs', 'statue', 'table', 'torch', 'trap', 'tree',
    'web'].map((type) => [type, 'rect', 'rect']),
];

describe('PlacedItems - rendering', () => {
  it('renders nothing for an empty item list', () => {
    const { container } = renderItems([]);
    expect(container.querySelector('g.placed-item, g.npc-group')).toBeNull();
  });

  it.each(DRAG_SHAPES)(
    'renders %s icon with a %s GM hit area, highlighted as %s while dragging',
    (type, hitShape, hlShape) => {
      const { container, rerender } = renderItems([makeItem({ type })]);
      expect(container.querySelector(`g.placed-item image[href="/images/items/${type}.png"]`)).toBeInTheDocument();
      const otherHit = hitShape === 'circle' ? 'rect' : 'circle';
      expect(container.querySelector(`${hitShape}.item-hit-area`)).toBeInTheDocument();
      expect(container.querySelector(`${otherHit}.item-hit-area`)).toBeNull();
      expect(container.querySelector('.reposition-highlight')).toBeNull();

      rerender(
        <PlacedItems {...baseProps} placedItems={[makeItem({ type })]} itemDragging={{ itemId: 'item-1' }} />,
      );
      const otherHl = hlShape === 'circle' ? 'rect' : 'circle';
      expect(container.querySelector(`${hlShape}.reposition-highlight`)).toBeInTheDocument();
      expect(container.querySelector(`${otherHl}.reposition-highlight`)).toBeNull();
    },
  );

  it('highlights only the dragged item', () => {
    const items = [
      makeItem({ id: 'item-1', type: 'barrel' }),
      makeItem({ id: 'item-2', type: 'barrel', gridX: 1 }),
    ];
    const { container } = renderItems(items, { itemDragging: { itemId: 'item-2' } });
    expect(container.querySelectorAll('.reposition-highlight')).toHaveLength(1);
    // The one highlight must sit on item-2's group (unnamed props title as
    // `type (x,y)`), not on the untouched neighbour.
    expect(container.querySelector('g[title="barrel (1,0)"] .reposition-highlight')).toBeInTheDocument();
  });
});

describe('PlacedItems - grid placement', () => {
  // Mock grid centers are x*50+25 / y*50+25; icons are 36px (x=cx-18).
  // Wide items (bed) shift along their long axis via CELL_SIZE and swap the
  // anchor box at 90°.
  it.each([
    ['cell-sized barrel at 2,3', { type: 'barrel', gridX: 2, gridY: 3 }, '107', '157'],
    ['horizontal bed', { type: 'bed' }, '9', '7'],
    ['vertical bed', { type: 'bed', rotation: 90 }, '-11', '27'],
  ])('anchors the %s icon', (_label, item, x, y) => {
    const { container } = renderItems([makeItem(item)]);
    const el = container.querySelector(`image[href="/images/items/${item.type}.png"]`);
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('x', x);
    expect(el).toHaveAttribute('y', y);
  });
});

describe('PlacedItems - door open/closed state', () => {
  it('renders a closed door as the door icon without pane rects', () => {
    const { container } = renderItems([makeItem({ type: 'door' })]);
    expect(container.querySelector('image[href="/images/items/door.png"]')).toBeInTheDocument();
    expect(container.querySelectorAll('rect[fill="#8B5A2B"]')).toHaveLength(0);
  });

  it.each([
    ['horizontal panes', {}, '36', '5'],
    ['vertical panes', { rotation: 90 }, '5', '36'],
  ])('replaces the icon with %s when open', (_label, extra, w, h) => {
    const { container } = renderItems([makeItem({ type: 'door', open: true, ...extra })]);
    expect(container.querySelector('image[href="/images/items/door.png"]')).toBeNull();
    const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
    expect(rects).toHaveLength(2);
    expect(rects[0]).toHaveAttribute('width', w);
    expect(rects[0]).toHaveAttribute('height', h);
  });
});

describe('PlacedItems - rotation', () => {
  // Sprite lane: every rotatable type transforms at ANY non-zero angle (the
  // art spins about the footprint centre). Wide types swap their anchor box
  // only at 90/270. The full non-rotatable set is derived from the census so
  // no type can silently change classes here.
  const ROTATABLE = ['arrowSlitWall', 'bed', 'bookshelf', 'chair', 'door',
    'secretDoor', 'skeleton', 'stairs', 'torch', 'altar', 'table'];
  const NEVER = DRAG_SHAPES.map(([type]) => type).filter(t => !ROTATABLE.includes(t));

  it.each([
    ...ROTATABLE.map((type) => [type, 45, true]),
    ...ROTATABLE.map((type) => [type, undefined, false]),
    ...ROTATABLE.filter(t => ['altar', 'table'].includes(t)).map((type) => [type, 180, true]),
    ...NEVER.map((type) => [type, 90, false]),
  ])('%s with rotation=%s expects a transform: %s', (type, rotation, hasTransform) => {
    const { container } = renderItems([makeItem({ type, rotation })]);
    const artEl = container.querySelector(`image[href="/images/items/${type}.png"]`);
    expect(artEl).toBeInTheDocument();
    expect(artEl.hasAttribute('transform')).toBe(hasTransform);
    if (hasTransform) {
      expect(artEl.getAttribute('transform')).toMatch(new RegExp(`rotate\\(${rotation},`));
    }
  });
});
