// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: {
        getName: vi.fn((n) => n || 'Unknown'),
        guid: vi.fn(() => 'test-guid-1234'),
    },
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    findCreatureByName: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
    clearReTriggeredSequence: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    clearAllExpirationEffects: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    isUnbreakableMajestyActive: vi.fn(),
    getUnbreakableMajestySaveDc: vi.fn(),
    hasAttackerTriggeredMajesty: vi.fn(),
    markAttackerTriggeredMajesty: vi.fn(),
}));

vi.mock('../../services/rules/spells/postCastRiderService.js', () => ({
    getEmpoweredEvocationFeatures: vi.fn(() => []),
    getEmpoweredEvocationIntModifier: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    collectWeaponMastery: vi.fn(),
    hasGreatWeaponFighting: vi.fn(),
    applyGreatWeaponFightingToDamage: vi.fn((rolls) => rolls),
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import { addEntry } from '../../services/ui/logService.js';

describe('createLogAndShow - Living Legend & Veer', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        characters: [{ name: 'Goblin', computedStats: { armorClass: 12 } }],
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        autoDamageSourceRef: { current: null },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        rollD20.mockReturnValue(15);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0 });
        getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
        loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
        isUnbreakableMajestyActive.mockReturnValue(false);
        hasAttackerTriggeredMajesty.mockReturnValue(false);
        getRuntimeValue.mockReturnValue(null);
        getShieldAcBonus.mockReturnValue(0);
        getShieldOfFaithAcBonus.mockReturnValue(0);
        applyMinDamageAdjustment.mockImplementation((d) => d);
        utils.getName.mockImplementation((n) => n);
    });

    function createFn() {
        return createLogAndShow(deps);
    }

    describe('living legend / unerring strike', () => {
        it('retries hit when livingLegendActive and unerringStrikeUsed is false', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'livingLegendActive') return true;
                if (name === 'TestFighter' && prop === 'unerringStrikeUsed') return false;
                return null;
            });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'unerringStrikeUsed', true, 'test-campaign');
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: true,
                unerringStrikeApplied: true,
            }));
        });

        it('does not retry when livingLegendActive is false', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            getRuntimeValue.mockReturnValue(null);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
            }));
        });

        it('does not retry when isWeaponAttack is false', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'livingLegendActive') return true;
                if (name === 'TestFighter' && prop === 'unerringStrikeUsed') return false;
                return null;
            });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: false });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                hit: false,
            }));
        });

        it('logs Unerring Strike to campaign log when converting miss to hit', async () => {
            rollD20.mockReturnValueOnce(5);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 20 });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'livingLegendActive') return true;
                if (name === 'TestFighter' && prop === 'unerringStrikeUsed') return false;
                return null;
            });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isWeaponAttack: true });
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Living Legend',
                description: expect.stringContaining('Unerring Strike'),
                timestamp: expect.any(Number),
            }));
        });
    });

    describe('veer (mounted creature redirect)', () => {
        it('checks veer when target is mounted and veerActive', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Mount', ac: 12 });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'Mount' && prop === 'mountedBy') return 'Rider';
                if (name === 'Rider' && prop === 'veerActive') return true;
                if (name === 'Rider' && prop === 'activeConditions') return [];
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Mount', type: 'npc', ac: 12, conditions: [] }],
            });
            const origSetTimeout = globalThis.setTimeout;
            globalThis.setTimeout = (cb) => { cb(); return 0; };
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Mount' });
            globalThis.setTimeout = origSetTimeout;
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
                characterName: 'Rider',
            }));
            expect(setRuntimeValue).toHaveBeenCalledWith('Rider', 'veerActive', null, 'test-campaign');
        });

        it('does not trigger veer when mount or rider is incapacitated', async () => {
            const scenarios = [
                {
                    name: 'mount is incapacitated',
                    setup: () => {
                        getTargetFromAttacker.mockReturnValue({ name: 'Mount', ac: 12 });
                        getRuntimeValue.mockImplementation((name, prop) => {
                            if (name === 'Mount' && prop === 'mountedBy') return 'Rider';
                            if (name === 'Rider' && prop === 'veerActive') return true;
                            if (name === 'Rider' && prop === 'activeConditions') return [];
                            return null;
                        });
                        loadCombatSummary.mockResolvedValue({
                            creatures: [{ name: 'Mount', type: 'npc', ac: 12, conditions: [{ key: 'incapacitated' }] }],
                        });
                    },
                },
                {
                    name: 'rider is incapacitated',
                    setup: () => {
                        getTargetFromAttacker.mockReturnValue({ name: 'Mount', ac: 12 });
                        getRuntimeValue.mockImplementation((name, prop) => {
                            if (name === 'Mount' && prop === 'mountedBy') return 'Rider';
                            if (name === 'Rider' && prop === 'veerActive') return true;
                            if (name === 'Rider' && prop === 'activeConditions') return [{ key: 'incapacitated' }];
                            return null;
                        });
                        loadCombatSummary.mockResolvedValue({
                            creatures: [{ name: 'Mount', type: 'npc', ac: 12, conditions: [] }],
                        });
                    },
                },
            ];

            for (const scenario of scenarios) {
                vi.clearAllMocks();
                rollD20.mockReturnValue(15);
                getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
                loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'npc', ac: 12 }] });
                isUnbreakableMajestyActive.mockReturnValue(false);
                hasAttackerTriggeredMajesty.mockReturnValue(false);
                getRuntimeValue.mockReturnValue(null);
                getShieldAcBonus.mockReturnValue(0);
                getShieldOfFaithAcBonus.mockReturnValue(0);

                scenario.setup();
                const origSetTimeout = globalThis.setTimeout;
                globalThis.setTimeout = (cb) => { cb(); return 0; };
                const fn = createFn();
                await fn('Longsword', 5, 'attack', { targetName: 'Mount' });
                globalThis.setTimeout = origSetTimeout;
                expect(deps.logEntry).not.toHaveBeenCalledWith(expect.objectContaining({
                    abilityName: 'Veer',
                }));
            }
        });

        it('logs veer declined when rider confirms false (redirectResult=false)', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Mount', ac: 12 });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'Mount' && prop === 'mountedBy') return 'Rider';
                if (name === 'Rider' && prop === 'veerActive') return true;
                if (name === 'Rider' && prop === 'activeConditions') return [];
                return null;
            });
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'Mount', type: 'npc', ac: 12, conditions: [] }],
            });
            vi.useFakeTimers();
            const fn = createFn();
            const promise = fn('Longsword', 5, 'attack', { targetName: 'Mount' });
            await vi.advanceTimersByTimeAsync(1);
            window.dispatchEvent(new CustomEvent('veer-confirm', {
                detail: { promptId: 'veer-Mount', confirm: false },
            }));
            await promise;
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                abilityName: 'Veer',
                description: expect.stringContaining('declined to use Veer'),
            }));
            vi.useRealTimers();
        });
    });
});
