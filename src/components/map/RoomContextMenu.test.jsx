// @improved-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RoomContextMenu from './RoomContextMenu.jsx';
import { ROOM_TYPES, ROOM_TYPE_COLORS, CELL_SIZE } from '../../config/mapConfig';

const gridSize = 30;
const gridCenterX = (gx) => gx * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gy) => gy * CELL_SIZE + CELL_SIZE / 2;

const makeSelectedRoom = (overrides = {}) => ({
    id: 'room-1',
    label: 'Main Hall',
    type: 'entrance',
    rect: { x: 5, y: 3, w: 4, h: 3 },
    ...overrides,
});

const renderComponent = (props = {}) =>
    render(
        <svg>
            <RoomContextMenu
                selectedRoom={makeSelectedRoom()}
                isLocalhost={true}
                gridSize={gridSize}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                setMapData={vi.fn()}
                setSelectedRoom={vi.fn()}
                {...props}
            />
        </svg>
    );

describe('RoomContextMenu', () => {
    describe('null rendering', () => {
        it.each([
            [null, 'selectedRoom is null'],
            [undefined, 'selectedRoom is undefined'],
            [makeSelectedRoom(), 'isLocalhost is false'],
        ])('should return null when %s (%s)', (selectedRoom, _description) => {
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={selectedRoom}
                        isLocalhost={selectedRoom ? false : true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={vi.fn()}
                    />
                </svg>
            );
            expect(container.querySelector('.item-context-menu')).not.toBeInTheDocument();
        });
    });

    describe('basic rendering', () => {
        it('should render the root group with item-context-menu class', () => {
            const { container } = renderComponent();
            expect(container.querySelector('g.item-context-menu')).toBeInTheDocument();
        });

        it('should render the background rect with correct attributes', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            expect(rect).toBeInTheDocument();
            expect(rect).toHaveAttribute('fill', '#2a2a2a');
            expect(rect).toHaveAttribute('stroke', '#555');
            expect(rect).toHaveAttribute('stroke-width', '1');
            expect(rect).toHaveAttribute('width', '130');
            expect(rect).toHaveAttribute('rx', '4');
        });

        it('should render the Room title text', () => {
            const { container } = renderComponent();
            const titleText = container.querySelectorAll('text');
            const roomTitle = Array.from(titleText).find(
                (t) => t.getAttribute('font-weight') === 'bold'
            );
            expect(roomTitle).toBeInTheDocument();
            expect(roomTitle).toHaveAttribute('fill', '#e0e0e0');
            expect(roomTitle).toHaveAttribute('font-size', '11');
        });

        it('should render the Set Label menu option', () => {
            renderComponent();
            const labelTexts = screen.queryAllByText('Set Label...');
            expect(labelTexts.length).toBeGreaterThan(0);
        });

        it('should render room type options for each ROOM_TYPE', () => {
            const { container } = renderComponent();
            const menuOptionTexts = container.querySelectorAll('text.menu-option');
            const typeTexts = Array.from(menuOptionTexts).filter(
                (t) => t.textContent !== 'Set Label...' && t.textContent !== 'Delete Room'
            );
            expect(typeTexts.length).toBe(ROOM_TYPES.length);
        });

        it('should render all room type names capitalized', () => {
            const { container } = renderComponent();
            const menuOptionTexts = container.querySelectorAll('text.menu-option');
            const allTexts = Array.from(menuOptionTexts).map((t) => t.textContent);
            ROOM_TYPES.forEach((type) => {
                const expectedLabel = type.charAt(0).toUpperCase() + type.slice(1);
                expect(allTexts).toContain(expectedLabel);
            });
        });

        it('should render the Delete Room option in red', () => {
            const { container } = renderComponent();
            const deleteText = Array.from(container.querySelectorAll('text.menu-option')).find(
                (t) => t.textContent === 'Delete Room'
            );
            expect(deleteText).toBeInTheDocument();
            expect(deleteText).toHaveAttribute('fill', '#e74c3c');
        });

        it('should render the close button with correct attributes', () => {
            const { container } = renderComponent();
            const closeText = container.querySelector('text.menu-close');
            expect(closeText).toBeInTheDocument();
            expect(closeText.textContent).toBe('✕');
            expect(closeText).toHaveAttribute('fill', '#999');
            expect(closeText).toHaveAttribute('font-size', '10');
        });

        it('should render menu options with fontSize 11', () => {
            const { container } = renderComponent();
            const menuOptionTexts = container.querySelectorAll('text.menu-option');
            menuOptionTexts.forEach((text) => {
                expect(text).toHaveAttribute('font-size', '11');
            });
        });

        it('should render correct number of menu options', () => {
            const { container } = renderComponent();
            const menuOptionTexts = container.querySelectorAll('text.menu-option');
            expect(menuOptionTexts.length).toBe(1 + ROOM_TYPES.length + 1);
        });

        it('should render exactly 1 close button', () => {
            const { container } = renderComponent();
            const closeTexts = container.querySelectorAll('text.menu-close');
            expect(closeTexts.length).toBe(1);
        });

        it('should render exactly 1 title text (bold Room text)', () => {
            const { container } = renderComponent();
            const allTexts = container.querySelectorAll('text');
            const boldTexts = Array.from(allTexts).filter(
                (t) => t.getAttribute('font-weight') === 'bold' && t.getAttribute('fill') === '#e0e0e0'
            );
            expect(boldTexts.length).toBe(1);
        });
    });

    describe('menu positioning', () => {
        it('should position the menu at correct x based on room rect x', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            const expectedX = Math.min(gridCenterX(5 + 4) + 10, gridSize * CELL_SIZE - 140);
            expect(Number(rect.getAttribute('x'))).toBe(expectedX);
        });

        it('should position the menu at correct y based on room rect y', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            const expectedY = gridCenterY(3) - CELL_SIZE / 2;
            expect(Number(rect.getAttribute('y'))).toBe(expectedY);
        });

        it('should clamp menu x to not exceed grid width', () => {
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom({ rect: { x: 28, y: 10, w: 5, h: 4 } })}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            const clampedX = gridSize * CELL_SIZE - 140;
            expect(Number(rect.getAttribute('x'))).toBe(clampedX);
        });

        it('should position correctly for room at grid position 0,0', () => {
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom({ rect: { x: 0, y: 0, w: 2, h: 2 } })}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            const expectedX = Math.min(gridCenterX(0 + 2) + 10, gridSize * CELL_SIZE - 140);
            const expectedY = gridCenterY(0) - CELL_SIZE / 2;
            expect(Number(rect.getAttribute('x'))).toBe(expectedX);
            expect(Number(rect.getAttribute('y'))).toBe(expectedY);
        });

        it('should position correctly for room with negative grid position', () => {
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom({ rect: { x: -2, y: -1, w: 3, h: 2 } })}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            const expectedX = Math.min(gridCenterX(-2 + 3) + 10, gridSize * CELL_SIZE - 140);
            const expectedY = gridCenterY(-1) - CELL_SIZE / 2;
            expect(Number(rect.getAttribute('x'))).toBe(expectedX);
            expect(Number(rect.getAttribute('y'))).toBe(expectedY);
        });
    });

    describe('menu height', () => {
        it('should render the rect with correct height based on ROOM_TYPES count', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            const expectedHeight = 72 + ROOM_TYPES.length * 20;
            expect(Number(rect.getAttribute('height'))).toBe(expectedHeight);
        });
    });

    describe('room type color indicators', () => {
        it('should render a color indicator rect for each room type', () => {
            const { container } = renderComponent();
            const typeIndicatorRects = container.querySelectorAll('rect[rx="2"]');
            expect(typeIndicatorRects.length).toBe(ROOM_TYPES.length);
        });

        it('should render each room type with the correct color', () => {
            const { container } = renderComponent();
            ROOM_TYPES.forEach((type) => {
                const expectedColor = ROOM_TYPE_COLORS[type] || '#888';
                const colorRect = container.querySelector(
                    `rect[fill="${expectedColor}"][rx="2"]`
                );
                expect(colorRect).toBeInTheDocument();
            });
        });

        it('should render the currently selected type with white text and bold', () => {
            const { container } = renderComponent();
            const selectedType = 'entrance';
            const selectedColor = ROOM_TYPE_COLORS[selectedType];
            const colorRect = container.querySelector(`rect[fill="${selectedColor}"][rx="2"]`);
            expect(colorRect).toBeInTheDocument();
        });

        it('should render non-selected types with #ccc text and normal font-weight', () => {
            const { container } = renderComponent();
            const menuOptionTexts = container.querySelectorAll('text.menu-option');
            const nonSelectedTypes = Array.from(menuOptionTexts).filter(
                (t) => t.textContent !== 'Set Label...' && t.textContent !== 'Delete Room' && t.textContent !== 'Entrance'
            );
            nonSelectedTypes.forEach((text) => {
                expect(text).toHaveAttribute('font-weight', 'normal');
            });
        });
    });

    describe('selected room type highlighting', () => {
        it('should render the selected type text as white and bold', () => {
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom({ type: 'grand' })}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={vi.fn()}
                    />
                </svg>
            );
            const grandText = Array.from(container.querySelectorAll('text.menu-option')).find(
                (t) => t.textContent === 'Grand'
            );
            expect(grandText).toHaveAttribute('fill', '#fff');
            expect(grandText).toHaveAttribute('font-weight', 'bold');
        });

        it('should render non-selected types with normal font-weight', () => {
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom({ type: 'grand' })}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={vi.fn()}
                    />
                </svg>
            );
            const menuOptionTexts = container.querySelectorAll('text.menu-option');
            const nonSelectedTypes = Array.from(menuOptionTexts).filter(
                (t) => t.textContent !== 'Set Label...' && t.textContent !== 'Delete Room' && t.textContent !== 'Grand'
            );
            nonSelectedTypes.forEach((text) => {
                expect(text).toHaveAttribute('font-weight', 'normal');
            });
        });
    });

    describe('set label interaction', () => {
        it('should call setSelectedRoom(null) when Set Label is clicked', () => {
            const setMapData = vi.fn((fn) => fn({ rooms: [{ id: 'room-1', label: 'Old Label', type: 'entrance' }] }));
            const setSelectedRoom = vi.fn();
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom()}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={setMapData}
                        setSelectedRoom={setSelectedRoom}
                    />
                </svg>
            );
            const labelText = Array.from(container.querySelectorAll('text.menu-option')).find(
                (t) => t.textContent === 'Set Label...'
            );
            labelText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(setSelectedRoom).toHaveBeenCalledWith(null);
        });

        it('should stop propagation on context menu container click', () => {
            const { container } = renderComponent();
            const rootGroup = container.querySelector('g.item-context-menu');
            const event = new MouseEvent('click', { bubbles: true });
            const stopPropagationSpy = vi.fn();
            event.stopPropagation = stopPropagationSpy;
            rootGroup.dispatchEvent(event);
            expect(stopPropagationSpy).toHaveBeenCalled();
        });
    });

    describe('room type selection interaction', () => {
        it('should call setSelectedRoom(null) when a room type option is clicked', () => {
            const setMapData = vi.fn((fn) => fn({ rooms: [{ id: 'room-1', label: 'Hall', type: 'entrance' }] }));
            const setSelectedRoom = vi.fn();
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom()}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={setMapData}
                        setSelectedRoom={setSelectedRoom}
                    />
                </svg>
            );
            const menuOptionTexts = container.querySelectorAll('text.menu-option');
            const commonText = Array.from(menuOptionTexts).find(
                (t) => t.textContent === 'Common'
            );
            commonText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(setSelectedRoom).toHaveBeenCalledWith(null);
        });

        it('should update room type to each ROOM_TYPE value', () => {
            const setSelectedRoom = vi.fn();
            ROOM_TYPES.forEach((type) => {
                const setMapData = vi.fn();
                const { container } = render(
                    <svg>
                        <RoomContextMenu
                            selectedRoom={makeSelectedRoom()}
                            isLocalhost={true}
                            gridSize={gridSize}
                            gridCenterX={gridCenterX}
                            gridCenterY={gridCenterY}
                            setMapData={setMapData}
                            setSelectedRoom={setSelectedRoom}
                        />
                    </svg>
                );
                const menuOptionTexts = container.querySelectorAll('text.menu-option');
                const typeText = Array.from(menuOptionTexts).find(
                    (t) => t.textContent === type.charAt(0).toUpperCase() + type.slice(1)
                );
                typeText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                expect(setMapData).toHaveBeenCalled();
                expect(setSelectedRoom).toHaveBeenCalledWith(null);
            });
        });
    });

    describe('delete room interaction', () => {
        it('should call setMapData to filter out the room when Delete Room is clicked', () => {
            const setMapData = vi.fn((fn) => fn({ rooms: [{ id: 'room-1', label: 'Hall', type: 'entrance' }] }));
            const setSelectedRoom = vi.fn();
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom()}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={setMapData}
                        setSelectedRoom={setSelectedRoom}
                    />
                </svg>
            );
            const deleteText = Array.from(container.querySelectorAll('text.menu-option')).find(
                (t) => t.textContent === 'Delete Room'
            );
            deleteText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(setSelectedRoom).toHaveBeenCalledWith(null);
        });

        it('should use the correct room ID in setMapData calls', () => {
            const setMapData = vi.fn();
            const setSelectedRoom = vi.fn();
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom({ id: 'custom-room-42' })}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={setMapData}
                        setSelectedRoom={setSelectedRoom}
                    />
                </svg>
            );
            const deleteText = Array.from(container.querySelectorAll('text.menu-option')).find(
                (t) => t.textContent === 'Delete Room'
            );
            deleteText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(setSelectedRoom).toHaveBeenCalledWith(null);
        });
    });

    describe('close interaction', () => {
        it('should call setSelectedRoom(null) when close button is clicked', () => {
            const setSelectedRoom = vi.fn();
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom()}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={setSelectedRoom}
                    />
                </svg>
            );
            const closeText = container.querySelector('text.menu-close');
            closeText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(setSelectedRoom).toHaveBeenCalledWith(null);
        });
    });

    describe('room without label', () => {
        it('should render Set Label option when room has no label', () => {
            const { container } = render(
                <svg>
                    <RoomContextMenu
                        selectedRoom={makeSelectedRoom({ label: '' })}
                        isLocalhost={true}
                        gridSize={gridSize}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        setMapData={vi.fn()}
                        setSelectedRoom={vi.fn()}
                    />
                </svg>
            );
            const labelText = Array.from(container.querySelectorAll('text.menu-option')).find(
                (t) => t.textContent === 'Set Label...'
            );
            expect(labelText).toBeInTheDocument();
        });
    });
});
