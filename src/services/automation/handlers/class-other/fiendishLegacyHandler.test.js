// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmFiendishLegacy,
    restoreUses,
    resolveFiendishLegacy,
    stampFiendishLegacyRuntime,
    getFiendishLegacySelection,
    getFiendishLegacyAbility,
    getFiendishLegacyCantrip,
    getFiendishLegacyLevel3Spell,
    getFiendishLegacyLevel5Spell,
} from './fiendishLegacyHandler.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn((_name, key, _campaign) => {
        const keyValues = {
            '_fiendishLegacySelection': 'Infernal',
            '_fiendishLegacyAbility': 'Charisma',
            '_fiendishLegacyCantrip': 'Fire Bolt',
            '_fiendishLegacyLevel3': 'Hellish Rebuke',
            '_fiendishLegacyLevel5': 'Darkness',
        };
        return keyValues[key] || null;
    }),
    setRuntimeValue: vi.fn(async () => {}),
    setRuntimeObject: vi.fn(async () => {}),
}));

const { getRuntimeValue, setRuntimeValue, setRuntimeObject } = await import('../../../../hooks/runtime/useRuntimeState.js');

const campaignName = 'test-campaign';
const playerName = 'Warlock1';

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 3,
        race: { name: 'Tiefling', subrace: null },
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

describe('resolveFiendishLegacy (CLA-139 unified channel)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('subrace is authoritative and beats a stale runtime selection', () => {
        getRuntimeValue.mockReturnValue('Infernal');
        const stats = makePlayerStats({ race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } } });
        expect(resolveFiendishLegacy(stats, campaignName)).toBe('Abyssal');
        expect(getRuntimeValue).not.toHaveBeenCalled();
    });

    it('runtime selection refines when the Tiefling has no subrace', () => {
        getRuntimeValue.mockReturnValue('Infernal');
        expect(resolveFiendishLegacy(makePlayerStats(), campaignName)).toBe('Infernal');
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_fiendishLegacySelection', campaignName);
    });

    it('returns null for non-Tieflings', () => {
        getRuntimeValue.mockReturnValue('Infernal');
        const stats = makePlayerStats({ race: { name: 'Elf', subrace: { name: 'Drow' } } });
        expect(resolveFiendishLegacy(stats, campaignName)).toBeNull();
    });
});

describe('fiendishLegacyHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when a legacy is already selected', async () => {
        getRuntimeValue.mockReturnValue('Infernal');

        const result = await handle(
            { name: 'Fiendish Legacy', automation: { type: 'fiendish_legacy' } },
            makePlayerStats(),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Fiendish Legacy: Infernal (already selected)');
        expect(result.payload.automation).toEqual({ type: 'fiendish_legacy' });
    });

    it('CLA-139: reports the subrace-authoritative legacy, never a stale runtime value', async () => {
        getRuntimeValue.mockReturnValue('Infernal');

        const result = await handle(
            { name: 'Fiendish Legacy', automation: { type: 'fiendish_legacy' } },
            makePlayerStats({ race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } } }),
            'test-campaign',
            null
        );

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Fiendish Legacy: Abyssal (already selected)');
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
        getRuntimeValue.mockReturnValue(null);
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Nonexistent', campaignName);
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Fiendish Legacy');
        expect(result.payload.description).toBe('No legacy selected.');
        expect(result.payload.automation.type).toBe('fiendish_legacy');

        const emptyResult = await confirmFiendishLegacy(makePlayerStats(), '', campaignName);
        expect(emptyResult.type).toBe('popup');
        expect(emptyResult.payload.description).toBe('No legacy selected.');
        expect(setRuntimeObject).not.toHaveBeenCalled();
    });

    it.each(Object.entries(LEGACY_DATA))('CLA-139: stores all runtime values for %s in ONE merged write', async (legacy, data) => {
        getRuntimeValue.mockReturnValue(null);
        const result = await confirmFiendishLegacy(makePlayerStats(), legacy, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain(`Selected ${legacy} legacy`);
        expect(result.payload.description).toContain(`Spellcasting ability: ${data.ability}`);

        expect(setRuntimeObject).toHaveBeenCalledTimes(1);
        expect(setRuntimeObject).toHaveBeenCalledWith(playerName, {
            '_fiendishLegacySelection': legacy,
            '_fiendishLegacyAbility': data.ability,
            '_fiendishLegacyCantrip': data.cantrip,
            '_fiendishLegacyLevel3': data.level3,
            '_fiendishLegacyLevel5': data.level5,
        }, campaignName);
    });
});

describe('stampFiendishLegacyRuntime (CLA-139 wizard seam)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('strips the Tiefling suffix and stamps all keys in one merged write', () => {
        stampFiendishLegacyRuntime('TieflingTest', 'Infernal Tiefling', campaignName);

        expect(setRuntimeObject).toHaveBeenCalledTimes(1);
        expect(setRuntimeObject).toHaveBeenCalledWith('TieflingTest', {
            '_fiendishLegacySelection': 'Infernal',
            '_fiendishLegacyAbility': 'Charisma',
            '_fiendishLegacyCantrip': 'Fire Bolt',
            '_fiendishLegacyLevel3': 'Hellish Rebuke',
            '_fiendishLegacyLevel5': 'Darkness',
        }, campaignName);
    });

    it('logs and skips unknown subraces', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        stampFiendishLegacyRuntime('TieflingTest', 'Moon Elf', campaignName);

        expect(setRuntimeObject).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalled();
        errorSpy.mockRestore();
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

describe('getFiendishLegacySelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the stored legacy selection from runtime', () => {
        const result = getFiendishLegacySelection(makePlayerStats(), campaignName);
        expect(result).toBe('Infernal');
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_fiendishLegacySelection', campaignName);
    });
});

describe('getFiendishLegacyAbility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the stored spellcasting ability from runtime', () => {
        const result = getFiendishLegacyAbility(makePlayerStats(), campaignName);
        expect(result).toBe('Charisma');
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_fiendishLegacyAbility', campaignName);
    });
});

describe('getFiendishLegacyCantrip', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the stored cantrip from runtime', () => {
        const result = getFiendishLegacyCantrip(makePlayerStats(), campaignName);
        expect(result).toBe('Fire Bolt');
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_fiendishLegacyCantrip', campaignName);
    });
});

describe('getFiendishLegacyLevel3Spell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the stored level 3 spell from runtime', () => {
        const result = getFiendishLegacyLevel3Spell(makePlayerStats(), campaignName);
        expect(result).toBe('Hellish Rebuke');
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_fiendishLegacyLevel3', campaignName);
    });
});

describe('getFiendishLegacyLevel5Spell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the stored level 5 spell from runtime', () => {
        const result = getFiendishLegacyLevel5Spell(makePlayerStats(), campaignName);
        expect(result).toBe('Darkness');
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, '_fiendishLegacyLevel5', campaignName);
    });
});
