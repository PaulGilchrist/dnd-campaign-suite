// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle, applyRiderOption } from './attackRiderHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
    buildSaveDc: vi.fn(() => 14),
    createSaveListener: vi.fn(() => ({
        promptId: 'test-prompt',
        promise: Promise.resolve({ success: false, roll: 5, total: 5 }),
    })),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(async () => ({
        creatures: [{ name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } }],
        round: 1,
        activeCreatureName: 'TestHero',
    })),
    getTargetFromAttacker: vi.fn(() => ({ name: 'Goblin' })),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(async () => {}),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../common/oncePerTurn.js', () => ({
    checkOncePerTurn: vi.fn().mockResolvedValue(null),
    checkOncePerTurnWithSkip: vi.fn().mockResolvedValue(null),
    markOncePerTurn: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
    addExpiration: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { checkOncePerTurn } from '../../common/oncePerTurn.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addExpiration } from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    return {
        name: 'Cunning Strike',
        description: 'Apply a rider effect on a hit.',
        automation: {
            type: 'attack_rider',
            options: [
                { name: 'Trip', effect: 'prone' },
                { name: 'Poison', effect: 'poisoned', requires: "Poisoner's Kit" },
                { name: 'Daze', effect: 'daze' },
                { name: 'Push 15ft', effect: 'push_15ft', value: 15 },
                { name: 'Disadvantage on Save', effect: 'disadvantage_on_next_save' },
                { name: 'No Opportunity Attacks', effect: 'no_opportunity_attacks', movement: true },
                { name: 'Withdraw', effect: 'no_opportunity_attacks', movement: 'half_speed', noOAs: true },
                { name: 'Sudden Strike', effect: 'sudden_strike' },
                { name: 'Mass Fear', effect: 'mass_fear', saveType: 'WIS', saveAbility: 'WIS' },
                { name: 'Damage Bonus', effect: 'damage_bonus', damageExpression: '2d6' },
                { name: 'Cleave', effect: 'cleave', oncePerTurn: true },
            ],
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        abilities: [
            { name: 'Dexterity', bonus: 2 },
            { name: 'Constitution', bonus: 1 },
            { name: 'Wisdom', bonus: 3 },
        ],
        toolProficiencies: [],
        automation: { passives: [] },
        ...overrides,
    };
}

