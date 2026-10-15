// @maintained-by-ai: 2026-10-14
// Base lane for useLoggedDiceRollSaves.createSaves: the quick-roll save seam
// (pending guards → roll → damage threading → sendSaveResult → pending removal →
// popup) and the Glorious Defense counterattack outcome routing.
// Evasion / shield / target-effect riders: useLoggedDiceRollSaves.evasion.test.js.
// Event-handler seam: useLoggedDiceRollEventHandlers.test.js.
// Pure damage math (computeDamageAfterEvasion) and bane/bless roll internals:
// applyDamage + bane/bless service lanes.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn(() => 10),
    rollSaveForCreature: vi.fn(),
    applyDamageToTarget: vi.fn(),
    normalizeSaveType: (saveType) => {
        if (!saveType) return '';
        const map = { 'STRENGTH': 'STR', 'DEXTERITY': 'DEX', 'CONSTITUTION': 'CON', 'INTELLIGENCE': 'INT', 'WISDOM': 'WIS', 'CHARISMA': 'CHA' };
        return map[saveType.toUpperCase()] || saveType.toUpperCase();
    },
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSaveResult: vi.fn(),
}));

// Guard the heavy transitive damage graph — this lane never reaches it.
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getTargetFromAttacker: vi.fn(),
    getCombatContext: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/baseCombatActions.js', () => ({
    MELEE_REACH_FEET: 5,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(),
    evaluateAutoExpression: vi.fn(),
}));

