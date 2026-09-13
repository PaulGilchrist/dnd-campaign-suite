// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ─────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    rangeToFeet: vi.fn((r) => (r === 'Touch' ? 5 : 30)),
}));

vi.mock('../../common/targetResolver.js', () => ({
    resolveMapPositions: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { handle, applyGreaterInvisibility, isGreaterInvisibilityActive } from './greaterInvisibilityHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';

// ── Helpers ──────────────────────────────────────────────────────

const campaignName = 'test-campaign';
const mapName = 'test-map';

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestWizard',
        level: 5,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: 'Greater Invisibility',
        spell: { range: 'Touch', duration: 'Up to 1 minute', ...overrides.spell },
        automation: { type: 'greater_invisibility', ...overrides.automation },
    };
}

// ── handle ───────────────────────────────────────────────────────

describe('greaterInvisibilityHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns target selection popup with creature list when combat context exists', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'TestWizard', type: 'player' },
                { name: 'Enemy1', type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('greater_invisibility_target_selection');
        expect(result.payload.name).toBe('Greater Invisibility');
        expect(result.payload.creatureTargets).toEqual(['Ally1', 'TestWizard', 'Enemy1']);
        expect(result.payload.duration).toBe('Up to 1 minute');
        expect(result.payload.range).toBe('Touch');
        expect(result.payload.rangeFt).toBe(5);
        expect(result.payload).toHaveProperty('attackerPos');
    });

    it('uses default range and duration when spell object is empty', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }],
        });

        const result = await handle(
            { name: 'Greater Invisibility', spell: {}, automation: {} },
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(result.payload.range).toBe('Touch');
        expect(result.payload.duration).toBe('Concentration, up to 1 minute');
    });

    it('uses default range and duration when spell object is absent', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }],
        });

        const result = await handle(
            { name: 'Greater Invisibility', automation: {} },
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(result.payload.range).toBe('Touch');
        expect(result.payload.rangeFt).toBe(5);
        expect(result.payload.duration).toBe('Concentration, up to 1 minute');
    });

    it('returns empty creature list when no combat summary', async () => {
        combatData.getCombatSummary.mockReturnValue(null);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('includes attacker position when mapName is provided', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally1' }] });
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

        const result = await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
            mapName,
        );

        expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
    });

    it('does not call resolveMapPositions when mapName is absent', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally1' }] });

        await handle(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
        );

        expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });
});

// ── applyGreaterInvisibility ─────────────────────────────────────

