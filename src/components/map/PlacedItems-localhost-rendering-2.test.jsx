// @improved-by-ai
// @cleaned-by-ai
import { render } from '@testing-library/react';
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

function renderWithLocalhost(placedItems, isLocalhost = true, itemDragging = null, fog = new Map()) {
  return render(
    <PlacedItems
      {...baseProps}
      placedItems={placedItems}
      isLocalhost={isLocalhost}
      itemDragging={itemDragging}
      fog={fog}
    />,
  );
}

// ── Remote rendering: localhost-only elements must not appear for remote clients ──
// This is the only block with unique behavioral coverage not covered by other test files.
// PlacedItems-fog.test.jsx tests fog hiding; this tests isLocalhost flag stripping localhost-only elements.
describe('PlacedItems - rect-type items hide localhost elements on remote', () => {
  it.each(['altar', 'bookshelf', 'chair', 'door', 'pillar', 'stairs', 'trap', 'arrowSlitWall'])('hides hit area and highlight for %s on remote', (type) => {
    const { container } = renderWithLocalhost([makeItem({ type })], false);
    const group = container.querySelector(`g.placed-item`);
    expect(group?.querySelector('.item-hit-area')).toBeNull();
    expect(group?.querySelector('.reposition-highlight')).toBeNull();
  });

  it.each(['altar', 'bookshelf', 'chair', 'door', 'pillar', 'stairs', 'trap', 'arrowSlitWall'])('still renders the use element for %s on remote', (type) => {
    const { container } = renderWithLocalhost([makeItem({ type })], false);
    expect(container.querySelector(`use[href="#${type}"]`)).toBeInTheDocument();
  });
});

describe('PlacedItems - secret door is GM-only', () => {
  it.each([[false, 'hidden'], [true, 'discovered']])('does not render the secret-door icon for a player when %s', (visible) => {
    const { container } = renderWithLocalhost([makeItem({ type: 'secretDoor', visible })], false);
    expect(container.querySelector('use[href="#secretDoor"]')).not.toBeInTheDocument();
  });

  it.each([[false, 'hidden'], [true, 'discovered']])('renders the secret-door icon for the GM when %s', (visible) => {
    const { container } = renderWithLocalhost([makeItem({ type: 'secretDoor', visible })], true);
    expect(container.querySelector('use[href="#secretDoor"]')).toBeInTheDocument();
  });
});
