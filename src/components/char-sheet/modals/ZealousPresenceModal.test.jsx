import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ZealousPresenceModal from './ZealousPresenceModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockTargets = [
    { name: 'Ally1', type: 'player', currentHp: 20, maxHp: 30 },
    { name: 'NPC1', type: 'npc', currentHp: 10, maxHp: 20 },
];

const defaultProps = {
    targets: mockTargets,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
};

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ZealousPresenceModal', () => {
    // ZealousPresenceModal is a thin wrapper around CreatureSelectionModal.
    // This file tests only the hardcoded configuration that distinguishes it.
    // All selection/interaction behavior is covered by
    // CreatureSelectionModal.test.jsx — testing it again here would be redundant.

    it('renders with the correct hardcoded props (title, icon, description, confirm label)', () => {
        render(<ZealousPresenceModal {...defaultProps} />);
        expect(screen.getByText('Zealous Presence')).toBeInTheDocument();
        expect(screen.getByText(/Choose creatures to grant Advantage on attack rolls/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Grant Advantage/ })).toBeInTheDocument();
    });
});
