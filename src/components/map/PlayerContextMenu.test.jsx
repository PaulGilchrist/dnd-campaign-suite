// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerContextMenu from './PlayerContextMenu';

const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;
const defaultPlayer = { id: 'player-1', gridX: 1, gridY: 2 };

const defaultProps = (overrides = {}) => ({
    selectedPlayer: defaultPlayer,
    gridCenterX,
    gridCenterY,
    handleRemovePlayer: vi.fn(),
    setSelectedPlayer: vi.fn(),
    ...overrides,
});

describe('PlayerContextMenu', () => {
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

    it('calls handleRemovePlayer with the player id when "Remove from Map" is clicked', () => {
        const handleRemovePlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ handleRemovePlayer })} />);
        fireEvent.click(screen.getByText('Remove from Map'));
        expect(handleRemovePlayer).toHaveBeenCalledWith('player-1');
    });

    it('calls setSelectedPlayer with null when close (✕) is clicked', () => {
        const setSelectedPlayer = vi.fn();
        render(<PlayerContextMenu {...defaultProps({ setSelectedPlayer })} />);
        fireEvent.click(screen.getByText('✕'));
        expect(setSelectedPlayer).toHaveBeenCalledWith(null);
    });
});
