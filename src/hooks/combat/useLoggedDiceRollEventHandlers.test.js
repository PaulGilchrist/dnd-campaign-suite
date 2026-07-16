// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/rules/effects/expirations.js', () => ({ addExpiration: vi.fn() }));
vi.mock('../../services/dice/diceRoller.js', () => ({ rollExpression: vi.fn(), rollExpressionDoubled: vi.fn() }));
vi.mock('../../services/encounters/combatData.js', () => ({ getCombatSummary: vi.fn() }));
vi.mock('../runtime/useRuntimeState.js', () => ({ getRuntimeValue: vi.fn(), setRuntimeValue: vi.fn() }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    computeDamageAfterEvasion: vi.fn((raw, success, dcSuccess, evasion) => {
        if (evasion && !success) return Math.floor(raw / 2);
        return success ? Math.floor(raw / 2) : raw;
    }),
    applyDamageToTarget: vi.fn(), clearReTriggeredSequence: vi.fn(),
    normalizeSaveType: (saveType) => {
        if (!saveType) return '';
        const map = { 'STRENGTH': 'STR', 'DEXTERITY': 'DEX', 'CONSTITUTION': 'CON', 'INTELLIGENCE': 'INT', 'WISDOM': 'WIS', 'CHARISMA': 'CHA' };
        return map[saveType.toUpperCase()] || saveType.toUpperCase();
    },
}));
vi.mock('../../services/combat/automation/automationService.js', () => ({ hasIgnoreResistance: vi.fn(), playerIsImmuneToCondition: vi.fn() }));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({ endInvisibilityOnHostileAction: vi.fn() }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: vi.fn((n) => n || 'Unknown'), guid: vi.fn(() => 'test-guid-1234') } }));
vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn() } }));
vi.mock('./loggedDiceRollUtils.js', () => ({ hasSoulstitchProtection: vi.fn() }));
vi.mock('../../services/ui/logService.js', () => {
    const mockAddEntry = vi.fn().mockReturnValue(Promise.resolve(undefined));
    return { addEntry: mockAddEntry };
});
let _registry = {};
vi.mock('../../services/combat/auras/pendingPopupRegistry.js', () => ({
    registerPendingPopupSetter: vi.fn((id, fn) => { _registry[id] = fn; }),
    getPendingPopupSetter: vi.fn((id) => { const fn = _registry[id]; if (fn) { delete _registry[id]; return fn; } return null; }),
}));
import { registerPendingPopupSetter } from '../../services/combat/auras/pendingPopupRegistry.js';

