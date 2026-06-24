// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
}));

vi.mock('../../../ui/storage.js', () => ({
    __esModule: true,
    default: {
        set: vi.fn().mockResolvedValue(undefined),
    },
}));

// ── Imports ────────────────────────────────────────────────────────────────

import {
    handle,
    applyProtectionFromPoison,
    isProtectionFromPoisonActive,
} from './protectionFromPoisonHandler.js';

import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../rules/effects/expirations.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import storage from '../../../ui/storage.js';

// ── Constants & Helpers ────────────────────────────────────────────────────

const CAMPAIGN_NAME = 'TestCampaign';
const PLAYER_NAME = 'TestCharacter';

function makePlayerStats(overrides = {}) {
    return { name: PLAYER_NAME, level: 5, ...overrides };
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
        // Reset to safe defaults so mockReturnValueOnce chains work correctly
        useRuntimeState.getRuntimeValue.mockReset();
        useRuntimeState.getRuntimeValue.mockReturnValue(undefined);
        damageUtils.getCombatContext.mockResolvedValue(undefined);
        logService.addEntry.mockResolvedValue(undefined);
        storage.set.mockResolvedValue(undefined);
    });

    describe('handle', () => {
        it('returns error popup when no combat context', async () => {
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protection from Poison');
            expect(result.payload.description).toContain('No combat context found');
            expect(result.payload.description).toContain('Protection from Poison');
        });

        it('returns target selection popup with combat context', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1' },
                    { name: 'Ally2' },
                ],
            });
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Protection from Poison');
            expect(result.payload.description).toBe('Select a target to protect.');
            expect(result.payload.targets).toHaveLength(3);
            expect(result.payload.targets[0].isSelf).toBe(true);
            expect(result.payload.targets[0].name).toBe(PLAYER_NAME);
        });

        it('marks self as having poisoned condition when ally has none', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1' }],
            });
            // Creatures processed first, then self. Use mockImplementation for clarity.
            let callIndex = 0;
            const responses = [[], ['poisoned']];
            useRuntimeState.getRuntimeValue.mockImplementation((_name, _key) => {
                return responses[callIndex++];
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            // targets = [self, Ally1]
            expect(result.payload.targets[0].hasPoisoned).toBe(true);
            expect(result.payload.targets[1].hasPoisoned).toBe(false);
        });

        it('marks allies with poisoned condition independently', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [
                    { name: 'Ally1' },
                    { name: 'Ally2' },
                ],
            });
            // Creatures: Ally1, Ally2, then self
            let callIndex = 0;
            const responses = [['poisoned'], [], []];
            useRuntimeState.getRuntimeValue.mockImplementation((_name, _key) => {
                return responses[callIndex++];
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            // targets = [self, Ally1, Ally2]
            expect(result.payload.targets[0].hasPoisoned).toBe(false);
            expect(result.payload.targets[1].hasPoisoned).toBe(true);
            expect(result.payload.targets[2].hasPoisoned).toBe(false);
        });

        it('excludes self from creature targets list', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [
                    { name: PLAYER_NAME },
                    { name: 'Ally1' },
                ],
            });
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            const selfInTargets = result.payload.targets.filter((t) => t.isSelf);
            expect(selfInTargets).toHaveLength(1);
            expect(selfInTargets[0].name).toBe(PLAYER_NAME);

            const allyTarget = result.payload.targets.find((t) => t.name === 'Ally1');
            expect(allyTarget).toBeTruthy();
        });

        it('passes automation and range through to payload', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1' }],
            });
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = makeAction({ type: 'buff' });
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.automation).toEqual({
                duration: '1 hour',
                range: 'Touch',
                type: 'buff',
            });
            expect(result.payload.range).toBe('Touch');
        });

        it('uses default range when automation has no range', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1' }],
            });
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = makeAction({ range: undefined });
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.range).toBe('Touch');
        });

        it('handles action with no automation property', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1' }],
            });
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            const action = { name: 'Protection from Poison' };
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.type).toBe('popup');
            expect(result.payload.automation).toEqual({});
            expect(result.payload.range).toBe('Touch');
        });

        it('normalizes condition strings for poisoned check', async () => {
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [{ name: 'Ally1' }],
            });
            // Creatures first, then self
            let callIndex = 0;
            const responses = [[' Poisoned '], []];
            useRuntimeState.getRuntimeValue.mockImplementation((_name, _key) => {
                return responses[callIndex++];
            });

            const action = makeAction();
            const result = await handle(action, makePlayerStats(), CAMPAIGN_NAME, null);

            expect(result.payload.targets[1].hasPoisoned).toBe(true);
        });
    });

    describe('applyProtectionFromPoison', () => {
        it('returns null when no target provided', async () => {
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

        it('returns null when targetName is empty string', async () => {
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

        it('does not call setRuntimeValue for conditions when none to remove', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['buffed'])
                .mockReturnValueOnce([]);

            const action = makeAction();
            const result = await applyProtectionFromPoison(
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
            expect(result.type).toBe('popup');
        });

        it('updates combat context creature conditions when combat context exists', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([]);
            damageUtils.getCombatContext.mockResolvedValue({
                creatures: [
                    { name: PLAYER_NAME, conditions: [{ key: 'poisoned' }] },
                ],
            });

            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(storage.set).toHaveBeenCalledWith(
                'combatSummary',
                expect.any(Object),
                CAMPAIGN_NAME
            );
            expect(result.payload.description).toContain('Protection from Poison');
        });

        it('does not call storage.set when combat context is null', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([]);
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = makeAction();
            await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(storage.set).not.toHaveBeenCalled();
        });

        it('applies buff when none currently active', async () => {
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
                { targetName: PLAYER_NAME }
            );

            const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeBuffs'
            );
            expect(buffCalls).toHaveLength(1);
            expect(buffCalls[0][3]).toBe(CAMPAIGN_NAME);

            const buffs = buffCalls[0][2];
            expect(buffs).toContainEqual(
                expect.objectContaining({
                    name: 'Protection from Poison',
                    effect: 'protection_from_poison',
                    resistanceTypes: ['Poison'],
                })
            );
        });

        it('replaces existing buff when already active', async () => {
            // getRuntimeValue calls: activeConditions (1), activeBuffs (2)
            // getCombatContext returns undefined (default), so combat context block is skipped
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

        it('sets sourceCharacter on the buff', async () => {
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

            const buffCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
                (c) => c[1] === 'activeBuffs'
            );
            const buffs = buffCalls[0][2];
            const poisonBuff = buffs.find(
                (b) => b.name === 'Protection from Poison'
            );

            expect(poisonBuff.sourceCharacter).toBe(PLAYER_NAME);
        });

        it('uses duration from automation when provided', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = makeAction({ duration: 'Concentration, up to 10 minutes' });
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
            const buffs = buffCalls[0][2];
            const poisonBuff = buffs.find(
                (b) => b.name === 'Protection from Poison'
            );

            expect(poisonBuff.duration).toBe('Concentration, up to 10 minutes');
        });

        it('uses default duration when automation has no duration', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);

            const action = makeAction({ duration: undefined });
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
            const buffs = buffCalls[0][2];
            const poisonBuff = buffs.find(
                (b) => b.name === 'Protection from Poison'
            );

            expect(poisonBuff.duration).toBe('1 hour');
        });

        it('uses default duration when automation object is empty', async () => {
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
            const buffs = buffCalls[0][2];
            const poisonBuff = buffs.find(
                (b) => b.name === 'Protection from Poison'
            );

            expect(poisonBuff.duration).toBe('1 hour');
        });

        it('registers expiration to remove buff after duration', async () => {
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

            expect(expirations.addExpiration).toHaveBeenCalledWith(
                PLAYER_NAME,
                PLAYER_NAME,
                [
                    {
                        type: 'remove_active_buff',
                        buffName: 'Protection from Poison',
                    },
                ],
                CAMPAIGN_NAME
            );
        });

        it('calls addEntry with correct log payload', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            damageUtils.getCombatContext.mockResolvedValue(null);

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
                description: expect.stringMatching(
                    new RegExp(`${PLAYER_NAME}.*Ally1.*Advantage.*Resistance`)
                ),
                targetName: 'Ally1',
                timestamp: expect.any(Number),
            });
        });

        it('returns popup with description confirming application', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce(['poisoned'])
                .mockReturnValueOnce([])
                .mockReturnValueOnce([]);
            damageUtils.getCombatContext.mockResolvedValue(null);

            const action = makeAction();
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
            expect(result.payload.description).toContain('Protection from Poison');
            expect(result.payload.description).toContain('Ally1');
            expect(result.payload.description).toContain('Advantage');
            expect(result.payload.description).toContain('Resistance');
        });

        it('handles condition stored as object with key property', async () => {
            useRuntimeState.getRuntimeValue
                .mockReturnValueOnce([{ key: 'poisoned' }])
                .mockReturnValueOnce([]);

            const action = makeAction();
            const result = await applyProtectionFromPoison(
                action,
                makePlayerStats(),
                CAMPAIGN_NAME,
                null,
                { targetName: PLAYER_NAME }
            );

            expect(result).toBeTruthy();
            expect(result.type).toBe('popup');
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

        it('returns false when buff is not active', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([]);

            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });

        it('returns false when buff has different name', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Blade Ward', effect: 'blade_ward' },
            ]);

            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });

        it('returns false when buff has different effect', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Protection from Poison', effect: 'some_other_effect' },
            ]);

            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });

        it('returns false when multiple buffs present but not protection from poison', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue([
                { name: 'Mage Armor', effect: 'mage_armor' },
                { name: 'Shield of Faith', effect: 'ac_bonus' },
            ]);

            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
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

        it('returns false when runtime value is null', () => {
            useRuntimeState.getRuntimeValue.mockReturnValue(null);

            expect(
                isProtectionFromPoisonActive(PLAYER_NAME, CAMPAIGN_NAME)
            ).toBe(false);
        });
    });
});
