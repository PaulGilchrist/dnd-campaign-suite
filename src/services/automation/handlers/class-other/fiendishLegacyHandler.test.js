import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmFiendishLegacy,
    restoreUses,
} from './fiendishLegacyHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, _key, _campaign) => null),
    setRuntimeValue: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');

const campaignName = 'TestCampaign';
const playerName = 'Warlock1';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 3,
        ...overrides,
    };
}

const LEGACY_DATA = {
    Infernal: {
        ability: 'Charisma',
        cantrip: 'Fire Bolt',
        level3: 'Hellish Rebuke',
        level5: 'Darkness',
    },
    Abyssal: {
        ability: 'Charisma',
        cantrip: 'Poison Spray',
        level3: 'Ray of Sickness',
        level5: 'Hold Person',
    },
    Chthonic: {
        ability: 'Charisma',
        cantrip: 'Chill Touch',
        level3: 'False Life',
        level5: 'Ray of Enfeeblement',
    },
};

describe('fiendishLegacyHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when a legacy is already selected', async () => {
        getRuntimeValue.mockReturnValue('Infernal');

        const result = await handle(
            { name: 'Fiendish Legacy', automation: { type: 'fiendish_legacy' } },
            makePlayerStats(),
            campaignName,
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Fiendish Legacy: Infernal (already selected)');
        expect(result.payload.automation).toEqual({ type: 'fiendish_legacy' });
    });

    it('returns modal when no legacy is selected', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handle(
            { name: 'Fiendish Legacy', automation: { type: 'fiendish_legacy' } },
            makePlayerStats(),
            campaignName,
            null
        );

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('fiendishLegacy');
        expect(result.payload.action).toBeDefined();
        expect(result.payload.playerStats).toBeInstanceOf(Object);
        expect(result.payload.campaignName).toBe(campaignName);
    });
});

describe('confirmFiendishLegacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error popup for invalid legacy', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Nonexistent', campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Fiendish Legacy');
        expect(result.payload.description).toBe('No legacy selected.');
        expect(result.payload.automation.type).toBe('fiendish_legacy');

        const emptyResult = await confirmFiendishLegacy(makePlayerStats(), '', campaignName);
        expect(emptyResult.type).toBe('popup');
        expect(emptyResult.payload.description).toBe('No legacy selected.');
    });

    it.each(Object.entries(LEGACY_DATA))('stores all runtime values for %s', async (legacy, data) => {
        const result = await confirmFiendishLegacy(makePlayerStats(), legacy, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(`Selected ${legacy} legacy`);
        expect(result.payload.description).toContain(`Spellcasting ability: ${data.ability}`);

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, '_fiendishLegacySelection', legacy, campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, '_fiendishLegacyAbility', data.ability, campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, playerName, '_fiendishLegacyCantrip', data.cantrip, campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(4, playerName, '_fiendishLegacyLevel3', data.level3, campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(5, playerName, '_fiendishLegacyLevel5', data.level5, campaignName);
    });
});

describe('restoreUses', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('clears all legacy runtime values by calling setRuntimeValue with null', () => {
        restoreUses(playerName, campaignName);

        expect(setRuntimeValue).toHaveBeenCalledTimes(5);
        const calls = setRuntimeValue.mock.calls;
        const keys = calls.map((c) => c[1]);
        expect(keys).toEqual([
            '_fiendishLegacySelection',
            '_fiendishLegacyAbility',
            '_fiendishLegacyCantrip',
            '_fiendishLegacyLevel3',
            '_fiendishLegacyLevel5',
        ]);
        calls.forEach((c) => {
            expect(c[2]).toBeNull();
        });
    });
});
