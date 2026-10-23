// @maintained-by-ai
// beaconOfHopeService lane — envelope builder + gate only (no healing mechanics here).
// Live dispatch: spellCastService/execution/triggerSpells.js:163 calls
// triggerBeaconOfHope(spell, { ...metaCtx, spellSaveDc }, playerStats, campaignName, mapName).
// spellSaveDc is composed upstream (producer lane) — this service never reads it; the slot
// tiers below pin sentinel FORWARDING (metaCtx.slotLevel → action.spellSlotLevel), not numbers.
// Disk canon (public/data/spells.json 'beacon-of-hope'): level 3, range '30 feet',
// automation { type: 'beacon_of_hope', range: '30 feet' } — matches the pinned envelope.
// Downstream own-lanes (NOT tested here): beaconOfHopeHandler.test.js (te stamp / apply /
// log), useSpellMetamagicFlow/confirm-payloads.test.js (picker), SavePromptModal /
// conditionEffects / restRules consumers of the written targetEffects.
// NOTE: confirmBeaconOfHope excised as a zero-caller dead export (#1338 dead-export batch) —
// the live picker lane goes straight to applyBeaconOfHopeEffect (useSimpleSpellHandlers.js:299),
// owned by the handler + confirm-payloads lanes cited above.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { triggerBeaconOfHope } from './beaconOfHopeService.js';

// ── Mocks (1:1 with the service's real imports) ───────────────────────────

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

import { executeHandler } from '../../automation/index.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';
const PLAYER_STATS = { name: 'Cleric' };

// Shape of the disk canon row (public/data/spells.json), reduced to what the
// service actually reads; full-row apply semantics live in the handler lane.
const DISK_SPELL = { name: 'Beacon of Hope', level: 3, range: '30 feet' };

// Distinct sentinel returned by executeHandler — never rebuilt, so toBe pins
// identity-forwarding of the handler result through the service.
const HANDLER_RESULT = Object.freeze({ type: 'popup', sentinel: 'beacon-trigger' });

let consoleError;

beforeEach(() => {
    vi.clearAllMocks();
    // Re-seed explicitly: clearAllMocks retains prior mockResolvedValue impls.
    executeHandler.mockResolvedValue(HANDLER_RESULT);
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    consoleError.mockRestore();
});

// ── triggerBeaconOfHope ────────────────────────────────────────────────────

describe('triggerBeaconOfHope', () => {
    it.each([
        ['Bless', 'own buff lane (blessHandler)'],
        ['Beast Bond', 'near-miss prefix "Bea" on disk'],
        ['Cure Wounds', 'healing spell with its own cast lane'],
    ])('returns null without dispatching for real disk spell %s (%s)', async (name) => {
        const result = await triggerBeaconOfHope(
            { name, level: 1 }, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME,
        );

        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it.each([
        ['missing name', {}],
        ['empty name', { name: '' }],
    ])('returns null for spell with %s (gate is (spell.name || \'\') exact-match)', async (label, spell) => {
        const result = await triggerBeaconOfHope(
            spell, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME,
        );

        expect(result).toBeNull();
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it.each([
        ['disk canon level-3 cast', DISK_SPELL, {}, { slot: 3, range: '30 feet' }],
        ['metamagic upcast forwards sentinel slot', DISK_SPELL, { slotLevel: 5 }, { slot: 5, range: '30 feet' }],
        ['uppercase name passes case-insensitive gate', { ...DISK_SPELL, name: 'BEACON OF HOPE' }, {}, { slot: 3, range: '30 feet' }],
        ['missing range falls back to 30 feet', { name: 'Beacon of Hope', level: 3 }, {}, { slot: 3, range: '30 feet' }],
        ['no slot info falls back to 3', { name: 'Beacon of Hope', range: '30 feet' }, {}, { slot: 3, range: '30 feet' }],
    ])('builds exact envelope and forwards args — %s', async (_label, spell, metaCtx, expected) => {
        const result = await triggerBeaconOfHope(
            spell, metaCtx, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME,
        );

        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(
            {
                name: 'Beacon of Hope',
                automation: { type: 'beacon_of_hope', range: expected.range },
                spell,
                spellSlotLevel: expected.slot,
            },
            PLAYER_STATS,
            CAMPAIGN_NAME,
            MAP_NAME,
        );
        // identity pin: the caller's spell object is forwarded, not cloned
        expect(executeHandler.mock.calls[0][0].spell).toBe(spell);
        // identity pin: handler result forwarded untouched
        expect(result).toBe(HANDLER_RESULT);
    });

    it('returns null and logs exact banner + identical Error when executeHandler rejects', async () => {
        const err = new Error('Handler failed');
        executeHandler.mockRejectedValue(err);

        const result = await triggerBeaconOfHope(
            DISK_SPELL, {}, PLAYER_STATS, CAMPAIGN_NAME, MAP_NAME,
        );

        expect(result).toBeNull();
        expect(consoleError).toHaveBeenCalledWith(
            '[beaconOfHope] Failed to execute Beacon of Hope handler:',
            err,
        );
    });
});
