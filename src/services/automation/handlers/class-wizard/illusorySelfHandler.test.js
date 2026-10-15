// @maintained-by-ai
// Unit tests for illusorySelfHandler (Wizard Illusory Self reaction: an illusory duplicate
// makes a hit attack automatically miss and rolls back its damage). Deterministic: runtime
// store, damage rollback utility, and log IO are all mocked; tests pin guard branches,
// spell-slot restore wiring, exact runtime-key writes, and full-string popup composition.
// No timers — turn-based only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './illusorySelfHandler.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as damageRollback from '../../common/damageRollback.js';
import { addEntry } from '../../../ui/logService.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findAttackRollAgainstTarget: vi.fn(),
    rollbackDamage: vi.fn(),
}));

const campaignName = 'test-campaign';
const playerName = 'TestWizard';

function makeAction(overrides = {}) {
    return {
        name: 'Illusory Self',
        automation: {
            type: 'illusory_self',
            trigger: 'attack_hit',
            casting_time: '1 reaction',
            uses: 1,
            recharge: 'short_or_long_rest',
            spellSlotRestore: { minLevel: 2 },
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: playerName,
        level: 10,
        spellAbilities: {
            spell_slots_level_2: 4,
            spell_slots_level_3: 3,
            spell_slots_level_4: 2,
        },
        ...overrides,
    };
}

function makeAttackEvent(overrides = {}) {
    return {
        d20: 15,
        bonus: 5,
        targetName: playerName,
        targetAc: 13,
        hit: true,
        timestamp: Date.now() - 1000,
        ...overrides,
    };
}

function mockCurrentUses(current) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'illusorySelfUses') return current;
        return null;
    });
}

function mockCurrentUsesAndSlots(current, slotOverrides = {}) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'illusorySelfUses') return current;
        if (key in slotOverrides) return slotOverrides[key];
        if (key.startsWith('spell_slots_level_')) return 0;
        return null;
    });
}

