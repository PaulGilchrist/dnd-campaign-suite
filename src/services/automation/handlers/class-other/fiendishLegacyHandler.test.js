// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
    handle,
    confirmFiendishLegacy,
    getFiendishLegacySelection,
    getFiendishLegacyAbility,
    getFiendishLegacyCantrip,
    getFiendishLegacyLevel3Spell,
    getFiendishLegacyLevel5Spell,
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

function makeAction(automation = {}) {
    return {
        name: 'Fiendish Legacy',
        automation: { type: 'fiendish_legacy', ...automation },
    };
}

// ─── handle ──────────────────────────────────────────────────────

describe('fiendishLegacyHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns info popup when a legacy is already selected', async () => {
        getRuntimeValue.mockReturnValue('Infernal');

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.description).toContain('Fiendish Legacy: Infernal (already selected)');
        expect(result.payload.automation).toEqual({ type: 'fiendish_legacy' });
    });

    it('returns modal when no legacy is selected', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('fiendishLegacy');
        expect(result.payload.action).toBeDefined();
        expect(result.payload.playerStats).toBeInstanceOf(Object);
        expect(result.payload.campaignName).toBe(campaignName);
    });
});

// ─── confirmFiendishLegacy ───────────────────────────────────────

describe('confirmFiendishLegacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns error popup for nonexistent legacy', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Nonexistent', campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Fiendish Legacy');
        expect(result.payload.description).toBe('No legacy selected.');
        expect(result.payload.automation.type).toBe('fiendish_legacy');
    });

    it('returns error popup for empty string legacy', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), '', campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe('No legacy selected.');
    });

    it('stores all runtime values and returns success for Infernal', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Infernal', campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('Selected Infernal legacy');
        expect(result.payload.description).toContain('Spellcasting ability: Charisma');

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, '_fiendishLegacySelection', 'Infernal', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, '_fiendishLegacyAbility', 'Charisma', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, playerName, '_fiendishLegacyCantrip', 'Fire Bolt', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(4, playerName, '_fiendishLegacyLevel3', 'Hellish Rebuke', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(5, playerName, '_fiendishLegacyLevel5', 'Darkness', campaignName);
    });

    it('stores all runtime values and returns success for Abyssal', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Abyssal', campaignName);

        expect(result.payload.description).toContain('Selected Abyssal legacy');

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, '_fiendishLegacySelection', 'Abyssal', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, '_fiendishLegacyAbility', 'Charisma', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, playerName, '_fiendishLegacyCantrip', 'Poison Spray', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(4, playerName, '_fiendishLegacyLevel3', 'Ray of Sickness', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(5, playerName, '_fiendishLegacyLevel5', 'Hold Person', campaignName);
    });

    it('stores all runtime values and returns success for Chthonic', async () => {
        const result = await confirmFiendishLegacy(makePlayerStats(), 'Chthonic', campaignName);

        expect(result.payload.description).toContain('Selected Chthonic legacy');

        expect(setRuntimeValue).toHaveBeenNthCalledWith(1, playerName, '_fiendishLegacySelection', 'Chthonic', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(2, playerName, '_fiendishLegacyAbility', 'Charisma', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(3, playerName, '_fiendishLegacyCantrip', 'Chill Touch', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(4, playerName, '_fiendishLegacyLevel3', 'False Life', campaignName);
        expect(setRuntimeValue).toHaveBeenNthCalledWith(5, playerName, '_fiendishLegacyLevel5', 'Ray of Enfeeblement', campaignName);
    });
});

// ─── Getters ──────────────────────────────────────────────────────

describe('getFiendishLegacySelection', () => {
    it('returns the stored legacy name', () => {
        getRuntimeValue.mockReturnValue('Infernal');

        const result = getFiendishLegacySelection(makePlayerStats(), campaignName);

        expect(result).toBe('Infernal');
    });

    it('returns null when nothing is stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacySelection(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

describe('getFiendishLegacyAbility', () => {
    it('returns the stored spellcasting ability', () => {
        getRuntimeValue.mockReturnValue('Charisma');

        const result = getFiendishLegacyAbility(makePlayerStats(), campaignName);

        expect(result).toBe('Charisma');
    });

    it('returns null when nothing is stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyAbility(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

describe('getFiendishLegacyCantrip', () => {
    it('returns the stored cantrip name', () => {
        getRuntimeValue.mockReturnValue('Fire Bolt');

        const result = getFiendishLegacyCantrip(makePlayerStats(), campaignName);

        expect(result).toBe('Fire Bolt');
    });

    it('returns null when nothing is stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyCantrip(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

describe('getFiendishLegacyLevel3Spell', () => {
    it('returns the stored level 3 spell name', () => {
        getRuntimeValue.mockReturnValue('Hellish Rebuke');

        const result = getFiendishLegacyLevel3Spell(makePlayerStats(), campaignName);

        expect(result).toBe('Hellish Rebuke');
    });

    it('returns null when nothing is stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyLevel3Spell(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

describe('getFiendishLegacyLevel5Spell', () => {
    it('returns the stored level 5 spell name', () => {
        getRuntimeValue.mockReturnValue('Darkness');

        const result = getFiendishLegacyLevel5Spell(makePlayerStats(), campaignName);

        expect(result).toBe('Darkness');
    });

    it('returns null when nothing is stored', () => {
        getRuntimeValue.mockReturnValue(null);

        const result = getFiendishLegacyLevel5Spell(makePlayerStats(), campaignName);

        expect(result).toBeNull();
    });
});

// ─── restoreUses ─────────────────────────────────────────────────

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
