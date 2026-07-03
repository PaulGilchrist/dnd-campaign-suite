// @cleaned-by-ai
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

function mockUses(remaining) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'illusorySelfUses') return remaining;
        return null;
    });
}

function mockUsesAndSlots(remaining, slotLevels = {}) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'illusorySelfUses') return remaining;
        if (slotLevels[key] !== undefined) return slotLevels[key];
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
            mockUses(0);

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
            mockUses(1);

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
    });

    describe('spell slot restore', () => {
        it('spends the lowest available spell slot (level 2+) to restore a use', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockUsesAndSlots(1, { spell_slots_level_2: 4 });

            await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                playerName,
                'spell_slots_level_2',
                3,
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
            mockUsesAndSlots(1, { spell_slots_level_2: 0, spell_slots_level_3: 3 });

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
            mockUsesAndSlots(1);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

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
            mockUses(0);

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
            mockUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).not.toContain('Damage Negated');
            expect(result.payload.description).not.toContain('HP restored');
        });
    });

    describe('description formatting', () => {
        it('shows the correct attacker name from combatSummary', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Dragon',
            });
            mockUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toContain('Dragon');
            expect(result.payload.description).not.toContain('Attacker: <b>TestWizard</b>');
        });

        it('uses "Unknown creature" when attacker name is missing', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: null,
            });
            mockUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toContain('Unknown creature');
        });
    });

    describe('uses counter', () => {
        it('shows correct remaining uses in description after increment', async () => {
            damageRollback.findAttackRollAgainstTarget.mockResolvedValue({
                attackEvent: makeAttackEvent(),
                attackerName: 'Goblin',
            });
            mockUses(0);

            const result = await handle(makeAction(), makePlayerStats(), campaignName, 'test-map');

            expect(result.payload.description).toContain('0 / 1');
        });
    });
});
