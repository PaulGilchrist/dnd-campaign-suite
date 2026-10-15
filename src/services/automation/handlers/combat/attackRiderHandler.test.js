// @maintained-by-ai
// attackRiderHandler core lane: handle() routing (choice modal / single-option
// auto-apply / ready-info / oncePerTurn skip / slashing_damage_hit validation),
// applyRiderOption single-option contract (optKey stash, pendingRiderChoice
// clear), effect-dispatch (sudden_strike stamp, mass_fear delegation-passthrough,
// no-target guard, multi-choice summary own-composition), VT/Stalker's/CLA-376
// secondary-target stamping, Envenom Weapons save-fail damage, and the Slasher
// Hamstring lane (attacker/damageType matches, exact te write, FT-082 expiration).
// Owned elsewhere: Shield Bash prerequisites by
// attackRiderHandler.shield-bash.test.js; Shield Bash save flow by
// attackRiderHandler.save-flow.test.js; the Charger/Trip size gate wiring by
// attackRiderHandler.charger-size-gate.test.js; the validator matrix (incl. the
// requires branch internals) by cunningStrikeUtils.test.js; mass-fear resolution
// internals by massFearHandler*.test.js. Deterministic, fully mocked, turn-based.
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

// Mass fear resolution internals are owned by massFearHandler*.test.js —
// this file only pins that the mass_fear option dispatches here and the
// result passes through untouched (no direct targetEffects write).
vi.mock('./massFearHandler.js', () => ({
    resolveMassFear: vi.fn(async () => ({
        type: 'popup',
        payload: { type: 'automation_info', description: 'Mass Fear resolved — 2 affected.' },
    })),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { checkOncePerTurn, markOncePerTurn } from '../../common/oncePerTurn.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { addExpiration } from '../../../rules/effects/expirations.js';
import { resolveMassFear } from './massFearHandler.js';

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
                { name: 'Withdraw', effect: 'no_opportunity_attacks', movement: 'half_speed', noOAs: true },
                { name: 'Sudden Strike', effect: 'sudden_strike' },
                { name: 'Mass Fear', effect: 'mass_fear', saveType: 'WIS', saveAbility: 'WIS' },
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

function teWrites() {
    return setRuntimeValue.mock.calls.filter(c => c[1] === 'targetEffects');
}

// ── Tests ──────────────────────────────────────────────────────

describe('attackRiderHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handle routing', () => {
        it.each([
            { chooseOne: true, maxEffects: 1, desc: 'chooseOne' },
            { chooseOne: false, maxEffects: 3, desc: 'maxEffects > 1' },
        ])('should return attackRider modal when %s is set', async ({ chooseOne, maxEffects }) => {
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    chooseOne,
                    maxEffects,
                    options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }],
                },
            });
            const stats = makePlayerStats();
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('modal');
            expect(result.modalName).toBe('attackRider');
            // Target is resolved from the attacker's combat context into the payload.
            expect(getTargetFromAttacker).toHaveBeenCalled();
            expect(result.payload).toMatchObject({ playerStats: stats, campaignName: 'campaign', targetName: 'Goblin' });
            // Routing decision only — nothing applied or latched.
            expect(teWrites()).toHaveLength(0);
            expect(markOncePerTurn).not.toHaveBeenCalled();
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
            expect(result.payload.description).toBe('Trip applied to Goblin — target must make a Dexterity save or gain the Prone condition');
            // No oncePerTurn on the automation → latch untouched.
            expect(markOncePerTurn).not.toHaveBeenCalled();
        });

        it('should return ready info when multiple options without chooseOne/maxEffects', async () => {
            const action = makeAction({
                automation: { type: 'attack_rider', options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }] },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Cunning Strike');
            expect(result.payload.automationType).toBe('attack_rider');
            expect(result.payload.description).toBe('Cunning Strike ready. The next eligible attack will apply it.');
        });

        it('should return skip result when oncePerTurn check returns skip', async () => {
            const skipStub = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Cunning Strike', description: 'Cunning Strike can only be used once per turn.' },
            };
            vi.mocked(checkOncePerTurn).mockResolvedValue(skipStub);
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result).toBe(skipStub);
            // Skip short-circuits before any effect write or latch burn.
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(markOncePerTurn).not.toHaveBeenCalled();
        });
    });

    describe('applyRiderOption', () => {
        it('single option: stashes the choice key, clears pendingRiderChoice, passes the effect result through', async () => {
            mockTargetEffects();
            const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Trip applied to Goblin — target must make a Dexterity save or gain the Prone condition');
            // Choice stashed for features that read it from runtime state.
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_Cunning_Strike_option', 'Trip', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'pendingRiderChoice', null, 'campaign');
        });

        it('should reject Poison without Poisoner\'s Kit — requires gate at handler seam', async () => {
            mockTargetEffects();
            const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Poison']);

            // Reason from validateCunningStrikeOption surfaces verbatim in the refusal.
            expect(result.payload.description).toBe("<b>Poison</b> cannot be used: Requires Poisoner's Kit which the character does not have.");
            // Refusal leaves nothing behind: no te write, no latch burn.
            expect(teWrites()).toHaveLength(0);
            expect(markOncePerTurn).not.toHaveBeenCalled();
        });

        it('should apply Sudden Strike effect', async () => {
            mockTargetEffects();
            const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Sudden Strike']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Sudden Strike enabled. Make a bonus action attack against a different creature within 5 ft of Goblin.');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'pendingSuddenStrike', true, 'campaign');
        });

        it('should dispatch mass_fear to resolveMassFear and pass its result through', async () => {
            mockTargetEffects();
            const option = makeAction().automation.options.find(o => o.name === 'Mass Fear');
            const stats = makePlayerStats();
            const result = await applyRiderOption(makeAction(), stats, 'campaign', 'Goblin', ['Mass Fear']);

            expect(resolveMassFear).toHaveBeenCalledWith({
                campaignName: 'campaign',
                casterName: 'TestHero',
                primaryTargetName: 'Goblin',
                option,
                playerStats: stats,
            });
            expect(result).toBe(await vi.mocked(resolveMassFear).mock.results[0].value);
            // mass_fear never takes the default targetEffects write lane.
            expect(teWrites()).toHaveLength(0);
        });

        it('should return info popup when no target (not null)', async () => {
            mockTargetEffects();
            const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', null, ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No target selected');
            expect(teWrites()).toHaveLength(0);
        });

        it('should summarize multiple options in one popup (own-composition)', async () => {
            mockTargetEffects();
            const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip', 'Daze']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Applied to Goblin:<br/>• Trip — target has Prone condition<br/>• Daze — target on next turn can only do one of: move, action, or Bonus Action');
        });

        it('should stamp VT and Stalker\'s Flurry secondary targets when Trip and Sudden Strike applied with passives', async () => {
            mockTargetEffects();
            vi.mocked(isWithinRange).mockResolvedValue(true);
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
            await applyRiderOption(makeAction(), stats, 'campaign', 'Goblin', ['Trip', 'Sudden Strike']);

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', expect.arrayContaining([expect.objectContaining({ name: 'Skeleton' })]), 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterPrimaryTarget', 'Goblin', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterAction', { type: 'versatile_trickster', automation: { type: 'versatile_trickster', casting_time: 'passive' } }, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurrySecondaryTargets', expect.arrayContaining([expect.objectContaining({ name: 'Skeleton' })]), 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurryPrimaryTarget', 'Goblin', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurryOptions', ['Trip', 'Sudden Strike'], 'campaign');
        });

        it('should not set VT or Stalker\'s Flurry keys when no passives or no nearby creatures', async () => {
            mockTargetEffects();
            vi.mocked(isWithinRange).mockResolvedValue(false);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } },
                    { name: 'Dragon', size: 'Large', position: { x: 30, y: 30 } },
                ],
            });
            await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip', 'Sudden Strike']);

            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', expect.any(Array), 'campaign');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stalkersFlurrySecondaryTargets', expect.any(Array), 'campaign');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stalkersFlurryPrimaryTarget', expect.anything(), 'campaign');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stalkersFlurryOptions', expect.anything(), 'campaign');
        });

        it('CLA-376: clears stale Versatile Trickster keys at apply entry', async () => {
            mockTargetEffects();
            await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Withdraw']);

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
            await applyRiderOption(makeAction(), stats, 'campaign', 'Goblin', ['Trip']);

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
            expect(applyDamageToTarget).toHaveBeenCalledWith(
                { creatures: [{ name: 'Goblin' }] },
                'Goblin',
                8,
                ['Poison'],
                { campaignName: 'campaign', characters: [], ignoreResistance: true, attackerName: 'TestHero' },
            );
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

        function mockSlashingHit() {
            vi.mocked(checkOncePerTurn).mockResolvedValue(null);
            getRuntimeValue.mockImplementation((key, prop) => {
                if (key === 'campaign' && prop === 'lastAttack') {
                    return { hit: true, attackerName: 'TestHero', damageType: 'Slashing', targetName: 'Goblin' };
                }
                if (prop === 'targetEffects') return [];
                return null;
            });
        }

        it('should apply effect when lastAttack is player slashing hit', async () => {
            mockSlashingHit();

            const result = await handle(hamstringAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe("Hamstring applied to Goblin — target's Speed reduced by 10 ft until the start of your next turn");

            // te written EXACT
            expect(teWrites()).toEqual([['campaign', 'targetEffects',
                [expect.objectContaining({
                    target: 'Goblin',
                    source: 'TestHero',
                    option: 'Hamstring',
                    effect: 'speed_reduction',
                    value: 10,
                    duration: 'until_start_of_next_turn',
                })], 'campaign']]);

            // Automated use logged to the campaign log (AGENTS: every automation logs).
            expect(addEntry).toHaveBeenCalledWith('campaign', expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Hamstring',
            }));

            // FT-082: expiration must be registered so the te expires at the
            // holder's next turn start (drained by expireStaleEffects phase 1).
            expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestHero', targetName: 'Goblin', effects: [{ type: 'remove_target_effect', effectKey: 'speed_reduction', source: 'TestHero', option: 'Hamstring', target: 'Goblin' }], campaignName: 'campaign', rounds: undefined, expireOnCreatureName: 'TestHero' });
        });

        it('should NOT register expiration for save-based speed_reduction options', async () => {
            mockSlashingHit();

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

            // Save-based te still written (save attached), but no auto-expire —
            // the repeating save owns its lifetime.
            expect(teWrites()[0][2]).toEqual([expect.objectContaining({ option: 'Chill', effect: 'speed_reduction', saveType: 'CON' })]);
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it.each([
            [null, 'No attack hit recorded'],
            [{ hit: false }, 'Your last attack missed'],
            [{ hit: true, attackerName: 'Orc', damageType: 'Slashing', targetName: 'Goblin' }, 'your own attacks'],
            [{ hit: true, attackerName: 'TestHero', damageType: 'Piercing', targetName: 'Goblin' }, 'Slashing damage'],
        ])('should reject when lastAttack is %j — expects "%s"', async (lastAttack, expectedText) => {
            getRuntimeValue.mockReturnValue(lastAttack);

            const result = await handle(hamstringAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain(expectedText);
        });
    });
});
