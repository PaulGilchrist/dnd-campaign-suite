// MN-003: with maneuvers known the modal must render the USE flow (radio list
// incl. the Grant Attack group) instead of being pinned to Select-View — the
// dispatcher now passes selectionMode=false when known > 0 (known < all used to
// pin it true forever). "Use Maneuver" must pick Commander's Strike single-use.
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 6),
}));

const ALL = [
    { name: 'Trip Attack', actionType: 'attack_rider' },
    { name: 'Rally', actionType: 'bonus_action' },
    { name: 'Bait and Switch', actionType: 'movement' },
    { name: "Commander's Strike", actionType: 'grant_attack', trigger: 'replace_attack' },
];

function renderUseMode(onConfirm = vi.fn().mockResolvedValue(null)) {
    const utils = render(
        <CombatSuperiorityModal
            payload={{
                allManeuvers: ALL,
                knownManeuvers: ["Commander's Strike", 'Rally', 'Bait and Switch'],
                maxOptions: 9,
                selectionMode: false,
                playerStats: { name: 'EvasiveFighter', _trackedResources: { superiorityDice: { current: 6 } } },
            }}
            onConfirm={onConfirm}
            onClose={vi.fn()}
        />
    );
    return { ...utils, onConfirm };
}

describe('CombatSuperiorityModal — MN-003 use-mode reachability', () => {
    it('renders the UseView with a Grant Attack group when selectionMode is false', () => {
        renderUseMode();
        expect(screen.queryByText(/Select Maneuvers/)).not.toBeInTheDocument();
        expect(screen.getByText('Grant Attack')).toBeInTheDocument();
        expect(screen.getByText("Commander's Strike")).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Use Maneuver/i })).toBeInTheDocument();
    });

    it('selecting Commander\'s Strike and pressing Use Maneuver confirms it single-use', () => {
        const { onConfirm } = renderUseMode();
        fireEvent.click(screen.getByText("Commander's Strike"));
        fireEvent.click(screen.getByRole('button', { name: /Use Maneuver/i }));
        expect(onConfirm).toHaveBeenCalledWith(null, "Commander's Strike");
    });

    it('selectionMode=true still renders the checkbox Select-View', () => {
        render(
            <CombatSuperiorityModal
                payload={{
                    allManeuvers: ALL,
                    knownManeuvers: [],
                    maxOptions: 9,
                    selectionMode: true,
                    playerStats: { name: 'EvasiveFighter' },
                }}
                onConfirm={vi.fn()}
                onClose={vi.fn()}
            />
        );
        expect(screen.getByText(/Select Maneuvers/)).toBeInTheDocument();
    });
});
