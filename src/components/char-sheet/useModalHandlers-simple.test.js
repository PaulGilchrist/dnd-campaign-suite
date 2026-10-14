import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        ...(overrides.playerStats || {}),
    };
    const modalState = {
        ...(overrides.modalState || {}),
    };
    return {
        playerStats,
        campaignName: 'test-campaign',
        rollDamage: vi.fn(),
        proceedWithDamage: vi.fn(),
        pendingDamage: null,
        setPendingDamage: vi.fn(),
        modalState,
        setModalState: vi.fn((updates) => {
            if (typeof updates === 'function') {
                return updates(modalState);
            }
            Object.assign(modalState, updates);
        }),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers - simple modal handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleWeaponMasteryChoice', () => {
        it('clears the weapon mastery choice modal', () => {
            const deps = createDeps();
            const { handleWeaponMasteryChoice } = useModalHandlers(deps);
            handleWeaponMasteryChoice('Crushing');
            expect(deps.setModalState).toHaveBeenCalledWith({ weaponMasteryChoiceModal: null });
        });

        it('ignores the mastery name argument with no side effects', () => {
            const deps = createDeps();
            const { handleWeaponMasteryChoice } = useModalHandlers(deps);
            handleWeaponMasteryChoice('Sweeping');
            expect(deps.setModalState).toHaveBeenCalledTimes(1);
        });
    });

    describe('handleWeaponKindMasteryClose', () => {
        it('clears the weapon kind mastery modal', () => {
            const deps = createDeps();
            const { handleWeaponKindMasteryClose } = useModalHandlers(deps);
            handleWeaponKindMasteryClose();
            expect(deps.setModalState).toHaveBeenCalledWith({ weaponKindMasteryModal: null });
        });
    });
});