import { addExpiration } from '../../services/rules/effects/expirations.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../runtime/useRuntimeState.js';
import { computeDamageAfterEvasion, applyDamageToTarget } from '../../services/rules/combat/applyDamage.js';
import { hasIgnoreResistance, playerIsImmuneToCondition } from '../../services/combat/automation/automationService.js';
import { endInvisibilityOnHostileAction } from '../../services/rules/features/invisibilityService.js';
import { hasSoulstitchProtection } from './loggedDiceRollUtils.js';
import utils from '../../services/ui/utils.js';
import storage from '../../services/ui/storage.js';
import { addEntry } from '../../services/ui/logService.js';
import { rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import { setupEventListeners } from './useLoggedDiceRollEventHandlers.js';

describe('setupEventListeners (useLoggedDiceRollEventHandlers)', () => {
    const deps = { characterName: 'TestWizard', campaignName: 'test-campaign', logEntry: vi.fn(), charactersRef: { current: [] } };
    let testPendingSaves = {};

    beforeEach(() => {
        delete window.__pendingResultHandlersInstalled;
        testPendingSaves = {};
        getCombatSummary.mockReturnValue(null);
        getRuntimeValue.mockImplementation((key, prop) => {
            if (key === 'test-campaign' && prop === 'pendingSavePrompts') return testPendingSaves;
            if (key === 'test-campaign' && prop === 'pendingSaveListenerPrompts') return new Set();
            return null;
        });
        setRuntimeValue.mockReturnValue(undefined);
        setRuntimeValue.mockClear();
        hasSoulstitchProtection.mockReturnValue(false);
        computeDamageAfterEvasion.mockReturnValue(10);
        applyDamageToTarget.mockReset();
        applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
        endInvisibilityOnHostileAction.mockReset();
        endInvisibilityOnHostileAction.mockReturnValue(undefined);
        addExpiration.mockReset();
        addExpiration.mockReturnValue(undefined);
        storage.set.mockReset();
        storage.set.mockReturnValue(undefined);
        hasIgnoreResistance.mockReset();
        hasIgnoreResistance.mockReturnValue(false);
        playerIsImmuneToCondition.mockReset();
        playerIsImmuneToCondition.mockReturnValue(false);
        utils.getName.mockImplementation((n) => n);
        addEntry.mockReset();
        addEntry.mockReturnValue(Promise.resolve(undefined));
        deps.logEntry.mockClear();
        rollExpression.mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 });
        rollExpressionDoubled.mockReturnValue({ total: 20, rolls: [5, 5, 5, 5], modifier: 0 });
    });

    function setup() { setupEventListeners(deps); }

    function createSavePrompt(promptId, overrides = {}) {
        return { promptId, targetName: 'Goblin', rawDamage: 15, saveDc: 15, saveType: 'DEX', dcSuccess: 'half',
            damageType: 'fire', attackerName: 'TestWizard', name: 'Fireball', formula: '8d6',
            rolls: [3, 4, 5, 2, 3, 3], modifier: 0, campaignName: 'test-campaign', setPopupHtml: vi.fn(), ...overrides };
    }

    // --- save-result: basic ---
    describe('save-result event', () => {
        it('applies damage and logs when save fails', () => {
            setup();
            const pid = 'p1';
            testPendingSaves = { [pid]: createSavePrompt(pid) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(applyDamageToTarget).toHaveBeenCalled();
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'roll', rollType: 'save-damage', name: 'Fireball' }));
        });

        it('does nothing when no pending save for promptId', () => {
            setup();
            testPendingSaves = {};
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: 'nonexistent' } }));
            expect(applyDamageToTarget).not.toHaveBeenCalled();
        });

        it('skips damage when soulstitch protected', () => {
            setup();
            hasSoulstitchProtection.mockReturnValue(true);
            const pid = 'p2';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'Ally' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Ally', success: true, roll: 18, total: 21, saveBonus: 3 } }));
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ saveResult: 'soulstitch_auto_success', soulstitchProtected: true }));
        });

        it('removes pending save after processing', () => {
            setup();
            const pid = 'p3';
            testPendingSaves = { [pid]: createSavePrompt(pid) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(testPendingSaves[pid]).toBeUndefined();
        });

        it('sets popupHtml after processing', () => {
            setup();
            const setPopupHtml = vi.fn();
            const pid = 'p4';
            testPendingSaves = { [pid]: createSavePrompt(pid, { setPopupHtml }) };
            registerPendingPopupSetter(pid, setPopupHtml);
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(setPopupHtml).toHaveBeenCalledWith(expect.objectContaining({ type: 'save-damage', name: 'Fireball' }));
        });

        // --- save-result: evasion ---
        it('applies evasion when target has matching evasion effect', () => {
            setup();
            deps.charactersRef.current = [{ name: 'Ally', computedStats: { evasionEffects: [{ saveType: 'DEX' }] } }];
            const pid = 'p5';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'Ally' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Ally', success: false, roll: 5, total: 8, saveBonus: 3, rawDamage: 15 } }));
            expect(computeDamageAfterEvasion).toHaveBeenCalled();
        });

        it('applies shared evasion from another character within range', () => {
            setup();
            deps.charactersRef.current = [{ name: 'Ally', computedStats: { evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 5 }] } }];
            const pid = 'p6';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'Ally' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Ally', success: false, roll: 5, total: 8, saveBonus: 3, rawDamage: 15 } }));
            expect(computeDamageAfterEvasion).toHaveBeenCalled();
        });

        it('does not apply shared evasion when shareRange is insufficient', () => {
            setup();
            computeDamageAfterEvasion.mockReset();
            computeDamageAfterEvasion.mockImplementation((raw, success, dcSuccess, evasion) => {
                if (evasion && !success) return Math.floor(raw / 2);
                return success ? Math.floor(raw / 2) : raw;
            });
            deps.charactersRef.current = [
                { name: 'Bard', computedStats: { evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 3 }] } },
                { name: 'Ally', computedStats: {} },
            ];
            const pid = 'p7';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'Ally' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Ally', success: false, roll: 5, total: 8, saveBonus: 3, rawDamage: 15, dcSuccess: 'half', saveType: 'DEX' } }));
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, expect.anything(), 'half', false);
        });

        it('does not apply evasion when target is incapacitated', () => {
            setup();
            computeDamageAfterEvasion.mockReset();
            computeDamageAfterEvasion.mockImplementation((raw, success, dcSuccess, evasion) => {
                if (evasion && !success) return Math.floor(raw / 2);
                return success ? Math.floor(raw / 2) : raw;
            });
            getRuntimeValue.mockImplementation((charName, prop, _) => {
                if (prop === 'activeConditions') return ['incapacitated'];
                if (charName === 'test-campaign' && prop === 'pendingSavePrompts') return testPendingSaves;
                if (charName === 'test-campaign' && prop === 'pendingSaveListenerPrompts') return new Set();
                return null;
            });
            deps.charactersRef.current = [
                { name: 'Bard', computedStats: { evasionEffects: [{ saveType: 'DEX', shareable: true, shareRange: 5 }] } },
                { name: 'Ally', computedStats: {} },
            ];
            const pid = 'p8';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'Ally' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Ally', success: false, roll: 5, total: 8, saveBonus: 3, rawDamage: 15, dcSuccess: 'half', saveType: 'DEX' } }));
            expect(computeDamageAfterEvasion).toHaveBeenCalledWith(15, expect.anything(), 'half', false);
        });

        // --- save-result: shield / intervene ---
        it('applies shield immunity for magic missile', () => {
            setup();
            deps.charactersRef.current = [];
            getRuntimeValue.mockImplementation((charName, prop, camp) => {
                if (prop === 'activeBuffs' && camp === 'test-campaign') return [{ effect: 'shield' }];
                if (charName === 'test-campaign' && prop === 'pendingSavePrompts') return testPendingSaves;
                if (charName === 'test-campaign' && prop === 'pendingSaveListenerPrompts') return new Set();
                return null;
            });
            const pid = 'p9';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'ShieldedAlly', name: 'Magic Missile', damageType: 'force' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'ShieldedAlly', success: true, roll: 18, total: 21, saveBonus: 3 } }));
            expect(applyDamageToTarget).toHaveBeenCalledWith(null, 'ShieldedAlly', 0, ['force'], 'test-campaign', expect.any(Array), false, 'TestWizard', true);
        });

        it('does not apply shield immunity for non-magic missile spells', () => {
            setup();
            getRuntimeValue.mockImplementation((charName, prop, camp) => {
                if (prop === 'activeBuffs' && camp === 'test-campaign') return [{ effect: 'shield' }];
                if (charName === 'test-campaign' && prop === 'pendingSavePrompts') return testPendingSaves;
                if (charName === 'test-campaign' && prop === 'pendingSaveListenerPrompts') return new Set();
                return null;
            });
            const pid = 'p10';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'ShieldedAlly', name: 'Fireball' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'ShieldedAlly', success: true, roll: 18, total: 21, saveBonus: 3 } }));
            expect(applyDamageToTarget).not.toHaveBeenCalledWith(null, 'ShieldedAlly', 0, expect.any(Array), 'test-campaign', expect.any(Array), false, 'TestWizard', true);
        });

        it('clears intervene shield on successful DEX half save', () => {
            setup();
            getRuntimeValue.mockImplementation((charName, prop, camp) => {
                if (prop === 'interveneShieldActive' && camp === 'test-campaign') return true;
                if (charName === 'test-campaign' && prop === 'pendingSavePrompts') return testPendingSaves;
                if (charName === 'test-campaign' && prop === 'pendingSaveListenerPrompts') return new Set();
                return null;
            });
            const pid = 'p11';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'ProtectedAlly' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'ProtectedAlly', success: true, roll: 18, total: 21, saveBonus: 3, saveType: 'DEX', dcSuccess: 'half' } }));
            expect(setRuntimeValue).toHaveBeenCalledWith('ProtectedAlly', 'interveneShieldActive', null, 'test-campaign');
        });

        it('does not clear intervene shield for non-DEX saves', () => {
            setup();
            getRuntimeValue.mockImplementation((charName, prop, camp) => {
                if (prop === 'interveneShieldActive' && camp === 'test-campaign') return true;
                if (charName === 'test-campaign' && prop === 'pendingSavePrompts') return testPendingSaves;
                if (charName === 'test-campaign' && prop === 'pendingSaveListenerPrompts') return new Set();
                return null;
            });
            const pid = 'p12';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'ProtectedAlly', saveType: 'CON' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'ProtectedAlly', success: true, roll: 18, total: 21, saveBonus: 3, saveType: 'CON', dcSuccess: 'half' } }));
            expect(setRuntimeValue).not.toHaveBeenCalledWith('ProtectedAlly', 'interveneShieldActive', null, 'test-campaign');
        });

        // --- save-result: HP thresholds ---
        it('logs hp_change when target dies', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 15 }] });
            applyDamageToTarget.mockReturnValue({ finalDamage: 15, newHp: 0, damageReduced: false });
            const pid = 'p13';
            testPendingSaves = { [pid]: createSavePrompt(pid, { rawDamage: 15 }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'hp_change', targetName: 'Goblin', isUnconscious: true }));
        });

        it('logs hp_change with bloodied threshold', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', currentHp: 30, maxHp: 30 }] });
            applyDamageToTarget.mockReturnValue({ finalDamage: 18, newHp: 12, damageReduced: false });
            const pid = 'p14';
            testPendingSaves = { [pid]: createSavePrompt(pid, { rawDamage: 18 }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'hp_change', targetName: 'Goblin', threshold: 'bloodied' }));
        });

        // --- save-result: death saves / invisibility ---
        it('resets death saves when player dies', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'player-TestWizard', type: 'player', currentHp: 10, maxHp: 20 }] });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 0, damageReduced: false });
            const pid = 'p15';
            testPendingSaves = { [pid]: createSavePrompt(pid, { rawDamage: 10, targetName: 'player-TestWizard' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'player-TestWizard', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(setRuntimeValue).toHaveBeenCalledWith('player-TestWizard', 'deathSaves', [false, false, false], 'test-campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('player-TestWizard', 'deathFailures', [false, false, false], 'test-campaign');
        });

        it('ends invisibility on hostile action when damage dealt', () => {
            setup();
            const pid = 'p17';
            testPendingSaves = { [pid]: createSavePrompt(pid) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(endInvisibilityOnHostileAction).toHaveBeenCalledWith('TestWizard', 'test-campaign');
        });

        it('does not end invisibility when no damage dealt', () => {
            setup();
            hasSoulstitchProtection.mockReturnValue(true);
            applyDamageToTarget.mockReturnValue({ finalDamage: 0, newHp: 10, damageReduced: true });
            const pid = 'p18';
            testPendingSaves = { [pid]: createSavePrompt(pid, { targetName: 'Ally' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Ally', success: true, roll: 18, total: 21, saveBonus: 3 } }));
            expect(endInvisibilityOnHostileAction).not.toHaveBeenCalled();
        });

        // --- save-result: secondary / overchannel ---
        it('handles secondary damage formula on failed save', () => {
            setup();
            rollExpressionDoubled.mockReturnValue({ total: 20, rolls: [5, 5, 5, 5], modifier: 0 });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 5, damageReduced: false });
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', currentHp: 15, maxHp: 15 }] });
            const pid = 'p19';
            testPendingSaves = { [pid]: createSavePrompt(pid, { autoDamageSecondaryFormula: '1d10', autoDamageSecondaryName: 'Secondary', autoDamageSecondaryDamageType: 'necrotic', isAutoCrit: true }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(rollExpressionDoubled).toHaveBeenCalledWith('1d10');
            const logCalls = deps.logEntry.mock.calls.map(c => c[0]);
            const combinedEntry = logCalls.find(entry => entry.note === 'combined_save_damage_roll');
            expect(combinedEntry).toBeDefined();
            expect(combinedEntry.secondaryName).toBe('Secondary');
        });

        it('handles overchannel self-damage', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestWizard', type: 'player', currentHp: 20, maxHp: 20 }] });
            applyDamageToTarget.mockReturnValue({ finalDamage: 10, newHp: 10, damageReduced: false });
            const pid = 'p20';
            testPendingSaves = { [pid]: createSavePrompt(pid, { overchannelActive: true, overchannelUseCount: 3, overchannelSpellLevel: 2 }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(rollExpression).toHaveBeenCalledWith('8d12');
        });

        // --- save-result: status effects ---
        it('applies status effects on failed save', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }] });
            const pid = 'p21';
            testPendingSaves = { [pid]: createSavePrompt(pid, { statusEffects: ['poisoned', 'frightened'], saveDc: 15, saveType: 'CON' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 5, total: 8, saveBonus: 3 } }));
            expect(addExpiration).toHaveBeenCalledWith('TestWizard', 'Goblin', expect.any(Array), 'test-campaign', 2);
        });

        it('skips status effects when target is immune', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }] });
            deps.charactersRef.current = [{ name: 'Goblin', computedStats: { characterAdvancement: [] } }];
            playerIsImmuneToCondition.mockReturnValue(true);
            const pid = 'p22';
            testPendingSaves = { [pid]: createSavePrompt(pid, { statusEffects: ['poisoned'], saveDc: 15, saveType: 'CON' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 5, total: 8, saveBonus: 3 } }));
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it('does not apply status effects on successful save', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }] });
            const pid = 'p23';
            testPendingSaves = { [pid]: createSavePrompt(pid, { statusEffects: ['poisoned'], saveDc: 15, saveType: 'CON' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: true, roll: 18, total: 21, saveBonus: 3 } }));
            expect(addExpiration).not.toHaveBeenCalled();
        });

        // --- save-result: log entry details ---
        it('updates player currentHitPoints runtime value', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'player-Ally', type: 'player', currentHp: 10, maxHp: 20 }] });
            applyDamageToTarget.mockReturnValue({ finalDamage: 5, newHp: 5, damageReduced: false });
            const pid = 'p24';
            testPendingSaves = { [pid]: createSavePrompt(pid, { rawDamage: 5, targetName: 'player-Ally' }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'player-Ally', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            expect(setRuntimeValue).toHaveBeenCalledWith('player-Ally', 'currentHitPoints', 5, 'test-campaign');
        });

        it('includes aoeAffectedCount when isAoe is true', () => {
            setup();
            const pid = 'p26';
            testPendingSaves = { [pid]: createSavePrompt(pid, { isAoe: true }) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3, aoeAffectedCount: 3 } }));
            const logCalls = deps.logEntry.mock.calls.map(c => c[0]);
            const rollEntry = logCalls.find(entry => entry.note === 'combined_save_damage_roll');
            expect(rollEntry.aoeAffectedCount).toBe(3);
        });

        it('sets saveResult based on save success value', () => {
            setup();
            const pid = 'p27';
            testPendingSaves = { [pid]: createSavePrompt(pid) };
            window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: pid, targetName: 'Goblin', success: false, roll: 8, total: 11, saveBonus: 3 } }));
            const logCalls = deps.logEntry.mock.calls.map(c => c[0]);
            const rollEntry = logCalls.find(entry => entry.note === 'combined_save_damage_roll');
            expect(rollEntry.saveResult).toBe('failure');
        });
    });

    // --- death-save-result event ---
    describe('death-save-result event', () => {
        it('logs death save entry with basic fields', () => {
            setup();
            window.dispatchEvent(new CustomEvent('death-save-result', { detail: { targetName: 'InjuredAlly', roll: 15, isNat20: false, isNat1: false, success: true } }));
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'death_save', characterName: 'InjuredAlly', roll: 15, success: true }));
        });

        it('handles natural 20 and natural 1 death saves', () => {
            setup();
            window.dispatchEvent(new CustomEvent('death-save-result', { detail: { targetName: 'InjuredAlly', roll: 20, isNat20: true, isNat1: false, success: true } }));
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ isNatural20: true }));

            deps.logEntry.mockClear();
            window.dispatchEvent(new CustomEvent('death-save-result', { detail: { targetName: 'InjuredAlly', roll: 1, isNat20: false, isNat1: true, success: false } }));
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ isNatural1: true }));
        });
    });

    // --- concentration-result event ---
    describe('concentration-result event', () => {
        it('logs concentration save entry', () => {
            setup();
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'TestWizard', roll: 15, total: 18, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: true } }));
            expect(deps.logEntry).toHaveBeenCalledWith(expect.objectContaining({ type: 'roll', rollType: 'concentration-save', name: 'Constitution', condition: 'Concentration: Fireball' }));
        });

        it('clears concentration on failed save and updates combat summary', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestWizard', concentration: 'Fireball' }] });
            storage.set.mockReturnValue(undefined);
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'TestWizard', roll: 5, total: 8, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: false } }));
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });

        it('dispatches combat-summary-updated event when concentration breaks', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestWizard', concentration: 'Fireball' }] });
            storage.set.mockReturnValue(undefined);
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'TestWizard', roll: 5, total: 8, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: false } }));
            expect(dispatchEventSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'combat-summary-updated' }));
            dispatchEventSpy.mockRestore();
        });

        it('clears mantleOfMajestyActive on concentration break', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestWizard', concentration: 'Fireball' }] });
            storage.set.mockReturnValue(undefined);
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'TestWizard', roll: 5, total: 8, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: false } }));
            expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'mantleOfMajestyActive', null, 'test-campaign');
        });

        it('does not clear concentration when save succeeds', () => {
            setup();
            const creature = { name: 'TestWizard', concentration: { spell: 'Fireball' } };
            getCombatSummary.mockReturnValue({ creatures: [creature] });
            storage.set.mockReturnValue(undefined);
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'TestWizard', roll: 18, total: 21, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: true } }));
            expect(creature.concentration).toEqual({ spell: 'Fireball' });
        });

        it('finds creature by name prefix for concentration', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestWizard Level 5', concentration: 'Fireball' }] });
            storage.set.mockReturnValue(undefined);
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'TestWizard Level 5', roll: 5, total: 8, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: false } }));
            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
        });

        it('does not dispatch event when creature not found', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [] });
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'Unknown', roll: 5, total: 8, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: false } }));
            const calls = dispatchEventSpy.mock.calls.map(c => c[0]);
            const combatUpdatedCalls = calls.filter(e => e.type === 'combat-summary-updated');
            expect(combatUpdatedCalls).toHaveLength(0);
            dispatchEventSpy.mockRestore();
        });

        it('does not dispatch event when creature succeeds concentration', () => {
            setup();
            getCombatSummary.mockReturnValue({ creatures: [{ name: 'TestWizard', concentration: 'Fireball' }] });
            const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
            window.dispatchEvent(new CustomEvent('concentration-result', { detail: { targetName: 'TestWizard', roll: 18, total: 21, saveBonus: 3, bonusDetail: '+3', spellName: 'Fireball', dc: 15, success: true } }));
            const calls = dispatchEventSpy.mock.calls.map(c => c[0]);
            const combatUpdatedCalls = calls.filter(e => e.type === 'combat-summary-updated');
            expect(combatUpdatedCalls).toHaveLength(0);
            dispatchEventSpy.mockRestore();
        });
    });
});
