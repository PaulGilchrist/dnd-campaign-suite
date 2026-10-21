// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerBanishment } from './banishmentService.js';
import { executeHandler } from '../../automation/index.js';

// Sole collaborator of banishmentService.js — mocked 1:1 with its import set.
// Downstream automation (banishment handler: conditions/te writes, concentration
// scoping per disk duration 'Concentration, up to 1 minute') is the handler's
// ownership, not this trigger service's (#1290 delegation precedent).
vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

const playerStats = {
    name: 'Wizard',
    spellAbilities: { saveDc: 15, modifier: 4, spellCastingAbility: 'Intelligence' },
    proficiency: 4,
};

describe('triggerBanishment', () => {
    beforeEach(() => {
        // clearAllMocks retains implementations — re-seed explicitly each test.
        vi.clearAllMocks();
        executeHandler.mockResolvedValue({ type: 'popup' });
    });

    describe('spell name gate (exact match, case-insensitive)', () => {
        it.each([
            ['Banishment', true],
            ['banishment', true],
            // Real spell on disk (2024/spells.json, level 5 CHA) — must NOT trigger this service.
            ['Banishing Smite', false],
            ['Banishment Shield', false],
            ['Banished', false],
            ['', false],
            [undefined, false],
        ])('"%" %s executeHandler', async (name, shouldTrigger) => {
            const result = await triggerBanishment(
                { name, level: 1 },
                {},
                playerStats,
                'TestCampaign',
                'testMap',
            );

            if (shouldTrigger) {
                expect(executeHandler).toHaveBeenCalledTimes(1);
                expect(result).toEqual({ type: 'popup' });
            } else {
                expect(executeHandler).not.toHaveBeenCalled();
                expect(result).toBeNull();
            }
        });
    });

    describe('saveDc / slotLevel precedence', () => {
        // Discriminants: every expected number differs from all fixture sources
        // (18/5 metaCtx overrides, 15 stats, 6 spell.level, 11 = 8+prof 3,
        // 10 = 8+default prof 2, 4 = disk level default, 7 unique slot).
        it.each([
            {
                label: 'metaCtx overrides win over stats and spell',
                spell: { name: 'Banishment', level: 4 },
                metaCtx: { spellSaveDc: 18, slotLevel: 5 },
                stats: playerStats,
                saveDc: 18,
                slotLevel: 5,
            },
            {
                label: 'falls back to spellAbilities.saveDc and spell.level',
                spell: { name: 'Banishment', level: 6 },
                metaCtx: {},
                stats: playerStats,
                saveDc: 15,
                slotLevel: 6,
            },
            {
                label: 'derives 8 + proficiency when spellAbilities is missing',
                spell: { name: 'Banishment', level: 4 },
                metaCtx: {},
                stats: { name: 'Wizard', proficiency: 3 },
                saveDc: 11,
                slotLevel: 4,
            },
            {
                label: 'minimal stats default to DC 10, spell defaults to slot 4 (disk level)',
                spell: { name: 'Banishment' },
                metaCtx: {},
                stats: {},
                saveDc: 10,
                slotLevel: 4,
            },
            {
                label: 'undefined metaCtx is guarded and forwards',
                spell: { name: 'banishment', level: 7 },
                metaCtx: undefined,
                stats: playerStats,
                saveDc: 15,
                slotLevel: 7,
            },
        ])('$label', async ({ spell, metaCtx, stats, saveDc, slotLevel }) => {
            const result = await triggerBanishment(spell, metaCtx, stats, 'TestCampaign', 'testMap');

            const action = executeHandler.mock.calls[0][0];
            expect(action.automation.saveDc).toBe(saveDc);
            expect(action.spellSlotLevel).toBe(slotLevel);
            expect(action.metaCtx).toBe(metaCtx);
            expect(result).toEqual({ type: 'popup' });
        });
    });

    it('builds the exact action envelope and forwards all arguments positionally', async () => {
        const sentinel = { type: 'popup', payload: { automation: 'banishment' } };
        executeHandler.mockResolvedValue(sentinel);
        const spell = { name: 'Banishment', level: 4 };
        const metaCtx = { targetName: 'Dragon', slotLevel: 5 };

        const result = await triggerBanishment(spell, metaCtx, playerStats, 'PinCampaign', 'pin-map');

        expect(executeHandler).toHaveBeenCalledWith(
            {
                name: 'Banishment',
                // saveType CHA pinned verbatim from disk banishment dc.dc_type.
                automation: { type: 'banishment', saveDc: 15, saveType: 'CHA' },
                spell,
                spellSlotLevel: 5,
                metaCtx,
            },
            playerStats,
            'PinCampaign',
            'pin-map',
        );
        // Pure forwarder: returns the handler's resolved value by identity, no shaping.
        expect(result).toBe(sentinel);
    });

    it('returns null (no fabricated fallback) when the handler resolves null', async () => {
        executeHandler.mockResolvedValue(null);

        const result = await triggerBanishment(
            { name: 'Banishment', level: 4 },
            {},
            playerStats,
            'TestCampaign',
            'testMap',
        );

        expect(result).toBeNull();
    });

    it('logs the exact error string and returns null when the handler throws', async () => {
        const failure = new Error('Handler failed');
        executeHandler.mockRejectedValue(failure);
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await triggerBanishment(
            { name: 'Banishment', level: 4 },
            {},
            playerStats,
            'TestCampaign',
            'testMap',
        );

        expect(consoleSpy).toHaveBeenCalledWith(
            '[banishmentService] Failed to execute Banishment handler:',
            failure,
        );
        expect(result).toBeNull();

        consoleSpy.mockRestore();
    });
});
