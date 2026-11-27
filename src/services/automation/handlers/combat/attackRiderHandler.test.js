// @maintained-by-ai 2026-11-26
// attackRiderHandler core lane: handle() routing (choice-modal full payload +
// logRiderUse row, single-option auto-apply with oncePerTurn latch burn via the
// Cunning-Strike alias usedKey, ready-info face, skip passthrough), slashing_-
// damage_hit validation branches, applyRiderOption ordered write census (CLA-376
// entry clears → pendingRiderChoice clear → option stash → te append), requires
// refusal at the handler seam, effect-dispatch (sudden_strike stamp, mass_fear
// delegation-passthrough, no-target notice, multi-choice summary own-composition
// + single-only stash rule), VT/Stalker's secondary stamping incl. DG holder
// exclusion, Envenom Weapons save-fail damage, and the Slasher Hamstring lane
// (exact no-save te row, ordered exact log census, FT-082 expiration vs
// save-based suppression, non-alias usedKey). Owned elsewhere: Shield Bash
// prerequisites by attackRiderHandler.shield-bash.test.js; Shield Bash save flow
// by attackRiderHandler.save-flow.test.js; Charger/Trip size-gate wiring by
// attackRiderHandler.charger-size-gate.test.js; the validator matrix (incl. the
// requires branch internals) by cunningStrikeUtils.test.js; save-leg row bytes +
// eviction by attackRiderHandler.save-success-eviction.test.js; save-outcome log
// copy by attackRiderHandler.log-honesty.test.js; save-gated expiry clocks by
// attackRiderHandler.daze-expiry.test.js; repeat-save descriptors by
// attackRiderHandler.repeat-save-descriptor.test.js; VT primarySave threading and
// empty-scan VT suppression by attackRiderHandler.vt-primary-save.test.js;
// mass-fear resolution internals by massFearHandler*.test.js. Deterministic,
// fully mocked, turn-based.
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
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
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
                { name: 'Withdraw', effect: 'no_opportunity_attacks', movement: 'half_speed', noOpportunityAttacks: true },
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

