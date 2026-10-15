// @maintained-by-ai
// Invisibility handler: thin adapter over invisibilityShared.js.
// This suite pins the regular-Invisibility contract (popup type, buff name
// 'Invisibility', 'Concentration, up to 1 hour' default, the
// '_activeInvisibility_' tracking key consumed by concentration/rest/
// initiative code) and is the CANONICAL home for the shared apply mechanics
// in invisibilityShared.js (dedupe branches, nullish-store guards, self
// pronoun, multi-target formatting) — the greater lane delegates them here
// via its own header. The greater lane pins only greater-specific constants
// plus the shared targetNames null-guard, so that guard is not repeated here.
// NOTE: the shared log text ("Spell ends if target attacks...") is correct
// ONLY for regular Invisibility — Greater Invisibility does not end on
// attack; that phrasing lives in invisibilityShared.js and must stay
// parameterised before the greater lane reuses it.
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

import { handle, applyInvisibility, isInvisibilityActive } from './invisibilityHandler.js';

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
        name: 'Invisibility',
        spell: { range: 'Touch', duration: 'Up to 1 hour', ...overrides.spell },
        automation: { type: 'invisibility', ...overrides.automation },
    };
}

/** Fresh empty-list answers for every runtime read (buffs/conditions/targetEffects). */
function emptyStores() {
    useRuntimeState.getRuntimeValue.mockReturnValue([]);
}

// ── handle ───────────────────────────────────────────────────────

describe('invisibilityHandler.handle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns invisibility target selection popup with creature list', async () => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [
                { name: 'Ally1', type: 'player' },
                { name: 'TestWizard', type: 'player' },
                { name: 'Enemy1', type: 'npc' },
            ],
        });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('invisibility_target_selection');
        expect(result.payload.name).toBe('Invisibility');
        expect(result.payload.creatureTargets).toEqual(['Ally1', 'TestWizard', 'Enemy1']);
        expect(result.payload.duration).toBe('Up to 1 hour');
        expect(result.payload.range).toBe('Touch');
        expect(result.payload.rangeFt).toBe(5);
        expect(result.payload.attackerPos).toBeNull();
    });

    it.each([
        { label: 'spell object is empty', spell: {} },
        { label: 'spell object is absent', spell: undefined },
    ])('defaults to Touch range and 1-hour concentration duration when $label', async ({ spell }) => {
        combatData.getCombatSummary.mockReturnValue({
            creatures: [{ name: 'Ally1' }],
        });

        const action = { name: 'Invisibility', automation: {} };
        if (spell !== undefined) action.spell = spell;

        const result = await handle(action, makePlayerStats(), campaignName, null);

        expect(result.payload.range).toBe('Touch');
        expect(result.payload.rangeFt).toBe(5);
        expect(result.payload.duration).toBe('Concentration, up to 1 hour');
    });

    it.each([
        { label: 'no combat summary', summary: null },
        { label: 'summary has no creatures', summary: { creatures: [] } },
    ])('returns empty creature list when $label', async ({ summary }) => {
        combatData.getCombatSummary.mockReturnValue(summary);

        const result = await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(result.payload.creatureTargets).toEqual([]);
    });

    it('includes attacker position when mapName is provided', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally1' }] });
        targetResolver.resolveMapPositions.mockResolvedValue({ attackerPos: { x: 1, y: 2 } });

        const result = await handle(makeAction(), makePlayerStats(), campaignName, mapName);

        expect(result.payload.attackerPos).toEqual({ x: 1, y: 2 });
    });

    it('does not call resolveMapPositions when mapName is absent', async () => {
        combatData.getCombatSummary.mockReturnValue({ creatures: [{ name: 'Ally1' }] });

        await handle(makeAction(), makePlayerStats(), campaignName, null);

        expect(targetResolver.resolveMapPositions).not.toHaveBeenCalled();
    });
});

// ── applyInvisibility ────────────────────────────────────────────
// targetNames null/empty guard is asserted in the greater lane
// (same applyInvisibilityToTargets branch); not repeated here.

