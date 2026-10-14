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

// ── applyResistanceChoice: valid types ─────────────────────────

describe('elementalEpitomeHandler.applyResistanceChoice — valid types', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stores epitome_resistance buff for Acid', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Acid',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Elemental Epitome',
                    effect: 'epitome_resistance',
                    damageType: 'Acid',
                }),
            ]),
            campaignName,
        );
    });

    it('stores epitome_resistance buff for Cold', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Cold',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Elemental Epitome',
                    effect: 'epitome_resistance',
                    damageType: 'Cold',
                }),
            ]),
            campaignName,
        );
    });

    it('stores epitome_resistance buff for Fire', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Elemental Epitome',
                    effect: 'epitome_resistance',
                    damageType: 'Fire',
                }),
            ]),
            campaignName,
        );
    });

    it('stores epitome_resistance buff for Lightning', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Lightning',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Elemental Epitome',
                    effect: 'epitome_resistance',
                    damageType: 'Lightning',
                }),
            ]),
            campaignName,
        );
    });

    it('stores epitome_resistance buff for Thunder', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Thunder',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Elemental Epitome',
                    effect: 'epitome_resistance',
                    damageType: 'Thunder',
                }),
            ]),
            campaignName,
        );
    });

    it('sets epitomeResistanceType in runtime', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'epitomeResistanceType',
            'Fire',
            campaignName,
        );
    });

    it('returns popup with correct description for chosen type', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Lightning',
        );

        expect(result).toEqual({
            type: 'popup',
            payload: {
                type: 'automation_info',
                name: 'Elemental Epitome',
                automationType: 'elemental_epitome',
                description: 'Damage Resistance set to Lightning.',
                automation: expect.objectContaining({ type: 'elemental_epitome' }),
            },
        });
    });

    it('logs ability_use to campaign log', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Cold',
        );

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestSorcerer',
            abilityName: 'Elemental Epitome',
            description: 'Elemental Epitome — Damage Resistance set to Cold.',
            timestamp: expect.any(Number),
        });
    });
});

// ── applyResistanceChoice: existing buff update ────────────────

describe('elementalEpitomeHandler.applyResistanceChoice — existing buff update', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates existing Elemental Epitome buff instead of adding duplicate', async () => {
        const existingBuffs = [
            { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Acid' },
            { name: 'Bless', effect: 'bless' },
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
                {
                    name: 'Elemental Epitome',
                    effect: 'epitome_resistance',
                    damageType: 'Fire',
                },
                { name: 'Bless', effect: 'bless' },
            ],
            campaignName,
        );
    });

    it('does not add a second Elemental Epitome buff when one already exists', async () => {
        const existingBuffs = [
            { name: 'Elemental Epitome', effect: 'epitome_resistance', damageType: 'Cold' },
        ];
        useRuntimeState.getRuntimeValue.mockReturnValue(existingBuffs);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        const epitomeBuffs = buffsArg.filter(b => b.name === 'Elemental Epitome');
        expect(epitomeBuffs).toHaveLength(1);
    });

    it('preserves other buffs when updating Elemental Epitome', async () => {
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
            'Thunder',
        );

        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg).toHaveLength(3);
        expect(buffsArg[0]).toEqual({
            name: 'Elemental Epitome',
            effect: 'epitome_resistance',
            damageType: 'Thunder',
        });
        expect(buffsArg[1]).toEqual({ name: 'Bless', effect: 'bless' });
        expect(buffsArg[2]).toEqual({ name: 'Shield of Faith', effect: 'shield_of_faith' });
    });

    it('works when Elemental Epitome buff is at the end of the array', async () => {
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

        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg[0]).toEqual({ name: 'Bless', effect: 'bless' });
        expect(buffsArg[1]).toEqual({
            name: 'Elemental Epitome',
            effect: 'epitome_resistance',
            damageType: 'Cold',
        });
    });
});

// ── applyResistanceChoice: invalid types ───────────────────────

