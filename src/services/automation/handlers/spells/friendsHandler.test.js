// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './friendsHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import storage from '../../../ui/storage.js';

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

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

const campaignName = 'TestCampaign';
const defaultPlayerStats = {
    name: 'Bard1',
    level: 5,
    proficiency: 3,
    abilities: [{ name: 'Charisma', bonus: 3 }],
};

function makeAction(automation = {}) {
    return { name: 'Friends', automation: { type: 'friends_cantrip', ...automation } };
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
                campaignName,
                '_activeFriends_Bard1',
                null,
                campaignName,
            );
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

            expect(addExpiration).toHaveBeenCalledWith(
                'Bard1',
                'Ally1',
                expect.any(Array),
                campaignName,
                2,
            );
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
            expect(result.payload.targetName).toBe('Goblin');
        });

        it('does not call storage.set', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(storage.set).not.toHaveBeenCalled();
        });
    });

    // ─── Target not in combat ───

    describe('target not in combat', () => {
        it('still applies expiration and log entry when targetCreature is undefined', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);

            await handle(makeAction({ targetName: 'MissingTarget' }), defaultPlayerStats, campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith(
                'Bard1',
                'MissingTarget',
                expect.any(Array),
                campaignName,
                2,
            );
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
            expect(addExpiration).toHaveBeenCalledWith(
                'Bard1',
                'CustomTarget',
                expect.any(Array),
                campaignName,
                2,
            );
            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
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
                saveType: 'WIS',
                saveDc: 10,
                dcSuccess: 'none',
            });
        });
    });
});
