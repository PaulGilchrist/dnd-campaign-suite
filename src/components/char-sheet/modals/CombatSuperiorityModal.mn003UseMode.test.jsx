// MN-003 lane: with maneuvers known the modal must render the USE flow (radio list
// incl. the Grant Attack group) instead of being pinned to Select-View — the
// dispatcher now passes selectionMode=false when known > 0 (known < all used to
// pin it true forever). "Use Maneuver" must pick Commander's Strike single-use.
//
// Ownership map (siblings own the rest — do NOT re-test here):
// .test.jsx ........... selection/use happy paths, radio check/uncheck cycling,
//                       use-with-no-selection disabled, Select-View header/groups/checkboxes
//                       (the old mn003 "selectionMode=true still renders Select-View" case
//                       is identical to its first test — deleted here, owned there).
// .runtime.test.jsx ... superiority-dice resolution (getRuntimeValue / _trackedResources
//                       fallback), no-dice notice.
// .triggers.test.jsx .. trigger predicates, MN-014 hints ("to replace an attack" owned
//                       there), prompt headers, onReopenSelection, use-reject half.
// .edge-cases ......... payload null/undefined, overlay containment, group order,
//                       duplicates, intersection cardinality, and the applied-result swap
//                       after a use that resolves a TRUTHY result.
//
// This lane owns:
//  - use-mode reachability: selectionMode=false + known > 0 → UseView (exact use header,
//    no checkboxes, Grant Attack group heading, exact visible radio set — attack_rider
//    known maneuvers suppressed from the use list by shouldShowUseGroup)
//  - Grant Attack single-use confirm: exact payload onConfirm(null, name), and the
//    disabled→enabled transition of Use Maneuver as observable UI
//  - the null-resolve half of the state machine the edge-cases header flags as ours:
//    when the dispatcher resolves null, the `applied && result` guard keeps the modal
//    in UseView (no Done button) — the truthy-result swap lives in edge-cases.
//
// Conventions: fresh vi.fn + fresh fixture arrays per makeProps call; afterEach
// mockReset (not clearAllMocks) on the module-mocked getRuntimeValue; findBy idiom
// for the post-confirm flush; role-scoped queries; no style-attribute selectors.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CombatSuperiorityModal from './CombatSuperiorityModal.jsx';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => 6),
}));

afterEach(() => {
    vi.mocked(getRuntimeValue).mockReset().mockReturnValue(6);
});

function makeProps(payloadOverrides = {}, propOverrides = {}) {
    return {
        payload: {
            allManeuvers: [
                { name: 'Trip Attack', actionType: 'attack_rider' },
                { name: 'Rally', actionType: 'bonus_action' },
                { name: 'Bait and Switch', actionType: 'movement' },
                { name: "Commander's Strike", actionType: 'grant_attack', trigger: 'replace_attack' },
            ],
            knownManeuvers: ["Commander's Strike", 'Rally', 'Bait and Switch'],
            maxOptions: 9,
            selectionMode: false,
            playerStats: { name: 'EvasiveFighter', _trackedResources: { superiorityDice: { current: 6 } } },
            ...payloadOverrides,
        },
        onConfirm: vi.fn().mockResolvedValue(null),
        onClose: vi.fn(),
        ...propOverrides,
    };
}

function renderModal(payloadOverrides = {}, propOverrides = {}) {
    return render(<CombatSuperiorityModal {...makeProps(payloadOverrides, propOverrides)} />);
}

describe('CombatSuperiorityModal — MN-003 use-mode reachability', () => {
    it('renders the use flow with a Grant Attack group, not the checkbox Select-View, when selectionMode is false', () => {
        renderModal();
        expect(screen.getByText('Combat Superiority — Choose Maneuver')).toBeInTheDocument();
        expect(screen.queryByText(/Select Maneuvers/)).not.toBeInTheDocument();
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Manage Maneuvers/ })).toBeInTheDocument();

        // Grant Attack reaches the use list only via the MN-003 fix.
        expect(screen.getByRole('heading', { name: 'Grant Attack' })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Commander's Strike/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Rally/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /Bait and Switch/ })).toBeInTheDocument();
        // Known-but-attack_rider (Trip Attack is unknown here AND riders are
        // suppressed from the non-prompt use list by shouldShowUseGroup).
        expect(screen.queryByText('Trip Attack')).not.toBeInTheDocument();
        expect(screen.queryAllByRole('radio')).toHaveLength(3);
    });

    it('confirms Commander\'s Strike single-use and stays in UseView when the dispatcher resolves null', async () => {
        const onConfirm = vi.fn().mockResolvedValue(null);
        renderModal({}, { onConfirm });

        const strike = screen.getByRole('radio', { name: /Commander's Strike/ });
        const useBtn = screen.getByRole('button', { name: /Use Maneuver/ });
        expect(useBtn).toBeDisabled();

        fireEvent.click(strike);
        expect(strike).toBeChecked();
        expect(screen.getByRole('button', { name: /Use Maneuver/ })).toBeEnabled();

        fireEvent.click(useBtn);
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onConfirm).toHaveBeenCalledWith(null, "Commander's Strike");

        // Null-resolve half of the state machine: the applied swap requires a truthy
        // result (edge-cases owns that half), so the use list survives the flush.
        expect(await screen.findByRole('radio', { name: /Commander's Strike/ })).toBeChecked();
        expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    });
});
