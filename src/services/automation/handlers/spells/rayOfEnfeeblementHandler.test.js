// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './rayOfEnfeeblementHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 10),
    createSaveListener: vi.fn(() => ({
        promptId: 'test-prompt-id',
        promise: Promise.resolve({ success: false }),
    })),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => []),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imported mocks ─────────────────────────────────────────────

import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { getCombatSummary } from '../../../encounters/combatData.js';
import { isRayOfEnfeeblementActive } from './rayOfEnfeeblementHandler.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import storage from '../../../ui/storage.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'Test Wizard',
        proficiency: 2,
        abilities: [{ name: 'Intelligence', bonus: 4 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Ray of Enfeeblement',
        automation: { targetName: 'Goblin' },
        ...overrides,
    };
}

// ── Tests ──────────────────────────────────────────────────────

describe('rayOfEnfeeblementHandler', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        getCombatSummary.mockReturnValue({ creatures: [] });
    });

    describe('handle — failed save', () => {
        it('returns popup with correct structure and content', async () => {
            buildSaveDc.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.description).toContain('failed the CON save');
            expect(result.payload.description).toContain('Disadvantage on Strength-based d20 tests');
            expect(result.payload.description).toContain('subtracts 1d8 from all damage rolls');
            expect(result.payload.automation).toEqual({ targetName: 'Goblin' });
        });

        it('handles missing automation targetName gracefully', async () => {
            buildSaveDc.mockReturnValue(10);

            const action = makeAction({ automation: {} });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.targetName).toBe('Unknown');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Unknown',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
            });
        });

        it('logs the ability use with correct details', async () => {
            buildSaveDc.mockReturnValue(12);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'Test Wizard',
                abilityName: 'Ray of Enfeeblement',
                description: expect.stringContaining('Test Wizard casts Ray of Enfeeblement on Goblin'),
                promptId: 'test-prompt-id',
            });
        });

        it('triggers a CON save prompt via createSaveListener', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
            });
        });

        it('applies the debuff effect to targetEffects and deduplicates from same caster', async () => {
            buildSaveDc.mockReturnValue(10);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        effect: 'ray_of_enfeeble_debuff',
                        source: 'Test Wizard',
                        slotLevel: 2,
                        duration: 'concentration',
                        strCheckDisadvantage: true,
                        rayOfEnfeebleDamageReduction: true,
                    }),
                ]),
                'test-campaign'
            );
        });

        it('replaces an existing ray_of_enfeeble_debuff effect from the same caster but not from other casters', async () => {
            buildSaveDc.mockReturnValue(10);

            const sameCasterEffect = {
                target: 'Goblin',
                effect: 'ray_of_enfeeble_debuff',
                source: 'Test Wizard',
                slotLevel: 2,
                duration: 'concentration',
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            };
            const otherEffect = {
                target: 'Goblin',
                effect: 'ray_of_enfeeble_debuff',
                source: 'Other Wizard',
                slotLevel: 2,
                duration: 'concentration',
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            };
            getRuntimeValue.mockReturnValue([sameCasterEffect, otherEffect, { target: 'Goblin', effect: 'other' }]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const call = setRuntimeValue.mock.calls[0];
            const newEffects = call[2];
            expect(newEffects).toHaveLength(3);
            expect(newEffects[0]).toEqual({
                target: 'Goblin',
                effect: 'ray_of_enfeeble_debuff',
                source: 'Test Wizard',
                slotLevel: 2,
                duration: 'concentration',
                dc: 10,
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            });
            expect(newEffects[1]).toBe(otherEffect);
            expect(newEffects[2]).toEqual({ target: 'Goblin', effect: 'other' });
        });

        it('adds expiration for the debuff (10 rounds)', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Test Wizard', targetName: 'Goblin', effects: [
                    {
                        type: 'remove_target_effect',
                        effectKey: 'ray_of_enfeeble_debuff',
                        source: 'Test Wizard',
                    },
                ], campaignName: 'test-campaign' });
        });

        it('uses numeric saveDc from automation (no fallback DC 10) on the save prompt', async () => {
            buildSaveDc.mockImplementation((auto) => (typeof auto.saveDc === 'number' ? auto.saveDc : 10));

            const action = makeAction({ automation: { targetName: 'Thug 1', saveDc: 17 } });
            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Thug 1',
                saveType: 'CON',
                saveDc: 17,
                dcSuccess: 'none',
                disadvantage: false,
            });
            expect(result.payload.targetName).toBe('Thug 1');
        });

        it('stores dc on the debuff targetEffect for badge repeat saves', async () => {
            buildSaveDc.mockReturnValue(17);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ automation: { targetName: 'Thug 1', saveDc: 17 } }), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Thug 1',
                        effect: 'ray_of_enfeeble_debuff',
                        dc: 17,
                    }),
                ]),
                'test-campaign'
            );
        });

        it('writes activeConditionMeta with dc and CON ability on failed save', async () => {
            buildSaveDc.mockReturnValue(17);
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                if (scope === 'Goblin' && key === 'activeConditionMeta') return { poisoned: { dc: 12, ability: 'con' } };
                return [];
            });

            await handle(makeAction({ automation: { targetName: 'Goblin', saveDc: 17 } }), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditionMeta',
                {
                    poisoned: { dc: 12, ability: 'con' },
                    ray_of_enfeeble_debuff: { dc: 17, ability: 'con' },
                },
                'test-campaign'
            );
        });

        it('writes activeConditionMeta even when existing meta is null', async () => {
            buildSaveDc.mockReturnValue(15);
            getRuntimeValue.mockImplementation((scope, key) => {
                if (scope === 'campaign' && key === 'targetEffects') return [];
                if (scope === 'Goblin' && key === 'activeConditionMeta') return null;
                return [];
            });

            await handle(makeAction({ automation: { targetName: 'Goblin', saveDc: 15 } }), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditionMeta',
                { ray_of_enfeeble_debuff: { dc: 15, ability: 'con' } },
                'test-campaign'
            );
        });

        it('posts a condition log entry for the debuff', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'condition',
                action: 'applied',
                characterName: 'Goblin',
                condition: 'Ray of Enfeeblement debuff',
                reason: 'Ray of Enfeeblement (failed save)',
                note: expect.stringContaining('Disadvantage on Strength-based d20 tests'),
                timestamp: expect.any(Number),
            });
        });
    });

    describe('handle — successful save', () => {
        it('returns popup describing the successful save', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('succeeded on the CON save');
            expect(result.payload.description).toContain('Disadvantage on the next attack roll');
        });

        it('triggers a CON save prompt via createSaveListener', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
            });
        });

        it('logs the save result on successful save', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            // addEntry is called twice: first for ability_use, second for save_result
            expect(addEntry).toHaveBeenNthCalledWith(2, 'test-campaign', {
                type: 'save_result',
                characterName: 'Test Wizard',
                rollType: 'save-ray-of-enfeeblement',
                targetName: 'Goblin',
                saveDc: 10,
                saveType: 'CON',
                success: true,
                description: expect.stringContaining('succeeded on CON save'),
            });
        });

        it('applies disadvantage_next_attack effect to targetEffects and deduplicates from same caster', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Test Wizard',
                        effect: 'disadvantage_next_attack',
                    }),
                ]),
                'test-campaign'
            );
        });

        it('adds expiration for the disadvantage effect (1 round)', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Test Wizard', targetName: 'Goblin', effects: [
                    {
                        type: 'remove_target_effect',
                        effectKey: 'disadvantage_next_attack',
                        source: 'Test Wizard',
                    },
                ], campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'Test Wizard' });
        });

        it('posts an automation_info log entry for the successful save', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'automation_info',
                action: 'applied',
                characterName: 'Goblin',
                effect: 'Disadvantage on next attack roll',
                reason: 'Ray of Enfeeblement (successful save)',
                note: expect.stringContaining('Disadvantage on the next attack roll'),
                timestamp: expect.any(Number),
            });
        });

        it('replaces an existing disadvantage_next_attack effect from the same caster', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            const existingEffect = {
                target: 'Goblin',
                source: 'Test Wizard',
                effect: 'disadvantage_next_attack',
            };
            const otherEffect = {
                target: 'Goblin',
                source: 'Other Wizard',
                effect: 'disadvantage_next_attack',
            };
            getRuntimeValue.mockReturnValue([existingEffect, otherEffect]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const call = setRuntimeValue.mock.calls[0];
            const newEffects = call[2];
            expect(newEffects).toHaveLength(2);
            expect(newEffects[0]).toEqual({
                target: 'Goblin',
                source: 'Test Wizard',
                effect: 'disadvantage_next_attack',
            });
            expect(newEffects[1]).toBe(otherEffect);
        });

        it('handles getRuntimeValue returning null for targetEffects on successful save', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });
            getRuntimeValue.mockReturnValue(null);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        source: 'Test Wizard',
                        effect: 'disadvantage_next_attack',
                    }),
                ]),
                'test-campaign'
            );
        });
    });

    describe('isRayOfEnfeeblementActive', () => {
        it('returns true when the debuff effect exists for the target and caster', () => {
            getRuntimeValue.mockReturnValue([
                {
                    target: 'Goblin',
                    effect: 'ray_of_enfeeble_debuff',
                    source: 'Test Wizard',
                },
            ]);

            const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');

            expect(result).toBe(true);
        });

        it('returns false when the debuff effect does not exist for the target', () => {
            getRuntimeValue.mockReturnValue([
                {
                    target: 'Goblin',
                    effect: 'ray_of_enfeeble_debuff',
                    source: 'Other Wizard',
                },
            ]);

            const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');

            expect(result).toBe(false);
        });

        it('returns false when the debuff effect does not exist for the caster', () => {
            getRuntimeValue.mockReturnValue([
                {
                    target: 'Goblin',
                    effect: 'ray_of_enfeeble_debuff',
                    source: 'Other Wizard',
                },
            ]);

            const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');

            expect(result).toBe(false);
        });

        it('returns false when targetEffects is empty', () => {
            getRuntimeValue.mockReturnValue([]);

            const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');

            expect(result).toBe(false);
        });

        it('returns false when targetEffects is null/undefined', () => {
            getRuntimeValue.mockReturnValue(null);

            const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');

            expect(result).toBe(false);
        });

        it('returns false when there is no matching effect', () => {
            getRuntimeValue.mockReturnValue([
                {
                    target: 'Goblin',
                    effect: 'other_effect',
                    source: 'Test Wizard',
                },
            ]);

            const result = isRayOfEnfeeblementActive('Goblin', 'Test Wizard', 'test-campaign');

            expect(result).toBe(false);
        });
    });

    describe('handle — edge cases and error handling', () => {
        it('handles action with no automation property', async () => {
            buildSaveDc.mockReturnValue(10);

            const action = { name: 'Ray of Enfeeblement' };

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.targetName).toBe('Unknown');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Unknown',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
            });
        });

        it('handles action with null automation property', async () => {
            buildSaveDc.mockReturnValue(10);

            const action = { name: 'Ray of Enfeeblement', automation: null };

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.targetName).toBe('Unknown');
        });

        it('uses slotLevel from automation when present on failed save', async () => {
            buildSaveDc.mockReturnValue(10);

            const action = makeAction({ automation: { targetName: 'Goblin', slotLevel: 4 } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        slotLevel: 4,
                    }),
                ]),
                'test-campaign'
            );
        });

        it('sets disadvantage from metamagicHeighten on save prompt', async () => {
            buildSaveDc.mockReturnValue(10);

            const action = makeAction({ metaCtx: { metamagicHeighten: true } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: true,
            });
        });

        it('handles save result with missing roll/total fields on success', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addTargetResult).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveResult: 'success',
                roll: 0,
                total: 0,
                conditions: [],
                appliedDamage: 0,
            });
        });

        it('handles save result with missing roll/total fields on failure', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addTargetResult).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 0,
                total: 0,
                conditions: ['ray_of_enfeeble_debuff'],
                appliedDamage: 0,
            });
        });

        it('logs error when ability_use addEntry rejects', async () => {
            buildSaveDc.mockReturnValue(10);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            addEntry.mockImplementation(() => Promise.reject(new Error('log failure')));

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[rayOfEnfeeblement] Error:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('logs error when save_result addEntry rejects', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            addEntry.mockImplementation(() => {
                if (addEntry.mock.calls.length === 1) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('log failure'));
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[rayOfEnfeeblement] Error:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('logs error when condition addEntry rejects', async () => {
            buildSaveDc.mockReturnValue(10);
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            let callCount = 0;
            addEntry.mockImplementation(() => {
                callCount++;
                if (callCount <= 1) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('log failure'));
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[rayOfEnfeeblement] Error:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('logs error when automation_info addEntry rejects on success', async () => {
            buildSaveDc.mockReturnValue(10);
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });
            const consoleErrorSpy = vi.spyOn(console, 'error').mockReturnValue();

            addEntry.mockImplementation(() => {
                if (addEntry.mock.calls.length <= 2) {
                    return Promise.resolve();
                }
                return Promise.reject(new Error('log failure'));
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[rayOfEnfeeblement] Error:',
                expect.any(Error)
            );

            consoleErrorSpy.mockRestore();
        });

        it('uses default slotLevel 2 when automation.slotLevel is missing', async () => {
            buildSaveDc.mockReturnValue(10);

            const action = makeAction({ automation: { targetName: 'Goblin' } });

            await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        slotLevel: 2,
                    }),
                ]),
                'test-campaign'
            );
        });

        it('stores spell last attack with correct parameters', async () => {
            buildSaveDc.mockReturnValue(12);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(storeSpellLastAttack).toHaveBeenCalledWith('test-campaign', {
                casterName: 'Test Wizard',
                spellName: 'Ray of Enfeeblement',
                saveType: 'CON',
                saveDc: 12,
                attackScope: 'single',
            });
        });

        it('adds concentration tracking on failed save', async () => {
            buildSaveDc.mockReturnValue(10);
            getCombatSummary.mockReturnValue({ creatures: [], concentration: { add: vi.fn() } });

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addConcentration).toHaveBeenCalledWith(
                expect.objectContaining({ creatures: [] }),
                'Test Wizard',
                'Ray of Enfeeblement',
                10
            );
        });

        it('persists the mutated combatSummary after adding concentration with the resolved dc', async () => {
            buildSaveDc.mockReturnValue(17);
            const cs = { creatures: [{ name: 'Test Wizard' }] };
            getCombatSummary.mockReturnValue(cs);

            await handle(makeAction({ automation: { targetName: 'Thug 1', saveDc: 17 } }), makePlayerStats(), 'test-campaign', null);

            expect(addConcentration).toHaveBeenCalledWith(cs, 'Test Wizard', 'Ray of Enfeeblement', 17);
            expect(storage.set).toHaveBeenCalledWith('combatSummary', cs, 'test-campaign');
        });

        it('skips concentration persistence when no combat summary exists', async () => {
            buildSaveDc.mockReturnValue(15);
            getCombatSummary.mockReturnValue(null);

            await handle(makeAction({ automation: { targetName: 'Thug 1', saveDc: 15 } }), makePlayerStats(), 'test-campaign', null);

            expect(addConcentration).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalled();
        });
    });
});
