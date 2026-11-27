// @maintained-by-ai 2026-11-26
// OWNED here: player-menu content census + the Remove/✕ dispatch seam at unit
// level. Cited to sibling lanes (do not re-cover here): open/anchor bytes and
// canvas close wiring → Map-handlers.test.jsx; Light row cycle/labels →
// PlayerContextMenu.light.test.jsx; section gating, cosmetics writes,
// keyboard + Escape → PlayerContextMenu.cosmetics.test.jsx.
// The removal confirm is no longer asked in the menu (nor natively): clicking
// hands the id to handleRemovePlayer, which arms the shared named-modal at the
// Map level (dialog copy: see DeleteFromMapModal.test.jsx).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerContextMenu from './PlayerContextMenu';

const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;
const defaultPlayer = { id: 'player-1', name: 'FeyRanger', gridX: 1, gridY: 2 };

const defaultProps = (overrides = {}) => ({
    selectedPlayer: defaultPlayer,
    players: [defaultPlayer],
    gridCenterX,
    gridCenterY,
    handleRemovePlayer: vi.fn(),
    handleCyclePlayerLight: vi.fn(),
    setSelectedPlayer: vi.fn(),
    ...overrides,
});

describe('PlayerContextMenu', () => {
    // Spy only to prove the menu seam never falls back to a native dialog.
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

    it('offers the Remove row and the close button', () => {
        render(<PlayerContextMenu {...defaultProps()} />);
        expect(screen.getByText('Remove from Map')).toBeInTheDocument();
        expect(screen.getByText('✕')).toBeInTheDocument();
    });

    it('Remove press hands the id to handleRemovePlayer and closes — no native confirm, no light dispatch', () => {
        const handleRemovePlayer = vi.fn();
        const handleCyclePlayerLight = vi.fn();
        const setSelectedPlayer = vi.fn();
        render(
            <PlayerContextMenu
                {...defaultProps({ handleRemovePlayer, handleCyclePlayerLight, setSelectedPlayer })}
            />
        );
        fireEvent.click(screen.getByText('Remove from Map'));
        expect(handleRemovePlayer).toHaveBeenCalledWith('player-1');
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
        expect(handleCyclePlayerLight).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('close (✕) press dismisses via setSelectedPlayer(null) with zero writes', () => {
        const handleRemovePlayer = vi.fn();
        const setSelectedPlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ handleRemovePlayer, setSelectedPlayer })} />);
        fireEvent.click(screen.getByText('✕'));
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
        expect(handleRemovePlayer).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
    });
});
