import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto) => auto.saveDc || 15),
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
        const m = String(r).match(/(\d+)/);
        return m ? parseInt(m[1], 10) : 60;
    }),
}));

import { handle, getEffectOptions } from './eyebiteHandler.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import * as mapsService from '../../../maps/mapsService.js';

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

    it('returns a modal with modalName eyebiteEffect', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('eyebiteEffect');
    });

    it('includes correct payload properties', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });
        mapsService.loadMapData.mockResolvedValue({
            players: [{ name: 'Necromancer1', gridX: 5, gridY: 10 }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload).toHaveProperty('combatSummary');
        expect(result.payload).toHaveProperty('attackerName', 'Necromancer1');
        expect(result.payload).toHaveProperty('saveDc');
        expect(result.payload).toHaveProperty('campaignName', campaignName);
        expect(result.payload).toHaveProperty('mapData');
        expect(result.payload).toHaveProperty('featureName', 'Eyebite');
        expect(result.payload).toHaveProperty('rangeFeet');
        expect(result.payload).toHaveProperty('durationRounds', 10);
    });

    it('includes attackerPos when mapName provided and player found on map', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });
        mapsService.loadMapData.mockResolvedValue({
            players: [{ name: 'Necromancer1', gridX: 5, gridY: 10 }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toEqual({ gridX: 5, gridY: 10 });
    });

    it('has null attackerPos when player not found on map', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });
        mapsService.loadMapData.mockResolvedValue({
            players: [],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toBeNull();
    });

    it('has null attackerPos when mapName is null', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.attackerPos).toBeNull();
    });

    it('uses automation range or defaults to 60', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction({ range: '120 ft' }), makePlayerStats(), campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(120);
    });

    it('uses saveDc from buildSaveDc', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.saveDc).toBeDefined();
    });

    it('handles map load failure gracefully', async () => {
        getCombatContext.mockResolvedValue({
            creatures: [{ name: 'Goblin', type: 'npc' }],
        });
        mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.payload.attackerPos).toBeNull();
    });

    it('returns modal even when no creatures in combat', async () => {
        getCombatContext.mockResolvedValue({ creatures: [] });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('eyebiteEffect');
    });
});

// ─── getEffectOptions ───

describe('getEffectOptions', () => {
    it('returns the EFFECT_OPTIONS array', () => {
        const options = getEffectOptions();

        expect(Array.isArray(options)).toBe(true);
        expect(options.length).toBe(3);
    });

    it('includes asleep option with unconscious condition', () => {
        const options = getEffectOptions();
        const asleep = options.find((o) => o.key === 'asleep');

        expect(asleep).toBeDefined();
        expect(asleep.label).toBe('Asleep');
        expect(asleep.condition).toBe('unconscious');
    });

    it('includes panicked option with frightened condition', () => {
        const options = getEffectOptions();
        const panicked = options.find((o) => o.key === 'panicked');

        expect(panicked).toBeDefined();
        expect(panicked.label).toBe('Panicked');
        expect(panicked.condition).toBe('frightened');
    });

    it('includes sickened option with poisoned condition', () => {
        const options = getEffectOptions();
        const sickened = options.find((o) => o.key === 'sickened');

        expect(sickened).toBeDefined();
        expect(sickened.label).toBe('Sickened');
        expect(sickened.condition).toBe('poisoned');
    });
});
