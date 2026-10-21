// @maintained-by-ai
// AUDITED 2026-10-20 — falseLife lane: minimal behavioral suite (guard table, exact envelope + slot chain, error passthrough). Expression selection owned by falseLifeHandler (own lane).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerFalseLife } from './falseLifeService.js';
import { executeHandler } from '../../automation/index.js';

vi.mock('../../automation/index.js', () => {
    return { executeHandler: vi.fn() };
});

describe('falseLifeService.triggerFalseLife', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = { name: 'Wizard', proficiency: 4 };
    let errorSpy;

    beforeEach(() => {
        vi.resetAllMocks();
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it.each([
        ['real-disk near-miss Fire Bolt', { name: 'Fire Bolt', level: 0 }],
        ['missing name', {}],
        ['null name', { name: null }],
        ['empty name', { name: '' }],
    ])('returns null without touching executeHandler for %s', async (_label, spell) => {
        const result = await triggerFalseLife(spell, {}, playerStats, campaignName, mapName);
        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it.each([
        ['metaCtx.slotLevel wins over spell.level', { slotLevel: 5 }, { name: 'False Life', level: 2 }, 5],
        ['null metaCtx falls back to spell.level (and matches lowercase)', null, { name: 'false life', level: 2 }, 2],
        ['falsy spell.level 0 defaults to 1 (and matches UPPERCASE)', {}, { name: 'FALSE LIFE', level: 0 }, 1],
    ])('builds exact envelope and forwards args verbatim — %s', async (_label, metaCtx, spell, expectedSlot) => {
        const handlerResult = { type: 'popup', payload: { type: 'automation_info', description: 'Gained temp HP' } };
        executeHandler.mockResolvedValue(handlerResult);

        const result = await triggerFalseLife(spell, metaCtx, playerStats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const [action, stats, campaign, map] = executeHandler.mock.calls[0];
        expect(action).toEqual({
            name: 'False Life',
            automation: { type: 'false_life', tempHpExpression: '2d4+4' },
            spell,
            spellSlotLevel: expectedSlot,
        });
        // spell forwarded by reference so falseLifeHandler re-derives slot expression from disk heal_at_slot_level
        expect(action.spell).toBe(spell);
        expect(stats).toBe(playerStats);
        expect(campaign).toBe(campaignName);
        expect(map).toBe(mapName);
        expect(result).toBe(handlerResult); // handler result returned verbatim
    });

    it('logs exact [falseLife] prefix with the identical Error and returns null when executeHandler rejects', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);

        const result = await triggerFalseLife({ name: 'False Life', level: 1 }, {}, playerStats, campaignName, mapName);

        expect(result).toBeNull();
        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('[falseLife] Failed to execute False Life handler:', err);
    });
});