describe('elementalEpitomeHandler.applyResistanceChoice — invalid types', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns null for unknown damage type', async () => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Poison',
        );

        expect(result).toBeNull();
    });

    it('returns null for empty string', async () => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            '',
        );

        expect(result).toBeNull();
    });

    it('returns null for null', async () => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(result).toBeNull();
    });

    it('returns null for undefined', async () => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            undefined,
        );

        expect(result).toBeNull();
    });

    it('returns null for number', async () => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            42,
        );

        expect(result).toBeNull();
    });

    it('returns null for case-insensitive mismatch (lowercase)', async () => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'fire',
        );

        expect(result).toBeNull();
    });

    it('returns null for case-insensitive mismatch (uppercase)', async () => {
        const result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'ACID',
        );

        expect(result).toBeNull();
    });

    it('does not set runtime values for invalid types', async () => {
        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Poison',
        );

        expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });

    it('does not log for invalid types', async () => {
        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Poison',
        );

        expect(logService.addEntry).not.toHaveBeenCalled();
    });
});

// ── applyResistanceChoice: empty existing buffs ────────────────

describe('elementalEpitomeHandler.applyResistanceChoice — empty existing buffs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pushes new buff when activeBuffs is empty array', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg).toEqual([
            {
                name: 'Elemental Epitome',
                effect: 'epitome_resistance',
                damageType: 'Fire',
            },
        ]);
    });

    it('pushes new buff when activeBuffs is undefined', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Cold',
        );

        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg).toEqual([
            {
                name: 'Elemental Epitome',
                effect: 'epitome_resistance',
                damageType: 'Cold',
            },
        ]);
    });

    it('pushes new buff when activeBuffs is null', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Thunder',
        );

        const buffsArg = useRuntimeState.setRuntimeValue.mock.calls[0][2];
        expect(buffsArg).toEqual([
            {
                name: 'Elemental Epitome',
                effect: 'epitome_resistance',
                damageType: 'Thunder',
            },
        ]);
    });
});

// ── applyResistanceChoice: custom player/action names ──────────

describe('elementalEpitomeHandler.applyResistanceChoice — custom names', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses custom player name for runtime operations', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats({ name: 'DragonSorcerer' }),
            campaignName,
            'Fire',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'DragonSorcerer',
            'activeBuffs',
            expect.any(Array),
            campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'DragonSorcerer',
            'epitomeResistanceType',
            'Fire',
            campaignName,
        );
    });

    it('uses custom action name in log entry', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction({ name: 'Custom Epitome' }),
            makePlayerStats(),
            campaignName,
            'Acid',
        );

        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, {
            type: 'ability_use',
            characterName: 'TestSorcerer',
            abilityName: 'Custom Epitome',
            description: 'Elemental Epitome — Damage Resistance set to Acid.',
            timestamp: expect.any(Number),
        });
    });

    it('uses custom campaign name in runtime and log', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            'MyCustomCampaign',
            'Lightning',
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'activeBuffs',
            expect.any(Array),
            'MyCustomCampaign',
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'TestSorcerer',
            'epitomeResistanceType',
            'Lightning',
            'MyCustomCampaign',
        );
        expect(logService.addEntry).toHaveBeenCalledWith(
            'MyCustomCampaign',
            expect.any(Object),
        );
    });
});

// ── applyResistanceChoice: popup payload ───────────────────────

describe('elementalEpitomeHandler.applyResistanceChoice — popup payload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('includes automation in popup payload', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const action = makeAction({
            automation: { type: 'custom_type', extra: 'data' },
        });

        const result = await applyResistanceChoice(
            action,
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        expect(result.payload.automation).toEqual({ type: 'custom_type', extra: 'data' });
    });

    it('passes automationType from action.automation', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = await applyResistanceChoice(
            makeAction({ automation: { type: 'my_type' } }),
            makePlayerStats(),
            campaignName,
            'Cold',
        );

        expect(result.payload.automationType).toBe('my_type');
    });

    it('passes action name to popup payload', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        const result = await applyResistanceChoice(
            makeAction({ name: 'My Epitome' }),
            makePlayerStats(),
            campaignName,
            'Acid',
        );

        expect(result.payload.name).toBe('My Epitome');
    });
});

// ── applyResistanceChoice: log entry error handling ────────────

describe('elementalEpitomeHandler.applyResistanceChoice — log error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not throw when addEntry rejects', async () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);
        logService.addEntry.mockRejectedValue(new Error('Log service error'));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const _result = await applyResistanceChoice(
            makeAction(),
            makePlayerStats(),
            campaignName,
            'Fire',
        );

        expect(_result).toBeDefined();
        expect(_result.type).toBe('popup');
        expect(consoleSpy).toHaveBeenCalledWith(
            '[ElementalEpitome] Error logging:',
            expect.any(Error),
        );

        consoleSpy.mockRestore();
    });
});
