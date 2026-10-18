// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

// Minimal deps by runtime probe: handleWeaponMasteryChoice (source:26-28) and
// handleWeaponKindMasteryClose (source:200-202) are single-key modal clears that
// reference nothing but setModalState, so every other injected collaborator,
// playerStats fixture, and the setState-merge mock are purged from these tests.
// Exact-match assertions on the recorded payload pin the full key set, proving
// cross-key isolation (these clears never clobber the other mastery modal).

describe('useModalHandlers - simple modal handlers', () => {
    it('handleWeaponMasteryChoice clears only weaponMasteryChoiceModal, ignoring the mastery name', () => {
        const setModalState = vi.fn();
        const { handleWeaponMasteryChoice } = useModalHandlers({ setModalState });

        handleWeaponMasteryChoice('Crushing');
        handleWeaponMasteryChoice('Sweeping');

        expect(setModalState.mock.calls).toEqual([
            [{ weaponMasteryChoiceModal: null }],
            [{ weaponMasteryChoiceModal: null }],
        ]);
    });

    it('handleWeaponKindMasteryClose clears only weaponKindMasteryModal', () => {
        const setModalState = vi.fn();
        const { handleWeaponKindMasteryClose } = useModalHandlers({ setModalState });

        handleWeaponKindMasteryClose();

        expect(setModalState.mock.calls).toEqual([
            [{ weaponKindMasteryModal: null }],
        ]);
    });
});
