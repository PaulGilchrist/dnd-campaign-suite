import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PlayerContextMenu from './PlayerContextMenu.jsx';

const CELL_SIZE = 50;
const gridCenterX = (gx) => gx * CELL_SIZE + CELL_SIZE / 2;
const gridCenterY = (gy) => gy * CELL_SIZE + CELL_SIZE / 2;

const makeSelectedPlayer = (overrides = {}) => ({
    id: 'player-1',
    gridX: 2,
    gridY: 3,
    ...overrides,
});

const renderComponent = (props = {}) =>
    render(
        <svg>
            <PlayerContextMenu
                selectedPlayer={makeSelectedPlayer()}
                gridCenterX={gridCenterX}
                gridCenterY={gridCenterY}
                handleRemovePlayer={vi.fn()}
                setSelectedPlayer={vi.fn()}
                {...props}
            />
        </svg>
    );

describe('PlayerContextMenu', () => {
    describe('null rendering', () => {
        it('should return null when selectedPlayer is not provided', () => {
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={null}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={vi.fn()}
                        setSelectedPlayer={vi.fn()}
                    />
                </svg>
            );
            expect(container.querySelector('.item-context-menu')).toBeNull();
        });

        it('should return null when selectedPlayer is undefined', () => {
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={undefined}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={vi.fn()}
                        setSelectedPlayer={vi.fn()}
                    />
                </svg>
            );
            expect(container.querySelector('.item-context-menu')).toBeNull();
        });
    });

    describe('basic rendering', () => {
        it('should render the root group with item-context-menu class', () => {
            const { container } = renderComponent();
            const rootGroup = container.querySelector('g.item-context-menu');
            expect(rootGroup).not.toBeNull();
        });

        it('should render a rect background', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            expect(rect).not.toBeNull();
        });

        it('should render the rect with correct fill and stroke', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('fill')).toBe('#2a2a2a');
            expect(rect.getAttribute('stroke')).toBe('#555');
            expect(rect.getAttribute('stroke-width')).toBe('1');
        });

        it('should render the rect with width 120', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('width')).toBe('120');
        });

        it('should render the rect with height 36', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('height')).toBe('36');
        });

        it('should render the rect with rx 4', () => {
            const { container } = renderComponent();
            const rect = container.querySelector('rect');
            expect(rect.getAttribute('rx')).toBe('4');
        });

        it('should position the menu at correct grid position', () => {
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={makeSelectedPlayer({ gridX: 5, gridY: 7 })}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={vi.fn()}
                        setSelectedPlayer={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            const expectedX = gridCenterX(5) + 10;
            const expectedY = gridCenterY(7) + 10;
            expect(Number(rect.getAttribute('x'))).toBe(expectedX);
            expect(Number(rect.getAttribute('y'))).toBe(expectedY);
        });

        it('should render the Remove from Map text option', () => {
            const { container } = renderComponent();
            const optionText = container.querySelector('text.menu-option');
            expect(optionText).not.toBeNull();
            expect(optionText.textContent).toBe('Remove from Map');
        });

        it('should render the close button with correct text', () => {
            const { container } = renderComponent();
            const closeText = container.querySelector('text.menu-close');
            expect(closeText).not.toBeNull();
            expect(closeText.textContent).toBe('✕');
        });

        it('should render the close button with correct position', () => {
            const { container } = renderComponent();
            const closeText = container.querySelector('text.menu-close');
            const expectedX = gridCenterX(2) + 10 + 108;
            const expectedY = gridCenterY(3) + 10 + 12;
            expect(Number(closeText.getAttribute('x'))).toBe(expectedX);
            expect(Number(closeText.getAttribute('y'))).toBe(expectedY);
        });

        it('should render menu option text with correct fill and fontSize', () => {
            const { container } = renderComponent();
            const optionText = container.querySelector('text.menu-option');
            expect(optionText.getAttribute('fill')).toBe('#ccc');
            expect(optionText.getAttribute('font-size')).toBe('11');
        });

        it('should render menu option text at correct x position', () => {
            const { container } = renderComponent();
            const optionText = container.querySelector('text.menu-option');
            const expectedX = gridCenterX(2) + 10 + 8;
            expect(Number(optionText.getAttribute('x'))).toBe(expectedX);
        });

        it('should render menu option text at correct y position', () => {
            const { container } = renderComponent();
            const optionText = container.querySelector('text.menu-option');
            const expectedY = gridCenterY(3) + 10 + 24;
            expect(Number(optionText.getAttribute('y'))).toBe(expectedY);
        });

        it('should render close text with fill #999 and fontSize 10', () => {
            const { container } = renderComponent();
            const closeText = container.querySelector('text.menu-close');
            expect(closeText.getAttribute('fill')).toBe('#999');
            expect(closeText.getAttribute('font-size')).toBe('10');
        });
    });

    describe('stop propagation on context menu click', () => {
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

    describe('remove player interaction', () => {
        it('should call handleRemovePlayer with player id when Remove from Map is clicked', () => {
            const handleRemovePlayer = vi.fn();
            const { container } = renderComponent({ handleRemovePlayer });
            const optionText = container.querySelector('text.menu-option');
            optionText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleRemovePlayer).toHaveBeenCalledWith('player-1');
        });

        it('should call handleRemovePlayer with correct id for different player', () => {
            const handleRemovePlayer = vi.fn();
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={makeSelectedPlayer({ id: 'player-42' })}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={handleRemovePlayer}
                        setSelectedPlayer={vi.fn()}
                    />
                </svg>
            );
            const optionText = container.querySelector('text.menu-option');
            optionText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(handleRemovePlayer).toHaveBeenCalledWith('player-42');
        });
    });

    describe('close interaction', () => {
        it('should call setSelectedPlayer with null when close button is clicked', () => {
            const setSelectedPlayer = vi.fn();
            const { container } = renderComponent({ setSelectedPlayer });
            const closeText = container.querySelector('text.menu-close');
            closeText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(setSelectedPlayer).toHaveBeenCalledWith(null);
        });

        it('should call setSelectedPlayer with null regardless of grid position', () => {
            const setSelectedPlayer = vi.fn();
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={makeSelectedPlayer({ gridX: 10, gridY: 15 })}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={vi.fn()}
                        setSelectedPlayer={setSelectedPlayer}
                    />
                </svg>
            );
            const closeText = container.querySelector('text.menu-close');
            closeText.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(setSelectedPlayer).toHaveBeenCalledWith(null);
        });
    });

    describe('different grid positions', () => {
        it('should render menu at grid position 0,0', () => {
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={makeSelectedPlayer({ gridX: 0, gridY: 0 })}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={vi.fn()}
                        setSelectedPlayer={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('x'))).toBe(gridCenterX(0) + 10);
            expect(Number(rect.getAttribute('y'))).toBe(gridCenterY(0) + 10);
        });

        it('should render menu at negative grid positions', () => {
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={makeSelectedPlayer({ gridX: -1, gridY: -2 })}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={vi.fn()}
                        setSelectedPlayer={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('x'))).toBe(gridCenterX(-1) + 10);
            expect(Number(rect.getAttribute('y'))).toBe(gridCenterY(-2) + 10);
        });

        it('should render menu at large grid positions', () => {
            const { container } = render(
                <svg>
                    <PlayerContextMenu
                        selectedPlayer={makeSelectedPlayer({ gridX: 50, gridY: 60 })}
                        gridCenterX={gridCenterX}
                        gridCenterY={gridCenterY}
                        handleRemovePlayer={vi.fn()}
                        setSelectedPlayer={vi.fn()}
                    />
                </svg>
            );
            const rect = container.querySelector('rect');
            expect(Number(rect.getAttribute('x'))).toBe(gridCenterX(50) + 10);
            expect(Number(rect.getAttribute('y'))).toBe(gridCenterY(60) + 10);
        });
    });

    describe('element counts', () => {
        it('should render exactly 1 rect element', () => {
            const { container } = renderComponent();
            const rects = container.querySelectorAll('rect');
            expect(rects.length).toBe(1);
        });

        it('should render exactly 2 text elements', () => {
            const { container } = renderComponent();
            const texts = container.querySelectorAll('text');
            expect(texts.length).toBe(2);
        });

        it('should render exactly 2 nested groups', () => {
            const { container } = renderComponent();
            const groups = container.querySelectorAll('g');
            expect(groups.length).toBe(2);
        });
    });
});
