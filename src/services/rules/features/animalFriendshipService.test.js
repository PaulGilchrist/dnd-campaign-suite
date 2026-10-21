// @maintained-by-ai
// animalFriendshipService lane — triggerAnimalFriendship is the cast seam invoked by
// spellCastService execution/triggerSpells.js handleAnimalFriendship (metaCtx carries
// targetNames + spellSaveDc + slotLevel). Downstream dispatch internals belong to
// automation/handlers/spells/animalFriendshipHandler.test.js; confirm-runner threading
// belongs to useSimpleSpellHandlers.animalFriendship.test.js. This suite owns only the
// service's public contract: name gate, Beast auto-selection, action composition,
// handler pass-through, and the error popup.
// Mock surface = service's real import set 1:1 (automation/index, damageUtils,
// monsterUtils). The legacy logService mock was deleted — the service never imported it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import spells from '../../../../public/data/spells.json';
import { triggerAnimalFriendship } from './animalFriendshipService.js';
import { executeHandler } from '../../automation/index.js';
import { getCombatContext } from '../combat/damageUtils.js';
import { getMonsterData } from '../../npcs/monsterUtils.js';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../npcs/monsterUtils.js', () => ({
    getMonsterData: vi.fn(),
}));

// Disk canon — name/level/DC come from spells.json, never transcribed.
const AF = spells.find(s => s.name === 'Animal Friendship');

const NO_TARGETS_POPUP = {
    type: 'popup',
    payload: {
        type: 'automation_info',
        name: 'Animal Friendship',
        description: 'No Beast targets available for Animal Friendship.',
    },
};

describe('triggerAnimalFriendship', () => {
    const campaignName = 'test-campaign';
    const mapName = 'testMap';
    const stats = {
        name: 'Druid',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Wisdom' },
        proficiency: 4,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const call = (spell = AF, metaCtx = { targetNames: ['Wolf'] }, s = stats) =>
        triggerAnimalFriendship(spell, metaCtx, s, campaignName, mapName);

    it.each([null, undefined, '', 'Animal', 'Friendship', 'Animal Friends'])(
        'returns null and dispatches nothing for non-matching spell name %s',
        async (name) => {
            const result = await call({ ...AF, name });

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
            expect(getCombatContext).not.toHaveBeenCalled();
        }
    );

    it.each(['ANIMAL FRIENDSHIP', 'animal friendship', 'Animal Friendship'])(
        'gate matches %s case-insensitively and returns the handler result verbatim',
        async (name) => {
            const sentinel = { type: 'popup', payload: { handled: name } };
            executeHandler.mockResolvedValue(sentinel);

            const result = await call({ ...AF, name });

            expect(result).toBe(sentinel);
            expect(executeHandler).toHaveBeenCalledTimes(1);
        }
    );

    it('auto-selects only Beasts and dispatches the full composed action', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [
                { name: 'Wolf', type: 'npc' },
                { name: 'Goblin', type: 'npc' },
                { name: 'Druid', type: 'player' },
            ],
        });
        getMonsterData.mockImplementation(async (name) => {
            if (name === 'Wolf') return { type: 'Beast' };
            if (name === 'Goblin') return { type: 'Humanoid' };
            return null;
        });
        const sentinel = { type: 'popup', payload: { handled: true } };
        executeHandler.mockResolvedValue(sentinel);

        const result = await call(AF, { targetNames: [] });

        expect(result).toBe(sentinel);
        expect(getCombatContext).toHaveBeenCalledWith(campaignName);
        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(
            {
                name: 'Animal Friendship',
                automation: {
                    type: 'animal_friendship',
                    saveDc: stats.spellAbilities.saveDc,
                    targetNames: ['Wolf'],
                },
                spell: AF,
                spellSlotLevel: AF.level,
            },
            stats,
            campaignName,
            mapName,
        );
        // Players short-circuit before the bestiary; only npc creatures are looked up.
        expect(getMonsterData).toHaveBeenCalledWith('Wolf', null);
        expect(getMonsterData).toHaveBeenCalledWith('Goblin', null);
        expect(getMonsterData).not.toHaveBeenCalledWith('Druid', null);
    });

    it('passes explicit targetNames straight through without consulting combat context', async () => {
        executeHandler.mockResolvedValue({ type: 'popup' });

        await call(AF, { targetNames: ['Wolf', 'Hawk'] });

        expect(getCombatContext).not.toHaveBeenCalled();
        expect(getMonsterData).not.toHaveBeenCalled();
        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ targetNames: ['Wolf', 'Hawk'] }),
            }),
            stats,
            campaignName,
            mapName,
        );
    });

    it.each([
        {
            label: 'metaCtx spellSaveDc and slotLevel override stats and spell.level',
            spell: AF,
            metaCtx: { targetNames: ['Wolf'], spellSaveDc: 18, slotLevel: 3 },
            s: stats,
            saveDc: 18,
            slotLevel: 3,
        },
        {
            label: 'fallbacks: saveDc = 8 + proficiency, slotLevel = 1',
            spell: { name: 'Animal Friendship' },
            metaCtx: { targetNames: ['Wolf'] },
            s: { name: 'Druid', proficiency: 4 },
            saveDc: 12,
            slotLevel: 1,
        },
    ])('resolves saveDc/slotLevel priority — $label', async ({ spell, metaCtx, s, saveDc, slotLevel }) => {
        executeHandler.mockResolvedValue({ type: 'popup' });

        await call(spell, metaCtx, s);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: expect.objectContaining({ saveDc }),
                spellSlotLevel: slotLevel,
            }),
            s,
            campaignName,
            mapName,
        );
    });

    it.each([
        {
            label: 'empty combat context',
            context: { creatures: [] },
            monsters: {},
        },
        {
            label: 'null combat context',
            context: null,
            monsters: {},
        },
        {
            label: 'only non-Beast npcs (known Humanoid, unknown Giant)',
            context: { creatures: [{ name: 'Goblin', type: 'npc' }, { name: 'Ogre', type: 'npc' }] },
            monsters: { Goblin: { type: 'Humanoid' } },
        },
        {
            label: 'players are never Beasts',
            context: { creatures: [{ name: 'Druid', type: 'player' }] },
            monsters: {},
        },
        {
            label: 'bestiary lookup failure defaults to not a Beast',
            context: { creatures: [{ name: 'Wolf', type: 'npc' }] },
            monsters: 'reject',
        },
    ])('returns the no-targets popup and never dispatches — $label', async ({ context, monsters }) => {
        getCombatContext.mockResolvedValue(context);
        if (monsters === 'reject') {
            getMonsterData.mockRejectedValue(new Error('bestiary unavailable'));
        } else {
            getMonsterData.mockImplementation(async (name) => monsters[name] ?? null);
        }

        const result = await call(AF, { targetNames: null });

        expect(result).toEqual(NO_TARGETS_POPUP);
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('returns the exact error popup when the handler throws', async () => {
        executeHandler.mockRejectedValue(new Error('Handler failed'));

        const result = await call();

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Animal Friendship',
                description: 'Failed to execute Animal Friendship.',
            },
        });
    });
});
