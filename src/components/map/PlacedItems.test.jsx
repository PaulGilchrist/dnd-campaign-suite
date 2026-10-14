// @maintained-by-ai: 2026-10-14
// PlacedItems structural contracts: type dispatch with GM hit areas and drag
// highlights, door open/closed shapes, rotation transforms, grid placement,
// empty input. Owned elsewhere: fog visibility (PlacedItems-fog.test.jsx),
// remote hiding and NPC rendering details (PlacedItems-localhost-rendering
// {,-2}.test.jsx), callback wiring (PlacedItems-event-handlers.test.jsx).

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

// All non-NPC types (NPCs owned by -localhost-rendering). The firepit hit
// area is a rect but its drag highlight is a circle.
const DRAG_SHAPES = [
  ['barrel', 'circle'],
  ['firepit', 'circle'],
  ...['altar', 'arrowSlitWall', 'bed', 'bookshelf', 'boulder', 'bush',
    'chair', 'chest', 'crate', 'door', 'fountain', 'pillar', 'secretDoor',
    'skeleton', 'stairs', 'statue', 'table', 'torch', 'trap', 'tree',
    'web'].map((type) => [type, 'rect']),
];

describe('PlacedItems - rendering', () => {
  it('renders nothing for an empty item list', () => {
    const { container } = renderItems([]);
    expect(container.querySelector('g.placed-item, g.npc-group')).toBeNull();
  });

  it.each(DRAG_SHAPES)(
    'renders %s icon and GM hit area, highlighted as %s while dragging',
    (type, shape) => {
      const { container, rerender } = renderItems([makeItem({ type })]);
      expect(container.querySelector(`g.placed-item use[href="#${type}"]`)).toBeInTheDocument();
      expect(container.querySelector('.item-hit-area')).toBeInTheDocument();
      expect(container.querySelector('.reposition-highlight')).toBeNull();

      rerender(
        <PlacedItems {...baseProps} placedItems={[makeItem({ type })]} itemDragging={{ itemId: 'item-1' }} />,
      );
      expect(container.querySelector(`${shape}.reposition-highlight`)).toBeInTheDocument();
      expect(container.querySelector(`${shape === 'circle' ? 'rect' : 'circle'}.reposition-highlight`)).toBeNull();
    },
  );

  it('highlights only the dragged item', () => {
    const items = [
      makeItem({ id: 'item-1', type: 'barrel' }),
      makeItem({ id: 'item-2', type: 'barrel', gridX: 1 }),
    ];
    const { container } = renderItems(items, { itemDragging: { itemId: 'item-2' } });
    expect(container.querySelectorAll('.reposition-highlight')).toHaveLength(1);
  });
});

describe('PlacedItems - grid placement', () => {
  // Mock grid centers are x*50+25 / y*50+25; icons are 36px (x=cx-18).
  // Wide items (bed) shift along their long axis via CELL_SIZE.
  it.each([
    ['cell-sized barrel at 2,3', { type: 'barrel', gridX: 2, gridY: 3 }, '107', '157'],
    ['horizontal bed', { type: 'bed' }, '9', '7'],
    ['vertical bed', { type: 'bed', rotation: 90 }, '-11', '27'],
  ])('anchors the %s icon', (_label, item, x, y) => {
    const { container } = renderItems([makeItem(item)]);
    const useEl = container.querySelector(`use[href="#${item.type}"]`);
    expect(useEl).toBeInTheDocument();
    expect(useEl).toHaveAttribute('x', x);
    expect(useEl).toHaveAttribute('y', y);
  });
});

describe('PlacedItems - door open/closed state', () => {
  it('renders a closed door as the door icon without pane rects', () => {
    const { container } = renderItems([makeItem({ type: 'door' })]);
    expect(container.querySelector('use[href="#door"]')).toBeInTheDocument();
    expect(container.querySelectorAll('rect[fill="#8B5A2B"]')).toHaveLength(0);
  });

  it.each([
    ['horizontal panes', {}, '36', '5'],
    ['vertical panes', { rotation: 90 }, '5', '36'],
  ])('replaces the icon with %s when open', (_label, extra, w, h) => {
    const { container } = renderItems([makeItem({ type: 'door', open: true, ...extra })]);
    expect(container.querySelector('use[href="#door"]')).toBeNull();
    const rects = container.querySelectorAll('rect[fill="#8B5A2B"]');
    expect(rects).toHaveLength(2);
    expect(rects[0]).toHaveAttribute('width', w);
    expect(rects[0]).toHaveAttribute('height', h);
  });
});

describe('PlacedItems - rotation', () => {
  // Most rotatable icons honor any angle; the wide altar/table only swap
  // their anchor at 90, and cell-size props ignore rotation entirely.
  const ANY_ANGLE = ['arrowSlitWall', 'bed', 'bookshelf', 'chair', 'door',
    'secretDoor', 'stairs', 'torch'];
  const ONLY_90 = ['altar', 'table'];
  const NEVER = ['barrel', 'chest', 'firepit', 'trap'];

  it.each([
    ...ANY_ANGLE.map((type) => [type, 45, true]),
    ...ANY_ANGLE.map((type) => [type, undefined, false]),
    ...ONLY_90.map((type) => [type, 90, true]),
    ...ONLY_90.map((type) => [type, 180, false]),
    ...NEVER.map((type) => [type, 90, false]),
  ])('%s with rotation=%s expects a transform: %s', (type, rotation, hasTransform) => {
    const { container } = renderItems([makeItem({ type, rotation })]);
    const useEl = container.querySelector(`use[href="#${type}"]`);
    expect(useEl).toBeInTheDocument();
    expect(useEl.hasAttribute('transform')).toBe(hasTransform);
    if (hasTransform) {
      expect(useEl.getAttribute('transform')).toMatch(new RegExp(`rotate\\(${rotation},`));
    }
  });
});
