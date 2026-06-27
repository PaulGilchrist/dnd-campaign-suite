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
    findCreatureByName: vi.fn(() => null),
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
}));

vi.mock('./loggedDiceRollUtils.js', () => ({
    dispatchUnbreakableMajestySave: vi.fn(),
    hasPotentCantrip: vi.fn(),
    getShieldAcBonus: vi.fn(),
    getShieldOfFaithAcBonus: vi.fn(),
    applyMinDamageAdjustment: vi.fn((d) => d),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadManeuvers: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';
import utils from '../../services/ui/utils.js';
import { getTargetFromAttacker } from '../../services/rules/combat/damageUtils.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { loadCombatSummary } from '../../services/encounters/combatData.js';
import {
    getShieldAcBonus,
    getShieldOfFaithAcBonus,
    applyMinDamageAdjustment,
} from './loggedDiceRollUtils.js';
import { createLogAndShow } from './useLoggedDiceRollAttack.js';
import {
    isUnbreakableMajestyActive,
    hasAttackerTriggeredMajesty,
} from '../../services/combat/auras/unbreakableMajesty.js';

describe('createLogAndShow - Initiative, Save, Check, Storage', () => {
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
        getTargetFromAttacker.mockReturnValue(null);
        loadCombatSummary.mockResolvedValue({ creatures: [] });
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

    describe('initiative - creature update & event dispatch', () => {
        it('updates creature initiative in combat summary and sorts', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [
                    { name: 'Goblin', type: 'player', initiative: '5' },
                    { name: 'TestFighter', type: 'player', initiative: '3' },
                ],
            });
            const fn = createFn();
            await fn('Initiative', 3, 'initiative', {});
            const combatSummary = await loadCombatSummary('test-campaign');
            const fighterCreature = combatSummary.creatures.find(c => c.name === 'TestFighter');
            expect(fighterCreature.initiative).toBe('18');
        });

        it('dispatches initiative-rolled custom event', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player', initiative: '0' }],
            });
            const events = [];
            window.addEventListener('initiative-rolled', (e) => events.push(e), { once: true });
            const fn = createFn();
            await fn('Initiative', 3, 'initiative', {});
            expect(events.length).toBe(1);
            expect(events[0].detail.characterName).toBe('TestFighter');
            expect(events[0].detail.roll).toBe(18);
        });

        it('resets tandemFootworkBonus to 0 if > 0 on initiative', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player', initiative: '0' }],
            });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'tandemFootworkBonus') return 2;
                return null;
            });
            const fn = createFn();
            await fn('Initiative', 3, 'initiative', {});
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'tandemFootworkBonus', 0, 'test-campaign');
        });

        it('uses totalBonus (bonus + tandemFtBonus) for initiative total', async () => {
            loadCombatSummary.mockResolvedValue({
                creatures: [{ name: 'TestFighter', type: 'player', initiative: '0' }],
            });
            getRuntimeValue.mockImplementation((name, prop) => {
                if (name === 'TestFighter' && prop === 'tandemFootworkBonus') return 2;
                return null;
            });
            const fn = createFn();
            await fn('Initiative', 3, 'initiative', {});
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                bonus: 5,
            }));
        });
    });

    describe('save roll type - storage', () => {
        it('stores lastSaveRoll runtime value', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Constitution', 3, 'save', {
                saveType: 'CON',
                saveDc: 15,
            });
            const saveRollCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastSaveRoll'
            );
            expect(saveRollCalls.length).toBeGreaterThan(0);
            expect(saveRollCalls[0][2]).toMatchObject({
                saveType: 'CON',
            });
        });

        it('stores _lastRollContext for save with oldTotal and oldSuccess', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Constitution', 3, 'save', {
                saveType: 'CON',
                saveDc: 15,
            });
            const contextCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_lastRollContext'
            );
            expect(contextCalls[0][2]).toMatchObject({
                type: 'save',
                saveType: 'CON',
                saveDc: 15,
                oldTotal: 18,
            });
        });

        it('handles save with no saveDc (null)', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Constitution', 3, 'save', {
                saveType: 'CON',
            });
            const saveRollCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastSaveRoll'
            );
            expect(saveRollCalls.length).toBeGreaterThan(0);
            expect(saveRollCalls[0][2]).toMatchObject({
                saveType: 'CON',
            });
        });
    });

    describe('ability check roll type', () => {
        it('stores lastAbilityCheck runtime value', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Athletics', 5, 'check', {});
            const checkRollCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAbilityCheck'
            );
            expect(checkRollCalls.length).toBeGreaterThan(0);
            expect(checkRollCalls[0][2]).toMatchObject({
                checkName: 'Athletics',
            });
        });

        it('uses reliableTalent to floor d20 at 10 for checks', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            rollD20.mockReturnValueOnce(5);
            const fn = createFn();
            await fn('Athletics', 5, 'check', { reliableTalent: true });
            const checkRollCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAbilityCheck'
            );
            expect(checkRollCalls.length).toBeGreaterThan(0);
            expect(checkRollCalls[0][2]).toMatchObject({
                d20: 10,
            });
        });

        it('stores _lastRollContext for check type', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            const fn = createFn();
            await fn('Stealth', 4, 'skill', {});
            const contextCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_lastRollContext'
            );
            expect(contextCalls[0][2]).toMatchObject({
                type: 'check',
                checkName: 'Stealth',
            });
        });
    });

    describe('last attack roll storage', () => {
        it('stores lastAttackRoll on attack type', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            const lastAttackCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'lastAttackRoll'
            );
            expect(lastAttackCalls[0][2]).toMatchObject({
                d20: 15,
                bonus: 5,
                targetName: 'Goblin',
                hit: true,
                isCrit: false,
            });
        });

        it('stores _lastRollContext for attack type', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            const contextCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === '_lastRollContext'
            );
            expect(contextCalls[0][2]).toMatchObject({
                type: 'attack',
                attackName: 'Longsword',
            });
        });

        it('stores pendingCombatSuperiorityPrompt for attack type', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            const promptCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'pendingCombatSuperiorityPrompt'
            );
            expect(promptCalls[0][2]).toMatchObject({
                rollType: 'attack',
            });
        });

        it('stores pendingCombatSuperiorityPrompt with melee weaponType', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin' });
            const promptCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'pendingCombatSuperiorityPrompt'
            );
            expect(promptCalls[0][2].attackContext.weaponType).toBe('melee');
        });

        it('stores pendingCombatSuperiorityPrompt with ranged weaponType when damageType is ranged', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longbow', 5, 'attack', {
                targetName: 'Goblin',
                damageType: 'ranged',
            });
            const promptCalls = setRuntimeValue.mock.calls.filter(
                call => call[1] === 'pendingCombatSuperiorityPrompt'
            );
            expect(promptCalls[0][2].attackContext.weaponType).toBe('ranged');
        });
    });

    describe('combat summary lastAttack storage', () => {
        it('stores comprehensive lastAttack in combat summary for attack type', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 12 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {
                targetName: 'Goblin',
                autoDamageFormula: '1d8+3',
                damageType: 'slashing',
                autoDamageName: 'Longsword Attack',
                saveDc: 15,
                saveType: 'DEX',
                isUnarmedStrike: false,
            });
            expect(deps.setPopupHtml).toHaveBeenCalled();
        });

        it('does not store combatSummary lastAttack when no combatSummary', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            loadCombatSummary.mockResolvedValue(null);
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {});
        });

        it('does not store combatSummary lastAttack when no targetName', async () => {
            getTargetFromAttacker.mockReturnValue(null);
            loadCombatSummary.mockResolvedValue({ creatures: [] });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', {});
        });
    });

    describe('isAutoMiss prevents critical', () => {
        it('does not set isCrit when isAutoMiss is true even with natural 20', async () => {
            rollD20.mockReturnValueOnce(20);
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoMiss: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: false,
                isAutoMiss: true,
            }));
        });

        it('does not set isCrit when isAutoMiss is true even with autoCrit', async () => {
            getTargetFromAttacker.mockReturnValue({ name: 'Goblin', ac: 10 });
            const fn = createFn();
            await fn('Longsword', 5, 'attack', { targetName: 'Goblin', isAutoMiss: true, isAutoCrit: true });
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                isCrit: false,
            }));
        });
    });
});
