import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerBeaconOfHope, confirmBeaconOfHope } from './beaconOfHopeService.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../automation/index.js', () => ({
    executeHandler: vi.fn(),
}));

vi.mock('../../automation/handlers/spells/beaconOfHopeHandler.js', () => ({
    applyBeaconOfHopeEffect: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { executeHandler } from '../../automation/index.js';
import { applyBeaconOfHopeEffect } from '../../automation/handlers/spells/beaconOfHopeHandler.js';

// ── Helpers ────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const MAP_NAME = 'testMap';
const PLAYER_STATS = { name: 'Cleric' };

function buildSpell(extra = {}) {
    return {
        name: 'Beacon of Hope',
        level: 3,
        range: '30 feet',
        ...extra,
    };
}

function buildMetaCtx(extra = {}) {
    return { slotLevel: 4, ...extra };
}

// ── Tests ──────────────────────────────────────────────────────

describe('triggerBeaconOfHope', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('spell name validation', () => {
        it('returns null for non-Beacon of Hope spells', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            const result = await triggerBeaconOfHope(
                { name: 'Cure Wounds', level: 1 },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is missing', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            const result = await triggerBeaconOfHope(
                { level: 3 },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('returns null when spell name is empty string', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            const result = await triggerBeaconOfHope(
                { name: '', level: 3 },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
            expect(executeHandler).not.toHaveBeenCalled();
        });

        it('is case-insensitive for spell name', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            const result = await triggerBeaconOfHope(
                { name: 'BEACON OF HOPE', level: 3 },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toEqual({ ok: true });
            expect(executeHandler).toHaveBeenCalled();
        });

        it('matches with different casing variations', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            const result = await triggerBeaconOfHope(
                { name: 'Beacon Of Hope', level: 3 },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toEqual({ ok: true });
            expect(executeHandler).toHaveBeenCalled();
        });
    });

    describe('action construction', () => {
        it('passes action with correct type to executeHandler', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                buildSpell(),
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const action = executeHandler.mock.calls[0][0];
            expect(action.name).toBe('Beacon of Hope');
            expect(action.automation.type).toBe('beacon_of_hope');
            expect(action.automation.range).toBe('30 feet');
            expect(action.spell).toEqual(buildSpell());
            expect(action.spellSlotLevel).toBe(3);
        });

        it('uses spell.range when automation range is not provided', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                { name: 'Beacon of Hope', level: 3, range: '60 feet' },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const action = executeHandler.mock.calls[0][0];
            expect(action.automation.range).toBe('60 feet');
        });

        it('uses default range of 30 feet when spell has no range', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                { name: 'Beacon of Hope', level: 3 },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const action = executeHandler.mock.calls[0][0];
            expect(action.automation.range).toBe('30 feet');
        });
    });

    describe('slot level resolution', () => {
        it('uses metaCtx.slotLevel when provided', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                buildSpell(),
                buildMetaCtx(),
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const action = executeHandler.mock.calls[0][0];
            expect(action.spellSlotLevel).toBe(4);
        });

        it('falls back to spell.level when metaCtx.slotLevel is not provided', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                buildSpell(),
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const action = executeHandler.mock.calls[0][0];
            expect(action.spellSlotLevel).toBe(3);
        });

        it('falls back to spell.level when metaCtx is empty object', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                buildSpell(),
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const action = executeHandler.mock.calls[0][0];
            expect(action.spellSlotLevel).toBe(3);
        });

        it('falls back to 3 when no slot level info available', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                { name: 'Beacon of Hope' },
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            const action = executeHandler.mock.calls[0][0];
            expect(action.spellSlotLevel).toBe(3);
        });
    });

    describe('executeHandler delegation', () => {
        it('passes playerStats to executeHandler', async () => {
            executeHandler.mockResolvedValue({ ok: true });

            await triggerBeaconOfHope(
                buildSpell(),
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(executeHandler).toHaveBeenCalledWith(
                expect.any(Object),
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );
        });

        it('returns executeHandler result on success', async () => {
            const expected = { type: 'popup', payload: { type: 'automation_info', name: 'Beacon of Hope' } };
            executeHandler.mockResolvedValue(expected);

            const result = await triggerBeaconOfHope(
                buildSpell(),
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toEqual(expected);
        });

        it('returns null when executeHandler throws', async () => {
            executeHandler.mockRejectedValue(new Error('Handler failed'));

            const result = await triggerBeaconOfHope(
                buildSpell(),
                {},
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
            );

            expect(result).toBeNull();
        });
    });
});

describe('confirmBeaconOfHope', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('basic behavior', () => {
        it('delegates to applyBeaconOfHopeEffect', async () => {
            applyBeaconOfHopeEffect.mockResolvedValue({ ok: true });

            const action = { name: 'Beacon of Hope', automation: { type: 'beacon_of_hope' } };
            const targetNames = ['Goblin', 'Orc'];

            const result = await confirmBeaconOfHope(
                action,
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                targetNames,
            );

            expect(applyBeaconOfHopeEffect).toHaveBeenCalledWith(
                action,
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                targetNames,
            );
            expect(result).toEqual({ ok: true });
        });

        it('returns applyBeaconOfHopeEffect result', async () => {
            const expected = {
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Beacon of Hope',
                    description: '2 of 2 target(s) affected by Beacon of Hope.',
                },
            };
            applyBeaconOfHopeEffect.mockResolvedValue(expected);

            const action = { name: 'Beacon of Hope' };
            const result = await confirmBeaconOfHope(
                action,
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Goblin'],
            );

            expect(result).toEqual(expected);
        });

        it('returns null when applyBeaconOfHopeEffect throws', async () => {
            applyBeaconOfHopeEffect.mockRejectedValue(new Error('Apply failed'));

            const action = { name: 'Beacon of Hope' };
            const result = await confirmBeaconOfHope(
                action,
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Goblin'],
            );

            expect(result).toBeNull();
        });

        it('passes campaignName and mapName through', async () => {
            applyBeaconOfHopeEffect.mockResolvedValue({ ok: true });

            const action = { name: 'Beacon of Hope' };
            await confirmBeaconOfHope(
                action,
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Goblin'],
            );

            expect(applyBeaconOfHopeEffect).toHaveBeenCalledWith(
                action,
                PLAYER_STATS,
                CAMPAIGN_NAME,
                MAP_NAME,
                ['Goblin'],
            );
        });
    });
});
