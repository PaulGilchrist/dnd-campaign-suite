// Localhost-specific rendering tests.
//
// Structural + event handler + fog + visibility tests are covered in:
//   - PlacedItems.test.jsx (all structural, visibility, fog, rotation, event handler, mixed-type tests)
//   - PlacedItems-fog.test.jsx (extensive fog interaction tests)
//   - PlacedItems-event-handlers.test.jsx (event handler wiring with unique IDs)
//   - PlacedItems-localhost-rendering-2.test.jsx (negative assertions for rect-type items, remote hiding)
//
// This file focuses on localhost-specific NPC rendering details and group key uniqueness:
//   - NPC renders in npc-group (not placed-item group)
//   - NPC circle has correct class and attributes
//   - NPC text elements have correct classes
//   - NPC defs/clipPath rendering
//   - NPC image rendering with correct attributes
//   - NPC reposition highlight uses circle (not rect)
//   - Multiple same-type items render in separate groups
//   - Mixed types render in correct group types

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PlacedItems, { baseProps } from './PlacedItems.test-utils';

function makeItem(overrides) {
  return {
    id: 'item-1',
    type: 'barrel',
    gridX: 0,
    gridY: 0,
    visible: true,
    ...overrides,
  };
}

function renderOnLocalhost(placedItems, itemDragging = null, fog = new Map()) {
  return render(
    <PlacedItems
      {...baseProps}
      placedItems={placedItems}
      isLocalhost={true}
      itemDragging={itemDragging}
      fog={fog}
    />,
  );
}

describe('PlacedItems - NPC localhost rendering details', () => {
  it('renders NPC in npc-group with correct class', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin' });
    const { container } = renderOnLocalhost([npcItem]);
    expect(container.querySelector('g.npc-group')).toBeInTheDocument();
  });

  it('renders NPC circle with npc-circle class and correct attributes', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin' });
    const { container } = renderOnLocalhost([npcItem]);
    const circle = container.querySelector('circle.npc-circle');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveAttribute('cx');
    expect(circle).toHaveAttribute('cy');
    expect(circle).toHaveAttribute('r', '20');
  });

  it('renders NPC initial text with npc-initial class', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin' });
    renderOnLocalhost([npcItem]);
    expect(screen.getByText('G')).toHaveClass('npc-initial');
  });

  it('renders NPC name text with npc-name class', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin' });
    const { container } = renderOnLocalhost([npcItem]);
    const nameText = container.querySelector('text.npc-name');
    expect(nameText).toBeInTheDocument();
    expect(nameText).toHaveTextContent('Goblin');
  });

  it('renders NPC clipPath def with correct id pattern', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin', id: 'npc-42' });
    const { container } = renderOnLocalhost([npcItem]);
    const clipPath = container.querySelector('clipPath');
    expect(clipPath).toBeInTheDocument();
    expect(clipPath.getAttribute('id')).toMatch(/^npc-clip-npc-42$/);
  });

  it('renders NPC image with clipPath reference when imageUrl provided', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin', id: 'npc-1', imageUrl: '/goblin.png' });
    const { container } = renderOnLocalhost([npcItem]);
    const image = container.querySelector('image.creature-image');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('clip-path', 'url(#npc-clip-npc-1)');
    expect(image).toHaveAttribute('xlink:href', '/goblin.png');
  });

  it('renders NPC image with correct dimensions', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin', id: 'npc-1', imageUrl: '/goblin.png' });
    const { container } = renderOnLocalhost([npcItem]);
    const image = container.querySelector('image.creature-image');
    expect(image).toHaveAttribute('width', '36');
    expect(image).toHaveAttribute('height', '36');
  });

  it('renders NPC reposition highlight as circle (not rect)', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin' });
    const { container } = renderOnLocalhost([npcItem], { itemId: 'item-1' });
    const circleHighlight = container.querySelector('circle.reposition-highlight');
    expect(circleHighlight).toBeInTheDocument();
    expect(container.querySelector('rect.reposition-highlight')).toBeNull();
  });

  it('renders NPC reposition highlight with correct radius', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin' });
    const { container } = renderOnLocalhost([npcItem], { itemId: 'item-1' });
    const highlight = container.querySelector('circle.reposition-highlight');
    expect(highlight).toHaveAttribute('r', '24');
  });
});

describe('PlacedItems - localhost group key uniqueness', () => {
  it('renders each item in its own placed-item group', () => {
    const items = [
      makeItem({ id: 'barrel-1', type: 'barrel' }),
      makeItem({ id: 'barrel-2', type: 'barrel', gridX: 1 }),
      makeItem({ id: 'barrel-3', type: 'barrel', gridX: 2 }),
    ];
    const { container } = renderOnLocalhost(items);
    const groups = container.querySelectorAll('g.placed-item');
    expect(groups).toHaveLength(3);
  });

  it('renders mixed types in separate groups', () => {
    const items = [
      makeItem({ id: 'barrel-1', type: 'barrel' }),
      makeItem({ id: 'chest-1', type: 'chest', gridX: 1 }),
      makeItem({ id: 'npc-1', type: 'npc', name: 'Goblin', gridX: 2 }),
    ];
    const { container } = renderOnLocalhost(items);
    expect(container.querySelectorAll('g.placed-item')).toHaveLength(2);
    expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
  });
});