describe('greaterInvisibilityHandler.applyGreaterInvisibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { label: 'empty array', targets: [] },
        { label: 'null', targets: null },
        { label: 'undefined', targets: undefined },
        { label: 'non-array string', targets: 'not-an-array' },
        { label: 'non-array number', targets: 42 },
    ])('returns null when targetNames is $label', async ({ targets }) => {
        const result = await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            targets,
        );
        expect(result).toBeNull();
    });

    it('applies greater invisibility to a single target', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([]) // activeBuffs for target
            .mockReturnValueOnce([]); // activeConditions for target

        const result = await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');

        // Check buff was added
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'GreaterInvisibility',
                    effect: 'invisible',
                    sourceCharacter: 'TestWizard',
                }),
            ]),
            campaignName,
        );

        // Check condition was added
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            expect.arrayContaining(['invisible']),
            campaignName,
        );

        // Check tracking key was set
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '_activeGreaterInvisibility_Ally1',
            'TestWizard',
            campaignName,
        );

        // Check campaign-level targetEffects was set
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({
                    target: 'Ally1',
                    effect: 'invisible',
                    source: 'TestWizard',
                }),
            ]),
            campaignName,
        );

        // Check expiration was added
        expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'TestWizard', targetName: 'Ally1', effects: expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_active_buff',
                    buffName: 'GreaterInvisibility',
                }),
            ]), campaignName });

        // Check log entry
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Greater Invisibility',
            description: expect.stringContaining('Ally1'),
        }));
    });

    it('applies greater invisibility to self', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([]) // buffs
            .mockReturnValueOnce([]); // conditions

        const result = await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['TestWizard'],
        );

        expect(result).not.toBeNull();
        expect(result.payload.description).toContain('TestWizard');
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            description: expect.stringContaining('themself'),
        }));
    });

    it('does not add duplicate buff if already active', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([{ name: 'GreaterInvisibility', effect: 'invisible' }]) // already has buff
            .mockReturnValueOnce([]); // conditions

        await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        // Should not add a second buff
        const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'activeBuffs' && call[0] === 'Ally1',
        );
        expect(buffCalls).toHaveLength(0);
    });

    it('does not add duplicate condition if already present (case-insensitive)', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([]) // buffs
            .mockReturnValueOnce(['Invisible']); // already has condition (capitalized)

        await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        const condCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'activeConditions' && call[0] === 'Ally1',
        );
        expect(condCalls).toHaveLength(0);
    });

    it('applies greater invisibility to multiple targets', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([]) // Ally1 buffs
            .mockReturnValueOnce([]) // Ally1 conditions
            .mockReturnValueOnce([]) // Enemy1 buffs
            .mockReturnValueOnce([]); // Enemy1 conditions

        const result = await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1', 'Enemy1'],
        );

        expect(result).not.toBeNull();
        expect(result.payload.description).toContain('2 targets');
        expect(result.payload.description).toContain('Ally1');
        expect(result.payload.description).toContain('Enemy1');
    });

    it('respects custom duration from spell object', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await applyGreaterInvisibility(
            {
                name: 'Greater Invisibility',
                spell: { duration: 'Custom duration' },
                automation: { type: 'greater_invisibility' },
            },
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ duration: 'Custom duration' }),
            ]),
            campaignName,
        );
    });

    it('uses default duration when spell object is absent', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await applyGreaterInvisibility(
            { name: 'Greater Invisibility', automation: { type: 'greater_invisibility' } },
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ duration: 'Concentration, up to 1 minute' }),
            ]),
            campaignName,
        );
    });

    it('handles null activeBuffs gracefully', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce(null) // activeBuffs is null
            .mockReturnValueOnce([]); // conditions

        await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ name: 'GreaterInvisibility' }),
            ]),
            campaignName,
        );
    });

    it('handles null activeConditions gracefully', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([]) // buffs
            .mockReturnValueOnce(null); // conditions is null

        await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            expect.arrayContaining(['invisible']),
            campaignName,
        );
    });

    it('skips buff and condition for target that already has both', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([{ name: 'GreaterInvisibility', effect: 'invisible' }]) // has buff
            .mockReturnValueOnce(['invisible']); // has condition

        await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'activeBuffs' && call[0] === 'Ally1',
        );
        const condCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
            call => call[1] === 'activeConditions' && call[0] === 'Ally1',
        );
        expect(buffCalls).toHaveLength(0);
        expect(condCalls).toHaveLength(0);
    });

    it('sets tracking key and targetEffects even when buff/condition already present', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([{ name: 'GreaterInvisibility', effect: 'invisible' }])
            .mockReturnValueOnce(['invisible']);

        await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '_activeGreaterInvisibility_Ally1',
            'TestWizard',
            campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ target: 'Ally1', effect: 'invisible' }),
            ]),
            campaignName,
        );
    });

    it('uses playerStats.name for source in targetEffects', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([])
            .mockReturnValueOnce([]);

        await applyGreaterInvisibility(
            makeAction(),
            makePlayerStats({ name: 'ArchmageElara' }),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([
                expect.objectContaining({ source: 'ArchmageElara' }),
            ]),
            campaignName,
        );
    });
});

// ── isGreaterInvisibilityActive ──────────────────────────────────

describe('greaterInvisibilityHandler.isGreaterInvisibilityActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when GreaterInvisibility buff with invisible effect is active', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'GreaterInvisibility', effect: 'invisible', duration: '1_minute' },
        ]);

        expect(isGreaterInvisibilityActive('Ally1', campaignName)).toBe(true);
    });

    it('returns false when buff has GreaterInvisibility name but wrong effect', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'GreaterInvisibility', effect: 'some_other_effect' },
        ]);

        expect(isGreaterInvisibilityActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when no GreaterInvisibility buff', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'Shield', effect: 'shield' },
        ]);

        expect(isGreaterInvisibilityActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is empty', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([]);

        expect(isGreaterInvisibilityActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is null', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(null);

        expect(isGreaterInvisibilityActive('Ally1', campaignName)).toBe(false);
    });

    it('returns false when activeBuffs is undefined', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue(undefined);

        expect(isGreaterInvisibilityActive('Ally1', campaignName)).toBe(false);
    });
});
