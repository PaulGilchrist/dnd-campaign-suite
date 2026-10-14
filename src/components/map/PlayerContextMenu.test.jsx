import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PlayerContextMenu from './PlayerContextMenu';

const mockGridCenterX = (gx) => gx * 40 + 20;
const mockGridCenterY = (gy) => gy * 40 + 20;

const createMocks = () => ({
    handleRemovePlayer: vi.fn(),
    setSelectedPlayer: vi.fn(),
});

const defaultPlayer = { id: 'player-1', gridX: 1, gridY: 2 };

const defaultProps = (player = defaultPlayer) => ({
    selectedPlayer: player,
    gridCenterX: mockGridCenterX,
    gridCenterY: mockGridCenterY,
});

// ── Rendering ────────────────────────────────────────────────────

describe('PlayerContextMenu rendering', () => {
    it('renders nothing when selectedPlayer is falsy', () => {
        const { container } = render(
            <PlayerContextMenu
                selectedPlayer={null}
                gridCenterX={mockGridCenterX}
                gridCenterY={mockGridCenterY}
                handleRemovePlayer={vi.fn()}
                setSelectedPlayer={vi.fn()}
            />
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders the menu with remove option and close button when player is selected', () => {
        const mocks = createMocks();
        render(
            <PlayerContextMenu
                {...defaultProps()}
                handleRemovePlayer={mocks.handleRemovePlayer}
                setSelectedPlayer={mocks.setSelectedPlayer}
            />
        );
        expect(screen.getByText('Remove from Map')).toBeInTheDocument();
        expect(screen.getByText('✕')).toBeInTheDocument();
    });
});

// ── Event handlers ───────────────────────────────────────────────

describe('PlayerContextMenu event handlers', () => {
    it('calls handleRemovePlayer with the player id when "Remove from Map" is clicked', () => {
        const mocks = createMocks();
        render(
            <PlayerContextMenu
                {...defaultProps()}
                handleRemovePlayer={mocks.handleRemovePlayer}
                setSelectedPlayer={mocks.setSelectedPlayer}
            />
        );
        fireEvent.click(screen.getByText('Remove from Map'));
        expect(mocks.handleRemovePlayer).toHaveBeenCalledWith('player-1');
    });

    it('calls setSelectedPlayer with null when close (✕) is clicked', () => {
        const mocks = createMocks();
        render(
            <PlayerContextMenu
                {...defaultProps()}
                handleRemovePlayer={mocks.handleRemovePlayer}
                setSelectedPlayer={mocks.setSelectedPlayer}
            />
        );
        fireEvent.click(screen.getByText('✕'));
        expect(mocks.setSelectedPlayer).toHaveBeenCalledWith(null);
    });
});
