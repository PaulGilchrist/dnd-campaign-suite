// @maintained-by-ai
// fiendishLegacyHandler — unit seam map.
//
// This file OWNS:
// - resolveFiendishLegacy() CLA-139 unified channel: subrace is authoritative
//   (runtime cache never consulted), runtime _fiendishLegacySelection is the
//   fallback for subrace-less Tieflings, null for non-Tieflings.
// - handle() router: popup with subrace-authoritative full-string composition
//   when already selected, fiendishLegacy modal when unselected.
// - confirmFiendishLegacy(): invalid-input guard (no write) + one merged
//   setRuntimeObject write per legacy — the exact runtime keys every other
//   suite mocks against live here.
// - stampFiendishLegacyRuntime() CLA-139 wizard seam: suffix-strip, one
//   merged write, unknown-subrace console.error guard.
// - restoreUses() + the five getters: API-contract pins (exact key
//   delegation tables). No production caller today — kept as the handler-lane
//   rest/getter contract (same convention as elfish/gnomish/stonecunning).
//
// Owned ELSEWHERE (do not re-pin here):
// - FiendishLegacyModal.test.jsx — modal UI (mocks confirmFiendishLegacy).
// - useCharacterWizard.test.js — wizard POST-body seam through the stamp.
// - race-rules/2024.js resolveFiendishLegacyName — separate summary resolver.
//
// Deterministic: pure functions over an in-memory runtime-store mock, no
// timers, no DOM, no network. LEGACY_DATA below intentionally mirrors the
// handler's FIENDISH_LEGACIES so rule-data edits fail here on purpose.
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

// Mirrors handler FIENDISH_LEGACIES (races.json:880, 2024 Tiefling).
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

    const action = { name: 'Fiendish Legacy', automation: { type: 'fiendish_legacy' } };

    it.each([
        // runtime-channel selection (no subrace persisted)
        ['Infernal', makePlayerStats(), 'Infernal'],
        // CLA-139: subrace-authoritative, never the stale runtime value
        ['Abyssal', makePlayerStats({ race: { name: 'Tiefling', subrace: { name: 'Abyssal Tiefling' } } }), 'Infernal'],
    ])('reports %s legacy (already selected) popup, full composition', async (legacy, stats, runtimeValue) => {
        getRuntimeValue.mockReturnValue(runtimeValue);

        const result = await handle(action, stats, campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Fiendish Legacy');
        expect(result.payload.description).toBe(`Fiendish Legacy: ${legacy} (already selected).`);
        expect(result.payload.automation).toEqual({ type: 'fiendish_legacy' });
    });

    it('returns modal when no legacy is selected', async () => {
        getRuntimeValue.mockReturnValue(null);

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.type).toBe('modal');
        expect(result.modalName).toBe('fiendishLegacy');
        expect(result.payload.action).toBe(action);
        expect(result.payload.playerStats).toBeInstanceOf(Object);
        expect(result.payload.campaignName).toBe(campaignName);
    });
});

describe('confirmFiendishLegacy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(['Nonexistent', '', undefined])('returns error popup and writes nothing for invalid legacy %s', async (legacy) => {
        getRuntimeValue.mockReturnValue(null);
        const result = await confirmFiendishLegacy(makePlayerStats(), legacy, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Fiendish Legacy');
        expect(result.payload.description).toBe('No legacy selected.');
        expect(result.payload.automation.type).toBe('fiendish_legacy');
        expect(setRuntimeObject).not.toHaveBeenCalled();
    });

    it.each(Object.entries(LEGACY_DATA))('CLA-139: stores all runtime values for %s in ONE merged write', async (legacy, data) => {
        getRuntimeValue.mockReturnValue(null);
        const result = await confirmFiendishLegacy(makePlayerStats(), legacy, campaignName);

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(`Selected ${legacy} legacy. Spellcasting ability: ${data.ability}.`);

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
        vi.clearAllMocks();
    });

    it('clears all legacy runtime keys with null in exact order', () => {
        restoreUses(playerName, campaignName);

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
            expect(c).toEqual([playerName, c[1], null, campaignName]);
        });
    });
});

describe('runtime getters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Each getter is a one-line delegation to getRuntimeValue on its exact
    // key — pinned as a table so a renamed key fails here, once, clearly.
    it.each([
        ['getFiendishLegacySelection', '_fiendishLegacySelection', getFiendishLegacySelection, 'Infernal'],
        ['getFiendishLegacyAbility', '_fiendishLegacyAbility', getFiendishLegacyAbility, 'Charisma'],
        ['getFiendishLegacyCantrip', '_fiendishLegacyCantrip', getFiendishLegacyCantrip, 'Fire Bolt'],
        ['getFiendishLegacyLevel3Spell', '_fiendishLegacyLevel3', getFiendishLegacyLevel3Spell, 'Hellish Rebuke'],
        ['getFiendishLegacyLevel5Spell', '_fiendishLegacyLevel5', getFiendishLegacyLevel5Spell, 'Darkness'],
    ])('%s reads %s verbatim', (_label, key, getter, value) => {
        getRuntimeValue.mockReturnValue(value);
        expect(getter(makePlayerStats(), campaignName)).toBe(value);
        expect(getRuntimeValue).toHaveBeenCalledWith(playerName, key, campaignName);
    });
});
