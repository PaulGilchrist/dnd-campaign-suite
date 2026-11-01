// @maintained-by-ai: 2026-11-01 (AZ2 improve: the native window.confirm here
// became the in-app named modal — the menu now only hands off + closes; the
// `Remove "<name>" from the map?` dialog is owned by the parent lane, see
// Map-handlers.test.jsx and DeleteFromMapModal.test.jsx.)
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
    // The removal confirm is no longer asked HERE (nor natively): clicking
    // hands the id to handleRemovePlayer, which arms the shared named-modal at
    // the Map level. This spy proves the menu seam never falls back to a
    // native dialog.
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

    it('hands the id to handleRemovePlayer and closes the menu — no native confirm', () => {
        const handleRemovePlayer = vi.fn();
        const setSelectedPlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ handleRemovePlayer, setSelectedPlayer })} />);
        fireEvent.click(screen.getByText('Remove from Map'));
        expect(handleRemovePlayer).toHaveBeenCalledWith('player-1');
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('hands off the raw id even when the player has no name (dialog copy resolves it)', () => {
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
        expect(handleRemovePlayer).toHaveBeenCalledWith('player-9');
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('calls setSelectedPlayer with null when close (✕) is clicked', () => {
        const setSelectedPlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ setSelectedPlayer })} />);
        fireEvent.click(screen.getByText('✕'));
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
    });
});
