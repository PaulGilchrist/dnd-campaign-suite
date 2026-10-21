// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cloneDeep } from 'lodash';
import { triggerRayOfEnfeeblement } from './rayOfEnfeeblementService.js';
import { executeHandler } from '../../automation/index.js';
import spells5e from '../../../../public/data/spells.json';
import spells2024 from '../../../../public/data/2024/spells.json';

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

// Forwarder lane. Sole production caller: triggerSpells.js:319
//   triggerRayOfEnfeeblement(spell, { ...metaCtx, spellSaveDc, targetName: rayTarget?.name }, playerStats, campaignName, mapName)
// Consumer of the envelope: automation/handlers/spells/rayOfEnfeeblementHandler.js (saveDc + targetName).
// Zero runtime-store writes here (no skipSync audit needed); zero dice rolled here.
const diskRow = (data) => data.find((s) => s.index === 'ray-of-enfeeblement');
const disk5e = diskRow(spells5e);
const disk2024 = diskRow(spells2024);

const campaignName = 'TestCampaign';
const mapName = 'testMap';
const playerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
    proficiency: 4,
};

describe('rayOfEnfeeblementService.triggerRayOfEnfeeblement', () => {
    let consoleSpy;

    beforeEach(() => {
        // vitest-4: clearAllMocks RETAINS implementations — reset then explicitly re-seed.
        vi.resetAllMocks();
        executeHandler.mockResolvedValue(undefined);
        consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it('builds the exact envelope (name pinned to both-ruleset disk canon) and forwards it once with identity args, inputs unpolluted', async () => {
        const spell = { name: disk5e.name, level: disk5e.level };
        const metaCtx = { targetName: 'Goblin', spellSaveDc: 17 };
        const inputsBefore = cloneDeep({ spell, metaCtx, playerStats });

        await triggerRayOfEnfeeblement(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, statsArg, campArg, mapArg] = executeHandler.mock.calls[0];
        expect(Object.keys(action)).toEqual(['name', 'spell', 'automation']);
        // Chokepoint inline-dup drift pin: hardcoded action.name vs BOTH disks.
        expect(disk5e.name).toBe(disk2024.name);
        expect(disk5e.level).toBe(disk2024.level);
        expect(action.name).toBe(disk5e.name);
        expect(action.spell).toBe(spell);
        expect(Object.keys(action.automation)).toEqual(['type', 'saveDc', 'targetName']);
        expect(action.automation).toEqual({ type: 'ray_of_enfeeblement', saveDc: 17, targetName: 'Goblin' });
        expect(statsArg).toBe(playerStats);
        expect(campArg).toBe(campaignName);
        expect(mapArg).toBe(mapName);
        expect({ spell, metaCtx, playerStats }).toEqual(inputsBefore);
    });

    it.each([['undefined', undefined], ['0 (:0-swallow)', 0]])(
        'saveDc falls through metaCtx.spellSaveDc=%s to playerStats.spellAbilities.saveDc',
        async (_label, spellSaveDc) => {
            await triggerRayOfEnfeeblement({ name: disk5e.name, level: disk5e.level }, { spellSaveDc, targetName: 'Goblin' }, playerStats, campaignName, mapName);

            expect(executeHandler).toHaveBeenCalledTimes(1);
            expect(executeHandler.mock.calls[0][0].automation).toEqual({ type: 'ray_of_enfeeblement', saveDc: 15, targetName: 'Goblin' });
        }
    );

    it.each([
        ['no saveDc, proficiency 4', { spellAbilities: {}, proficiency: 4 }, 12],
        ['saveDc 0 swallowed, proficiency 7', { spellAbilities: { saveDc: 0 }, proficiency: 7 }, 15],
        ['spellAbilities absent, proficiency 0 swallowed to default 2', { proficiency: 0 }, 10],
    ])('saveDc tier 3: 8 + proficiency (%s -> DC %i)', async (_label, stats, expectedDc) => {
        await triggerRayOfEnfeeblement({ name: disk5e.name, level: disk5e.level }, { targetName: 'Goblin' }, stats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler.mock.calls[0][0].automation).toEqual({ type: 'ray_of_enfeeblement', saveDc: expectedDc, targetName: 'Goblin' });
    });

    it("defaults targetName to 'Unknown' on the production caller's live shape (rayTarget?.name -> undefined)", async () => {
        await triggerRayOfEnfeeblement({ name: disk5e.name, level: disk5e.level }, { spellSaveDc: undefined, targetName: undefined }, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler.mock.calls[0][0].automation).toEqual({ type: 'ray_of_enfeeblement', saveDc: 15, targetName: 'Unknown' });
    });

    it('logs the exact prefix and re-throws the identical Error when executeHandler rejects', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);

        await expect(triggerRayOfEnfeeblement({ name: disk5e.name, level: disk5e.level }, { targetName: 'Goblin' }, playerStats, campaignName, mapName)).rejects.toBe(err);

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalledWith('[rayOfEnfeeblement] Trigger failed:', err);
    });

    it('throws TypeError OUTSIDE the try when playerStats is undefined: executeHandler and console.error untouched (try-boundary pin)', async () => {
        await expect(triggerRayOfEnfeeblement({ name: disk5e.name, level: disk5e.level }, { targetName: 'Goblin' }, undefined, campaignName, mapName)).rejects.toBeInstanceOf(TypeError);

        expect(executeHandler).toHaveBeenCalledTimes(0);
        expect(consoleSpy).toHaveBeenCalledTimes(0);
    });
});
