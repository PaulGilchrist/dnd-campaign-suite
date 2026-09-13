// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, isCompelledDuelActive, endCompelledDuel, checkCompelledDuelAttackExpiry } from './compelledDuelHandler.js';

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

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => ({ creatures: [] })),
}));

// ── Imported mocks ─────────────────────────────────────────────

import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { addConcentration } from '../../../combat/concentration/concentrationService.js';
import { getCombatSummary } from '../../../encounters/combatData.js';

// ── Helpers ────────────────────────────────────────────────────

function makePlayerStats(overrides = {}) {
    return {
        name: 'Paladin',
        proficiency: 2,
        abilities: [{ name: 'Wisdom', bonus: 4 }],
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Compelled Duel',
        automation: { targetName: 'Goblin' },
        ...overrides,
    };
}

const duelEffect = { target: 'Goblin', effect: 'compelled_duel', source: 'Paladin', duration: 'concentration' };

// ── Tests ──────────────────────────────────────────────────────

describe('compelledDuelHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue({ creatures: [] });
    });

    describe('handle — failed save', () => {
        it('returns popup with correct structure and content', async () => {
            buildSaveDc.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.targetName).toBe('Goblin');
            expect(result.payload.description).toContain('failed the WIS save');
            expect(result.payload.description).toContain('Disadvantage on attack rolls against creatures other than Paladin');
            expect(result.payload.automation).toEqual({ targetName: 'Goblin' });
        });

        it('handles missing automation targetName gracefully', async () => {
            buildSaveDc.mockReturnValue(10);

            const action = makeAction({ automation: {} });

            const result = await handle(action, makePlayerStats(), 'test-campaign', null);

            expect(result.payload.targetName).toBe('Unknown');
            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Unknown',
                saveType: 'WIS',
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
                characterName: 'Paladin',
                abilityName: 'Compelled Duel',
                description: expect.stringContaining('Paladin casts Compelled Duel on Goblin'),
                promptId: 'test-prompt-id',
            });
        });

        it('triggers a WIS save prompt via createSaveListener', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'WIS',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
            });
        });

        it('applies the compelled_duel effect to targetEffects', async () => {
            buildSaveDc.mockReturnValue(10);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [duelEffect],
                'test-campaign'
            );
        });

        it('deduplicates an existing compelled_duel effect from the same caster', async () => {
            buildSaveDc.mockReturnValue(10);

            const otherEffect = {
                target: 'Goblin',
                effect: 'compelled_duel',
                source: 'Other Paladin',
                duration: 'concentration',
            };
            getRuntimeValue.mockReturnValue([duelEffect, otherEffect]);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const call = setRuntimeValue.mock.calls[0];
            const newEffects = call[2];
            expect(newEffects).toHaveLength(2);
            expect(newEffects[0]).toEqual(duelEffect);
            expect(newEffects[1]).toBe(otherEffect);
        });

        it('sets concentration tracking on the caster', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addConcentration).toHaveBeenCalledWith(
                { creatures: [] },
                'Paladin',
                'Compelled Duel',
                10
            );
        });

        it('adds expiration for the duel effect', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Paladin', targetName: 'Goblin', effects: [
                    {
                        type: 'remove_target_effect',
                        effectKey: 'compelled_duel',
                        source: 'Paladin',
                    },
                ], campaignName: 'test-campaign' });
        });

        it('posts a condition log entry for the effect', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'condition',
                action: 'applied',
                characterName: 'Goblin',
                condition: 'Compelled Duel',
                reason: 'Compelled Duel (failed save)',
                note: expect.stringContaining('Disadvantage on attack rolls against creatures other than Paladin'),
                timestamp: expect.any(Number),
            });
        });

        it('records a failed save result for rollback', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            const { addTargetResult } = await import('../../common/damageRollback.js');
            expect(addTargetResult).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 0,
                total: 0,
                conditions: ['compelled_duel'],
                appliedDamage: 0,
            });
        });
    });

    describe('handle — successful save', () => {
        beforeEach(() => {
            createSaveListener.mockReturnValue({
                promptId: 'test-prompt-id',
                promise: Promise.resolve({ success: true }),
            });
        });

        it('returns popup describing the successful save', async () => {
            buildSaveDc.mockReturnValue(10);

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('succeeded on the WIS save');
        });

        it('logs the save result on successful save', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            // addEntry is called twice: first for ability_use, second for save_result
            expect(addEntry).toHaveBeenNthCalledWith(2, 'test-campaign', {
                type: 'save_result',
                characterName: 'Paladin',
                rollType: 'save-compelled-duel',
                targetName: 'Goblin',
                saveDc: 10,
                saveType: 'WIS',
                success: true,
                description: expect.stringContaining('succeeded on WIS save against Compelled Duel'),
            });
        });

        it('does not apply the compelled_duel effect on success', async () => {
            buildSaveDc.mockReturnValue(10);

            await handle(makeAction(), makePlayerStats(), 'test-campaign', null);

            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addConcentration).not.toHaveBeenCalled();
        });
    });

    describe('isCompelledDuelActive', () => {
        it('returns true when the target has an active duel from the caster', () => {
            getRuntimeValue.mockReturnValue([duelEffect, { target: 'Other', effect: 'compelled_duel', source: 'Paladin' }]);

            expect(isCompelledDuelActive('Goblin', 'Paladin', 'test-campaign')).toBe(true);
        });

        it('returns false when the duel is from a different caster', () => {
            getRuntimeValue.mockReturnValue([duelEffect]);

            expect(isCompelledDuelActive('Goblin', 'Other Paladin', 'test-campaign')).toBe(false);
        });

        it('returns false when there are no effects', () => {
            getRuntimeValue.mockReturnValue([]);

            expect(isCompelledDuelActive('Goblin', 'Paladin', 'test-campaign')).toBe(false);
        });
    });

    describe('endCompelledDuel', () => {
        it('removes the effect and returns a popup', () => {
            getRuntimeValue.mockReturnValue([duelEffect, { target: 'Goblin', effect: 'other' }]);

            const result = endCompelledDuel('Paladin', 'Goblin', 'test-campaign', 'reason');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                'targetEffects',
                [{ target: 'Goblin', effect: 'other' }],
                'test-campaign',
                true
            );
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no longer compelled');
            expect(result.payload.description).toContain('reason');
        });

        it('logs a condition removal entry', () => {
            getRuntimeValue.mockReturnValue([duelEffect]);

            endCompelledDuel('Paladin', 'Goblin', 'test-campaign', 'reason');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'condition',
                action: 'removed',
                characterName: 'Goblin',
                condition: 'Compelled Duel',
                reason: 'Compelled Duel ended',
                note: 'reason',
                timestamp: expect.any(Number),
            });
        });

        it('returns null when no matching effect exists', () => {
            getRuntimeValue.mockReturnValue([{ target: 'Goblin', effect: 'other' }]);

            expect(endCompelledDuel('Paladin', 'Goblin', 'test-campaign', 'reason')).toBeNull();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('checkCompelledDuelAttackExpiry', () => {
        it('returns null when there is no active duel from the caster', () => {
            getRuntimeValue.mockReturnValue([]);

            expect(checkCompelledDuelAttackExpiry('Paladin', 'Orc', 'test-campaign')).toBeNull();
        });

        it('returns null when attacking the duel target', () => {
            getRuntimeValue.mockReturnValue([duelEffect]);

            expect(checkCompelledDuelAttackExpiry('Paladin', 'Goblin', 'test-campaign')).toBeNull();
        });

        it('returns null when no attacked target is provided', () => {
            getRuntimeValue.mockReturnValue([duelEffect]);

            expect(checkCompelledDuelAttackExpiry('Paladin', null, 'test-campaign')).toBeNull();
        });

        it('ends the duel when the caster attacks a different creature', () => {
            getRuntimeValue.mockReturnValue([duelEffect]);

            const result = checkCompelledDuelAttackExpiry('Paladin', 'Orc', 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [], 'test-campaign', true);
            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Orc');
        });
    });
});
