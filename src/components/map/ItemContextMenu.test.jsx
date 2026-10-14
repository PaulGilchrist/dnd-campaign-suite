import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemContextMenu from './ItemContextMenu';

const mockGridCenterX = (gx) => gx * 40 + 20;
const mockGridCenterY = (gy) => gy * 40 + 20;

const createMocks = () => ({
    handleToggleItemVisibility: vi.fn(),
    handleDeleteItem: vi.fn(),
    handleRotate: vi.fn(),
    handleToggleDoor: vi.fn(),
    handleViewStats: vi.fn(),
    onRenameClicked: vi.fn(),
    onClose: vi.fn(),
});

const defaultSelectedItem = { id: 'item-1', gridX: 0, gridY: 0 };

const createPlacedItem = (overrides = {}) => ({
    id: 'item-1',
    type: 'token',
    visible: true,
    open: false,
    name: 'Test NPC',
    ...overrides,
});

// ── Null / undefined item renders nothing ───────────────────────

describe('null item', () => {
    it('returns null when selectedItem is null or undefined', () => {
        const mocks = createMocks();
        const { container } = render(
            <ItemContextMenu
                selectedItem={undefined}
                placedItems={[]}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                {...mocks}
            />
        );
        expect(container.innerHTML).toBe('');
    });
});

// ── Basic token (non-NPC, non-door) ───────────────────────────

describe('basic token item', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMocks();
    });

    const renderBasicToken = (overrides = {}) => {
        const placedItems = [createPlacedItem(overrides)];
        render(
            <ItemContextMenu
                selectedItem={defaultSelectedItem}
                placedItems={placedItems}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                {...mocks}
            />
        );
    };

    it('renders Hide when item is visible', () => {
        renderBasicToken({ visible: true });
        expect(screen.getByText('Hide')).toBeInTheDocument();
    });

    it('renders Show when item visibility is explicitly false', () => {
        renderBasicToken({ visible: false });
        expect(screen.getByText('Show')).toBeInTheDocument();
    });

    it('renders Delete option', () => {
        renderBasicToken();
        expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('renders Rotate option', () => {
        renderBasicToken();
        expect(screen.getByText('Rotate')).toBeInTheDocument();
    });

    it('does NOT render door-specific options for non-door items', () => {
        renderBasicToken({ type: 'token' });
        expect(screen.queryByText('Open Door')).not.toBeInTheDocument();
        expect(screen.queryByText('Close Door')).not.toBeInTheDocument();
    });

    it('does NOT render rename or view stats for non-NPC items', () => {
        renderBasicToken({ type: 'token' });
        expect(screen.queryByText('Rename')).not.toBeInTheDocument();
        expect(screen.queryByText('View Stats')).not.toBeInTheDocument();
    });

    it('calls handleToggleItemVisibility when Hide or Show is clicked', () => {
        renderBasicToken({ visible: true });
        fireEvent.click(screen.getByText('Hide'));
        expect(mocks.handleToggleItemVisibility).toHaveBeenCalledWith('item-1');
    });

    it('calls handleDeleteItem with item id when Delete is clicked', () => {
        renderBasicToken();
        fireEvent.click(screen.getByText('Delete'));
        expect(mocks.handleDeleteItem).toHaveBeenCalledWith('item-1');
    });

    it('calls handleRotate with item id when Rotate is clicked', () => {
        renderBasicToken();
        fireEvent.click(screen.getByText('Rotate'));
        expect(mocks.handleRotate).toHaveBeenCalledWith('item-1');
    });

    it('calls onClose with menuX and menuY when close button is clicked', () => {
        renderBasicToken();
        fireEvent.click(screen.getByText('✕'));
        expect(mocks.onClose).toHaveBeenCalledWith(30, 30);
    });
});

// ── NPC item ───────────────────────────────────────────────────

