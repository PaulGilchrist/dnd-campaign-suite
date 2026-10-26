// @maintained-by-ai: 2026-10-26
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerContextMenu from './PlayerContextMenu';

const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;
const defaultPlayer = { id: 'player-1', name: 'FeyRanger', gridX: 1, gridY: 2 };

const defaultProps = (overrides = {}) => ({
    selectedPlayer: defaultPlayer,
    gridCenterX,
    gridCenterY,
    handleRemovePlayer: vi.fn(),
    setSelectedPlayer: vi.fn(),
    ...overrides,
});

describe('PlayerContextMenu', () => {
    // "Remove from Map" rides a named native confirm (house pattern, mirrors the
    // placed-item lane in usePlacedItems.js). Accept by default; the cancel-leg
    // test overrides to false.
    let confirmSpy;
    beforeEach(() => {
        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    });
    afterEach(() => {
        confirmSpy.mockRestore();
    });

    it('renders nothing when selectedPlayer is falsy', () => {
        const { container } = render(
            <PlayerContextMenu {...defaultProps({ selectedPlayer: null })} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders remove option and close button, positioned near the player', () => {
        const { container } = render(<PlayerContextMenu {...defaultProps()} />);
        expect(screen.getByText('Remove from Map')).toBeInTheDocument();
        expect(screen.getByText('✕')).toBeInTheDocument();
        const rect = container.querySelector('.item-context-menu rect');
        expect(rect).toBeInTheDocument();
        expect(rect.getAttribute('x')).toBe(String(gridCenterX(defaultPlayer.gridX) + 10));
        expect(rect.getAttribute('y')).toBe(String(gridCenterY(defaultPlayer.gridY) + 10));
    });

    it('asks a named confirm and calls handleRemovePlayer with the player id when accepted', () => {
        const handleRemovePlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ handleRemovePlayer })} />);
        fireEvent.click(screen.getByText('Remove from Map'));
        expect(confirmSpy).toHaveBeenCalledWith('Remove "FeyRanger" from the map?');
        expect(handleRemovePlayer).toHaveBeenCalledWith('player-1');
    });

    it('labels the confirm with the id when the player has no name', () => {
        const handleRemovePlayer = vi.fn();
        render(
            <PlayerContextMenu
                {...defaultProps({
                    handleRemovePlayer,
                    selectedPlayer: { id: 'player-9', gridX: 3, gridY: 4 },
                })}
            />
        );
        fireEvent.click(screen.getByText('Remove from Map'));
        expect(confirmSpy).toHaveBeenCalledWith('Remove "player-9" from the map?');
        expect(handleRemovePlayer).toHaveBeenCalledWith('player-9');
    });

    it('is fully inert on cancel: no removal call, but the menu still closes', () => {
        confirmSpy.mockReturnValue(false);
        const handleRemovePlayer = vi.fn();
        const setSelectedPlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ handleRemovePlayer, setSelectedPlayer })} />);
        fireEvent.click(screen.getByText('Remove from Map'));
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(handleRemovePlayer).not.toHaveBeenCalled();
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
    });

    it('calls setSelectedPlayer with null when close (✕) is clicked', () => {
        const setSelectedPlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ setSelectedPlayer })} />);
        fireEvent.click(screen.getByText('✕'));
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
    });
});