const VT_PASSIVE = {
    automation: { passives: [{ type: 'passive_rule', effect: 'versatile_trickster' }] },
};

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

            // Full modal payload contract, target resolved from the combat context.
            expect(result).toEqual({
                type: 'modal',
                modalName: 'attackRider',
                payload: { action, playerStats: stats, campaignName: 'campaign', targetName: 'Goblin' },
            });
            // Rider use is logged on every handle() routing (AGENTS: every automation logs).
            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Cunning Strike',
                description: 'Cunning Strike used against Goblin',
            });
            // Routing decision only — nothing applied or latched.
            expect(teWrites()).toHaveLength(0);
            expect(markOncePerTurn).not.toHaveBeenCalled();
        });

        it('single option auto-applies and burns the oncePerTurn latch on the Cunning-Strike alias key', async () => {
            mockTargetEffects();
            vi.mocked(checkOncePerTurn).mockResolvedValue(null);
            const stats = makePlayerStats();
            const action = makeAction({
                automation: {
                    type: 'attack_rider',
                    oncePerTurn: true,
                    options: [{ name: 'Trip', effect: 'prone' }],
                },
            });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Trip applied to Goblin — target must make a Dexterity save or gain the Prone condition');
            // isCunningStrikeFeatureName aliases the usedKey — the ONLY pin of the
            // alias branch (Slasher's literal `_Hamstring_usedRound` is pinned below).
            expect(checkOncePerTurn).toHaveBeenCalledWith('Cunning Strike', '_CunningStrike_usedRound', 'TestHero', 'campaign');
            expect(markOncePerTurn).toHaveBeenCalledWith('Cunning Strike', '_CunningStrike_usedRound', stats, 'campaign');
            expect(teWrites()).toHaveLength(1);
        });

        it('should return ready info when multiple options without chooseOne/maxEffects', async () => {
            const action = makeAction({
                automation: { type: 'attack_rider', options: [{ name: 'Trip', effect: 'prone' }, { name: 'Daze', effect: 'daze' }] },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Cunning Strike',
                    automationType: 'attack_rider',
                    description: 'Cunning Strike ready. The next eligible attack will apply it.',
                    automation: action.automation,
                },
            });
        });

        it('oncePerTurn skip: passthrough identity, alias usedKey checked, zero state written', async () => {
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
            expect(checkOncePerTurn).toHaveBeenCalledWith('Cunning Strike', '_CunningStrike_usedRound', 'TestHero', 'campaign');
            // Skip short-circuits before any effect write or latch burn.
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(markOncePerTurn).not.toHaveBeenCalled();
        });
    });

    describe('applyRiderOption', () => {
        it('single option: exact ordered write census (CLA-376 clears → pendingRiderChoice clear → option stash → te append)', async () => {
            mockTargetEffects();
            const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Trip applied to Goblin — target must make a Dexterity save or gain the Prone condition');
            // Whole-test ordered census: nothing else is ever written; the four
            // CLA-376 stale-key clears run at entry, then the pending clear, the
            // choice stash, and the single te append.
            expect(setRuntimeValue.mock.calls).toEqual([
                ['TestHero', 'versatileTricksterSecondaryTargets', null, 'campaign'],
                ['TestHero', 'versatileTricksterPrimaryTarget', null, 'campaign'],
                ['TestHero', 'versatileTricksterPrimarySave', null, 'campaign'],
                ['TestHero', 'versatileTricksterAction', null, 'campaign'],
                ['TestHero', 'pendingRiderChoice', null, 'campaign'],
                ['TestHero', '_Cunning_Strike_option', 'Trip', 'campaign'],
                ['campaign', 'targetEffects', [expect.objectContaining({
                    target: 'Goblin', source: 'TestHero', option: 'Trip', effect: 'prone', saveType: null,
                    duration: 'until_start_of_next_turn', label: 'Cunning Strike',
                })], 'campaign'],
            ]);
        });

        it('should reject Poison without Poisoner\'s Kit — requires gate at handler seam', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Poison']);

            // Reason from validateCunningStrikeOption surfaces verbatim in the refusal.
            // (The `<slug>_refused` log row shape is owned by charger-size-gate.)
            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Cunning Strike',
                    automationType: 'attack_rider',
                    description: "<b>Poison</b> cannot be used: Requires Poisoner's Kit which the character does not have.",
                    automation: action.automation,
                },
            });
            // Refusal leaves nothing behind: no te write, no latch burn.
            expect(teWrites()).toHaveLength(0);
            expect(markOncePerTurn).not.toHaveBeenCalled();
        });

        it('should apply Sudden Strike effect', async () => {
            mockTargetEffects();
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', 'Goblin', ['Sudden Strike']);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Cunning Strike',
                    automationType: 'attack_rider',
                    description: 'Sudden Strike enabled. Make a bonus action attack against a different creature within 5 ft of Goblin.',
                    automation: action.automation,
                },
            });
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'pendingSuddenStrike', true, 'campaign');
            // sudden_strike never takes the default targetEffects write lane.
            expect(teWrites()).toHaveLength(0);
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
            const action = makeAction();
            const result = await applyRiderOption(action, makePlayerStats(), 'campaign', null, ['Trip']);

            expect(result).toEqual({
                type: 'popup',
                payload: {
                    type: 'automation_info',
                    name: 'Cunning Strike',
                    automationType: 'attack_rider',
                    description: 'Trip: prone<br/><br/><i>No target selected — effect noted for manual application.</i>',
                    automation: action.automation,
                },
            });
            expect(teWrites()).toHaveLength(0);
        });

        it('should summarize multiple options in one popup (own-composition)', async () => {
            mockTargetEffects();
            const result = await applyRiderOption(makeAction(), makePlayerStats(), 'campaign', 'Goblin', ['Trip', 'Daze']);

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe('Applied to Goblin:<br/>• Trip — target has Prone condition<br/>• Daze — target on next turn can only do one of: move, action, or Bonus Action');
            // Each leg writes its own te row in choice order.
            expect(teWrites().map(w => w[2][0].option)).toEqual(['Trip', 'Daze']);
            // The option stash is a single-choice-only contract.
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', '_Cunning_Strike_option', expect.anything(), 'campaign');
        });

        it('should stamp VT and Stalker\'s Flurry secondary targets (full shape) when Trip and Sudden Strike applied with the passive', async () => {
            mockTargetEffects();
            vi.mocked(isWithinRange).mockResolvedValue(true);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } },
                    { name: 'Skeleton', size: 'Medium', position: { x: 2, y: 1 } },
                ],
            });
            const stats = makePlayerStats(VT_PASSIVE);
            await applyRiderOption(makeAction(), stats, 'campaign', 'Goblin', ['Trip', 'Sudden Strike']);

            const skeleton = { name: 'Skeleton', size: 'Medium', position: { x: 2, y: 1 } };
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterSecondaryTargets', [skeleton], 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterPrimaryTarget', 'Goblin', 'campaign');
            // No save leg on this Trip → primarySave threads null (save-threaded
            // faces are owned by attackRiderHandler.vt-primary-save.test.js).
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterPrimarySave', null, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'versatileTricksterAction', { type: 'versatile_trickster', automation: { type: 'versatile_trickster', casting_time: 'passive' } }, 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurrySecondaryTargets', [skeleton], 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurryPrimaryTarget', 'Goblin', 'campaign');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'stalkersFlurryOptions', ['Trip', 'Sudden Strike'], 'campaign');
        });

        it('out-of-range nearby creatures stamp nothing: VT stays entry-cleared, SF keys never written', async () => {
            mockTargetEffects();
            vi.mocked(isWithinRange).mockResolvedValue(false);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'Goblin', size: 'Medium', position: { x: 1, y: 1 } },
                    { name: 'Skeleton', size: 'Medium', position: { x: 30, y: 30 } },
                ],
            });
            // VT passive + Trip + Sudden Strike present: the 5-ft range scan is
            // the sole discriminator (empty-scan suppression with in-range-only
            // candidates is pinned by vt-primary-save / the DG holder tests).
            const stats = makePlayerStats(VT_PASSIVE);
            await applyRiderOption(makeAction(), stats, 'campaign', 'Goblin', ['Trip', 'Sudden Strike']);

            expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'versatileTricksterSecondaryTargets'))
                .toEqual([['TestHero', 'versatileTricksterSecondaryTargets', null, 'campaign']]);
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stalkersFlurrySecondaryTargets', expect.anything(), 'campaign');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stalkersFlurryPrimaryTarget', expect.anything(), 'campaign');
            expect(setRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'stalkersFlurryOptions', expect.anything(), 'campaign');
        });

        // DG 2026-11-06: RAW "another creature within 5 feet of the target"
        // excludes the holder — the candidate producer must never offer the
        // attacker themself (EvasiveFighter was live-listed as a radio).
        it('DG 2026-11-06: VT secondary scan excludes the holder but keeps other nearby creatures', async () => {
            mockTargetEffects();
            vi.mocked(isWithinRange).mockResolvedValue(true);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'TestHero', size: 'Medium' },
                    { name: 'Goblin', size: 'Medium' },
                    { name: 'Skeleton', size: 'Medium' },
                ],
            });
            const stats = makePlayerStats(VT_PASSIVE);
            await applyRiderOption(makeAction(), stats, 'campaign', 'Goblin', ['Trip']);

            const stamped = setRuntimeValue.mock.calls
                .filter(c => c[1] === 'versatileTricksterSecondaryTargets').at(-1)[2];
            expect(stamped).toEqual([{ name: 'Skeleton', size: 'Medium' }]);
        });

        it('DG 2026-11-06: holder exclusion is VT-only — Stalker\'s Flurry scan still includes the holder', async () => {
            mockTargetEffects();
            vi.mocked(isWithinRange).mockResolvedValue(true);
            vi.mocked(getCombatContext).mockResolvedValue({
                creatures: [
                    { name: 'TestHero', size: 'Medium' },
                    { name: 'Goblin', size: 'Medium' },
                    { name: 'Skeleton', size: 'Medium' },
                ],
            });
            const stats = makePlayerStats(VT_PASSIVE);
            await applyRiderOption(makeAction(), stats, 'campaign', 'Goblin', ['Trip', 'Sudden Strike']);

            const vtStamped = setRuntimeValue.mock.calls
                .filter(c => c[1] === 'versatileTricksterSecondaryTargets').at(-1)[2];
            const sfStamped = setRuntimeValue.mock.calls
                .filter(c => c[1] === 'stalkersFlurrySecondaryTargets').at(-1)[2];
            expect(vtStamped.map(c => c.name)).toEqual(['Skeleton']);
            expect(sfStamped.map(c => c.name)).toEqual(['TestHero', 'Skeleton']);
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
            // Exact own-row pin (save-outcome row copy is owned by log-honesty).
            expect(addEntry).toHaveBeenCalledWith('campaign', {
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Envenom Weapons',
                description: '2d6 Poison damage (8) applied to Goblin on failed Cunning Strike poison save',
            });
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
            const stats = makePlayerStats();
            const result = await handle(hamstringAction(), stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe("Hamstring applied to Goblin — target's Speed reduced by 10 ft until the start of your next turn");

            // te written EXACT: full no-save buildRiderEffect row (the save-leg
            // byte shape is owned by save-success-eviction).
            expect(teWrites()).toEqual([['campaign', 'targetEffects',
                [{
                    target: 'Goblin',
                    source: 'TestHero',
                    option: 'Hamstring',
                    effect: 'speed_reduction',
                    value: 10,
                    noOpportunityAttacks: false,
                    duration: 'until_start_of_next_turn',
                    saveType: null,
                    saveDc: null,
                    saveAbility: null,
                    condition: null,
                    repeatingSave: false,
                    requires: null,
                    sizeLimit: null,
                    movement: null,
                    cost: null,
                    ignoreResistance: false,
                    restoreCost: null,
                    damageDoubled: false,
                    damageExpression: null,
                    damageType: null,
                    label: 'Hamstring',
                }], 'campaign']]);

            // Non-alias usedKey branch: literal space-slugged latch, burned once.
            expect(markOncePerTurn).toHaveBeenCalledWith('Hamstring', '_Hamstring_usedRound', stats, 'campaign');

            // Automated use logged to the campaign log (AGENTS: every automation
            // logs) — ordered exact census: routing use row, then the Hamstring
            // speed row. Any extra/missing row fails.
            expect(addEntry.mock.calls).toEqual([
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Hamstring',
                    description: 'Hamstring used against Goblin',
                }],
                ['campaign', {
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Hamstring',
                    description: "TestHero used Hamstring on Goblin: target's Speed reduced by 10 ft until the start of TestHero's next turn",
                    targetName: 'Goblin',
                }],
            ]);

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
            expect(teWrites()).toEqual([['campaign', 'targetEffects',
                [expect.objectContaining({ option: 'Chill', effect: 'speed_reduction', value: 10, saveType: 'CON', saveDc: null })], 'campaign']]);
            expect(addExpiration).not.toHaveBeenCalled();
        });

        it.each([
            [null, 'No attack hit recorded. Hamstring requires a recent attack hit.'],
            [{ hit: false }, 'Hamstring requires a hit. Your last attack missed.'],
            [{ hit: true, attackerName: 'Orc', damageType: 'Slashing', targetName: 'Goblin' }, 'Hamstring only works on your own attacks.'],
            [{ hit: true, attackerName: 'TestHero', damageType: 'Piercing', targetName: 'Goblin' }, 'Hamstring requires Slashing damage. Your last attack dealt Piercing damage.'],
        ])('should reject when lastAttack is %j', async (lastAttack, description) => {
            getRuntimeValue.mockReturnValue(lastAttack);

            const result = await handle(hamstringAction(), makePlayerStats(), 'campaign', 'map');

            expect(result).toEqual({
                type: 'popup',
                payload: { type: 'automation_info', name: 'Hamstring', description },
            });
            // Validation short-circuits before the latch gate, use-log, and any write.
            expect(checkOncePerTurn).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(teWrites()).toHaveLength(0);
        });
    });
});