import { loadCombatSummary } from '../../services/encounters/combatData.js';
import { computeDamageAfterEvasion, rollSaveForCreature, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { sendSaveResult } from '../../services/combat/conditions/savePromptService.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { createSaves } from './useLoggedDiceRollSaves.js';

describe('createSaves (useLoggedDiceRollSaves) - Core', () => {
    const deps = {
        characterName: 'TestFighter',
        campaignName: 'test-campaign',
        setPopupHtml: vi.fn(),
        logEntry: vi.fn(),
        logAndShow: vi.fn(),
        pendingSaves: {},
        charactersRef: { current: [] },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        deps.charactersRef.current = [];
        deps.pendingSaves = {};
        deps.logEntry.mockResolvedValue({ id: 'log-1' });
        loadCombatSummary.mockResolvedValue(null);
        getRuntimeValue.mockImplementation(() => null);
        setRuntimeValue.mockReturnValue(undefined);
        rollSaveForCreature.mockReturnValue({ success: true, roll: 15, total: 18, bonus: 3 });
        computeDamageAfterEvasion.mockReturnValue(10);
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        hasIgnoreResistance.mockReturnValue(false);
    });

    // Key-based runtime mock — immune to the order/count of getRuntimeValue calls
    // (targetEffects, activeBuffs, activeConditions, lastAttack, hitPoints, ...).
    function mockRuntime(overrides = {}) {
        getRuntimeValue.mockImplementation((name, key) => overrides[`${name}|${key}`] ?? null);
    }

    function mockCreatures(...creatures) {
        loadCombatSummary.mockResolvedValue({ creatures });
    }

    function queueSave({ success = true, roll = 18, total = 21, bonus = 3 } = {}) {
        rollSaveForCreature.mockReturnValue({ success, roll, total, bonus });
    }

    const makePending = (overrides = {}) => ({
        targetName: 'Goblin',
        rawDamage: 15,
        saveDc: 15,
        saveType: 'DEX',
        dcSuccess: 'half',
        damageType: 'fire',
        attackerName: 'TestWizard',
        name: 'Fireball',
        formula: '8d6',
        rolls: [3, 4, 5, 2, 3, 3],
        modifier: 0,
        ...overrides,
    });

    describe('quickRollPlayerSave', () => {
        it('returns early when pending does not exist or target not found', async () => {
            const { quickRollPlayerSave } = createSaves(deps);
            await quickRollPlayerSave('nonexistent', 'Goblin', 'DEX', 15);
            expect(loadCombatSummary).not.toHaveBeenCalled();

            deps.pendingSaves['prompt-1'] = makePending();
            mockCreatures();
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).not.toHaveBeenCalled();
            expect(sendSaveResult).not.toHaveBeenCalled();
        });

        it('rolls the save, threads damage, sends the result, and removes pending', async () => {
            deps.pendingSaves['prompt-1'] = makePending();
            mockCreatures({ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 });
            const { quickRollPlayerSave } = createSaves(deps);

            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            // Clean NPC target: no advantage, no disadvantage, no evasion.
            expect(rollSaveForCreature).toHaveBeenCalledWith(expect.any(Object), 'DEX', 15, false, false);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, true, 'half', false);
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Goblin', 10, ['fire'], {
                campaignName: 'test-campaign',
                characters: expect.any(Array),
                ignoreResistance: false,
                attackerName: 'TestWizard',
            });
            expect(sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin', {
                promptId: 'prompt-1',
                success: true,
                roll: 15,
                total: 18,
                saveBonus: 3,
            });
            expect(deps.pendingSaves['prompt-1']).toBeUndefined();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                type: 'save-damage',
                name: 'Fireball',
                saveDc: 15,
                saveType: 'DEX',
                finalDamage: 10,
                damageApplied: true,
                damageReduced: false,
            }));

            // Failed save threads through as full halve-eligible damage (dcSuccess 'half').
            deps.pendingSaves['prompt-2'] = makePending({ rawDamage: 20 });
            queueSave({ success: false, roll: 8, total: 11 });
            computeDamageAfterEvasion.mockReturnValue(20);
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', false);
        });

        it('threads ignoreResistance from pending.playerStats into applyDamageToTarget', async () => {
            deps.pendingSaves['prompt-1'] = makePending({ playerStats: {} });
            mockCreatures({ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 });
            hasIgnoreResistance.mockReturnValue(true);
            const { quickRollPlayerSave } = createSaves(deps);

            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(hasIgnoreResistance).toHaveBeenCalledWith({}, 'fire');
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                expect.any(Object), 'Goblin', expect.any(Number), ['fire'],
                expect.objectContaining({ ignoreResistance: true })
            );
        });

        it('CLA-324: grants against_spell save advantage only for spell-origin saves', async () => {
            deps.pendingSaves['prompt-1'] = makePending({
                targetName: 'Wiz',
                saveType: 'INT',
                saveDc: 13,
                damageType: 'psychic',
                name: 'Mind Sliver',
                formula: '1d6',
                rolls: [4],
                isSpellDamage: true,
            });
            deps.charactersRef.current = [{
                name: 'Wiz',
                saveModifiers: [
                    { target: 'saving_throw', effect: 'advantage', condition: 'against_spell' },
                ],
            }];
            mockCreatures({ name: 'Wiz', type: 'player', ac: 13, currentHp: 15, maxHp: 15 });
            const { quickRollPlayerSave } = createSaves(deps);

            await quickRollPlayerSave('prompt-1', 'Wiz', 'INT', 13);
            expect(rollSaveForCreature).toHaveBeenCalledWith(expect.any(Object), 'INT', 13, false, true);
        });

        it('popup reports HP from runtime hitPoints for players and from the summary for npcs', async () => {
            const { quickRollPlayerSave } = createSaves(deps);

            deps.pendingSaves['prompt-1'] = makePending({ targetName: 'Ally', rawDamage: 10 });
            mockCreatures({ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 15, damageReduced: true });
            mockRuntime({ 'Ally|hitPoints': 20 });
            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                targetCurrentHp: 15,
                targetMaxHp: 20,
            }));

            deps.pendingSaves['prompt-2'] = makePending({ rawDamage: 10 });
            mockCreatures({ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(deps.setPopupHtml).toHaveBeenLastCalledWith(expect.objectContaining({
                targetCurrentHp: 5,
                targetMaxHp: 13,
            }));
        });
    });

    describe('triggerGloriousDefenseCounterAttack', () => {
        // d20 9 + bonus 7 = 16 vs AC 16 + CHA 1 = 17 → miss (counterattack allowed);
        // d20 15 + bonus 7 = 22 ≥ 17 → still hits (blocked).
        const lastAttack = (d20, attackerName = 'Goblin') => ({
            targetName: 'TestFighter',
            d20,
            bonus: 7,
            targetAc: 16,
            hit: true,
            attackerName,
        });

        function mockCounterAttackSetup(d20, uses = 2) {
            mockRuntime({
                'TestFighter|gloriousDefenseUses': uses,
                'campaign|lastAttack': lastAttack(d20),
            });
            mockCreatures({
                type: 'player',
                name: 'TestFighter',
                attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }],
            });
        }

        it('blocks when no uses remain', async () => {
            mockRuntime({ 'TestFighter|gloriousDefenseUses': 0 });
            const { triggerGloriousDefenseCounterAttack } = createSaves(deps);
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('no uses remaining'),
            }));
        });

        it('blocks when there is no last attack or it targeted someone else', async () => {
            const { triggerGloriousDefenseCounterAttack } = createSaves(deps);

            mockRuntime({ 'TestFighter|gloriousDefenseUses': 2 });
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('did not target you'),
            }));

            mockRuntime({
                'TestFighter|gloriousDefenseUses': 2,
                'campaign|lastAttack': { ...lastAttack(9), targetName: 'SomeOtherCharacter' },
            });
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenLastCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('did not target you'),
            }));
        });

        it('blocks when the CHA bonus is not enough to change the outcome', async () => {
            mockCounterAttackSetup(15);
            const { triggerGloriousDefenseCounterAttack } = createSaves(deps);
            await triggerGloriousDefenseCounterAttack();
            expect(deps.setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
                popupMessage: expect.stringContaining('not enough to change the outcome'),
            }));
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });

        it('counters the last attacker, spends a use, and logs the ability use', async () => {
            mockCounterAttackSetup(9, 2);
            const { triggerGloriousDefenseCounterAttack } = createSaves(deps);
            await triggerGloriousDefenseCounterAttack();
            expect(setRuntimeValue).toHaveBeenCalledWith('TestFighter', 'gloriousDefenseUses', 1, 'test-campaign');
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({
                type: 'ability_use',
                abilityName: 'Glorious Defense',
                targetName: 'Goblin',
            }));
            expect(deps.logAndShow).toHaveBeenCalledWith('Longsword', 5, 'attack', expect.objectContaining({
                targetName: 'Goblin',
            }));
        });

        it('counters the lastAttack attacker (not any current target)', async () => {
            mockRuntime({
                'TestFighter|gloriousDefenseUses': 2,
                'campaign|lastAttack': lastAttack(9, 'Red Dragon'),
            });
            mockCreatures({
                type: 'player',
                name: 'TestFighter',
                attacks: [{ name: 'Longsword', hitBonus: 5, range: 5 }],
            });
            const { triggerGloriousDefenseCounterAttack } = createSaves(deps);
            await triggerGloriousDefenseCounterAttack();
            expect(deps.logAndShow).toHaveBeenCalledWith('Longsword', 5, 'attack', expect.objectContaining({
                targetName: 'Red Dragon',
            }));
        });
    });
});
