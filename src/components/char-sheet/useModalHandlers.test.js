// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useModalHandlers from './useModalHandlers.js';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
    applyConstellationOption: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/bonusAttacksHandler.js', () => ({
    applyFlurryOfBlows: vi.fn(),
}));

import { rollExpression } from '../../services/dice/diceRoller.js';
import { getCombatContext } from '../../services/rules/combat/damageUtils.js';
import { getDistanceFeet } from '../../services/rules/combat/rangeValidation.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

function createDeps(overrides = {}) {
    const playerStats = {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        ...overrides.playerStats,
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
        setModalState: vi.fn((fn) => {
            if (typeof fn === 'function') {
                return fn(modalState);
            }
            Object.assign(modalState, fn);
        }),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

describe('useModalHandlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getRuntimeValue.mockReturnValue(null);
        setRuntimeValue.mockReturnValue(undefined);
        getCurrentCombatRound.mockReturnValue(1);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getCombatContext.mockResolvedValue(null);
        getDistanceFeet.mockReturnValue(5);
        globalThis.Math.random = () => 20;
    });

    describe('handleMasteryClose', () => {
        it('closes weapon mastery modal and proceeds with pending damage when no cleave effect', async () => {
            const deps = createDeps({
                pendingDamage: {
                    attack: { name: 'Longsword' },
                    formula: '1d8+3',
                    total: 10,
                    rolls: [5, 5],
                    modifier: 3,
                },
                setRuntimeValue: vi.fn(),
            });
            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.setModalState).toHaveBeenCalledWith({ weaponMasteryModal: null });
            expect(deps.proceedWithDamage).toHaveBeenCalledWith(
                { name: 'Longsword' },
                '1d8+3',
                10,
                [5, 5],
                3
            );
            expect(deps.setPendingDamage).toHaveBeenCalledWith(null);
        });



        it('does nothing when there is no pending damage', async () => {
            const deps = createDeps();
            const { handleMasteryClose } = useModalHandlers(deps);
            await handleMasteryClose();
            expect(deps.setModalState).toHaveBeenCalledWith({ weaponMasteryModal: null });
            expect(deps.proceedWithDamage).not.toHaveBeenCalled();
        });
    });


});
