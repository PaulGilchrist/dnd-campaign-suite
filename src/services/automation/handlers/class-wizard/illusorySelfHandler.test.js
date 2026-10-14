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
        it('returns info popup when no recent attack roll exists', async () => {
            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.name).toBe('Illusory Self');
            expect(result.payload.description).toContain('No recent attack roll');
            expect(result.payload.description).toContain('Reaction');
        });

        it('returns info popup when the attack already missed', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent({ hit: false }),
                attackerName: 'Goblin',
            });

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already missed');
            expect(result.payload.description).toContain('no effect');
        });
    });

    describe('uses remaining', () => {
        it('triggers normally when uses are available', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('automatically misses');
            expect(result.payload.description).toContain('Goblin');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'illusorySelfUses',
                1,
                campaignName,
            );
        });

        it('returns info popup when no uses remaining and no spell slot restore configured', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(1);

            const result = await handle(
                makeAction({ automation: { type: 'illusory_self', trigger: 'attack_hit', uses: 1, recharge: 'short_or_long_rest' } }),
                makePlayerStats(),
                campaignName,
                'test-map',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
            expect(result.payload.description).toContain('Short or Long Rest');
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

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('no uses remaining');
        });
    });

    describe('spell slot restore', () => {
        it('spends the lowest available spell slot (level 2+) to restore a use', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_2: 4 });

            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

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
                    abilityName: 'Illusory Self',
                    description: expect.stringContaining('expended a level 2 spell slot'),
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
                    description: expect.stringContaining('level 3'),
                }),
            );
        });

        it('returns info popup when no uses and no spell slots available', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No spell slots available');
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

        it('returns no spell slots available when minLevel exceeds highest available slot', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_2: 4 });

            const result = await handle(
                makeAction({ automation: { type: 'illusory_self', trigger: 'attack_hit', uses: 1, recharge: 'short_or_long_rest', spellSlotRestore: { minLevel: 4 } } }),
                makePlayerStats(),
                campaignName,
                'test-map',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No spell slots available');
        });

        it('handles player with no spellAbilities property', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1);

            const result = await handle(
                makeAction(),
                { name: playerName, level: 10, spellAbilities: undefined },
                campaignName,
                'test-map',
            );

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No spell slots available');
        });
    });

    describe('damage rollback', () => {
        it('reports healed amount in description when damage is rolled back', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Dragon',
            });
            damageRollback.rollbackDamage.mockResolvedValue(12);
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toContain('Damage Negated');
            expect(result.payload.description).toContain('12 HP restored');
        });

        it('does not report healed amount when rollback returns 0', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(0);
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).not.toContain('Damage Negated');
            expect(result.payload.description).not.toContain('HP restored');
        });

        it('calls addEntry even when no damage is rolled back', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            damageRollback.rollbackDamage.mockResolvedValue(0);
            mockCurrentUses(0);

            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(addEntry).toHaveBeenCalledWith(
                campaignName,
                expect.objectContaining({
                    type: 'ability_use',
                    abilityName: 'Illusory Self',
                    description: expect.stringContaining("Goblin's attack misses"),
                }),
            );
        });
    });

    describe('description formatting', () => {
        it('shows the correct attacker name from combatSummary', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Dragon',
            });
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toContain('Dragon');
            expect(result.payload.description).not.toContain('Attacker: <b>TestWizard</b>');
        });

        it('uses "Unknown creature" when attacker name is falsy', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: null,
            });
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toContain('Unknown creature');
        });

        it('shows correct remaining uses in description after increment', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toContain('0 / 1');
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

            expect(result.payload.description).toContain('1 / 3');
        });
    });

    describe('error handling', () => {
        it('handles addEntry rejection in spell slot restore path', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockCurrentUsesAndSlots(1, { spell_slots_level_2: 4 });
            addEntry.mockRejectedValue(new Error('DB error'));

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
            addEntry.mockRejectedValue(new Error('DB error'));

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
