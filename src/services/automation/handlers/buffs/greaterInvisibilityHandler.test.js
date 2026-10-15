// @maintained-by-ai
// Greater Invisibility handler: thin adapter over invisibilityShared.js.
// This suite pins ONLY the greater-specific contract (popup type, 1-minute
// concentration default, 'GreaterInvisibility' buff identity, the
// _activeGreaterInvisibility_ tracking key consumed by concentration/rest/
// initiative code). Shared apply mechanics (dedupe, null guards, self/other
// pronouns, multi-target formatting) are covered by invisibilityHandler.test.js.
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

    it('returns greater-invisibility target selection popup with creature list', async () => {
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
        expect(result.payload.attackerPos).toBeNull();
    });

    it('defaults to Touch range and 1-minute concentration duration when spell is absent', async () => {
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

    it('stamps GreaterInvisibility buff, condition, tracking key, targetEffect, expiration and log', async () => {
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
                    duration: 'Up to 1 minute',
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

        // Check tracking key was set (consumed by concentration/rest/initiative code)
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

    it('uses default 1-minute concentration duration when spell object is absent', async () => {
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

    it.each([
        { label: 'wrong effect', buffs: [{ name: 'GreaterInvisibility', effect: 'some_other_effect' }] },
        { label: 'only regular Invisibility buff', buffs: [{ name: 'Invisibility', effect: 'invisible' }] },
        { label: 'unrelated buff', buffs: [{ name: 'Shield', effect: 'shield' }] },
        { label: 'empty buffs', buffs: [] },
        { label: 'null buffs', buffs: null },
        { label: 'undefined buffs', buffs: undefined },
    ])('returns false when activeBuffs is $label', ({ buffs }) => {
        useRuntimeState.getRuntimeValue.mockReturnValue(buffs);

        expect(isGreaterInvisibilityActive('Ally1', campaignName)).toBe(false);
    });
});
