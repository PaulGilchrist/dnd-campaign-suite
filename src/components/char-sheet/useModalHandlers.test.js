// @improved-by-ai
// @cleaned-by-ai
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
    const modalState = {};
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

describe('useModalHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleMasteryClose', () => {
        it('clears the weapon mastery modal, proceeds with pending damage, and resets pending damage', async () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Longsword' },
                    formula: '1d8+3',
                    total: 10,
                    rolls: [5, 5],
                    modifier: 3,
                },
            });
            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.setModalState).toHaveBeenCalledWith({ weaponMasteryModal: null });
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: { name: 'Longsword' },
                formula: '1d8+3',
                total: 10,
                rolls: [5, 5],
                modifier: 3,
            });
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
        });

        it('clears the weapon mastery modal even when there is no pending damage', async () => {
            const deps = createDeps();
            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.setModalState).toHaveBeenCalledWith({ weaponMasteryModal: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
            expect(deps.setPendingDamage).not.toHaveBeenCalled();
        });

        it('passes the correct attack object reference to proceedWithDamage', async () => {
            const attack = { name: 'Greatsword', damageType: 'slashing' };
            const deps = createDeps({
                pendingDamage: {
                    attack,
                    formula: '2d6+3',
                    total: 12,
                    rolls: [6, 6],
                    modifier: 3,
                },
            });
            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.proceedWithDamage).toHaveBeenCalledWith({
                attack: attack,
                formula: '2d6+3',
                total: 12,
                rolls: [6, 6],
                modifier: 3,
            });
        });
    });
});
