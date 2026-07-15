// @cleaned-by-ai
// AllySelectionModal is a thin pass-through wrapper around
// CreatureSelectionModal. It passes hardcoded title, icon, description,
// and confirmLabel props — no logic of its own.
//
// All behavioral coverage is provided by
// shared/CreatureSelectionModal.test.jsx which tests the shared
// component directly. Testing the wrapper by asserting on the shared
// component's DOM internals would be brittle and redundant.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AllySelectionModal from './AllySelectionModal.jsx';

const mockOnConfirm = vi.fn();
const mockOnSkip = vi.fn();

const mockTargets = [
    { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10 },
    { name: 'Player Character', type: 'player', currentHp: 20, maxHp: 30 },
];

describe('AllySelectionModal', () => {
    it('renders without crashing', () => {
        render(
            <AllySelectionModal
                creatureTargets={mockTargets}
                onConfirm={mockOnConfirm}
                onSkip={mockOnSkip}
            />
        );
        expect(screen.getByText('Select Allies')).toBeInTheDocument();
    });
});
