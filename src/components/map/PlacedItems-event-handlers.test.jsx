// Event handler behavioral tests.
//
// These tests verify behavior through the mock functions that the component
// receives as props (handleItemPointerDown, setSelectedItem), confirming the
// component wires up the correct callbacks with the right arguments.
//
// Negative assertions (remote client hiding, fog hiding, NPC rendering details,
// cursor styles, reposition highlight shapes, rect-type negative assertions)
// are covered in:
//   - PlacedItems.test.jsx (structural + fog + rotation + edge cases)
//   - PlacedItems-fog.test.jsx (extensive fog interaction tests)
//   - PlacedItems-localhost-rendering.test.jsx (cursor styles, NPC details,
//     reposition highlights, barrel/table/firepit specifics, group key uniqueness)
//   - PlacedItems-localhost-rendering-2.test.jsx (rect-type negative assertions,
//     remote hiding, invisible items, mixed groups)

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PlacedItems, { baseProps, mockHandleItemPointerDown } from './PlacedItems.test-utils';

// ── Item factory ────────────────────────────────────────────────────────────
const makeItem = (overrides) => ({
  id: 'item-1',
  type: 'barrel',
  gridX: 0,
  gridY: 0,
  visible: true,
  ...overrides,
});

// ── Event handler tests ─────────────────────────────────────────────────────
describe('PlacedItems - event handler wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes the correct item id to handleItemPointerDown on barrel pointerdown', () => {
    const items = [makeItem({ type: 'barrel', id: 'barrel-42' })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    const hitArea = container.querySelector('circle.item-hit-area');
    hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.anything(), 'barrel-42');
  });

  it('passes the correct item id to handleItemPointerDown on NPC pointerdown', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Goblin', id: 'npc-7' });
    const { container } = render(<PlacedItems {...baseProps} placedItems={[npcItem]} />);
    // NPC hit area is the transparent rect (not the circle with .npc-circle class)
    const hitArea = container.querySelector('rect[fill="transparent"]');
    hitArea.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(mockHandleItemPointerDown).toHaveBeenCalledWith(expect.anything(), 'npc-7');
  });

  it('passes the correct item id to setSelectedItem on barrel contextmenu', () => {
    const items = [makeItem({ id: 'chest-99', gridX: 3, gridY: 5 })];
    const { container } = render(<PlacedItems {...baseProps} placedItems={items} />);
    // Barrel uses circle hit area
    const hitArea = container.querySelector('circle.item-hit-area');
    hitArea.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(baseProps.setSelectedItem).toHaveBeenCalledWith({ id: 'chest-99', gridX: 3, gridY: 5 });
  });

  it('passes the correct item id to setSelectedItem on NPC contextmenu', () => {
    const npcItem = makeItem({ type: 'npc', name: 'Dragon', id: 'dragon-1', gridX: 2, gridY: 4 });
    const { container } = render(<PlacedItems {...baseProps} placedItems={[npcItem]} />);
    const hitArea = container.querySelector('rect[fill="transparent"]');
    hitArea.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    expect(baseProps.setSelectedItem).toHaveBeenCalledWith({ id: 'dragon-1', gridX: 2, gridY: 4 });
  });
});
