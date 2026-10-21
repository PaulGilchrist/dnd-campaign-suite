// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerFear } from './fearService.js';
import { executeHandler } from '../../automation/index.js';

// Lane: forwarder/gate/composer ONLY. This service fronts the disk spell 'Fear'
// (public/data/spells.json + public/data/2024/spells.json: level 3, dc.dc_type WIS,
// concentration up to 1 minute, automation.type 'fear' — the ONLY /fear/i name on disk
// in either ruleset; there is no 'Cause Fear' spell in this data set).
// Downstream owners cited verbatim: executeHandler dispatches automation.type 'fear' to
// src/services/automation/handlers/spells/fearHandler.js, which owns the WIS save prompt,
// the Frightened condition, addExpiration and concentration. This service stamps NO
// expiry/round numbers (no-clock policy respected).

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

describe('fearService', () => {
    const campaignName = 'TestCampaign';
    const mapName = 'testMap';
    const playerStats = {
        name: 'Wizard',
        spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence', toHit: 9 },
        proficiency: 4,
    };

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('gates case-insensitive on the spell name, composes the exact action envelope, and passes the handler result through by identity', async () => {
        const expectedResult = { type: 'popup', payload: { name: 'Fear' } };
        executeHandler.mockResolvedValue(expectedResult);
        const spell = { name: 'fEAR', level: 3 }; // case-insensitive accept + spell object passthrough

        const result = await triggerFear(
            spell,
            { spellSaveDc: 18, slotLevel: 5 }, // top of both fallback chains
            playerStats,
            campaignName,
            mapName,
        );

        expect(executeHandler).toHaveBeenCalledTimes(1);
        // Exact envelope — no objectContaining: name, automation type (disk parity), saveDc, spell, slot.
        expect(executeHandler).toHaveBeenCalledWith(
            {
                name: 'Fear',
                automation: { type: 'fear', saveDc: 18 },
                spell,
                spellSlotLevel: 5,
            },
            playerStats,
            campaignName,
            mapName,
        );
        // Envelope carries the very spell object passed in, and the result returns untouched.
        expect(executeHandler.mock.calls[0][0].spell).toBe(spell);
        expect(result).toBe(expectedResult);
    });

    // One table for the two `||` fallback chains (saveDc: metaCtx > spellAbilities > 8+prof),
    // slot (metaCtx > spell.level > 3 == disk Fear.level), null/undefined metaCtx, and the
    // prof||2 falsy coercion.
    it.each([
        {
            label: 'metaCtx wins over spellAbilities and spell.level',
            metaCtx: { spellSaveDc: 17, slotLevel: 6 },
            spell: { name: 'Fear', level: 3 },
            stats: playerStats,
            saveDc: 17,
            slotLevel: 6,
        },
        {
            label: 'falls back to spellAbilities.saveDc and spell.level',
            metaCtx: {},
            spell: { name: 'Fear', level: 5 },
            stats: playerStats,
            saveDc: 15,
            slotLevel: 5,
        },
        {
            label: 'null metaCtx optional-chains to playerStats',
            metaCtx: null,
            spell: { name: 'Fear' },
            stats: playerStats,
            saveDc: 15,
            slotLevel: 3, // default 3 matches disk Fear.level
        },
        {
            label: 'falsy 0 metaCtx values fall through the || chain',
            metaCtx: { spellSaveDc: 0, slotLevel: 0 },
            spell: { name: 'Fear', level: 4 },
            stats: playerStats,
            saveDc: 15,
            slotLevel: 4,
        },
        {
            label: 'computes 8 + proficiency when spellAbilities is missing',
            metaCtx: undefined,
            spell: { name: 'Fear', level: 3 },
            stats: { name: 'Wizard', proficiency: 3 },
            saveDc: 11,
            slotLevel: 3,
        },
        {
            label: 'coerces falsy proficiency to 2 (default DC 10, slot 3)',
            metaCtx: {},
            spell: { name: 'Fear' },
            stats: { name: 'Wizard', proficiency: 0 },
            saveDc: 10,
            slotLevel: 3,
        },
    ])('resolves saveDc/slotLevel: $label', async ({ metaCtx, spell, stats, saveDc, slotLevel }) => {
        executeHandler.mockResolvedValue({ type: 'popup' });

        await triggerFear(spell, metaCtx, stats, campaignName, mapName);

        expect(executeHandler).toHaveBeenCalledWith(
            expect.objectContaining({
                automation: { type: 'fear', saveDc },
                spellSlotLevel: slotLevel,
            }),
            stats,
            campaignName,
            mapName,
        );
    });

    // Rejection gate: exact-name match, NO trim/substring tolerance.
    // Negative controls are REAL disk names (verified in public/data/spells.json):
    // 'Hold Monster', 'Phantasmal Killer', 'Confusion'.
    it.each([
        ['Hold Monster'],
        ['Phantasmal Killer'],
        ['Confusion'],
        ['Fearful'],
        ['Fear '], // trailing space must NOT match — no trim in the gate
        [''],
    ])('returns null without touching the handler for non-Fear spell "%s"', async (name) => {
        const result = await triggerFear(
            { name, level: 3 },
            { spellSaveDc: 18, slotLevel: 5 },
            playerStats,
            campaignName,
            mapName,
        );

        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('returns null and logs the identical Error with the [fearService] prefix when the handler rejects', async () => {
        const error = new Error('Handler failed');
        executeHandler.mockRejectedValue(error);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await triggerFear(
            { name: 'Fear', level: 3 },
            {},
            playerStats,
            campaignName,
            mapName,
        );

        expect(result).toBeNull();
        expect(errSpy).toHaveBeenCalledWith('[fearService] Failed to execute Fear handler:', error);
    });
});