describe('NPC item', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMocks();
    });

    const renderNpc = (overrides = {}) => {
        const placedItems = [createPlacedItem({ type: 'npc', ...overrides })];
        render(
            <ItemContextMenu
                selectedItem={defaultSelectedItem}
                placedItems={placedItems}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                monsterFound={overrides.monsterFound ?? false}
                {...mocks}
            />
        );
    };

    it('shows Rename option for NPC items', () => {
        renderNpc();
        expect(screen.getByText('Rename')).toBeInTheDocument();
    });

    it('shows View Stats when monsterFound is true', () => {
        renderNpc({ monsterFound: true });
        expect(screen.getByText('View Stats')).toBeInTheDocument();
    });

    it('does NOT show View Stats when monsterFound is falsy', () => {
        renderNpc({ monsterFound: false });
        expect(screen.queryByText('View Stats')).not.toBeInTheDocument();
    });

    it('calls onRenameClicked with event, selectedItem, and name when Rename is clicked', () => {
        renderNpc({ name: 'Goblin' });
        fireEvent.click(screen.getByText('Rename'));
        expect(mocks.onRenameClicked).toHaveBeenCalledTimes(1);
        const [event, selectedItem, name] = mocks.onRenameClicked.mock.calls[0];
        expect(event).toBeTruthy();
        expect(selectedItem).toBe(defaultSelectedItem);
        expect(name).toBe('Goblin');
    });

    it('passes "NPC" as default name when item has no name', () => {
        renderNpc({ name: null });
        fireEvent.click(screen.getByText('Rename'));
        expect(mocks.onRenameClicked.mock.calls[0][2]).toBe('NPC');
    });

    it('calls handleViewStats with item id when View Stats is clicked', () => {
        renderNpc({ monsterFound: true });
        fireEvent.click(screen.getByText('View Stats'));
        expect(mocks.handleViewStats).toHaveBeenCalledWith('item-1');
    });

    it('renders Rotate option for NPC items', () => {
        renderNpc();
        expect(screen.getByText('Rotate')).toBeInTheDocument();
    });

    it('does NOT show Rename or View Stats for door items even when monsterFound is true', () => {
        const placedItems = [createPlacedItem({ type: 'door' })];
        render(
            <ItemContextMenu
                selectedItem={defaultSelectedItem}
                placedItems={placedItems}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                monsterFound={true}
                {...mocks}
            />
        );
        expect(screen.queryByText('Rename')).not.toBeInTheDocument();
        expect(screen.queryByText('View Stats')).not.toBeInTheDocument();
    });
});

// ── Door item ──────────────────────────────────────────────────

describe('door item', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMocks();
    });

    const renderDoor = (overrides = {}) => {
        const placedItems = [createPlacedItem({ type: 'door', ...overrides })];
        render(
            <ItemContextMenu
                selectedItem={defaultSelectedItem}
                placedItems={placedItems}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                {...mocks}
            />
        );
    };

    it('shows Open Door when door is closed', () => {
        renderDoor({ open: false });
        expect(screen.getByText('Open Door')).toBeInTheDocument();
    });

    it('shows Close Door when door is open', () => {
        renderDoor({ open: true });
        expect(screen.getByText('Close Door')).toBeInTheDocument();
    });

    it('calls handleToggleDoor when Open Door is clicked', () => {
        renderDoor({ open: false });
        fireEvent.click(screen.getByText('Open Door'));
        expect(mocks.handleToggleDoor).toHaveBeenCalledWith('item-1');
    });

    it('calls handleToggleDoor when Close Door is clicked', () => {
        renderDoor({ open: true });
        fireEvent.click(screen.getByText('Close Door'));
        expect(mocks.handleToggleDoor).toHaveBeenCalledWith('item-1');
    });
});

// ── Menu layout / positioning ──────────────────────────────────

describe('menu layout', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMocks();
    });

    it('positions menu at correct grid offset', () => {
        const placedItems = [createPlacedItem()];
        const { container } = render(
            <ItemContextMenu
                selectedItem={{ id: 'item-1', gridX: 2, gridY: 3 }}
                placedItems={placedItems}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                {...mocks}
            />
        );
        const rect = container.querySelector('rect');
        // menuX = gridCenterX(2) + 10 = 110, menuY = gridCenterY(3) + 10 = 150
        expect(rect.getAttribute('x')).toBe('110');
        expect(rect.getAttribute('y')).toBe('150');
    });

    it('stops propagation on the outer group click', () => {
        const placedItems = [createPlacedItem()];
        const { container } = render(
            <ItemContextMenu
                selectedItem={defaultSelectedItem}
                placedItems={placedItems}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                {...mocks}
            />
        );
        const stopSpy = vi.spyOn(Event.prototype, 'stopPropagation');
        const outerG = container.querySelector('.item-context-menu');
        outerG.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(stopSpy).toHaveBeenCalled();
        stopSpy.mockRestore();
    });
});

// ── Item lookup from placedItems ───────────────────────────────

describe('item lookup from placedItems', () => {
    let mocks;

    beforeEach(() => {
        mocks = createMocks();
    });

    it('does NOT show Rename when selectedItem id is not in placedItems', () => {
        render(
            <ItemContextMenu
                selectedItem={defaultSelectedItem}
                placedItems={[]}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                {...mocks}
            />
        );
        expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    });
});
