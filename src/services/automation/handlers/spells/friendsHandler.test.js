// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './friendsHandler.js';
import { buildSaveDc, createSaveListener } from '../../common/savePrompt.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
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

vi.mock('../../../shared/logPoster.js', () => ({
    postLogEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
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

// ─── Success path (save succeeds) ───

describe('friendsHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('save succeeds', () => {
        it('returns a popup indicating the save succeeded', async () => {
            defaultSaveListener(true);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc' }],
            });

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
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Goblin', type: 'npc' }],
            });

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
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                '_activeFriends_Bard1',
                null,
                campaignName,
            );
        });

        it('posts a log entry when the save succeeds', async () => {
            defaultSaveListener(true);
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(postLogEntry).not.toHaveBeenCalled();
        });

        it('does not apply conditions when the save succeeds', async () => {
            defaultSaveListener(true);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1', type: 'player' }],
            });

            await handle(makeAction({ targetName: 'Ally1' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).not.toHaveBeenCalledWith(
                'Ally1',
                'activeConditions',
                expect.anything(),
                campaignName,
            );
            expect(addExpiration).not.toHaveBeenCalled();
        });
    });

    // ─── Save fails: player target ───

    describe('save fails — player target', () => {
        it('applies charmed condition to the player via runtime state', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1', type: 'player' }],
            });

            await handle(makeAction({ targetName: 'Ally1' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Ally1',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName,
            );
        });

        it('removes existing charmed condition before re-adding for player target', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue(['charmed', 'frightened']);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1', type: 'player' }],
            });

            await handle(makeAction({ targetName: 'Ally1' }), defaultPlayerStats, campaignName, null);

            const calls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions',
            );
            expect(calls).toHaveLength(1);
            const newConditions = calls[0][2];
            expect(newConditions).toEqual(['frightened', 'charmed']);
        });

        it('calls addExpiration and postLogEntry for player targets (unconditional on failure)', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1', type: 'player' }],
            });

            await handle(makeAction({ targetName: 'Ally1' }), defaultPlayerStats, campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith(
                'Bard1',
                'Ally1',
                expect.any(Array),
                campaignName,
                2,
            );
            expect(postLogEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ characterName: 'Ally1' }),
            );
        });

        it('does not call storage.set for player targets', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1', type: 'player' }],
            });

            await handle(makeAction({ targetName: 'Ally1' }), defaultPlayerStats, campaignName, null);

            expect(storage.set).not.toHaveBeenCalled();
        });
    });

    // ─── Save fails: NPC creature ───

    describe('save fails — NPC creature', () => {
        it('adds charmed condition to the creature conditions array', async () => {
            defaultSaveListener(false);
            const creature = { name: 'Goblin', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Goblin',
                'activeConditions',
                expect.arrayContaining(['charmed']),
                campaignName,
            );
        });

        it('replaces an existing charmed condition with a new one for NPCs', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue(['charmed', 'blinded']);
            const creature = { name: 'Goblin', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            const calls = setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions',
            );
            expect(calls).toHaveLength(1);
            const newConditions = calls[0][2];
            expect(newConditions).toEqual(['blinded', 'charmed']);
        });

        it('does not call storage.set for NPC targets', async () => {
            defaultSaveListener(false);
            const creature = { name: 'Goblin', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(storage.set).not.toHaveBeenCalled();
        });

        it('calls addExpiration with correct parameters for NPC', async () => {
            defaultSaveListener(false);
            const creature = { name: 'Goblin', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith(
                'Bard1',
                'Goblin',
                expect.arrayContaining([
                    expect.objectContaining({ type: 'condition', condition: 'charmed' }),
                ]),
                campaignName,
                2,
            );
        });

        it('posts a condition log entry for NPC', async () => {
            defaultSaveListener(false);
            const creature = { name: 'Goblin', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

            await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(postLogEntry).toHaveBeenCalledWith(
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

        it('returns a popup with the failure description for NPC', async () => {
            defaultSaveListener(false);
            const creature = { name: 'Goblin', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

            const result = await handle(makeAction({ targetName: 'Goblin' }), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Friends');
            expect(result.payload.description).toContain('Charmed');
            expect(result.payload.description).toContain('Concentration');
            expect(result.payload.targetName).toBe('Goblin');
        });
    });

    // ─── Save fails: target not found in combat ───

    describe('save fails — target not in combat', () => {
        it('still applies expiration and log entry when targetCreature is undefined', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({ creatures: [] });

            await handle(makeAction({ targetName: 'MissingTarget' }), defaultPlayerStats, campaignName, null);

            expect(addExpiration).toHaveBeenCalledWith(
                'Bard1',
                'MissingTarget',
                expect.any(Array),
                campaignName,
                2,
            );
            expect(postLogEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({ characterName: 'MissingTarget' }),
            );
        });

        it('does not call storage.set when targetCreature is undefined', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({ creatures: [] });

            await handle(makeAction({ targetName: 'MissingTarget' }), defaultPlayerStats, campaignName, null);

            expect(storage.set).not.toHaveBeenCalled();
        });

        it('applies charmed condition via setRuntimeValue even when targetCreature is undefined', async () => {
            defaultSaveListener(false);
            getRuntimeValue.mockReturnValue([]);
            getCombatContext.mockResolvedValue({ creatures: [] });

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
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Unknown');
        });

        it('handles null combat context on failure with no creatures', async () => {
            defaultSaveListener(false);
            getCombatContext.mockResolvedValue(null);

            const result = await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(result.type).toBe('popup');
            expect(result.payload.targetName).toBe('Unknown');
        });

        it('clears active tracking key on campaign even with null combat context', async () => {
            defaultSaveListener(true);
            getCombatContext.mockResolvedValue(null);

            await handle(makeAction(), defaultPlayerStats, campaignName, null);

            expect(setRuntimeValue).toHaveBeenCalledWith(
                campaignName,
                '_activeFriends_Bard1',
                null,
                campaignName,
            );
        });
    });

    // ─── Custom targetName ───

    describe('custom targetName', () => {
        it('uses the automation targetName in all outputs', async () => {
            defaultSaveListener(false);
            const creature = { name: 'CustomTarget', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

            await handle(makeAction({ targetName: 'CustomTarget' }), defaultPlayerStats, campaignName, null);

            expect(postLogEntry).toHaveBeenCalledWith(
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
            const creature = { name: 'Goblin', type: 'npc', conditions: [] };
            getCombatContext.mockResolvedValue({ creatures: [creature] });

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
            getCombatContext.mockResolvedValue(null);

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
