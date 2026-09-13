// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './friendsHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { storeSpellLastAttack, addTargetResult } from '../../common/damageRollback.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto) => auto?.saveDc ?? 10),
    createSaveListener: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../common/damageRollback.js', () => ({
    storeSpellLastAttack: vi.fn(),
    addTargetResult: vi.fn(() => Promise.resolve()),
}));

const campaignName = 'test-campaign';
const defaultPlayerStats = {
    name: 'Bard1',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
};

function makeAction(automation = {}) {
    return { name: 'Friends', automation: { type: 'friends_cantrip', ...automation } };
}

function makeActionNoAutomation() {
    return { name: 'Friends' };
}

function defaultSaveListener(success = true) {
    createSaveListener.mockReturnValue({
        promptId: 'friends-prompt-1',
        promise: Promise.resolve({ success }),
    });
}

// ─── Success path ───

describe('friendsHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('save succeeds', () => {
        it('returns a popup indicating the save succeeded', async () => {
            defaultSaveListener(true);

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Friends',
                    description: expect.stringContaining('succeeded on the Wisdom save'),
                },
            });
        });

        it('logs the ability use and save result entries', async () => {
            defaultSaveListener(true);

            await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(
                1,
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'Bard1',
                    abilityName: 'Friends',
                    description: expect.stringContaining('Bard1 casts Friends on Unknown'),
                    promptId: expect.any(String),
                }),
            );
            expect(addEntry).toHaveBeenNthCalledWith(
                2,
                campaignName,
                expect.objectContaining({
                    type: 'save_result',
                    success: true,
                }),
            );
        });

        it('clears active Friends tracking after a successful save', async () => {
            defaultSaveListener(true);

            await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_activeFriends_Bard1',
                null,
                campaignName,
            );
        });

        it('calls storeSpellLastAttack with correct parameters', async () => {
            defaultSaveListener(true);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
                casterName: 'Bard1',
                spellName: 'Friends',
                saveType: 'WIS',
                saveDc: 10,
                attackScope: 'single',
            });
        });

        it('calls addTargetResult with correct parameters on save success', async () => {
            defaultSaveListener(true);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'success',
                roll: 0,
                total: 0,
                conditions: [],
                appliedDamage: 0,
            });
        });
    });

    // ─── Save fails ───

    describe('save fails', () => {
        it('applies charmed condition to the target', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName,
            );
        });

        it('removes existing charmed condition before re-adding', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue(['charmed', 'frightened']);

            await handle(makeAction({ targetName: 'Ally1' }), defaultPlayerStats, campaignName, null);

            const calls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions',
            );
            expect(calls).toHaveLength(1);
            const newConditions = calls[0][2];
            expect(newConditions).toEqual(['frightened', 'charmed']);
        });

        it('calls addExpiration and addEntry for the target', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Ally1' }), defaultPlayerStats, campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Bard1', targetName: 'Ally1', effects: expect.any(Array), campaignName, rounds: 2 });
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ characterName: 'Ally1' }),
            );
        });

        it('posts a condition log entry with correct details', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'condition',
                    action: 'applied',
                    characterName: 'Goblin',
                    condition: 'Charmed',
                    reason: 'Friends cantrip',
                    note: expect.stringContaining('initiative roll'),
                }),
            );
        });

        it('returns a popup with the failure description', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Friends');
            expect(result.payload.description).toContain('Charmed');
            expect(result.payload.description).toContain('Concentration');
            expect(result.payload.description).toContain('initiative roll');
            expect(result.payload.description).toContain('short rest');
            expect(result.payload.description).toContain('long rest');
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('calls addTargetResult with failure details', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 0,
                total: 0,
                conditions: ['charmed'],
                appliedDamage: 0,
            });
        });
    });

    // ─── Target not in combat ───

    describe('target not in combat', () => {
        it('still applies expiration and log entry when targetCreature is undefined', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'MissingTarget' }), defaultPlayerStats, campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Bard1', targetName: 'MissingTarget', effects: expect.any(Array), campaignName, rounds: 2 });
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ characterName: 'MissingTarget' }),
            );
        });

        it('applies charmed condition via setRuntimeValue even when targetCreature is undefined', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'MissingTarget' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'MissingTarget',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName,
            );
        });
    });

    // ─── No combat context ───

    describe('no combat context', () => {
        it('handles null combat context gracefully on success', async () => {
            defaultSaveListener(true);

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown');
        });

        it('handles null combat context on failure', async () => {
            defaultSaveListener(false);

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.targetName).toBe('Unknown');
        });
    });

    // ─── Custom targetName ───

    describe('custom targetName', () => {
        it('uses the automation targetName in all outputs', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'CustomTarget' }), defaultPlayerStats, campaignName, null);

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ characterName: 'CustomTarget' }),
            );
            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'Bard1', targetName: 'CustomTarget', effects: expect.any(Array), campaignName, rounds: 2 });
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'campaign',
                '_activeFriends_Bard1',
                'CustomTarget',
                campaignName,
            );
        });
    });

    // ─── buildSaveDc integration ───

    describe('buildSaveDc usage', () => {
        it('passes saveDc to the save listener when save fails', async () => {
            const customDc = 13;
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin', saveDc: customDc }), defaultPlayerStats, campaignName, null);

            expect(buildSaveDc).toHaveBeenCalledWith(
                expect.objectContaining({ saveDc: customDc }),
                defaultPlayerStats,
            );
        });
    });

    // ─── createSaveListener invocation ───

    describe('createSaveListener invocation', () => {
        it('calls createSaveListener with correct parameters', async () => {
            defaultSaveListener(true);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                attackerName: 'Bard1',
                saveType: 'WIS',
                saveDc: 10,
                dcSuccess: 'none',
                disadvantage: false,
                condition: 'charmed',
            });
        });
    });

    // ─── Metamagic Heighten (disadvantage) ───

    describe('metamagic Heighten', () => {
        it('passes disadvantage to createSaveListener when metamagicHeighten is set', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle({ name: 'Friends', automation: { type: 'friends_cantrip', targetName: 'Goblin' }, metaCtx: { metamagicHeighten: true } }, defaultPlayerStats, campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                disadvantage: true,
            }));
        });

        it('passes disadvantage: false when metamagicHeighten is not set', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                disadvantage: false,
            }));
        });
    });

    // ─── Save result with roll values ───

    describe('save result with roll values', () => {
        it('includes roll and total in addTargetResult when save result has them (success)', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'friends-prompt-1',
                promise: Promise.resolve({ success: true, roll: 15, total: 18 }),
            });

            await handle(makeAction({ targetName: 'Goblin', saveDc: 13 }), defaultPlayerStats, campaignName, null);

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'success',
                roll: 15,
                total: 18,
                conditions: [],
                appliedDamage: 0,
            });
        });

        it('includes roll and total in addTargetResult when save result has them (failure)', async () => {
            createSaveListener.mockReturnValue({
                promptId: 'friends-prompt-1',
                promise: Promise.resolve({ success: false, roll: 3, total: 6 }),
            });
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin', saveDc: 13 }), defaultPlayerStats, campaignName, null);

            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 3,
                total: 6,
                conditions: ['charmed'],
                appliedDamage: 0,
            });
        });
    });

    // ─── getRuntimeValue fallback (undefined conditions) ───

    describe('getRuntimeValue returning undefined', () => {
        it('handles undefined getRuntimeValue result by defaulting to empty array', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue(undefined);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                ['charmed'],
                campaignName,
            );
        });
    });

    // ─── action.automation undefined ───

    describe('action.automation undefined', () => {
        it('defaults auto to empty object and uses default DC of 10', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeActionNoAutomation(), defaultPlayerStats, campaignName, null);

            expect(buildSaveDc).toHaveBeenCalledWith({}, defaultPlayerStats);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                saveDc: 10,
            }));
        });

        it('still applies charmed and logs entries when automation is missing', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeActionNoAutomation(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.targetName).toBe('Unknown');
            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addExpiration).toHaveBeenCalled();
        });
    });

    // ─── addEntry error handling ───

    describe('addEntry error handling', () => {
        it('catches and logs errors from the first addEntry (ability_use) without failing', async () => {
            defaultSaveListener(true);
            addEntry.mockImplementation(() => {
                // First call rejects, second succeeds
                if (addEntry.mock.calls.length <= 1) {
                    return Promise.reject(new Error('log error'));
                }
                return Promise.resolve();
            });

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
        });

        it('catches and logs errors from the second addEntry (save_result) without failing', async () => {
            defaultSaveListener(true);
            let rejectSecond = false;
            addEntry.mockImplementation(() => {
                if (rejectSecond) {
                    return Promise.reject(new Error('save result log error'));
                }
                rejectSecond = true;
                return Promise.resolve();
            });

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
        });

        it('catches and logs errors from the condition log entry without failing', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);
            let rejectCondition = false;
            addEntry.mockImplementation(() => {
                if (rejectCondition) {
                    return Promise.reject(new Error('condition log error'));
                }
                rejectCondition = true;
                return Promise.resolve();
            });

            const result = await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Charmed');
        });
    });

    // ─── setRuntimeValue calls tracking ───

    describe('setRuntimeValue calls', () => {
        it('sets active Friends tracking before save listener on failure path', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            const activeCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === '_activeFriends_Bard1',
            );
            expect(activeCalls).toHaveLength(1);
            expect(activeCalls[0]).toEqual([
                'campaign',
                '_activeFriends_Bard1',
                'Goblin',
                campaignName,
            ]);
        });

        it('does not clear active Friends tracking on failure path', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            const activeCalls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === '_activeFriends_Bard1' && c[2] === null,
            );
            expect(activeCalls).toHaveLength(0);
        });
    });

    // ─── storeSpellLastAttack invocation ───

    describe('storeSpellLastAttack', () => {
        it('is called with correct parameters on both success and failure paths', async () => {
            defaultSaveListener(true);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
            expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
                casterName: 'Bard1',
                spellName: 'Friends',
                saveType: 'WIS',
                saveDc: 10,
                attackScope: 'single',
            });
        });
    });

    // ─── addTargetResult invocation ───

    describe('addTargetResult', () => {
        it('is called with success result when save succeeds', async () => {
            defaultSaveListener(true);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(addTargetResult).toHaveBeenCalledTimes(1);
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'success',
                roll: 0,
                total: 0,
                conditions: [],
                appliedDamage: 0,
            });
        });

        it('is called with failure result when save fails', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(addTargetResult).toHaveBeenCalledTimes(1);
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 0,
                total: 0,
                conditions: ['charmed'],
                appliedDamage: 0,
            });
        });
    });

    // ─── Popup payload details ───

    describe('popup payload', () => {
        it('includes automation in failure popup payload', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction({ targetName: 'Goblin', saveDc: 13 }), defaultPlayerStats, campaignName, null);

            expect(result.payload.automation).toEqual({ type: 'friends_cantrip', targetName: 'Goblin', saveDc: 13 });
        });

        it('includes automation in failure popup payload when success path', async () => {
            defaultSaveListener(true);

            const result = await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(result.payload.automation).toBeUndefined();
        });
    });
});
