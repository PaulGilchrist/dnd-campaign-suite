// @maintained-by-ai: 2026-10-14
// Inline quick-roll lane (useLoggedDiceRollSaves.createSaves): evasion eligibility
// flags incl. the CLA-211 chooser stamp, shield-vs-magic-missile block, the manual
// intervene shield staying unconsumed here, and the disadvantage_on_next_save rider.
// Event-handler lane: useLoggedDiceRollEventHandlers.test.js. Pure evasion math:
// evasionUtils / applyDamage lanes.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(),
    getCombatContext: vi.fn(),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasion) => {
        // Byte mirror of the real computeDamageAfterEvasion (evasion + dcSuccess 'half').
        if (evasion && dcSuccess === 'half') return success ? 0 : Math.floor(raw / 2);
        if (!success) return raw;
        if (dcSuccess === 'half') return Math.floor(raw / 2);
        return 0;
    }),
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
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { hasIgnoreResistance } from '../../services/combat/automation/automationService.js';
import { createSaves } from './useLoggedDiceRollSaves.js';

describe('createSaves (useLoggedDiceRollSaves) - Evasion, Shields & Save Riders', () => {
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
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        hasIgnoreResistance.mockReturnValue(false);
    });

    function mockCreatures(...creatures) {
        loadCombatSummary.mockResolvedValue({ creatures });
    }

    // Key-based runtime mock — immune to the order/count of getRuntimeValue calls
    // (targetEffects, activeBuffs, activeConditions, lastAttack, hitPoints, ...).
    function mockRuntime(overrides = {}) {
        getRuntimeValue.mockImplementation((name, key) => overrides[`${name}|${key}`] ?? null);
    }

    function queueSave({ success = true, roll = 18, total = 21, bonus = 3 } = {}) {
        rollSaveForCreature.mockReturnValue({ success, roll, total, bonus });
    }

    const makePending = (overrides = {}) => ({
        targetName: 'ElfRogue',
        rawDamage: 20,
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

    describe('quickRollPlayerSave - Evasion', () => {
        it('applies own evasion: zero damage on success, half on failure', async () => {
            deps.pendingSaves['prompt-1'] = makePending();
            deps.charactersRef.current = [{
                name: 'ElfRogue',
                computedStats: { evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }] },
            }];
            mockCreatures({ name: 'ElfRogue', type: 'player', ac: 15, currentHp: 20, maxHp: 20 });
            const { quickRollPlayerSave } = createSaves(deps);

            await quickRollPlayerSave('prompt-1', 'ElfRogue', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', true);
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'ElfRogue', 0, ['fire'], { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard' });

            queueSave({ success: false, roll: 8, total: 11 });
            deps.pendingSaves['prompt-2'] = makePending();
            await quickRollPlayerSave('prompt-2', 'ElfRogue', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', true);
            expect(applyDamageToTarget).toHaveBeenLastCalledWith(expect.any(Object), 'ElfRogue', 10, ['fire'], { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard' });
        });

        it('evasion eligibility guards: incapacitated or non-shareable never fold; shareable ally aura folds (legacy chooser-less lane)', async () => {
            const { quickRollPlayerSave } = createSaves(deps);
            queueSave({ success: false, roll: 8, total: 11 });
            mockCreatures({ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 });

            // Incapacitated target with its own Evasion cannot use it.
            mockRuntime({ 'Goblin|activeConditions': ['incapacitated'] });
            deps.pendingSaves['prompt-1'] = makePending({ targetName: 'Goblin' });
            deps.charactersRef.current = [{ name: 'Goblin', computedStats: { evasionEffects: [{ saveType: 'DEX', source: 'Evasion' }] } }];
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', false);

            // Shareable ally aura within range folds the quick-roll (presence fallback).
            mockRuntime();
            deps.pendingSaves['prompt-2'] = makePending({ targetName: 'Goblin' });
            deps.charactersRef.current = [
                { name: 'Goblin' },
                { name: 'Paladin', computedStats: { evasionEffects: [{ saveType: 'DEX', source: 'Aura of Guardians', shareable: true, shareRange: 10 }] } },
            ];
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', true);

            // Non-shareable aura grants nothing.
            deps.pendingSaves['prompt-3'] = makePending({ targetName: 'Goblin' });
            deps.charactersRef.current = [
                { name: 'Goblin' },
                { name: 'Paladin', computedStats: { evasionEffects: [{ saveType: 'DEX', source: 'Aura of Guardians', shareable: false, shareRange: 10 }] } },
            ];
            await quickRollPlayerSave('prompt-3', 'Goblin', 'DEX', 15);
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', false);
        });

        it('CLA-211: chooser-confirm folds ONLY ticked allies — unselected target pays full', async () => {
            deps.pendingSaves['prompt-1'] = makePending({ targetName: 'Goblin' });
            deps.pendingSaves['prompt-2'] = makePending({ targetName: 'UntickedAlly' });
            deps.pendingSaves['prompt-3'] = makePending({ targetName: 'Goblin' });
            deps.charactersRef.current = [
                { name: 'Bard', computedStats: { evasionEffects: [{ saveType: 'DEX', source: 'Leading Evasion', shareable: true, shareRange: 5 }] } },
                { name: 'Goblin' },
                { name: 'UntickedAlly' },
            ];
            queueSave({ success: false, roll: 8, total: 11 });
            mockCreatures(
                { name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 },
                { name: 'UntickedAlly', type: 'player', ac: 12, currentHp: 40, maxHp: 40 },
            );
            const { quickRollPlayerSave } = createSaves(deps);
            // GM ticks Goblin only → Goblin folds half-on-fail
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15, { selectedAllies: new Set(['Goblin']) });
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', true);
            // Unticked control quick-roll → NO fold (full on fail), the CLA-211 over-grant
            await quickRollPlayerSave('prompt-2', 'UntickedAlly', 'DEX', 15, { selectedAllies: new Set(['Goblin']) });
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', false);
            // Explicit Skip (declined) → no fold even for a previously ticked target
            await quickRollPlayerSave('prompt-3', 'Goblin', 'DEX', 15, { evasionDeclined: true });
            expect(computeDamageAfterEvasion).toHaveBeenLastCalledWith(20, false, 'half', false);
        });
    });

    describe('quickRollPlayerSave - Shield & Intervene', () => {
        it('shield immunity zeroes Magic Missile only — other spells still take computeDamageAfterEvasion damage', async () => {
            mockRuntime({ 'Ally|activeBuffs': [{ effect: 'shield' }] });
            mockCreatures({ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 });
            deps.pendingSaves['prompt-1'] = makePending({ targetName: 'Ally', name: 'Magic Missile', formula: '4d4+2', rolls: [3, 2, 3, 2], modifier: 2, damageType: 'force' });
            const { quickRollPlayerSave } = createSaves(deps);

            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            // Shield blocks before the roll: apply sees 0, and evasion was never in play.
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(20, true, 'half', false);
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally', 0, ['force'], { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard' });

            // Same shield, non-missile spell → normal halved save damage (20 → 10).
            deps.pendingSaves['prompt-2'] = makePending({ targetName: 'Ally' });
            await quickRollPlayerSave('prompt-2', 'Ally', 'DEX', 15);
            expect(applyDamageToTarget).toHaveBeenLastCalledWith(expect.any(Object), 'Ally', 10, ['fire'], { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard' });
        });

        it('does not auto-apply intervene shield in save pipeline (now a manual reaction)', async () => {
            // Intervene Shield is a manual reaction that checks lastAttack at click time —
            // the quick-roll save lane must never consume the interveneShieldActive flag.
            deps.pendingSaves['prompt-1'] = makePending({ targetName: 'Ally', name: 'Lightning Bolt', damageType: 'lightning' });
            mockCreatures({ name: 'Ally', type: 'player', ac: 16, currentHp: 20, maxHp: 20 });
            queueSave();
            const { quickRollPlayerSave } = createSaves(deps);

            await quickRollPlayerSave('prompt-1', 'Ally', 'DEX', 15);
            // Damage halved by the successful save (10), NOT zeroed by an intervene shield.
            expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Ally', 10, ['lightning'], { campaignName: 'test-campaign', characters: expect.any(Array), ignoreResistance: false, attackerName: 'TestWizard' });
            expect(setRuntimeValue).not.toHaveBeenCalledWith('Ally', 'interveneShieldActive', null, 'test-campaign');
        });
    });

    describe('quickRollPlayerSave - Target Effects Disadvantage Rider', () => {
        it('applies disadvantage when rider matches target, skips when it does not', async () => {
            mockCreatures({ name: 'Goblin', type: 'npc', ac: 12, currentHp: 13, maxHp: 13 });
            const { quickRollPlayerSave } = createSaves(deps);

            deps.pendingSaves['prompt-1'] = makePending({ targetName: 'Goblin' });
            mockRuntime({ 'campaign|targetEffects': [{ target: 'Goblin', effect: 'disadvantage_on_next_save' }] });
            await quickRollPlayerSave('prompt-1', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenLastCalledWith(expect.any(Object), 'DEX', 15, true, false);

            deps.pendingSaves['prompt-2'] = makePending({ targetName: 'Goblin' });
            mockRuntime({ 'campaign|targetEffects': [{ target: 'Other', effect: 'disadvantage_on_next_save' }] });
            await quickRollPlayerSave('prompt-2', 'Goblin', 'DEX', 15);
            expect(rollSaveForCreature).toHaveBeenLastCalledWith(expect.any(Object), 'DEX', 15, false, false);
        });
    });
});
