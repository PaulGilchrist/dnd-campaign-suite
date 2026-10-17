// @maintained-by-ai
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
const activeKey = '_activeFriends_Bard1';
const defaultPlayerStats = {
    name: 'Bard1',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
};

// Production builds automation via friendsService with type 'friends'.
function makeAction(automation = {}) {
    return { name: 'Friends', automation: { type: 'friends', ...automation } };
}

function resolveSave({ success = true, roll, total } = {}) {
    createSaveListener.mockReturnValue({
        promptId: 'friends-prompt-1',
        promise: Promise.resolve({ success, roll, total }),
    });
}

describe('friendsHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('save succeeds', () => {
        it('returns exact success popup pinning full description (Unknown target)', async () => {
            resolveSave({ success: true });

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Friends',
                    description: 'Unknown succeeded on the Wisdom save. Friends has no effect.',
                },
            });
        });

        it('logs ability_use then save_result with full composed strings', async () => {
            resolveSave({ success: true });

            await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(addEntry).toHaveBeenCalledTimes(2);
            expect(addEntry).toHaveBeenNthCalledWith(
                1,
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'Bard1',
                    abilityName: 'Friends',
                    description: 'Bard1 casts Friends on Unknown. Unknown must make a WIS save (DC 10) or be Charmed.',
                    promptId: expect.any(String),
                }),
            );
            expect(addEntry).toHaveBeenNthCalledWith(
                2,
                campaignName,
                expect.objectContaining({
                    type: 'save_result',
                    rollType: 'save-friends',
                    targetName: 'Unknown',
                    saveDc: 10,
                    saveType: 'WIS',
                    success: true,
                }),
            );
        });

        it('stores spell attack and records zero-damage success target result', async () => {
            resolveSave({ success: true });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(storeSpellLastAttack).toHaveBeenCalledTimes(1);
            expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, {
                casterName: 'Bard1',
                spellName: 'Friends',
                saveType: 'WIS',
                saveDc: 10,
                attackScope: 'single',
            });
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

        it('clears active Friends tracking after a successful save', async () => {
            resolveSave({ success: true });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', activeKey, null, campaignName);
        });

        it('survives rejected log entries on the success path', async () => {
            resolveSave({ success: true });
            addEntry.mockRejectedValueOnce(new Error('log error'));
            addEntry.mockRejectedValueOnce(new Error('save result log error'));

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(addEntry).toHaveBeenCalledTimes(2);
        });
    });

    describe('save fails', () => {
        it('writes charmed once preserving other conditions and tracks active target without clearing', async () => {
            resolveSave({ success: false, roll: 3, total: 6 });
            getRuntimeValue.mockReturnValue(['charmed', 'frightened']);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            const conditionWrites = setRuntimeValue.mock.calls.filter((c) => c[1] === 'activeConditions');
            expect(conditionWrites).toEqual([['Goblin', 'activeConditions', ['frightened', 'charmed'], campaignName]]);
            const activeWrites = setRuntimeValue.mock.calls.filter((c) => c[1] === activeKey);
            expect(activeWrites).toEqual([['campaign', activeKey, 'Goblin', campaignName]]);
            expect(addTargetResult).toHaveBeenCalledWith(campaignName, {
                targetName: 'Goblin',
                saveResult: 'failure',
                roll: 3,
                total: 6,
                conditions: ['charmed'],
                appliedDamage: 0,
            });
        });

        it('defaults to empty conditions when getRuntimeValue is undefined', async () => {
            resolveSave({ success: false });
            getRuntimeValue.mockReturnValue(undefined);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['charmed'], campaignName);
        });

        it('applies exact-shape expiration and posts full condition log entry', async () => {
            resolveSave({ success: false });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith({
                attackerName: 'Bard1',
                targetName: 'Goblin',
                effects: [{ type: 'condition', condition: 'charmed' }],
                campaignName,
                rounds: 2,
            });
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'condition',
                    action: 'applied',
                    characterName: 'Goblin',
                    condition: 'Charmed',
                    reason: 'Friends cantrip',
                    note: 'Goblin is Charmed by Bard1 (Concentration, up to 1 minute). The spell ends if concentration is lost, on initiative roll, short rest, or long rest.',
                }),
            );
        });

        it('records zero-roll failure target result', async () => {
            resolveSave({ success: false });

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

        it('returns exact failure popup with full description and echoed automation', async () => {
            const auto = { type: 'friends', targetName: 'Goblin', saveDc: 13 };
            resolveSave({ success: false });

            const result = await handle(makeAction({ targetName: 'Goblin', saveDc: 13 }), defaultPlayerStats, campaignName, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Friends',
                    targetName: 'Goblin',
                    description: 'Goblin failed the WIS save and is Charmed (Concentration, up to 1 min). The spell ends if concentration is lost, on initiative roll, short rest, or long rest. When the spell ends, Goblin will know it was Charmed by you.',
                    automation: auto,
                },
            });
        });

        it('survives a rejected condition log entry on the failure path', async () => {
            resolveSave({ success: false });
            addEntry.mockResolvedValueOnce(undefined);
            addEntry.mockRejectedValueOnce(new Error('condition log error'));

            const result = await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Charmed');
        });
    });

    describe('save listener wiring', () => {
        it('creates the save listener with the exact prompt options', async () => {
            resolveSave({ success: true });

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

        it('passes saveDc through buildSaveDc into the listener and rollback store', async () => {
            resolveSave({ success: true });

            await handle(makeAction({ targetName: 'Goblin', saveDc: 13 }), defaultPlayerStats, campaignName, null);

            expect(buildSaveDc).toHaveBeenCalledWith(
                { type: 'friends', targetName: 'Goblin', saveDc: 13 },
                defaultPlayerStats,
            );
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ saveDc: 13 }));
            expect(storeSpellLastAttack).toHaveBeenCalledWith(campaignName, expect.objectContaining({ saveDc: 13 }));
        });

        it('applies disadvantage only when metamagicHeighten is set', async () => {
            resolveSave({ success: false });

            await handle(
                { name: 'Friends', automation: { type: 'friends', targetName: 'Goblin' }, metaCtx: { metamagicHeighten: true } },
                defaultPlayerStats,
                campaignName,
                null,
            );

            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                disadvantage: true,
            }));
        });
    });

    describe('target and automation defaults', () => {
        it('routes every failure-path write to the automation targetName', async () => {
            resolveSave({ success: false });
            getRuntimeValue.mockReturnValue([]);

            const result = await handle(makeAction({ targetName: 'CustomTarget' }), defaultPlayerStats, campaignName, null);

            expect(result.payload.targetName).toBe('CustomTarget');
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', activeKey, 'CustomTarget', campaignName);
            expect(setRuntimeValue).toHaveBeenCalledWith('CustomTarget', 'activeConditions', ['charmed'], campaignName);
            expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'CustomTarget' }));
            expect(addEntry).toHaveBeenNthCalledWith(
                1,
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'Bard1',
                    description: 'Bard1 casts Friends on CustomTarget. CustomTarget must make a WIS save (DC 10) or be Charmed.',
                }),
            );
            expect(addEntry).toHaveBeenNthCalledWith(
                2,
                campaignName,
                expect.objectContaining({
                    type: 'condition',
                    characterName: 'CustomTarget',
                }),
            );
        });

        it('defaults missing automation to empty object, DC 10, Unknown target, still applying charmed', async () => {
            resolveSave({ success: false });

            const result = await handle({ name: 'Friends' }, defaultPlayerStats, campaignName, null);

            expect(buildSaveDc).toHaveBeenCalledWith({}, defaultPlayerStats);
            expect(createSaveListener).toHaveBeenCalledWith(campaignName, expect.objectContaining({ saveDc: 10 }));
            expect(result.type).toBe('popup');
            expect(result.payload.targetName).toBe('Unknown');
            expect(setRuntimeValue).toHaveBeenCalledWith('Unknown', 'activeConditions', ['charmed'], campaignName);
            expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({ targetName: 'Unknown', rounds: 2 }));
            expect(addEntry).toHaveBeenCalledTimes(2);
        });
    });
});