describe('illusorySelfHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
            attackEvent: null,
            attackerName: null,
        });
        damageRollback.rollbackDamage.mockResolvedValue(0);
        runtimeState.getRuntimeValue.mockReturnValue(null);
        runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    });

    describe('guard clauses', () => {
        it('returns info popup with no side effects when no recent attack roll exists', async () => {
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Illusory Self',
                    description: 'No recent attack roll against you found. Illusory Self can only be used as a Reaction shortly after an attack roll.',
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns info popup with no side effects when the attack already missed', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent({ hit: false }),
                attackerName: 'Goblin',
            });
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Illusory Self',
                    description: 'The attack already missed — Illusory Self has no effect.',
                    automation: action.automation,
                },
            });
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('trigger and uses tracking', () => {
        it('auto-misses the attack, consumes a use, rolls back damage, and logs the ability use', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(0);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Goblin',
                playerName,
                campaignName,
                'Illusory Self',
            );
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Illusory Self',
                    description: 'Attacker: <b>Goblin</b><br/><br/>You use your Reaction to interpose an illusory duplicate between yourself and the attacker.<br/><br/><b>Result:</b> The attack automatically misses.<br/><br/><em>The illusion dissipates. Uses remaining: 0 / 1 (Short or Long Rest).</em>',
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'illusorySelfUses',
                1,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Illusory Self',
                    targetName: 'Goblin',
                    description: "TestWizard used Illusory Self — Goblin's attack misses due to illusory duplicate.",
                }),
            );
        });

        it('uses default maxUses of 1 when automation.uses is undefined', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(1);

            const result = await handle(
                makeAction({ automation: { type: 'illusory_self', trigger: 'attack_hit' } }),
                makePlayerStats(),
                campaignName,
                'test-map',
            );

            expect(result.payload.description).toBe(
                'Illusory Self has no uses remaining. Recharges on a Short or Long Rest.',
            );
        });
    });

    describe('uses remaining', () => {
        it('returns info popup with no side effects when no uses remaining and no spell slot restore configured', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(1);
            const action = makeAction({ automation: { type: 'illusory_self', trigger: 'attack_hit', uses: 1, recharge: 'short_or_long_rest' } });

            const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Illusory Self',
                    description: 'Illusory Self has no uses remaining. Recharges on a Short or Long Rest.',
                    automation: action.automation,
                },
            });
            expect(damageRollback.rollbackDamage).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    describe('spell slot restore', () => {
        it('spends the lowest available spell slot (level 2+) to restore a use', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_2: 4 });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                1,
                playerName,
                'spell_slots_level_2',
                3,
                campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                2,
                playerName,
                'illusorySelfUses',
                0,
                campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenNthCalledWith(
                3,
                playerName,
                'illusorySelfUses',
                1,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: playerName,
                    abilityName: 'Illusory Self',
                    description: 'TestWizard expended a level 2 spell slot to restore a use of Illusory Self.',
                }),
            );
            expect(result.payload.description).toContain('automatically misses');
        });

        it('falls back to playerStats spellAbilities maxima when the runtime store has no slot values', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(1); // runtime store empty for spell slot keys

            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            // max from playerStats.spellAbilities (level 2: 4) is consumed down to 3
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'spell_slots_level_2',
                3,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    description: 'TestWizard expended a level 2 spell slot to restore a use of Illusory Self.',
                }),
            );
        });

        it('picks level 3 slot when level 2 is exhausted', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_2: 0, spell_slots_level_3: 3 });

            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'spell_slots_level_3',
                2,
                campaignName,
            );
            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    description: 'TestWizard expended a level 3 spell slot to restore a use of Illusory Self.',
                }),
            );
        });

        it('respects custom spellSlotRestore.minLevel', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_3: 2, spell_slots_level_4: 1 });

            await handle(
                makeAction({ automation: { type: 'illusory_self', trigger: 'attack_hit', uses: 1, recharge: 'short_or_long_rest', spellSlotRestore: { minLevel: 3 } } }),
                makePlayerStats(),
                campaignName,
                'test-map',
            );

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'spell_slots_level_3',
                1,
                campaignName,
            );
        });

        it('returns info popup when no uses and no spell slots available', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1);
            const action = makeAction();

            const result = await handle(action, makePlayerStats(), campaignName, 'test-map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Illusory Self',
                    description: 'Illusory Self has no uses remaining. Recharges on a Short or Long Rest, or expend a level 2+ spell slot to restore a use. No spell slots available.',
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('returns no spell slots available when minLevel exceeds highest available slot', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_2: 4 });
            const action = makeAction({ automation: { type: 'illusory_self', trigger: 'attack_hit', uses: 1, recharge: 'short_or_long_rest', spellSlotRestore: { minLevel: 4 } } });

            // spellAbilities undefined exercises the optional-chain guard; runtime zeros decide anyway
            const result = await handle(action, makePlayerStats({ spellAbilities: undefined }), campaignName, 'test-map');

            // message interpolates the configured minLevel, and runtime zeros outrank playerStats maxima
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Illusory Self',
                    description: 'Illusory Self has no uses remaining. Recharges on a Short or Long Rest, or expend a level 4+ spell slot to restore a use. No spell slots available.',
                    automation: action.automation,
                },
            });
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    describe('damage rollback', () => {
        it('inserts Damage Negated segment and skips the ability-use log when damage is rolled back', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Dragon',
            });
            damageRollback.rollbackDamage.mockResolvedValue(12);
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toBe(
                'Attacker: <b>Dragon</b><br/><br/>You use your Reaction to interpose an illusory duplicate between yourself and the attacker.<br/><br/><b>Result:</b> The attack automatically misses.<br/><br/><b>Damage Negated:</b> 12 HP restored.<br/><br/><em>The illusion dissipates. Uses remaining: 0 / 1 (Short or Long Rest).</em>',
            );
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('uses "Unknown creature" when attacker name is falsy', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: null,
            });
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(damageRollback.rollbackDamage).toHaveBeenCalledWith(
                'Unknown creature',
                playerName,
                campaignName,
                'Illusory Self',
            );
            expect(result.payload.description).toContain('Attacker: <b>Unknown creature</b>');
        });

        it('shows correct remaining uses with maxUses greater than 1', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(1);

            const result = await handle(
                makeAction({ automation: { type: 'illusory_self', trigger: 'attack_hit', uses: 3, recharge: 'short_or_long_rest', spellSlotRestore: { minLevel: 2 } } }),
                makePlayerStats(),
                campaignName,
                'test-map',
            );

            expect(result.payload.description).toContain(
                '<em>The illusion dissipates. Uses remaining: 1 / 3 (Short or Long Rest).</em>',
            );
        });
    });

    describe('error handling', () => {
        it('handles addEntry rejection in spell slot restore path', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_2: 4 });
            addEntry.mockRejectedValueOnce(new Error('DB error'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('automatically misses');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'spell_slots_level_2',
                3,
                campaignName,
            );
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'illusorySelfUses',
                0,
                campaignName,
            );
        });

        it('handles addEntry rejection in normal path (no damage)', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(0);
            mockCurrentUses(0);
            addEntry.mockRejectedValueOnce(new Error('DB error'));

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('automatically misses');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'illusorySelfUses',
                1,
                campaignName,
            );
        });
    });
});
