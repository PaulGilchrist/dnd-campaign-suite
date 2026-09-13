// @improved-by-ai
// @cleaned-by-ai
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

function makePlayerStats(overrides = {}) {
    return { name: PLAYER_NAME, level: 5, proficiency: 3, spellAbilities: { saveDc: 13 }, ...overrides };
}

function makeAction(automation = {}) {
    return {
        name: 'Protection from Poison',
        automation: { duration: '1 hour', range: 'Touch', ...automation },
    };
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
        it('returns error popup when no combat context', async () => {
            combatData.getCombatSummary.mockReturnValue(null);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protection from Poison');
            expect(result.payload.description).toContain('No combat context found');
        });

        it('returns target selection popup with combat context including caster', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [
                    { name: 'Ally1' },
                    { name: 'Ally2' },
                ],
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('protection_from_poison_target_selection');
            expect(result.payload.name).toBe('Protection from Poison');
            expect(result.payload.creatureTargets).toHaveLength(3);
            expect(result.payload.creatureTargets[0]).toBe(PLAYER_NAME);
            expect(result.payload.creatureTargets[1]).toBe('Ally1');
            expect(result.payload.creatureTargets[2]).toBe('Ally2');
        });

        it('prepends caster when not already in creature list', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1' }],
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.creatureTargets).toHaveLength(2);
            expect(result.payload.creatureTargets[0]).toBe(PLAYER_NAME);
            expect(result.payload.creatureTargets[1]).toBe('Ally1');
        });

        it('does not duplicate caster when already in creature list', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [
                    { name: PLAYER_NAME },
                    { name: 'Ally1' },
                ],
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.creatureTargets).toHaveLength(2);
            expect(result.payload.creatureTargets[0]).toBe(PLAYER_NAME);
            expect(result.payload.creatureTargets[1]).toBe('Ally1');
        });

        it('passes automation and range through to payload with defaults', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1' }],
            });

            const action = makeAction({ type: 'buff' });
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.automation).toEqual({
                duration: '1 hour',
                range: 'Touch',
                type: 'buff',
            });
            expect(result.payload.range).toBe('Touch');
        });

        it('uses automation range when provided', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1' }],
            });

            const action = makeAction({ range: '30 feet' });
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.range).toBe('30 feet');
        });

        it('handles action with no automation object', async () => {
            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: 'Ally1' }],
            });

            const action = { name: 'Protection from Poison' };
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.range).toBe('Touch');
            expect(result.payload.automation).toEqual({});
        });
    });

    describe('applyProtectionFromPoison', () => {
        it('returns null when no result provided', async () => {
            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                null
            );

            expect(result).toBeNull();
        });

        it('returns null when result has no targetName', async () => {
            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                {}
            );

            expect(result).toBeNull();
        });

        it('returns null when result.targetName is empty string', async () => {
            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: '' }
            );

            expect(result).toBeNull();
        });

        it('returns null when result is undefined', async () => {
            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                undefined
            );

            expect(result).toBeNull();
        });

        it('removes Poisoned condition from target when present', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([]);

            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(useRuntimeState.getRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                'activeConditions'
            );
            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                'activeConditions',
                [],
                CAMPAIGN_NAME
            );
            expect(result.type).toBe('popup');
        });

        it('removes only Poisoned condition, preserving others', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned', 'exhausted', 'frightened'])
                .mockReturnValueOnce([]);

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
                PLAYER_NAME,
                'activeConditions',
                ['exhausted', 'frightened'],
                CAMPAIGN_NAME
            );
        });

        it('skips conditions update when no Poisoned condition present', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['exhausted'])
                .mockReturnValueOnce([]);

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            const conditionCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(conditionCalls).toHaveLength(0);
        });

        it('skips conditions update when activeConditions is empty array', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            const conditionCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeConditions'
            );
            expect(conditionCalls).toHaveLength(0);
        });

        it('applies buff with correct properties to new target', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            expect(result.type).toBe('popup');

            const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeBuffs'
            );
            expect(buffCalls).toHaveLength(1);
            expect(buffCalls[0][3]).toBe(CAMPAIGN_NAME);

            const buffs = buffCalls[0][2];
            const poisonBuff = buffs.find(
                (b) => b.name === 'Protection from Poison'
            );
            expect(poisonBuff).toBeTruthy();
            expect(poisonBuff.sourceCharacter).toBe(PLAYER_NAME);
            expect(poisonBuff.duration).toBe('1 hour');
            expect(poisonBuff.resistanceTypes).toEqual(['Poison']);
            expect(poisonBuff.saveAdvantageTypes).toEqual(['poisoned']);
        });

        it('uses default duration when automation lacks duration', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = { name: 'Protection from Poison', automation: {} };
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeBuffs'
            );
            expect(buffCalls[0][2][0].duration).toBe('1 hour');
        });

        it('updates existing buff duration when already active', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([
                    {
                        name: 'Protection from Poison',
                        effect: 'protection_from_poison',
                        duration: '10 minutes',
                    },
                    {
                        name: 'Mage Armor',
                        effect: 'mage_armor',
                    },
                ]);

            const action = makeAction({ duration: '1 hour' });
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(result.type).toBe('popup');

            const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeBuffs'
            );
            expect(buffCalls).toHaveLength(1);

            const buffs = buffCalls[0][2];
            const poisonBuffs = buffs.filter(
                (b) => b.name === 'Protection from Poison'
            );
            expect(poisonBuffs).toHaveLength(1);
            expect(poisonBuffs[0].duration).toBe('1 hour');
            expect(poisonBuffs[0].resistanceTypes).toEqual(['Poison']);

            const mageArmor = buffs.find((b) => b.name === 'Mage Armor');
            expect(mageArmor).toBeTruthy();
        });

        it('handles activeBuffs stored as null', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce(null);

            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(result.type).toBe('popup');
            const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeBuffs'
            );
            expect(buffCalls).toHaveLength(1);
            expect(buffCalls[0][2]).toContainEqual(
                expect.objectContaining({
                    name: 'Protection from Poison',
                })
            );
        });

        it('registers target effect for badge rendering', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: PLAYER_NAME }],
            });

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            const teCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(teCalls.length).toBeGreaterThan(0);
            const effects = teCalls[teCalls.length - 1][2];
            const poisonEffect = effects.find(
                (te) => te.effect === 'protection_from_poison'
            );
            expect(poisonEffect).toBeTruthy();
            expect(poisonEffect.target).toBe('Ally1');
            expect(poisonEffect.source).toBe(PLAYER_NAME);
            expect(poisonEffect.duration).toBe('1 hour');
        });

        it('handles targetEffects with array target format', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([
                    { target: ['ExistingTarget'], effect: 'other_effect', source: 'OtherCaster' },
                ]);

            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: PLAYER_NAME }],
            });

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            const teCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            expect(teCalls.length).toBeGreaterThan(0);
            const effects = teCalls[teCalls.length - 1][2];
            expect(effects).toHaveLength(2);
            expect(effects[0].target).toEqual(['ExistingTarget']);
            expect(effects[0].effect).toBe('other_effect');
            const newEffect = effects.find(
                (te) => te.effect === 'protection_from_poison'
            );
            expect(newEffect).toBeTruthy();
            expect(newEffect.target).toBe('Ally1');
        });

        it('filters out duplicate target effects (same target, effect, source)', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([
                    { target: PLAYER_NAME, effect: 'protection_from_poison', source: PLAYER_NAME },
                    { target: 'Other', effect: 'other_effect', source: 'Other' },
                ]);

            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: PLAYER_NAME }],
            });

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            const teCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'targetEffects'
            );
            const effects = teCalls[teCalls.length - 1][2];
            const poisonEffects = effects.filter(
                (te) => te.effect === 'protection_from_poison'
            );
            expect(poisonEffects).toHaveLength(1);
            expect(poisonEffects[0].target).toBe(PLAYER_NAME);
            const otherEffect = effects.find(
                (te) => te.effect === 'other_effect'
            );
            expect(otherEffect).toBeTruthy();
        });

        it('does NOT impose caster concentration (SP-095: RAW/data concentration:false)', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: PLAYER_NAME }],
            });

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
            const csWrites = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'combatSummary'
            );
            expect(csWrites).toHaveLength(0);
        });

        it('does NOT impose concentration even when playerStats lacks spellAbilities', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: PLAYER_NAME }],
            });

            const action = makeAction();
            const statsNoSpellAbilities = { name: PLAYER_NAME, proficiency: 3 };
            await applyProtectionFromPoison(
                action,
                statsNoSpellAbilities,
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            expect(concentrationService.addConcentration).not.toHaveBeenCalled();
        });

        it('registers expiration for initiative/rest cleanup', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = makeAction({ duration: '1 hour' });
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: PLAYER_NAME, targetName: PLAYER_NAME, effects: [
                    {
                        type: 'remove_active_buff',
                        buffName: 'Protection from Poison',
                    },
                    {
                        type: 'remove_target_effect',
                        effectKey: 'protection_from_poison',
                        source: PLAYER_NAME,
                    },
                ], campaignName: CAMPAIGN_NAME, rounds: Infinity, expireOnCreatureName: PLAYER_NAME });
        });

        it('calls addEntry with correct log payload', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            expect(logService.addEntry).toHaveBeenCalledWith(CAMPAIGN_NAME, {
                type: 'ability_use',
                characterName: PLAYER_NAME,
                abilityName: 'Protection from Poison',
                description: expect.stringMatching(/Ally1.*Advantage.*Resistance/),
                targetName: 'Ally1',
                timestamp: 1700000000000,
            });
        });

        it('handles addEntry rejection gracefully', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockReturnValue();

            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            logService.addEntry.mockRejectedValue(new Error('disk full'));

            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            expect(result.type).toBe('popup');
            expect(consoleSpy).toHaveBeenCalledWith(
                '[protectionFromPoisonHandler] Error:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        it('does NOT dispatch combat-summary-updated (SP-095: concentration block removed)', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            combatData.getCombatSummary.mockReturnValue({
                creatures: [{ name: PLAYER_NAME }],
            });

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            expect(window.dispatchEvent).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'combat-summary-updated' })
            );
        });

        it('returns result with correct popup payload shape', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = makeAction({ type: 'buff' });
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: 'Ally1' }
            );

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protection from Poison');
            expect(result.payload.automationType).toBe('buff');
            expect(result.payload.description).toContain('Ally1');
            expect(result.payload.automation).toEqual({
                duration: '1 hour',
                range: 'Touch',
                type: 'buff',
            });
        });
    });

    describe('isProtectionFromPoisonActive', () => {
        it('returns true when buff is active', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Protection from Poison', effect: 'protection_from_poison' },
            ]);

            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(true);
        });

        it('returns true alongside other buffs', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Mage Armor', effect: 'mage_armor' },
                { name: 'Protection from Poison', effect: 'protection_from_poison' },
                { name: 'Shield of Faith', effect: 'ac_bonus' },
            ]);

            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(true);
        });

        it('returns false when buff is not active', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([]);
            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });

        it('returns false when activeBuffs is null', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);
            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });

        it('returns false when activeBuffs is undefined', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });

        it('returns false when buff name matches but effect differs', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Protection from Poison', effect: 'some_other_effect' },
            ]);
            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });
    });
});
