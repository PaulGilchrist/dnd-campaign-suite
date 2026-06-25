// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { buildSaveDc } from '../../common/savePrompt.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import * as mapsService from '../../../maps/mapsService.js';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => {
        if (typeof r === 'number') return r;
        if (!r || typeof r !== 'string') return null;
        const m = r.toLowerCase().trim().match(/^(-?\d+(?:\.\d+)?)\s*(feet|foot|ft\.?)?$/);
        return m ? parseFloat(m[1]) : null;
    }),
}));

import { handle, getEffectOptions } from './eyebiteHandler.js';

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

function makePlayerStats(overrides = {}) {
    return {
        name: 'Necromancer1',
        level: 7,
        proficiency: 4,
        abilities: [{ name: 'Intelligence', bonus: 3 }],
        ...overrides,
    };
}

function makeAction(automation = {}) {
    return {
        name: 'Eyebite',
        automation: { type: 'eyebite', ...automation },
    };
}

// ─── handle ───

describe('eyebiteHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    function defaultMocks() {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });
        buildSaveDc.mockReturnValue(15);
    }

    it('returns a modal with modalName eyebiteEffect', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('eyebiteEffect');
    });

    it('passes saveDc from buildSaveDc into payload', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.saveDc).toBe(15);
    });

    it('defaults rangeFeet to 60 when automation range is absent', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(60);
    });

    it('uses automation range when provided', async () => {
        defaultMocks();

        const result = await handle(makeAction({ range: '120 ft' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(120);
    });

    it('includes attackerPos when player is found on map', async () => {
        defaultMocks();
        mapsService.loadMapData.mockResolvedValue({
            players: [{ name: 'Necromancer1', gridX: 5, gridY: 10 }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
    });

    it('sets attackerPos to null when player is not on the map', async () => {
        defaultMocks();
        mapsService.loadMapData.mockResolvedValue({
            players: [],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toBeNull();
    });

    it('sets attackerPos to null when mapName is null', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.attackerPos).toBeNull();
    });

    it('handles map load failure gracefully', async () => {
        defaultMocks();
        mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.attackerPos).toBeNull();
    });

    it('includes combatSummary from getCombatContext', async () => {
        defaultMocks();

        const expectedContext = { creatures: [{ name: 'Dragon', type: 'boss' }] };
        getCombatContext.mockResolvedValue(expectedContext);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.combatSummary).toBe(expectedContext);
    });

    it('includes attackerName from playerStats', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerName).toBe('Necromancer1');
    });

    it('includes campaignName in payload', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.campaignName).toBe(campaignName);
    });

    it('includes featureName from action name', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.featureName).toBe('Eyebite');
    });

    it('includes durationRounds as 10', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.durationRounds).toBe(10);
    });

    it('returns modal even when no creatures in combat', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });
        buildSaveDc.mockReturnValue(15);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('eyebiteEffect');
    });
});

// ─── getEffectOptions ───

describe('getEffectOptions', () => {
    it('returns an array of 3 effect options', () => {
        const options = getEffectOptions();

        expect(Array.isArray(options)).toBe(true);
        expect(options.length).toBe(3);
    });

    it('returns the same EFFECT_OPTIONS array on each call', () => {
        const a = getEffectOptions();
        const b = getEffectOptions();

        expect(a).toBe(b);
    });

    it('includes asleep option with unconscious condition', () => {
        const options = getEffectOptions();
        const asleep = options.find((o) => o.key === 'asleep');

        expect(asleep).toEqual({ key: 'asleep', label: 'Asleep', condition: 'unconscious' });
    });

    it('includes panicked option with frightened condition', () => {
        const options = getEffectOptions();
        const panicked = options.find((o) => o.key === 'panicked');

        expect(panicked).toEqual({ key: 'panicked', label: 'Panicked', condition: 'frightened' });
    });

    it('includes sickened option with poisoned condition', () => {
        const options = getEffectOptions();
        const sickened = options.find((o) => o.key === 'sickened');

        expect(sickened).toEqual({ key: 'sickened', label: 'Sickened', condition: 'poisoned' });
    });
});