function mockTargetEffects() {
    getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'targetEffects') return [];
        return null;
    });
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle', () => {
        it.each([
            { chooseOne: true, maxEffects: 1, desc: 'chooseOne' },
            { chooseOne: false, maxEffects: 3, desc: 'maxEffects > 1' },
        ])('should return modal when %s is set', async ({ chooseOne, maxEffects }) => {
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    chooseOne,
                    maxEffects,
                    options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('attackRider');
        });

        it('should apply immediately when single option and no modal triggers', async () => {
            mockTargetEffects();
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
            expect(result.payload.description).toContain('Goblin');
        });

        it('should return ready info when multiple options without chooseOne/maxEffects', async () => {
            const action = makeAction({
                automation: { type: 'attack_rider', options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }] },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('ready');
            expect(result.payload.automationType).toBe('attack_rider');
        });

        it('should return skip result when oncePerTurn check returns skip', async () => {
            vi.mocked(checkOncePerTurn).mockResolvedValue({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Cunning Strike',
                    description: 'Cunning Strike can only be used once per turn.',
                },
            });
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('once per turn');
        });
    });

    describe('applyRiderOption', () => {
        it('should apply Trip effect', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
            expect(result.payload.description).toContain('Goblin');
        });

        it('should reject Poison without Poisoner\'s Kit', async () => {
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison']);

            expect(result.payload.description).toContain("Poisoner's Kit");
            expect(result.payload.description).toContain('cannot be used');
        });

        it('should apply Sudden Strike effect', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Sudden Strike']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Sudden Strike enabled');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'pendingSuddenStrike', true, 'campaign');
        });

        it('should apply Mass Fear effect and resolve saves', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Mass Fear']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Mass Fear');
            expect(result.payload.description).toContain('affected');
        });

        it('should return info popup when no target (not null)', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', null, ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
        });

        it('should handle multiple options with combined description', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip', 'Daze']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Trip');
            expect(result.payload.description).toContain('Daze');
        });

        it('should apply Versatile Trickster and Stalker\'s Flurry secondary targets when Trip and Sudden Strike applied with passives', async () => {
            mockTargetEffects();
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } },
                    { name: 'Skeleton', size: 'Medium', position: { x: 2, y: 1 } },
                ],
            });
            const stats = makePlayerStats({
                automation: {
                    passives: [{ type: 'passive_rule', effect: 'versatile_trickster' }],
                },
            });
            const action = makeAction();
            await applyRiderOption(action, stats, 'campaign', 'Goblin', ['Trip', 'Sudden Strike']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', expect.any(Array), 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterPrimaryTarget', 'Goblin', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurrySecondaryTargets', expect.any(Array), 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurryPrimaryTarget', 'Goblin', 'campaign');
        });

        it('should not set Versatile Trickster or Stalker\'s Flurry targets when no passives or no nearby creatures', async () => {
            mockTargetEffects();
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } },
                    { name: 'Dragon', size: 'Large', position: { x: 30, y: 30 } },
                ],
            });
            vi.mocked(isWithinRange).mockResolvedValue(false);
            const action = makeAction();
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Trip', 'Sudden Strike']);

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', expect.any(Array), 'campaign');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stalkersFlurrySecondaryTargets', expect.any(Array), 'campaign');
        });

        it('should apply Cleave effect with oncePerTurn', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Cleave']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Cleave');
        });

        it('CLA-376: clears stale Versatile Trickster keys at apply entry', async () => {
            mockTargetEffects();
            const action = makeAction();
            await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Withdraw']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterPrimaryTarget', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterAction', null, 'campaign');
        });

        it('CLA-376: Trip with VT passive re-writes secondary keys after entry clear', async () => {
            mockTargetEffects();
            vi.mocked(isWithinRange).mockResolvedValue(true);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'Goblin', size: 'Medium' },
                    { name: 'Skeleton', size: 'Medium' },
                ],
            });
            const stats = makePlayerStats({
                automation: { passives: [{ type: 'passive_rule', effect: 'versatile_trickster' }] },
            });
            const action = makeAction();
            await applyRiderOption(action, stats, 'campaign', 'Goblin', ['Trip']);

            const vtCalls = setRuntimeValue.mock.calls.filter(c => c[1] === 'versatileTricksterSecondaryTargets');
            expect(vtCalls[0][2]).toBeNull();
            expect(vtCalls.at(-1)[2]).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Skeleton' })]));
        });

        it('should apply Envenom Weapons damage when CON poison save fails and passive exists', async () => {
            vi.mocked(rollExpression).mockReturnValue({ total: 8 });
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [{ name: 'Goblin' }],
            });
            getRuntimeValue.mockImplementation((_key, prop, _camp) => {
                if (prop === 'targetEffects') return [];
                return null;
            });

            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    options: [{ name: 'Poison', effect: 'poisoned', saveType: 'CON', requires: "Poisoner's Kit" }],
                },
            });
            const stats = makePlayerStats({
                toolProficiencies: ["Poisoner's Kit"],
                automation: {
                    passives: [
                        { type: 'damage_bonus', trigger: 'cunning_strike_poison_save_fail', name: 'Envenom Weapons', automation: { damageExpression: '2d6', damageType: 'Poison' } },
                    ],
                },
            });
            await applyRiderOption(action, stats, 'campaign', 'Goblin', ['Poison']);

            expect(rollExpression).toHaveBeenCalledWith('2d6');
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                abilityName: 'Envenom Weapons',
            }));
        });

    });

    describe('slashing_damage_hit trigger (Slasher feat)', () => {
        function hamstringAction() {
            return {
                name: 'Hamstring',
                automation: {
                    type: 'attack_rider',
                    trigger: 'slashing_damage_hit',
                    oncePerTurn: true,
                    options: [{ name: 'Hamstring', effect: 'speed_reduction', value: 10 }],
                },
            };
        }

        it('should apply effect when lastAttack is player slashing hit', async () => {
            vi.mocked(checkOncePerTurn).mockResolvedValue(null);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') {
                    return { hit: true, attackerName: 'TestHero', damageType: 'Slashing', targetName: 'Goblin' };
                }
                if (prop === 'targetEffects') return [];
                return null;
            });

            const result = await handle(hamstringAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('Hamstring');
            expect(result.payload.description).toContain("Speed reduced by 10 ft");

            // te written EXACT
            expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects',
                [expect.objectContaining({
                    target: 'Goblin',
                    source: 'TestHero',
                    option: 'Hamstring',
                    effect: 'speed_reduction',
                    value: 10,
                    duration: 'until_start_of_next_turn',
                })], 'campaign');

            // FT-082: expiration must be registered so the te expires at the
            // holder's next turn start (drained by expireStaleEffects phase 1).
            expect(addExpiration).toHaveBeenCalledWith(
                'TestHero',
                'Goblin',
                [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'TestHero', option: 'Hamstring', target: 'Goblin' }],
                'campaign',
                undefined,
                'TestHero'
            );
        });

        it('should NOT register expiration for save-based speed_reduction options', async () => {
            vi.mocked(checkOncePerTurn).mockResolvedValue(null);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') {
                    return { hit: true, attackerName: 'TestHero', damageType: 'Slashing', targetName: 'Goblin' };
                }
                if (prop === 'targetEffects') return [];
                return null;
            });

            const action = {
                name: 'Rider',
                automation: {
                    type: 'attack_rider',
                    trigger: 'slashing_damage_hit',
                    oncePerTurn: true,
                    options: [{ name: 'Chill', effect: 'speed_reduction', value: 10, saveType: 'CON' }],
                },
            };
            await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(addExpiration).not.toHaveBeenCalled();
        });

        it.each([
            [null, 'No attack hit recorded'],
            [{ hit: false }, 'Your last attack missed'],
            [{ hit: true, attackerName: 'Orc', damageType: 'Slashing', targetName: 'Goblin' }, 'your own attacks'],
            [{ hit: true, attackerName: 'TestHero', damageType: 'Piercing', targetName: 'Goblin' }, 'Slashing damage'],
        ])('should reject when lastAttack is %j — expects "%s"', async (lastAttack, expectedText) => {
            getRuntimeValue.mockReturnValue(lastAttack);

            const action = {
                name: 'Hamstring',
                automation: {
                    type: 'attack_rider',
                    trigger: 'slashing_damage_hit',
                    oncePerTurn: true,
                    options: [{ name: 'Hamstring', effect: 'speed_reduction', value: 10 }],
                },
            };
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(expectedText);
        });
    });
});
