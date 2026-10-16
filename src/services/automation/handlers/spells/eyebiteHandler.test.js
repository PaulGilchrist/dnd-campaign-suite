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
        mapsService.loadMapData.mockResolvedValue(null);
    }

    it('returns a modal with modalName eyebiteEffect', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('eyebiteEffect');
    });

    it('payload carries save DC, caster context, and combat summary', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload).toMatchObject({
            saveDc: 15,
            attackerName: 'Necromancer1',
            campaignName: 'TestCampaign',
            featureName: 'Eyebite',
            durationRounds: 10,
            combatSummary: { creatures: [{ name: 'Goblin', type: 'npc' }] },
        });
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

    it('sets attackerPos to null when mapName is null', async () => {
        defaultMocks();

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.attackerPos).toBeNull();
        expect(mapsService.loadMapData).not.toHaveBeenCalled();
    });

    it('handles map load failure gracefully', async () => {
        defaultMocks();
        mapsService.loadMapData.mockRejectedValueOnce(new Error('Map not found'));

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.attackerPos).toBeNull();
    });
});

// ─── getEffectOptions ───

describe('getEffectOptions', () => {
    it('returns the three eyebite effect options', () => {
        expect(getEffectOptions()).toEqual([
            { key: 'asleep', label: 'Asleep', condition: 'unconscious' },
            { key: 'panicked', label: 'Panicked', condition: 'frightened' },
            { key: 'sickened', label: 'Sickened', condition: 'poisoned' },
        ]);
    });
});
