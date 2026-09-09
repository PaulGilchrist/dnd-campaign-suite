// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handle } from './superiorHunterDefenseHandler.js';
import * as damageRollback from '../../common/damageRollback.js';

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../common/damageRollback.js', () => ({
    findLastAttack: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../../rules/combat/applyHealing.js', () => ({
    applyHealingToTarget: vi.fn(() => Promise.resolve({ actualHeal: 0, oldHp: 0, newHp: 0 })),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

const { getRuntimeValue, setRuntimeValue } = await import('../../../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../../ui/logService.js');
const { applyHealingToTarget } = await import('../../../rules/combat/applyHealing.js');
const { addExpiration } = await import('../../../rules/effects/expirations.js');

function makePlayerStats(overrides = {}) {
    return {
        name: 'Test Ranger',
        level: 15,
        ...overrides,
    };
}

function makeAction(overrides = {}) {
    return {
        name: "Superior Hunter's Defense",
        automation: {
            type: 'superior_hunter_defense',
            casting_time: '1 reaction',
            ...overrides.automation,
        },
        ...overrides,
    };
}

describe('superiorHunterDefenseHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it('returns error popup when no last attack exists', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: null,
                attackerName: null,
                targetName: null,
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Defense");
            expect(result.payload.description).toContain('No recent attack found');
            expect(result.payload.description).toContain('can only be used after taking damage');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('returns error when last attack did not target the player', async () => {
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', damageApplied: true, primaryDamage: 10 },
                attackerName: 'Goblin',
                targetName: 'Other Player',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe("Superior Hunter's Defense");
            expect(result.payload.description).toContain('did not target you');
            expect(result.payload.description).toContain('can only be used shortly after taking damage');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('applies resistance buff and returns success popup for targeted attack', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', damageApplied: true, primaryDamage: 15, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 15,
                secondaryDamage: 0,
                totalDamage: 15,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Resistance to fire damage');
            expect(result.payload.description).toContain('15 fire');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({
                        name: "Superior Hunter's Defense",
                        effect: 'damage_resistance',
                        duration: 'until_end_of_current_turn',
                        resistanceTypes: ['fire'],
                    }),
                ]),
                'test-campaign'
            );

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'Test Ranger',
                abilityName: "Superior Hunter's Defense",
            }));
        });

        it('manages existing buffs correctly when adding the resistance buff', async () => {
            // Preserve existing buffs and replace existing Superior Hunter Defense
            const existingBuffs = [
                { name: 'Shield', effect: 'ac_bonus', resistanceTypes: [] },
                { name: "Superior Hunter's Defense", effect: 'damage_resistance', resistanceTypes: ['cold'] },
            ];
            getRuntimeValue.mockReturnValue(existingBuffs);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'acid', primaryDamage: 8, targetName: 'Test Ranger' },
                attackerName: 'Ooze',
                targetName: 'Test Ranger',
                primaryDamage: 8,
                secondaryDamage: 0,
                totalDamage: 8,
                damageTypes: ['acid'],
            });

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            const buffsArg = setRuntimeValue.mock.calls.find(c => c[1] === 'activeBuffs')[2];

            // Shield preserved
            expect(buffsArg).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: 'Shield' }),
            ]));

            // Only one Superior Hunter Defense buff (replaced, not duplicated)
            const shdBuffs = buffsArg.filter(b => b.name === "Superior Hunter's Defense");
            expect(shdBuffs).toHaveLength(1);
            expect(shdBuffs[0].resistanceTypes).toEqual(['acid']);
        });

        it('defaults to untyped when attackEvent has no damageType', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { primaryDamage: 5, targetName: 'Test Ranger' },
                attackerName: 'Skeleton',
                targetName: 'Test Ranger',
                primaryDamage: 5,
                secondaryDamage: 0,
                totalDamage: 5,
                damageTypes: [],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('untyped');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ resistanceTypes: ['untyped'] }),
                ]),
                'test-campaign'
            );
        });

        it('uses totalDamage in the popup description', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'lightning', primaryDamage: 10, targetName: 'Test Ranger' },
                attackerName: 'Storm Giant',
                targetName: 'Test Ranger',
                primaryDamage: 10,
                secondaryDamage: 5,
                totalDamage: 15,
                damageTypes: ['lightning'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('15 lightning');
        });

        it('grants resistance to secondary damage type when secondary damage exceeds primary', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'Slashing', primaryDamageType: 'Slashing', secondaryDamageType: 'Necrotic', primaryDamage: 11, secondaryDamage: 17, targetName: 'Test Ranger' },
                attackerName: 'Death Knight',
                targetName: 'Test Ranger',
                primaryDamage: 11,
                secondaryDamage: 17,
                totalDamage: 28,
                damageTypes: ['Slashing'],
                primaryDamageType: 'Slashing',
                secondaryDamageType: 'Necrotic',
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Resistance to Necrotic damage');
            expect(result.payload.description).toContain('17 Necrotic');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ resistanceTypes: ['necrotic'] }),
                ]),
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('Resistance to Necrotic'),
            }));
        });

        it('grants resistance to primary damage type when primary exceeds secondary', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'Slashing', primaryDamageType: 'Slashing', secondaryDamageType: 'Necrotic', primaryDamage: 17, secondaryDamage: 11, targetName: 'Test Ranger' },
                attackerName: 'Death Knight',
                targetName: 'Test Ranger',
                primaryDamage: 17,
                secondaryDamage: 11,
                totalDamage: 28,
                damageTypes: ['Slashing'],
                primaryDamageType: 'Slashing',
                secondaryDamageType: 'Necrotic',
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Resistance to Slashing damage');
            expect(result.payload.description).toContain('17 Slashing');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ resistanceTypes: ['slashing'] }),
                ]),
                'test-campaign'
            );
        });

        it('grants resistance to secondary damage type when primary and secondary are equal', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'Fire', primaryDamageType: 'Fire', secondaryDamageType: 'Cold', primaryDamage: 10, secondaryDamage: 10, targetName: 'Test Ranger' },
                attackerName: 'Dragon',
                targetName: 'Test Ranger',
                primaryDamage: 10,
                secondaryDamage: 10,
                totalDamage: 20,
                damageTypes: ['Fire'],
                primaryDamageType: 'Fire',
                secondaryDamageType: 'Cold',
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Resistance to Cold damage');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ resistanceTypes: ['cold'] }),
                ]),
                'test-campaign'
            );
        });

        it('handles null stored activeBuffs by treating as empty array', async () => {
            getRuntimeValue.mockReturnValue(null);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 7, targetName: 'Test Ranger' },
                attackerName: 'Fire Elemental',
                targetName: 'Test Ranger',
                primaryDamage: 7,
                secondaryDamage: 0,
                totalDamage: 7,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ resistanceTypes: ['fire'] }),
                ]),
                'test-campaign'
            );
        });

        it('heals the target for half the resisted damage amount', async () => {
            getRuntimeValue.mockReturnValue([]);
            applyHealingToTarget.mockResolvedValue({ actualHeal: 7, oldHp: 150, newHp: 157 });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'Slashing', primaryDamageType: 'Slashing', secondaryDamageType: null, primaryDamage: 15, secondaryDamage: 0, targetName: 'Test Ranger' },
                attackerName: 'Orc',
                targetName: 'Test Ranger',
                primaryDamage: 15,
                secondaryDamage: 0,
                totalDamage: 15,
                damageTypes: ['Slashing'],
                primaryDamageType: 'Slashing',
                secondaryDamageType: null,
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(applyHealingToTarget).toHaveBeenCalledWith(
                expect.anything(),
                'Test Ranger',
                7,
                'test-campaign'
            );
            expect(result.payload.description).toContain('Retroactively healed for 7 HP');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                description: expect.stringContaining('Retroactively healed for 7 HP'),
            }));
        });

        it('handles addEntry rejection for heal logging without breaking', async () => {
            getRuntimeValue.mockReturnValue([]);
            applyHealingToTarget.mockResolvedValue({ actualHeal: 5, oldHp: 10, newHp: 15 });
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 10, targetName: 'Test Ranger' },
                attackerName: 'Fire Elemental',
                targetName: 'Test Ranger',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Resistance to fire damage');
            expect(result.payload.description).toContain('Retroactively healed for 5 HP');
        });

        it('handles addEntry rejection for ability_use logging without breaking', async () => {
            getRuntimeValue.mockReturnValue([]);
            applyHealingToTarget.mockResolvedValue({ actualHeal: 0, oldHp: 10, newHp: 10 });
            addEntry.mockImplementation(() => Promise.reject(new Error('log error')));
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'cold', primaryDamage: 8, targetName: 'Test Ranger' },
                attackerName: 'Frost Giant',
                targetName: 'Test Ranger',
                primaryDamage: 8,
                secondaryDamage: 0,
                totalDamage: 8,
                damageTypes: ['cold'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Resistance to cold damage');
        });

        it('uses custom action name when provided', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 5, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 5,
                secondaryDamage: 0,
                totalDamage: 5,
                damageTypes: ['fire'],
            });

            const customAction = makeAction({ name: 'Custom Feature Name' });
            const result = await handle(customAction, makePlayerStats(), 'test-campaign');

            expect(result.payload.name).toBe('Custom Feature Name');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                'activeBuffs',
                expect.arrayContaining([
                    expect.objectContaining({ name: 'Custom Feature Name' }),
                ]),
                'test-campaign'
            );
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                abilityName: 'Custom Feature Name',
            }));
        });

        it('handles when combat context is null', async () => {
            getRuntimeValue.mockReturnValue([]);
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue(null);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 12, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 12,
                secondaryDamage: 0,
                totalDamage: 12,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Resistance to fire damage');
            expect(result.payload.description).not.toContain('healed');
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
            }));
        });

        it('handles healResult with no actualHeal property', async () => {
            getRuntimeValue.mockReturnValue([]);
            applyHealingToTarget.mockResolvedValue({ oldHp: 10, newHp: 10 });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 10, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 10,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).not.toContain('healed');
            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'hp_change',
            }));
        });

        it('handles attack with no totalDamage falling back to 0', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 10, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 10,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('0 fire');
        });

        it('uses playerStats computedStats as fallback for HP values', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return undefined;
            });
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({});
            applyHealingToTarget.mockResolvedValue({ actualHeal: 3, oldHp: 10, newHp: 13 });
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', primaryDamage: 6, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 6,
                secondaryDamage: 0,
                totalDamage: 6,
                damageTypes: ['fire'],
            });

            const playerStats = makePlayerStats({
                computedStats: { currentHp: 10, maxHp: 20 },
            });

            await handle(makeAction(), playerStats, 'test-campaign');

            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                currentHp: 10,
                maxHp: 20,
            }));
        });

        it('refuses when primaryDamage is 0 (no damage dealt — CLA-371 hit gate)', async () => {
            getRuntimeValue.mockReturnValue([]);
            damageRollback.findLastAttack.mockResolvedValue({
                attackEvent: { damageType: 'fire', hit: true, primaryDamage: 0, targetName: 'Test Ranger' },
                attackerName: 'Goblin',
                targetName: 'Test Ranger',
                primaryDamage: 0,
                secondaryDamage: 0,
                totalDamage: 0,
                damageTypes: ['fire'],
            });

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('dealt you no damage');
            expect(result.payload.description).toContain('Reaction is not spent');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'superior_hunters_defense_refused',
            }));
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'ability_use',
            }));
        });
    });

    describe('CLA-371 hit gate + latch serialization', () => {
        const uncannyAction = () => ({
            name: 'Uncanny Dodge',
            automation: { type: 'superior_hunter_defense', casting_time: '1 reaction' },
        });

        const missAttack = () => ({
            attackEvent: { damageType: 'piercing', primaryDamageType: 'Piercing', hit: false, damageApplied: false, targetName: 'Test Ranger' },
            attackerName: 'Thug 1',
            targetName: 'Test Ranger',
            primaryDamage: 0,
            secondaryDamage: 0,
            totalDamage: 0,
            damageTypes: ['Piercing'],
            primaryDamageType: 'Piercing',
            secondaryDamageType: null,
        });

        const hitAttack = (primaryDamage) => ({
            attackEvent: { damageType: 'Bludgeoning', primaryDamageType: 'Bludgeoning', hit: true, damageApplied: true, targetName: 'Test Ranger' },
            attackerName: 'Thug 1',
            targetName: 'Test Ranger',
            primaryDamage,
            secondaryDamage: 0,
            totalDamage: primaryDamage,
            damageTypes: ['Bludgeoning'],
            primaryDamageType: 'Bludgeoning',
            secondaryDamageType: null,
        });

        // Simulates the live runtime store so a second same-turn click reads
        // the latch value the first click stamped (the write→read race of CLA-371).
        async function armedRuntime(round) {
            const store = { _Superior_Hunters_Defense_usedRound: null, activeBuffs: [] };
            getRuntimeValue.mockImplementation((name, key) => store[key] ?? null);
            setRuntimeValue.mockImplementation((name, key, value) => { store[key] = value; });
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ round, creatures: [{ name: 'Thug 1' }, { name: 'Test Ranger' }], activeCreatureName: 'Thug 1' });
            return store;
        }

        it('refuses a MISS click: refused log only, no ability_use, no buff, no heal, no latch stamp', async () => {
            const store = await armedRuntime(1);
            damageRollback.findLastAttack.mockResolvedValue(missAttack());

            const result = await handle(uncannyAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('triggers only when an attack hits you');
            expect(result.payload.description).toContain('the last attack missed you');
            expect(result.payload.description).toContain('Reaction is not spent');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'uncanny_dodge_refused',
                characterName: 'Test Ranger',
            }));
            expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ type: 'ability_use' }));
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(store._Superior_Hunters_Defense_usedRound).toBeNull();
        });

        it('on a HIT: halves exactly once and stamps the latch BEFORE any spend', async () => {
            await armedRuntime(1);
            applyHealingToTarget.mockResolvedValue({ actualHeal: 3, oldHp: 97, newHp: 100 });
            damageRollback.findLastAttack.mockResolvedValue(hitAttack(7));

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(applyHealingToTarget).toHaveBeenCalledWith(expect.anything(), 'Test Ranger', 3, 'test-campaign');
            expect(result.payload.description).toContain('Retroactively healed for 3 HP');

            const abilityUseLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'ability_use');
            expect(abilityUseLogs).toHaveLength(1);

            const latchOrder = setRuntimeValue.mock.invocationCallOrder;
            const latchIdx = setRuntimeValue.mock.calls.findIndex(c => c[1] === '_Superior_Hunters_Defense_usedRound');
            const buffIdx = setRuntimeValue.mock.calls.findIndex(c => c[1] === 'activeBuffs');
            expect(latchIdx).toBeGreaterThanOrEqual(0);
            expect(latchIdx).toBeLessThan(buffIdx);
            expect(latchOrder[latchIdx]).toBeLessThan(applyHealingToTarget.mock.invocationCallOrder[0]);
        });

        it('second same-turn click after a HIT spend is refused (no double-spend)', async () => {
            const store = await armedRuntime(1);
            applyHealingToTarget.mockResolvedValue({ actualHeal: 3, oldHp: 97, newHp: 100 });
            damageRollback.findLastAttack.mockResolvedValue(hitAttack(7));

            await handle(uncannyAction(), makePlayerStats(), 'test-campaign');
            const second = await handle(uncannyAction(), makePlayerStats(), 'test-campaign');

            expect(store._Superior_Hunters_Defense_usedRound).toBe(1);
            expect(second.payload.description).toContain('already used Uncanny Dodge this round');
            // first click: hp_change + ability_use; second click: refusal only
            expect(addEntry).toHaveBeenCalledTimes(3);
            expect(addEntry.mock.calls.filter(c => c[1]?.automationType === 'uncanny_dodge_refused')).toHaveLength(0);
            expect(addEntry.mock.calls.filter(c => c[1]?.automationType === 'superior_hunters_defense_refused')).toHaveLength(1);
            const abilityUseLogs = addEntry.mock.calls.filter(c => c[1]?.type === 'ability_use');
            expect(abilityUseLogs).toHaveLength(1);
            expect(applyHealingToTarget).toHaveBeenCalledTimes(1);
            expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs')).toHaveLength(1);
        });

        it('re-arms next round: hit + cleared latch spends again', async () => {
            const store = await armedRuntime(3);
            store._Superior_Hunters_Defense_usedRound = 2;
            applyHealingToTarget.mockResolvedValue({ actualHeal: 3, oldHp: 97, newHp: 100 });
            damageRollback.findLastAttack.mockResolvedValue(hitAttack(7));

            const result = await handle(uncannyAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Resistance to Bludgeoning damage');
            expect(store._Superior_Hunters_Defense_usedRound).toBe(3);
        });
    });

    describe('CLA-345 reaction latch + buff expiration', () => {
        const bludgeoningHit = () => ({
            attackEvent: { damageType: 'Bludgeoning', primaryDamageType: 'Bludgeoning', targetName: 'Test Ranger' },
            attackerName: 'Thug 1',
            targetName: 'Test Ranger',
            primaryDamage: 6,
            secondaryDamage: 0,
            totalDamage: 6,
            damageTypes: ['Bludgeoning'],
            primaryDamageType: 'Bludgeoning',
            secondaryDamageType: null,
        });

        it('stamps _Superior_Hunters_Defense_usedRound with the round from a fresh combat context', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return undefined;
            });
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ round: 3, creatures: [{ name: 'Thug 1' }, { name: 'Test Ranger' }], activeCreatureName: 'Thug 1' });
            damageRollback.findLastAttack.mockResolvedValue(bludgeoningHit());

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                '_Superior_Hunters_Defense_usedRound',
                3,
                'test-campaign'
            );
        });

        it('refuses a same-round re-click, logs superior_hunters_defense_refused, and spends nothing', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Superior_Hunters_Defense_usedRound') return 3;
                if (key === 'activeBuffs') return [];
                return undefined;
            });
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ round: 3, creatures: [{ name: 'Thug 1' }, { name: 'Test Ranger' }], activeCreatureName: 'Thug 1' });
            damageRollback.findLastAttack.mockResolvedValue(bludgeoningHit());

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('already used');
            expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'automation',
                automationType: 'superior_hunters_defense_refused',
                characterName: 'Test Ranger',
            }));
            expect(applyHealingToTarget).not.toHaveBeenCalled();
            expect(addExpiration).not.toHaveBeenCalled();
            const buffWrites = setRuntimeValue.mock.calls.filter(c => c[1] === 'activeBuffs');
            expect(buffWrites).toHaveLength(0);
            const latchWrites = setRuntimeValue.mock.calls.filter(c => c[1] === '_Superior_Hunters_Defense_usedRound');
            expect(latchWrites).toHaveLength(0);
        });

        it('re-arms on the next round (latch round < current round succeeds)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === '_Superior_Hunters_Defense_usedRound') return 2;
                if (key === 'activeBuffs') return [];
                return undefined;
            });
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({ round: 3, creatures: [{ name: 'Thug 1' }, { name: 'Test Ranger' }], activeCreatureName: 'Thug 1' });
            damageRollback.findLastAttack.mockResolvedValue(bludgeoningHit());

            const result = await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(result.payload.description).toContain('Resistance to Bludgeoning damage');
            expect(setRuntimeValue).toHaveBeenCalledWith(
                'Test Ranger',
                '_Superior_Hunters_Defense_usedRound',
                3,
                'test-campaign'
            );
        });

        it('registers a 1-round-clock remove_active_buff expiration so the resistance drains at the next round', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'activeBuffs') return [];
                return undefined;
            });
            const { getCombatContext } = await import('../../../rules/combat/damageUtils.js');
            getCombatContext.mockResolvedValue({
                round: 2,
                activeCreatureName: 'Thug 1',
                creatures: [{ name: 'Thug 1' }, { name: 'Thug 2' }, { name: 'Test Ranger' }],
            });
            damageRollback.findLastAttack.mockResolvedValue(bludgeoningHit());

            await handle(makeAction(), makePlayerStats(), 'test-campaign');

            expect(addExpiration).toHaveBeenCalledWith(
                'Test Ranger',
                'Test Ranger',
                [{ type: 'remove_active_buff', buffName: "Superior Hunter's Defense" }],
                'test-campaign',
                1
            );
        });
    });
});
