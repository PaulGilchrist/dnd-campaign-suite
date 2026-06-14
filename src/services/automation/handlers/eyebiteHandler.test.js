import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle, getEffectOptions } from './eyebiteHandler.js';

vi.mock('../common/savePrompt.js', () => ({
    buildSaveDc: vi.fn((auto, playerStats) => {
        const prof = playerStats.proficiency || 0;
        const wisBonus = playerStats.abilities?.find(a => a.name === 'Wisdom')?.bonus || 0;
        return 8 + wisBonus + prof;
    }),
}));

vi.mock('../../rules/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({ creatures: [] })),
}));

vi.mock('../../maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../rules/rangeValidation.js', () => ({
    rangeToFeet: vi.fn(range => {
        if (!range) return 60;
        const match = range.match(/(\d+)\s*ft/);
        return match ? parseInt(match[1], 10) : 60;
    }),
}));

describe('eyebiteHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const campaignName = 'TestCampaign';
    const mapName = 'TestMap';

    function makePlayerStats(overrides = {}) {
        return {
            name: 'TestWizard',
            level: 10,
            proficiency: 4,
            abilities: [
                { name: 'Wisdom', bonus: 3 },
            ],
            ...overrides,
        };
    }

    function makeAction(automation = {}) {
        return {
            name: 'Eyebite',
            automation: {
                type: 'eyebite',
                saveType: 'WIS',
                range: '60 ft',
                duration: '1_minute',
                ...automation,
            },
        };
    }

    it('returns a modal result with eyebiteEffect modalName', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result).toBeDefined();
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('eyebiteEffect');
    });

    it('includes saveDc in payload', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.saveDc).toBe(15);
    });

    it('includes rangeFeet in payload', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(60);
    });

    it('includes durationRounds of 10 for 1_minute duration', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.durationRounds).toBe(10);
    });

    it('includes combatSummary in payload', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.combatSummary).toBeDefined();
    });

    it('includes attackerName in payload', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.attackerName).toBe('TestWizard');
    });

    it('includes featureName in payload', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.featureName).toBe('Eyebite');
    });

    it('includes campaignName in payload', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.campaignName).toBe('TestCampaign');
    });

    it('handles null mapName', async () => {
        const action = makeAction();
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, null);

        expect(result).toBeDefined();
        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('eyebiteEffect');
    });

    it('handles custom range', async () => {
        const action = makeAction({ range: '30 ft' });
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(30);
    });

    it('returns default 60 feet when range is missing', async () => {
        const action = makeAction({ range: undefined });
        const playerStats = makePlayerStats();
        const result = await handle(action, playerStats, campaignName, mapName);

        expect(result.payload.rangeFeet).toBe(60);
    });
});

describe('getEffectOptions', () => {
    it('returns three effect options', () => {
        const options = getEffectOptions();
        expect(options).toHaveLength(3);
    });

    it('includes asleep effect', () => {
        const options = getEffectOptions();
        const asleep = options.find(o => o.key === 'asleep');
        expect(asleep).toBeDefined();
        expect(asleep.condition).toBe('unconscious');
    });

    it('includes panicked effect', () => {
        const options = getEffectOptions();
        const panicked = options.find(o => o.key === 'panicked');
        expect(panicked).toBeDefined();
        expect(panicked.condition).toBe('frightened');
    });

    it('includes sickened effect', () => {
        const options = getEffectOptions();
        const sickened = options.find(o => o.key === 'sickened');
        expect(sickened).toBeDefined();
        expect(sickened.condition).toBe('poisoned');
    });
});