describe('invisibilityHandler.applyInvisibility', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stamps Invisibility buff, condition, tracking key, targetEffect, expiration and log', async () => {
        emptyStores();

        const result = await applyInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(result).not.toBeNull();
        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');

        // Buff carries the regular-Invisibility identity and duration
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({
                    name: 'Invisibility',
                    effect: 'invisible',
                    duration: 'Up to 1 hour',
                    sourceCharacter: 'TestWizard',
                }),
            ]),
            campaignName,
        );

        // Condition was added
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            expect.arrayContaining(['invisible']),
            campaignName,
        );

        // Tracking key (consumed by concentration/rest/initiative code)
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '_activeInvisibility_Ally1',
            'TestWizard',
            campaignName,
        );

        // Campaign-level targetEffects was set
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

        // Expiration removes the regular buff by name
        expect(expirations.addExpiration).toHaveBeenCalledWith({
            attackerName: 'TestWizard',
            targetName: 'Ally1',
            effects: expect.arrayContaining([
                expect.objectContaining({
                    type: 'remove_active_buff',
                    buffName: 'Invisibility',
                }),
            ]),
            campaignName,
        });

        // Log entry — regular Invisibility DOES end on attack
        expect(logService.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
            type: 'ability_use',
            characterName: 'TestWizard',
            abilityName: 'Invisibility',
            description: expect.stringContaining('ends if target makes an attack roll'),
        }));
    });

    it('applies invisibility to self with themself pronoun', async () => {
        emptyStores();

        const result = await applyInvisibility(
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

    it('skips duplicate buff/condition writes but still stamps tracking key, targetEffect, expiration and log', async () => {
        useRuntimeState.getRuntimeValue
            .mockReturnValueOnce([{ name: 'Invisibility', effect: 'invisible' }]) // buff already present
            .mockReturnValueOnce(['Invisible']); // condition present, different case

        await applyInvisibility(
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

        // Campaign-level stamps happen regardless of dedupe
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            '_activeInvisibility_Ally1',
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
        expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
        expect(logService.addEntry).toHaveBeenCalledTimes(1);
    });

    it('applies invisibility to multiple targets with plural description', async () => {
        emptyStores();

        const result = await applyInvisibility(
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
        expect(logService.addEntry).toHaveBeenCalledTimes(2);
    });

    it('respects custom duration from spell object', async () => {
        emptyStores();

        await applyInvisibility(
            {
                name: 'Invisibility',
                spell: { duration: 'Custom duration' },
                automation: { type: 'invisibility' },
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

    it('uses default 1-hour concentration duration when spell object is absent', async () => {
        emptyStores();

        await applyInvisibility(
            { name: 'Invisibility', automation: { type: 'invisibility' } },
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([
                expect.objectContaining({ duration: 'Concentration, up to 1 hour' }),
            ]),
            campaignName,
        );
    });

    it('survives null runtime stores and still stamps buff, condition and targetEffects', async () => {
        // Every read (buffs, conditions, campaign targetEffects) returns null
        useRuntimeState.getRuntimeValue.mockReturnValue(null);

        await applyInvisibility(
            makeAction(),
            makePlayerStats(),
            campaignName,
            null,
            ['Ally1'],
        );

        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeBuffs',
            expect.arrayContaining([expect.objectContaining({ name: 'Invisibility' })]),
            campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'Ally1',
            'activeConditions',
            expect.arrayContaining(['invisible']),
            campaignName,
        );
        expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
            'campaign',
            'targetEffects',
            expect.arrayContaining([expect.objectContaining({ target: 'Ally1' })]),
            campaignName,
        );
    });
});

// ── isInvisibilityActive ─────────────────────────────────────────

describe('invisibilityHandler.isInvisibilityActive', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when Invisibility buff with invisible effect is active', () => {
        useRuntimeState.getRuntimeValue.mockReturnValue([
            { name: 'Invisibility', effect: 'invisible', duration: '1_hour' },
        ]);

        expect(isInvisibilityActive('Ally1', campaignName)).toBe(true);
    });

    it.each([
        { label: 'wrong effect', buffs: [{ name: 'Invisibility', effect: 'some_other_effect' }] },
        { label: 'only GreaterInvisibility buff', buffs: [{ name: 'GreaterInvisibility', effect: 'invisible' }] },
        { label: 'unrelated buff', buffs: [{ name: 'Shield', effect: 'shield' }] },
        { label: 'empty buffs', buffs: [] },
        { label: 'null buffs', buffs: null },
        { label: 'undefined buffs', buffs: undefined },
    ])('returns false when activeBuffs is $label', ({ buffs }) => {
        useRuntimeState.getRuntimeValue.mockReturnValue(buffs);

        expect(isInvisibilityActive('Ally1', campaignName)).toBe(false);
    });
});
