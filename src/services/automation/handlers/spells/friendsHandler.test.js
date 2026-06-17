import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
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

import { handle } from './friendsHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { postLogEntry } from '../../../shared/logPoster.js';
import { createSaveListener } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Bard1',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Charisma', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Friends',
        automation: { type: 'friends_cantrip', ...automation },
    };
}

// ─── handle ───

describe('friendsHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns success popup when save succeeds', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('succeeded on the Wisdom save');
    });

    it('clears active Friends tracking on success', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            campaignName,
            expect.stringContaining('_activeFriends_'),
            null,
            campaignName,
        );
    });

    it('applies charmed condition when save fails for player target', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Ally1', type: 'player' }],
        });
        getRuntimeValue.mockReturnValue([]);

        const result = await handle(makeAction({ targetName: 'Ally1' }), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            expect.arrayContaining(['charmed']),
            campaignName,
        );
    });

    it('applies charmed condition to npc creature when save fails', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
    });

    it('adds expiration for charmed condition', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        await handle(makeAction({ targetName: 'Goblin' }), makePlayerStats(), campaignName, null);

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

    it('posts condition log entry when charmed is applied', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        await handle(makeAction({ targetName: 'Goblin' }), makePlayerStats(), campaignName, null);

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                type: 'condition',
                action: 'applied',
                characterName: 'Goblin',
                condition: 'Charmed',
            }),
        );
    });

    it('uses targetName from automation when provided', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'CustomTarget', type: 'npc', conditions: [] }],
        });

        await handle(makeAction({ targetName: 'CustomTarget' }), makePlayerStats(), campaignName, null);

        expect(postLogEntry).toHaveBeenCalledWith(
            campaignName,
            expect.objectContaining({
                characterName: 'CustomTarget',
            }),
        );
    });

    it('defaults targetName to Unknown when not in automation', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.description).toContain('Unknown');
    });

    it('sets active tracking key on campaign', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getCombatContext.mockResolvedValue(null);

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(setRuntimeValue).toHaveBeenCalledWith(
            campaignName,
            expect.stringContaining('_activeFriends_'),
            expect.any(String),
            campaignName,
        );
    });

    it('returns failure popup with correct description when save fails', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc', conditions: [] }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.name).toBe('Friends');
        expect(result.payload.description).toContain('Charmed');
        expect(result.payload.description).toContain('Concentration');
    });

    it('adds charmed condition to npc creature conditions array', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        const creature = { name: 'Goblin', type: 'npc', conditions: [] };
        getCombatContext.mockResolvedValue({ creatures: [creature] });

        await handle(makeAction({ targetName: 'Goblin' }), makePlayerStats(), campaignName, null);

        expect(creature.conditions).toHaveLength(1);
        expect(creature.conditions[0].key).toBe('charmed');
        expect(creature.conditions[0].label).toBe('Charmed');
    });

    it('removes existing charmed condition before adding new one for npc', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: false }),
        });
        const existingCondition = { key: 'charmed', id: 'old-id' };
        const creature = { name: 'Goblin', type: 'npc', conditions: [existingCondition, { key: 'blinded' }] };
        getCombatContext.mockResolvedValue({ creatures: [creature] });

        await handle(makeAction({ targetName: 'Goblin' }), makePlayerStats(), campaignName, null);

        expect(creature.conditions.length).toBe(2);
        const charmedCond = creature.conditions.find((c) => c.key === 'charmed');
        expect(charmedCond.id).not.toBe('old-id');
    });

    it('handles targetCreature being undefined (no combat context)', async () => {
        createSaveListener.mockReturnValue({
            promptId: 'friends-prompt-1',
            promise: Promise.resolve({ success: true }),
        });
        getCombatContext.mockResolvedValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
    });
});
