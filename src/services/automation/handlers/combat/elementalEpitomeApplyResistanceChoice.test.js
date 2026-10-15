// @maintained-by-ai
// elementalEpitomeHandler.applyResistanceChoice — resistance-selection writer lane
// (sibling elementalEpitomeHandle.test.js owns the handle() gate/modal lane).
// Contracts pinned here are read downstream and must stay exact-key/exact-shape:
//   - activeBuffs entry {name:'Elemental Epitome', effect:'epitome_resistance', damageType}
//     is consumed by applyDamage.js addBuffResistances (CLA-113; consumption itself is
//     owned by applyDamage.epitome.test.js) and re-picked via handle() currentResistance
//   - 'epitomeResistanceType' is read by charSummaryCalc.js, cleared on rests and by
//     ElementalAttunementModal deactivation
// Writes only: no game timers, turn-based seams only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ────────────────────────────────────────────────────

import { applyResistanceChoice } from './elementalEpitomeHandler.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestSorcerer',
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Elemental Epitome',
        automation: {
            type: 'elemental_epitome',
            ...overrides.automation,
        },
        ...overrides,
    };
}

// Whitelist mirrored from handler RESISTANCE_TYPES — full row coverage per type.
const VALID_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'];

// ── applyResistanceChoice: valid types — full write contract ───

describe('elementalEpitomeHandler.applyResistanceChoice — valid types', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(VALID_TYPES)('applies %s resistance: buff, runtime key, popup, log', async (type) => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            type,
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            expect.arrayContaining([
                { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: type },
            ]),
            campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'epitomeResistanceType',
            type,
            campaignName,
        );
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Elemental Epitome',
                automationType: 'elemental_epitome',
                description: `Damage Resistance set to ${type}.`,
                automation: expect.objectContaining({ type: 'elemental_epitome' }),
            },
        });
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestSorcerer',
            abilityName: 'Elemental Epitome',
            description: `Elemental Epitome — Damage Resistance set to ${type}.`,
            timestamp: expect.any(Number),
        });
    });
});

// ── applyResistanceChoice: existing buff update (in place) ─────

describe('elementalEpitomeHandler.applyResistanceChoice — existing buff update', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('replaces existing Elemental Epitome buff in place, preserving all others', async () => {
        const existingBuffs = [
            { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Acid' },
            { name: 'Bless', effect: 'bless' },
            { name: 'Shield of Faith', effect: 'shield_of_faith' },
        ];
        useRuntimeState.getRuntimeValue.mockReturnValue(existingBuffs);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            [
                { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Fire' },
                { name: 'Bless', effect: 'bless' },
                { name: 'Shield of Faith', effect: 'shield_of_faith' },
            ],
            campaignName,
        );
    });

    it('updates Elemental Epitome buff at the end of the array without reordering', async () => {
        const existingBuffs = [
            { name: 'Bless', effect: 'bless' },
            { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Fire' },
        ];
        useRuntimeState.getRuntimeValue.mockReturnValue(existingBuffs);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Cold',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            [
                { name: 'Bless', effect: 'bless' },
                { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Cold' },
            ],
            campaignName,
        );
    });
});

// ── applyResistanceChoice: empty/nullish existing buffs ────────

describe('elementalEpitomeHandler.applyResistanceChoice — empty existing buffs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        ['empty array', []],
        ['undefined', undefined],
        ['null', null],
    ])('pushes single exact-shape buff when activeBuffs is %s', async (_label, existing) => {
        useRuntimeState.getRuntimeValue.mockReturnValue(existing);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            [{ name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Fire' }],
            campaignName,
        );
    });
});

// ── applyResistanceChoice: invalid types — reject, zero effects ─

describe('elementalEpitomeHandler.applyResistanceChoice — invalid types', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Case-sensitive whitelist guard: non-whitelisted inputs return null with no writes/logs.
    it.each([
        ['Poison', 'Poison'],
        ['empty string', ''],
        ['null', null],
        ['undefined', undefined],
        ['number', 42],
        ['lowercase mismatch', 'fire'],
        ['uppercase mismatch', 'ACID'],
    ])('returns null and writes nothing for %s', async (_label, invalid) => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            invalid,
        );

        expect(result).toBeNull();
        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
        expect(logService.addEntry).not.toHaveBeenCalled();
    });
});

// ── applyResistanceChoice: identifier + automation passthrough ─

describe('elementalEpitomeHandler.applyResistanceChoice — passthrough', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('threads custom player, action name/automation, and campaign through writes, log, and popup', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const action = makeAction({
            name: 'Custom Epitome',
            automation: { type: 'custom_type', extra: 'data' },
        });

        const result = await applyResistanceChoice(
            action,
            makePlayerStats({ name: 'DragonSorcerer' }),
            'MyCustomCampaign',
            'Lightning',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'DragonSorcerer',
            'activeBuffs',
            [{ name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Lightning' }],
            'MyCustomCampaign',
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'DragonSorcerer',
            'epitomeResistanceType',
            'Lightning',
            'MyCustomCampaign',
        );
        expect(logService.addEntry).toHaveBeenCalledWith('MyCustomCampaign', {
            type: 'ability_use',
            characterName: 'DragonSorcerer',
            abilityName: 'Custom Epitome',
            description: 'Elemental Epitome — Damage Resistance set to Lightning.',
            timestamp: expect.any(Number),
        });
        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Custom Epitome',
                automationType: 'custom_type',
                description: 'Damage Resistance set to Lightning.',
                automation: { type: 'custom_type', extra: 'data' },
            },
        });
    });
});

// ── applyResistanceChoice: log failure is non-fatal ────────────

describe('elementalEpitomeHandler.applyResistanceChoice — log error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not throw when addEntry rejects, still returns popup and logs console error', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        logService.addEntry.mockRejectedValueOnce(new Error('Log service error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        expect(result).toBeDefined();
        expect(result.type).toBe('popup');
        expect(consoleSpy).toHaveBeenCalledWith(
            '[ElementalEpitome] Error logging:',
            expect.any(Error),
        );

        consoleSpy.mockRestore();
    });
});
