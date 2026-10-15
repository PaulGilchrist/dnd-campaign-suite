// @maintained-by-ai
// Unit tests for protectionFromPoisonHandler.js — deterministic pure-behaviour contract:
// handle() popup payloads, applyProtectionFromPoison() runtime-store writes (exact payloads),
// expiration registration, campaign log, and isProtectionFromPoisonActive() lookup.
// All deps are mocked; no app churn required unless the handler's contract changes.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../combat/concentration/concentrationService.js', () => ({
    addConcentration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(),
}));

// NOTE: targetEffectDefinitions is NOT mocked — the handler never calls
// getEffectDefinition. It uses a hardcoded EFFECT_KEY string instead.

// ── Imports ────────────────────────────────────────────────────────────────

import {
    handle,
    applyProtectionFromPoison,
    isProtectionFromPoisonActive,
} from './protectionFromPoisonHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as concentrationService from '../../../combat/concentration/concentrationService.js';
import * as logService from '../../../ui/logService.js';
import * as combatData from '../../../encounters/combatData.js';

// ── Constants & Helpers ────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'test-campaign';
const PLAYER_NAME = 'TestCharacter';
const SPELL_NAME = 'Protection from Poison';
const EFFECT_KEY = 'protection_from_poison';

function makePlayerStats(overrides = {}) {
    return { name: PLAYER_NAME, level: 5, proficiency: 3, spellAbilities: { saveDc: 13 }, ...overrides };
}

function makeAction(automation = {}) {
    return {
        name: SPELL_NAME,
        automation: { duration: '1 hour', range: 'Touch', ...automation },
    };
}

// The buff payload carries no target name — pinned exactly as the handler builds it.
function expectedBuff(duration = '1 hour') {
    return {
        name: SPELL_NAME,
        effect: EFFECT_KEY,
        duration,
        sourceCharacter: PLAYER_NAME,
        resistanceTypes: ['Poison'],
        saveAdvantageTypes: ['poisoned'],
    };
}

function expectedTargetEffect(target = 'Ally1', duration = '1 hour') {
    return { target, effect: EFFECT_KEY, source: PLAYER_NAME, duration };
}

// Mock the handler's three store reads by key instead of brittle positional
// mockReturnValueOnce chains: (target,'activeConditions'), (target,'activeBuffs'),
// ('campaign','targetEffects').
function mockReads({ conditions = [], buffs = [], targetEffects = [] } = {}) {
    useRuntimeState.getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'activeConditions') return conditions;
        if (prop === 'activeBuffs') return buffs;
        if (prop === 'targetEffects') return targetEffects;
        return undefined;
    });
}

