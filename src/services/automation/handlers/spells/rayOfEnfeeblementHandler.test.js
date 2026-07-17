// @improved-by-ai
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

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imported mocks ─────────────────────────────────────────────

import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

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
        vi.clearAllMocks();
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
                'test-campaign',
                'targetEffects',
                expect.arrayContaining([
                    expect.objectContaining({
                        target: 'Goblin',
                        effect: 'ray_of_enfeeble_debuff',
                        source: 'Test Wizard',
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
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            };
            const otherEffect = {
                target: 'Goblin',
                effect: 'ray_of_enfeeble_debuff',
                source: 'Other Wizard',
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
                strCheckDisadvantage: true,
                rayOfEnfeebleDamageReduction: true,
            });
            expect(newEffects[1]).toBe(otherEffect);
            expect(newEffects[2]).toEqual({ target: 'Goblin', effect: 'other' });
        });

        it('adds expiration for the debuff (10 rounds)', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith(
                'Test Wizard',
                'Goblin',
                [
                    {
                        type: 'remove_target_effect',
                        effectKey: 'ray_of_enfeeble_debuff',
                        source: 'Test Wizard',
                    },
                ],
                'test-campaign',
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
                'test-campaign',
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

            expect(addExpiration).toHaveBeenCalledWith(
                'Test Wizard',
                'Goblin',
                [
                    {
                        type: 'remove_target_effect',
                        effectKey: 'disadvantage_next_attack',
                        source: 'Test Wizard',
                    },
                ],
                'test-campaign',
                undefined,
                'Test Wizard'
            );
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
    });

});
