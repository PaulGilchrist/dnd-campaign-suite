import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ItemContextMenu from './ItemContextMenu.jsx';

const CELL_SIZE = 50;
const gridCenterX = (gx) => gx * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gy) => gy * CELL_SIZE + CELL_SIZE / 2;

const makeSelectedItem = (overrides = {}) => ({
    id: 'item-1',
    gridX: 2,
    gridY: 3,
    ...overrides,
});

const makePlacedItem = (overrides = {}) => ({
    id: 'item-1',
    type: 'barrel',
    visible: true,
    ...overrides,
});

const renderComponent = (props, placedItems = []) =>
    render(
        <svg>
            <ItemContextMenu
                selectedItem={makeSelectedItem()}
                placedItems={placedItems}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                handleToggleItemVisibility={vi.fn()}
                handleDeleteItem={vi.fn()}
                handleRotate={vi.fn()}
                handleToggleDoor={vi.fn()}
                handleViewStats={vi.fn()}
                monsterFound={false}
                onRenameClicked={vi.fn()}
                onClose={vi.fn()}
                {...props}
            />
        </svg>
    );

describe('ItemContextMenu', () => {
    describe('null rendering', () => {
        it('should return null when selectedItem is not provided', () => {
            const { container } = render(
                <svg>
                    <ItemContextMenu
                        selectedItem={null}
                        placedItems={[]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleToggleItemVisibility={vi.fn()}
                        handleDeleteItem={vi.fn()}
                        handleRotate={vi.fn()}
                        handleToggleDoor={vi.fn()}
                        handleViewStats={vi.fn()}
                        monsterFound={false}
                        onRenameClicked={vi.fn()}
                        onClose={vi.fn()}
                    />
                </svg>
            );
            expect(container.querySelector('.item-context-menu')).toBeNull();
        });

        it('should return null when selectedItem is undefined', () => {
            const { container } = render(
                <svg>
                    <ItemContextMenu
                        selectedItem={undefined}
                        placedItems={[]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleToggleItemVisibility={vi.fn()}
                        handleDeleteItem={vi.fn()}
                        handleRotate={vi.fn()}
                        handleToggleDoor={vi.fn()}
                        handleViewStats={vi.fn()}
                        monsterFound={false}
                        onRenameClicked={vi.fn()}
                        onClose={vi.fn()}
                    />
                </svg>
            );
            expect(container.querySelector('.item-context-menu')).toBeNull();
        });
    });

    describe('basic rendering', () => {
        it('should render the root group with item-context-menu class', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rootGroup = container.querySelector('g.item-context-menu');
            expect(rootGroup).not.toBeNull();
        });

        it('should render a rect background', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rect = container.querySelector('rect');
            expect(rect).not.toBeNull();
        });

        it('should render the rect with correct fill and stroke', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('fill')).toBe('#2a2a2a');
            expect(rect.getAttribute('stroke')).toBe('#555');
            expect(rect.getAttribute('stroke-width')).toBe('1');
        });

        it('should render the rect with width 120', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('width')).toBe('120');
        });

        it('should render the rect with rx 4', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('rx')).toBe('4');
        });

        it('should position the menu at correct grid position', () => {
            const placedItem = makePlacedItem();
            const selectedItem = makeSelectedItem({ gridX: 5, gridY: 7 });
            const { container } = render(
                <svg>
                    <ItemContextMenu
                        selectedItem={selectedItem}
                        placedItems={[placedItem]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleToggleItemVisibility={vi.fn()}
                        handleDeleteItem={vi.fn()}
                        handleRotate={vi.fn()}
                        handleToggleDoor={vi.fn()}
                        handleViewStats={vi.fn()}
                        monsterFound={false}
                        onRenameClicked={vi.fn()}
                        onClose={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            const expectedX = gridCenterX(5) + 10;
            const expectedY = gridCenterY(7) + 10;
            expect(Number(rect.getAttribute('x'))).toBe(expectedX);
            expect(Number(rect.getAttribute('y'))).toBe(expectedY);
        });

        it('should render Hide text when item is visible', () => {
            const placedItem = makePlacedItem({ visible: true });
            const { container } = renderComponent({}, [placedItem]);
            const hideText = container.querySelectorAll('text.menu-option');
            expect(hideText[0].textContent).toBe('Hide');
        });

        it('should render Show text when item is not visible', () => {
            const placedItem = makePlacedItem({ visible: false });
            const { container } = renderComponent({}, [placedItem]);
            const showText = container.querySelectorAll('text.menu-option');
            expect(showText[0].textContent).toBe('Show');
        });

        it('should render Delete text', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const deleteText = container.querySelectorAll('text.menu-option');
            expect(deleteText[1].textContent).toBe('Delete');
        });

        it('should render Rotate text', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rotateText = container.querySelectorAll('text.menu-option');
            expect(rotateText[rotateText.length - 1].textContent).toBe('Rotate');
        });

        it('should render the close button with correct text', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const closeText = container.querySelector('text.menu-close');
            expect(closeText.textContent).toBe('✕');
        });

        it('should render the close button with correct position', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const closeText = container.querySelector('text.menu-close');
            const expectedX = gridCenterX(2) + 10 + 108;
            const expectedY = gridCenterY(3) + 10 + 12;
            expect(Number(closeText.getAttribute('x'))).toBe(expectedX);
            expect(Number(closeText.getAttribute('y'))).toBe(expectedY);
        });

        it('should render menu option texts with correct fill and fontSize', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const optionTexts = container.querySelectorAll('text.menu-option');
            optionTexts.forEach((text) => {
                expect(text.getAttribute('fill')).toBe('#ccc');
                expect(text.getAttribute('font-size')).toBe('11');
            });
        });

        it('should render menu option texts at x offset 8', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const optionTexts = container.querySelectorAll('text.menu-option');
            optionTexts.forEach((text) => {
                expect(Number(text.getAttribute('x'))).toBe(gridCenterX(2) + 18);
            });
        });

        it('should render close text with fill #999 and fontSize 10', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const closeText = container.querySelector('text.menu-close');
            expect(closeText.getAttribute('fill')).toBe('#999');
            expect(closeText.getAttribute('font-size')).toBe('10');
        });
    });

    describe('menu height variants', () => {
        it('should render height 76 for basic item (no extras)', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('height'))).toBe(76);
        });

        it('should render height 120 for NPC item (rename option)', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent({}, [placedItem]);
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('height'))).toBe(120);
        });

        it('should render height 138 for NPC item with monsterFound', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { monsterFound: true },
                [placedItem]
            );
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('height'))).toBe(138);
        });

        it('should render height 116 for door item', () => {
            const placedItem = makePlacedItem({ type: 'door' });
            const { container } = renderComponent({}, [placedItem]);
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('height'))).toBe(116);
        });
    });

    describe('toggle item visibility interaction', () => {
        it('should call handleToggleItemVisibility when Hide is clicked', () => {
            const handleToggleItemVisibility = vi.fn();
            const placedItem = makePlacedItem({ visible: true });
            const { container } = renderComponent(
                { handleToggleItemVisibility },
                [placedItem]
            );
            const hideText = container.querySelectorAll('text.menu-option');
            hideText[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleToggleItemVisibility).toHaveBeenCalledWith('item-1');
        });

        it('should call handleToggleItemVisibility when Show is clicked', () => {
            const handleToggleItemVisibility = vi.fn();
            const placedItem = makePlacedItem({ visible: false });
            const { container } = renderComponent(
                { handleToggleItemVisibility },
                [placedItem]
            );
            const showText = container.querySelectorAll('text.menu-option');
            showText[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleToggleItemVisibility).toHaveBeenCalledWith('item-1');
        });
    });

    describe('delete interaction', () => {
        it('should call handleDeleteItem when Delete is clicked', () => {
            const handleDeleteItem = vi.fn();
            const placedItem = makePlacedItem();
            const { container } = renderComponent(
                { handleDeleteItem },
                [placedItem]
            );
            const deleteText = container.querySelectorAll('text.menu-option');
            deleteText[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleDeleteItem).toHaveBeenCalledWith('item-1');
        });
    });

    describe('rotate interaction', () => {
        it('should call handleRotate when Rotate is clicked', () => {
            const handleRotate = vi.fn();
            const placedItem = makePlacedItem();
            const { container } = renderComponent(
                { handleRotate },
                [placedItem]
            );
            const rotateText = container.querySelectorAll('text.menu-option');
            rotateText[rotateText.length - 1].dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(handleRotate).toHaveBeenCalledWith('item-1');
        });
    });

    describe('close interaction', () => {
        it('should call onClose when close button is clicked', () => {
            const onClose = vi.fn();
            const placedItem = makePlacedItem();
            const { container } = renderComponent({ onClose }, [placedItem]);
            const closeText = container.querySelector('text.menu-close');
            closeText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            const expectedX = gridCenterX(2) + 10;
            const expectedY = gridCenterY(3) + 10;
            expect(onClose).toHaveBeenCalledWith(expectedX, expectedY);
        });

        it('should call onClose with correct coordinates for different grid positions', () => {
            const onClose = vi.fn();
            const placedItem = makePlacedItem();
            const selectedItem = makeSelectedItem({ gridX: 10, gridY: 15 });
            const { container } = render(
                <svg>
                    <ItemContextMenu
                        selectedItem={selectedItem}
                        placedItems={[placedItem]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleToggleItemVisibility={vi.fn()}
                        handleDeleteItem={vi.fn()}
                        handleRotate={vi.fn()}
                        handleToggleDoor={vi.fn()}
                        handleViewStats={vi.fn()}
                        monsterFound={false}
                        onRenameClicked={vi.fn()}
                        onClose={onClose}
                    />
                </svg>
            );
            const closeText = container.querySelector('text.menu-close');
            closeText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            const expectedX = gridCenterX(10) + 10;
            const expectedY = gridCenterY(15) + 10;
            expect(onClose).toHaveBeenCalledWith(expectedX, expectedY);
        });
    });

    describe('door menu', () => {
        it('should not render Open Door for non-door items', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const doorTexts = container.querySelectorAll(
                'text.menu-option'
            );
            const hasDoorText = Array.from(doorTexts).some((t) =>
                t.textContent.includes('Door')
            );
            expect(hasDoorText).toBe(false);
        });

        it('should render Open Door text for door items', () => {
            const placedItem = makePlacedItem({ type: 'door', open: false });
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const doorTextEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Open Door'
            );
            expect(doorTextEl).not.toBeNull();
        });

        it('should render Close Door text for open door items', () => {
            const placedItem = makePlacedItem({ type: 'door', open: true });
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const doorTextEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Close Door'
            );
            expect(doorTextEl).not.toBeNull();
        });

        it('should call handleToggleDoor when Open Door is clicked', () => {
            const handleToggleDoor = vi.fn();
            const placedItem = makePlacedItem({ type: 'door', open: false });
            const { container } = renderComponent(
                { handleToggleDoor },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const doorTextEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Open Door'
            );
            doorTextEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleToggleDoor).toHaveBeenCalledWith('item-1');
        });

        it('should call handleToggleDoor when Close Door is clicked', () => {
            const handleToggleDoor = vi.fn();
            const placedItem = makePlacedItem({ type: 'door', open: true });
            const { container } = renderComponent(
                { handleToggleDoor },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const doorTextEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Close Door'
            );
            doorTextEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleToggleDoor).toHaveBeenCalledWith('item-1');
        });

        it('should stop propagation on context menu container click', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const rootGroup = container.querySelector('g.item-context-menu');
            const event = new MouseEvent('click', { bubbles: true });
            const stopPropagationSpy = vi.fn();
            event.stopPropagation = stopPropagationSpy;
            rootGroup.dispatchEvent(event);
            expect(stopPropagationSpy).toHaveBeenCalled();
        });
    });

    describe('NPC menu', () => {
        it('should not render Rename for non-NPC items', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const hasRenameText = Array.from(allOptionTexts).some(
                (t) => t.textContent === 'Rename'
            );
            expect(hasRenameText).toBe(false);
        });

        it('should render Rename for NPC items', () => {
            const placedItem = makePlacedItem({ type: 'npc', name: 'Gandalf' });
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const renameTextEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Rename'
            );
            expect(renameTextEl).not.toBeNull();
        });

        it('should call onRenameClicked when Rename is clicked', () => {
            const onRenameClicked = vi.fn();
            const placedItem = makePlacedItem({ type: 'npc', name: 'Gandalf' });
            const { container } = renderComponent(
                { onRenameClicked },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const renameTextEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Rename'
            );
            renameTextEl.dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(onRenameClicked).toHaveBeenCalled();
            const callArgs = onRenameClicked.mock.calls[0];
            expect(callArgs[1]).toHaveProperty('id', 'item-1');
            expect(callArgs[2]).toBe('Gandalf');
        });

        it('should call onRenameClicked with default name when item name is missing', () => {
            const onRenameClicked = vi.fn();
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { onRenameClicked },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const renameTextEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Rename'
            );
            renameTextEl.dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(onRenameClicked).toHaveBeenCalled();
            const callArgs = onRenameClicked.mock.calls[0];
            expect(callArgs[2]).toBe('NPC');
        });

        it('should not render View Stats when monsterFound is false', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { monsterFound: false },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const hasViewStats = Array.from(allOptionTexts).some(
                (t) => t.textContent === 'View Stats'
            );
            expect(hasViewStats).toBe(false);
        });

        it('should render View Stats when monsterFound is true', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { monsterFound: true },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const viewStatsEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'View Stats'
            );
            expect(viewStatsEl).not.toBeNull();
        });

        it('should call handleViewStats when View Stats is clicked', () => {
            const handleViewStats = vi.fn();
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { handleViewStats, monsterFound: true },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const viewStatsEl = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'View Stats'
            );
            viewStatsEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleViewStats).toHaveBeenCalledWith('item-1');
        });
    });

    describe('menu text positioning', () => {
        it('should position Hide text at correct y offset', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const hideText = allOptionTexts[0];
            const expectedY = gridCenterY(3) + 10 + 20;
            expect(Number(hideText.getAttribute('y'))).toBe(expectedY);
        });

        it('should position Delete text at correct y offset', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const deleteText = allOptionTexts[1];
            const expectedY = gridCenterY(3) + 10 + 42;
            expect(Number(deleteText.getAttribute('y'))).toBe(expectedY);
        });

        it('should position Rotate text at correct y offset for basic item', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const rotateText = allOptionTexts[allOptionTexts.length - 1];
            const expectedY = gridCenterY(3) + 10 + 64;
            expect(Number(rotateText.getAttribute('y'))).toBe(expectedY);
        });

        it('should position Rotate text at y=86 for NPC item', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const rotateText = allOptionTexts[allOptionTexts.length - 1];
            const expectedY = gridCenterY(3) + 10 + 86;
            expect(Number(rotateText.getAttribute('y'))).toBe(expectedY);
        });

        it('should position Rotate text at y=108 for NPC item with monsterFound', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { monsterFound: true },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const rotateText = allOptionTexts[allOptionTexts.length - 1];
            const expectedY = gridCenterY(3) + 10 + 108;
            expect(Number(rotateText.getAttribute('y'))).toBe(expectedY);
        });

        it('should position Rotate text at y=86 for door item', () => {
            const placedItem = makePlacedItem({ type: 'door' });
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const rotateText = allOptionTexts[allOptionTexts.length - 1];
            const expectedY = gridCenterY(3) + 10 + 86;
            expect(Number(rotateText.getAttribute('y'))).toBe(expectedY);
        });

        it('should position Rename text at correct y for NPC', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent({}, [placedItem]);
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const renameText = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'Rename'
            );
            const expectedY = gridCenterY(3) + 10 + 64;
            expect(Number(renameText.getAttribute('y'))).toBe(expectedY);
        });

        it('should position View Stats at correct y for NPC with monsterFound', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { monsterFound: true },
                [placedItem]
            );
            const allOptionTexts = container.querySelectorAll('text.menu-option');
            const viewStatsText = Array.from(allOptionTexts).find(
                (t) => t.textContent === 'View Stats'
            );
            const expectedY = gridCenterY(3) + 10 + 86;
            expect(Number(viewStatsText.getAttribute('y'))).toBe(expectedY);
        });
    });

    describe('text count by item type', () => {
        it('should render 3 menu options for basic item', () => {
            const placedItem = makePlacedItem();
            const { container } = renderComponent({}, [placedItem]);
            const optionTexts = container.querySelectorAll('text.menu-option');
            expect(optionTexts.length).toBe(3);
        });

        it('should render 4 menu options for NPC item', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent({}, [placedItem]);
            const optionTexts = container.querySelectorAll('text.menu-option');
            expect(optionTexts.length).toBe(4);
        });

        it('should render 5 menu options for NPC item with monsterFound', () => {
            const placedItem = makePlacedItem({ type: 'npc' });
            const { container } = renderComponent(
                { monsterFound: true },
                [placedItem]
            );
            const optionTexts = container.querySelectorAll('text.menu-option');
            expect(optionTexts.length).toBe(5);
        });

        it('should render 4 menu options for door item', () => {
            const placedItem = makePlacedItem({ type: 'door' });
            const { container } = renderComponent({}, [placedItem]);
            const optionTexts = container.querySelectorAll('text.menu-option');
            expect(optionTexts.length).toBe(4);
        });
    });

    describe('different selected item IDs', () => {
        it('should pass the correct item ID to all handlers', () => {
            const handleToggleItemVisibility = vi.fn();
            const handleDeleteItem = vi.fn();
            const handleRotate = vi.fn();
            const handleToggleDoor = vi.fn();
            const handleViewStats = vi.fn();
            const onRenameClicked = vi.fn();

            const selectedItem = makeSelectedItem({ id: 'custom-id-42' });
            const placedItem = makePlacedItem({ id: 'custom-id-42' });

            const { container } = render(
                <svg>
                    <ItemContextMenu
                        selectedItem={selectedItem}
                        placedItems={[placedItem]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleToggleItemVisibility={handleToggleItemVisibility}
                        handleDeleteItem={handleDeleteItem}
                        handleRotate={handleRotate}
                        handleToggleDoor={handleToggleDoor}
                        handleViewStats={handleViewStats}
                        monsterFound={false}
                        onRenameClicked={onRenameClicked}
                        onClose={vi.fn()}
                    />
                </svg>
            );

            const allOptionTexts = container.querySelectorAll('text.menu-option');

            // Hide
            allOptionTexts[0].dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(handleToggleItemVisibility).toHaveBeenCalledWith(
                'custom-id-42'
            );

            // Delete
            allOptionTexts[1].dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(handleDeleteItem).toHaveBeenCalledWith('custom-id-42');

            // Rotate
            allOptionTexts[allOptionTexts.length - 1].dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
            expect(handleRotate).toHaveBeenCalledWith('custom-id-42');
        });
    });

    describe('different grid positions', () => {
        it('should render menu at grid position 0,0', () => {
            const placedItem = makePlacedItem();
            const selectedItem = makeSelectedItem({ gridX: 0, gridY: 0 });
            const { container } = render(
                <svg>
                    <ItemContextMenu
                        selectedItem={selectedItem}
                        placedItems={[placedItem]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleToggleItemVisibility={vi.fn()}
                        handleDeleteItem={vi.fn()}
                        handleRotate={vi.fn()}
                        handleToggleDoor={vi.fn()}
                        handleViewStats={vi.fn()}
                        monsterFound={false}
                        onRenameClicked={vi.fn()}
                        onClose={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('x'))).toBe(gridCenterX(0) + 10);
            expect(Number(rect.getAttribute('y'))).toBe(gridCenterY(0) + 10);
        });

        it('should render menu at negative grid positions', () => {
            const placedItem = makePlacedItem();
            const selectedItem = makeSelectedItem({ gridX: -1, gridY: -2 });
            const { container } = render(
                <svg>
                    <ItemContextMenu
                        selectedItem={selectedItem}
                        placedItems={[placedItem]}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleToggleItemVisibility={vi.fn()}
                        handleDeleteItem={vi.fn()}
                        handleRotate={vi.fn()}
                        handleToggleDoor={vi.fn()}
                        handleViewStats={vi.fn()}
                        monsterFound={false}
                        onRenameClicked={vi.fn()}
                        onClose={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('x'))).toBe(gridCenterX(-1) + 10);
            expect(Number(rect.getAttribute('y'))).toBe(gridCenterY(-2) + 10);
        });
    });
});