function callsFor(prop) {
    return useRuntimeState.setRuntimeValue.mock.calls.filter((c) => c[1] === prop);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('protectionFromPoisonHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset getRuntimeValue so tests can set their own return values.
        useRuntimeState.getRuntimeValue.mockReset();
        logService.addEntry.mockReset().mockResolvedValue(undefined);
        // Mock Date.now for deterministic timestamp assertions.
        vi.spyOn(global.Date, 'now').mockReturnValue(1700000000000);
        // Prevent the handler's window.dispatchEvent from firing real events.
        vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    });

    describe('handle', () => {
        it('returns exact error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: SPELL_NAME,
                    description: `No combat context found. Cannot apply ${SPELL_NAME}.`,
                },
            });
        });

        it('returns full target-selection payload with caster prepended and defaults', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1' }, { name: 'Ally2' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'protection_from_poison_target_selection',
                    name: SPELL_NAME,
                    creatureTargets: [PLAYER_NAME, 'Ally1', 'Ally2'],
                    range: 'Touch',
                    automation: { duration: '1 hour', range: 'Touch' },
                },
            });
        });

        it('does not duplicate caster when already in creature list', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: PLAYER_NAME }, { name: 'Ally1' }],
            });

            const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.creatureTargets).toEqual([PLAYER_NAME, 'Ally1']);
        });

        it('uses automation range when provided', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1' }],
            });

            const result = await handle(makeAction({ range: '30 feet' }), makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.range).toBe('30 feet');
            expect(result.payload.automation).toEqual({ duration: '1 hour', range: '30 feet' });
        });

        it('defaults range and automation when action has no automation object', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1' }],
            });

            const result = await handle({ name: SPELL_NAME }, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.range).toBe('Touch');
            expect(result.payload.automation).toEqual({});
        });
    });

    describe('applyProtectionFromPoison', () => {
        it('returns null with no side effects for missing or empty target result', async () => {
            for (const bad of [null, undefined, {}, { targetName: '' }]) {
                expect(await applyProtectionFromPoison(
                    makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, bad
                )).toBeNull();
            }

            expect(useRuntimeState.getRuntimeValue).not.toHaveBeenCalled();
            expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(expirations.addExpiration).not.toHaveBeenCalled();
            expect(logService.addEntry).not.toHaveBeenCalled();
        });

        it('happy path: exact condition removal, buff, target effect, expiration, log, and popup', async () => {
            mockReads({ conditions: ['Poisoned', 'exhausted', 'frightened'] });
            const target = 'Ally1';

            const result = await applyProtectionFromPoison(
                makeAction({ type: 'buff' }), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: target }
            );

            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(target, 'activeConditions');

            // Poisoned removed (case-insensitive), others preserved, in one exact write.
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                target, 'activeConditions', ['exhausted', 'frightened'], CAMPAIGN_NAME
            );

            // Exact buff payload on a fresh target.
            expect(callsFor('activeBuffs')).toEqual([
                [target, 'activeBuffs', [expectedBuff()], CAMPAIGN_NAME],
            ]);

            // Exact campaign-level badge effect.
            expect(callsFor('targetEffects')).toEqual([
                ['campaign', 'targetEffects', [expectedTargetEffect(target)], CAMPAIGN_NAME],
            ]);

            // Expiration: cleared by initiative roll / rest, never a clock.
            expect(expirations.addExpiration).toHaveBeenCalledWith({
                attackerName: PLAYER_NAME,
                targetName: target,
                effects: [
                    { type: 'remove_active_buff', buffName: SPELL_NAME },
                    { type: 'remove_target_effect', effectKey: EFFECT_KEY, source: PLAYER_NAME },
                ],
                campaignName: CAMPAIGN_NAME,
                rounds: Infinity,
                expireOnCreatureName: target,
            });

            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
                type: 'ability_use',
                characterName: PLAYER_NAME,
                abilityName: SPELL_NAME,
                description: `${PLAYER_NAME} cast ${SPELL_NAME} on ${target}. Poisoned condition removed. Target has Advantage on saving throws vs Poisoned and Resistance to Poison damage. Duration 1 hour, no concentration. Expires on initiative roll, short rest, or long rest.`,
                targetName: target,
                timestamp: 1700000000000,
            });

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: SPELL_NAME,
                    automationType: 'buff',
                    description: `${SPELL_NAME} applied to ${target}. Poisoned condition removed. Target has Advantage on saving throws vs Poisoned and Resistance to Poison damage.`,
                    automation: { duration: '1 hour', range: 'Touch', type: 'buff' },
                },
            });
        });

        it('skips activeConditions write and still applies buff when target is not poisoned', async () => {
            for (const conditions of [['exhausted'], [], undefined, null]) {
                useRuntimeState.setRuntimeValue.mockClear();
                mockReads({ conditions });

                const result = await applyProtectionFromPoison(
                    makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: PLAYER_NAME }
                );

                expect(callsFor('activeConditions')).toHaveLength(0);
                expect(callsFor('activeBuffs')).toHaveLength(1);
                expect(result.type).toBe('popup');
            }
        });

        it('replaces existing buff and preserves unrelated buffs', async () => {
            mockReads({
                buffs: [
                    { name: SPELL_NAME, effect: EFFECT_KEY, duration: '10 minutes' },
                    { name: 'Mage Armor', effect: 'mage_armor' },
                ],
            });

            const result = await applyProtectionFromPoison(
                makeAction({ duration: '1 hour' }), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: PLAYER_NAME }
            );

            expect(callsFor('activeBuffs')).toEqual([
                [PLAYER_NAME, 'activeBuffs', [{ name: 'Mage Armor', effect: 'mage_armor' }, expectedBuff()], CAMPAIGN_NAME],
            ]);
            expect(result.type).toBe('popup');
        });

        it('applies fresh buff when stored activeBuffs is null or undefined', async () => {
            for (const stored of [null, undefined]) {
                useRuntimeState.setRuntimeValue.mockClear();
                mockReads({ buffs: stored });

                await applyProtectionFromPoison(
                    makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: PLAYER_NAME }
                );

                expect(callsFor('activeBuffs')).toEqual([
                    [PLAYER_NAME, 'activeBuffs', [expectedBuff()], CAMPAIGN_NAME],
                ]);
            }
        });

        it('preserves existing target effects including array-target format', async () => {
            const existing = { target: ['ExistingTarget'], effect: 'other_effect', source: 'OtherCaster' };
            mockReads({ targetEffects: [existing] });

            await applyProtectionFromPoison(
                makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: 'Ally1' }
            );

            expect(callsFor('targetEffects')).toEqual([
                ['campaign', 'targetEffects', [existing, expectedTargetEffect('Ally1')], CAMPAIGN_NAME],
            ]);
        });

        it('deduplicates own prior target effect (same target, effect, source)', async () => {
            const other = { target: 'Other', effect: 'other_effect', source: 'Other' };
            mockReads({
                targetEffects: [
                    { target: PLAYER_NAME, effect: EFFECT_KEY, source: PLAYER_NAME },
                    other,
                ],
            });

            await applyProtectionFromPoison(
                makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: PLAYER_NAME }
            );

            expect(callsFor('targetEffects')).toEqual([
                ['campaign', 'targetEffects', [other, expectedTargetEffect(PLAYER_NAME)], CAMPAIGN_NAME],
            ]);
        });

        it('does NOT impose concentration or touch combatSummary (SP-095: RAW concentration:false)', async () => {
            mockReads();

            await applyProtectionFromPoison(
                makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: 'Ally1' }
            );

            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
            expect(callsFor('combatSummary')).toHaveLength(0);
            expect(window.dispatchEvent).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'combat-summary-updated' })
            );
        });

        it('returns popup and logs console error when addEntry rejects', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();
            mockReads();
            logService.addEntry.mockRejectedValue(new Error('disk full'));

            const result = await applyProtectionFromPoison(
                makeAction(), makePlayerStats(), CAMPAIGN_NAME, null, { targetName: 'Ally1' }
            );

            expect(result.type).toBe('popup');
            expect(consoleSpy).toHaveBeenCalledWith(
                '[protectionFromPoisonHandler] Error:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('isProtectionFromPoisonActive', () => {
        it('returns true when buff is active alongside other buffs', () => {
            mockReads({
                buffs: [
                    { name: 'Mage Armor', effect: 'mage_armor' },
                    { name: SPELL_NAME, effect: EFFECT_KEY },
                ],
            });

            expect(isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(true);
            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(PLAYER_NAME, 'activeBuffs', CAMPAIGN_NAME);
        });

        it('returns false when buff is not active', () => {
            mockReads({ buffs: [{ name: 'Mage Armor', effect: 'mage_armor' }] });
            expect(isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
        });

        it('returns false when activeBuffs is empty, null, or undefined', () => {
            for (const stored of [[], null, undefined]) {
                mockReads({ buffs: stored });
                expect(isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
            }
        });

        it('returns false when buff name matches but effect differs', () => {
            mockReads({ buffs: [{ name: SPELL_NAME, effect: 'some_other_effect' }] });
            expect(isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)).toBe(false);
        });
    });
});
