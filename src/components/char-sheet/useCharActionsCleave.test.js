// @maintained-by-ai
// useCharActionsCleave hook seam: the two user-facing handlers plus the dismiss.
// - handleCleaveAttack: cleave second-target attack/miss resolution, modifier-free
//   damage, and byte-exact campaign logs.
// - handleTacticalMasterConfirm: pending read, replace-vs-choice log channels, the
//   live-target guard, Topple CON save → prone mutation, and WM-003 popup passthrough.
// Owned elsewhere (do not restate here): pipeline step condition/formula-strip/latch
// semantics → services/combat/steps/attackRollDamageSteps-cleaveMastery.test.js and
// attackRollPostDamage.cleaveOncePerTurn.test.js; resume chaining →
// useAttackDamageResolution.tacticalMaster.test.js (its header delegates confirm
// internals HERE); modal option rendering → TacticalMasterModal.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsCleave from './useCharActionsCleave.js';

// Sole module mock: the hook imports rollD20 + rollExpression from the canonical
// diceRoller lane — the cleave attack d20 is seeded here, never raw Math.random (#334).
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollD20: vi.fn(),
    rollExpression: vi.fn(),
}));

import { rollD20, rollExpression } from '../../services/dice/diceRoller.js';

// Deps factories build fresh spies per mount; the module-level rollD20/rollExpression
// mocks are the only shared spies, so their call logs are cleared between tests
// (implementations are set per test). A mid-face 10 default keeps every
// guaranteed-hit/guaranteed-miss lane deterministic without pinning a face.
beforeEach(() => {
    rollD20.mockClear();
    rollExpression.mockClear();
    rollD20.mockReturnValue(10);
});

// Realistic non-crit 1d8: dice [5, 3], no modifier (cleave strips it).
const CLEAVE_HIT_ROLL = { total: 8, rolls: [5, 3] };

function makeStats(overrides = {}) {
    return {
        name: 'TestFighter',
        level: 5,
        proficiency: 3,
        abilities: [{ name: 'Strength', bonus: 3 }],
        attacks: [{ name: 'Longsword', abilityName: 'Strength' }],
        ...overrides,
    };
}

// Key-based runtime store stub (key = characterKey + ':' + key) instead of Once
// chains — immune to source call-order changes and still exposes every read.
function makeStore(seed = {}) {
    const store = {
        'campaign:tacticalMasterPending': { baseMastery: 'Piercing', attackName: 'Longsword', targetName: 'Goblin' },
        'campaign:lastAttack': {
            attackName: 'Longsword',
            damageFormula: '1d8+3',
            damageType: 'slashing',
            targetName: 'Goblin',
        },
        ...seed,
    };
    return (characterKey, key) => store[`${characterKey}:${key}`];
}

function makeDeps({ playerStats, storeSeed, saveResult = { success: false, roll: 5, saveBonus: 2, total: 7 } } = {}) {
    return {
        campaignName: 'test-campaign',
        playerStats: makeStats(playerStats),
        setShowCleaveTargetSelection: vi.fn(),
        setTacticalMasterModal: vi.fn(),
        rollDamage: vi.fn(),
        getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin', ac: 5 }] }),
        getRuntimeValue: vi.fn(makeStore(storeSeed)),
        setRuntimeValue: vi.fn().mockResolvedValue(undefined),
        addEntry: vi.fn().mockResolvedValue(undefined),
        createSaveListener: vi.fn(() => ({ promise: Promise.resolve(saveResult) })),
        applyMasteryEffect: vi.fn().mockResolvedValue(undefined),
    };
}

describe('useCharActionsCleave', () => {
    describe('handleCleaveAttack', () => {
        // Deterministic hit lanes: the attack d20 arrives via the seeded rollD20
        // mock (default face 10); with STR 3 + prof 3 (+6) every pinned face against
        // ac 5 is hit and ac 30 is miss, so the >= tie boundary cannot flip
        // run-to-run (the tie leg itself is pinned in the cleaveMastery step lane).
        it('rolls modifier-free weapon damage on a guaranteed hit and logs the Cleave use', async () => {
            rollExpression.mockReturnValue(CLEAVE_HIT_ROLL);
            const deps = makeDeps();
            // Same-name enemy entry whose STR attack supplies the ability lookup —
            // positive leg for playerStats.attacks/abilities resolution (vs the
            // 'same_as_weapon' row below, where no attack entry exists).
            const stats = makeStats({ attacks: [{ name: 'Longsword', abilityName: 'Strength' }] });

            const { handleCleaveAttack } = useCharActionsCleave({ ...deps, playerStats: stats });
            await handleCleaveAttack('Goblin');

            expect(deps.setShowCleaveTargetSelection).toHaveBeenCalledWith(false);
            expect(rollExpression).toHaveBeenCalledTimes(1);
            // Modifier stripped ("+3" gone) and pinned modifier: 0 — the rule core of cleave.
            expect(deps.rollDamage).toHaveBeenCalledWith({
                name: 'Longsword (Cleave)',
                formula: '1d8',
                total: 8,
                rolls: [5, 3],
                modifier: 0,
                context: {
                    targetName: 'Goblin',
                    damageType: 'slashing',
                    attackerName: 'TestFighter',
                },
            });
            expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Cleave',
                description: 'TestFighter used Cleave on Longsword against Goblin',
                targetName: 'Goblin',
            });
            expect(deps.rollDamage).toHaveBeenCalledTimes(1);
        });

        it('auto-misses with 0 damage and logs the miss when no d20 face can reach AC', async () => {
            rollExpression.mockReturnValue(CLEAVE_HIT_ROLL);
            const deps = makeDeps({
                storeSeed: {
                    'campaign:lastAttack': {
                        attackName: 'Longsword',
                        damageFormula: '1d8+3',
                        damageType: 'slashing',
                        targetName: 'Ogre',
                    },
                },
            });
            deps.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Ogre', ac: 30 }] });

            const { handleCleaveAttack } = useCharActionsCleave(deps);
            await handleCleaveAttack('Ogre');

            // Positive leg proving the roll happened, gate leg proving damage was gated.
            expect(rollExpression).not.toHaveBeenCalled();
            expect(deps.rollDamage).toHaveBeenCalledWith({
                name: 'Longsword (Cleave)',
                formula: '1d8',
                total: 0,
                rolls: [],
                modifier: 0,
                context: {
                    targetName: 'Ogre',
                    damageType: 'slashing',
                    attackerName: 'TestFighter',
                    isAutoMiss: true,
                },
            });
            expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Cleave',
                description: 'TestFighter used Cleave on Longsword against Ogre — Miss',
                targetName: 'Ogre',
            });
        });

        // ── Seed pins (#334 routing, #1348 face matrix): the attack d20 is now
        // fully seedable through the rollD20 seam. Face+6 (STR 3 + prof 3) drives
        // hit/miss against a seeded AC; the roll is consumed exactly once per
        // cleave, ahead of the modifier-free damage roll.
        it('consumes the rollD20 lane exactly once per cleave, ahead of the damage roll', async () => {
            const order = [];
            rollD20.mockImplementation(() => { order.push('d20'); return 10; });
            rollExpression.mockImplementation(() => { order.push('damage'); return CLEAVE_HIT_ROLL; });
            const deps = makeDeps();

            const { handleCleaveAttack } = useCharActionsCleave(deps);
            await handleCleaveAttack('Goblin');

            // rollD20() takes no args — the seam itself is the '1d20'-shape pin
            // (canonical attack-d20 fn, mirror of concentrationBonusAttackHandler.js:151).
            expect(rollD20).toHaveBeenCalledTimes(1);
            expect(rollD20).toHaveBeenCalledWith();
            // Order pin: attack die resolved before damage dice.
            expect(order).toEqual(['d20', 'damage']);
        });

        it.each([
            // [label, face, ac, expectation]
            ['nat 20 totals 26 and hits AC 21', 20, 21, 'hit'],
            ['mid-roll totals 18 and ties-hit AC 18', 12, 18, 'hit'],
            ['mid-roll totals 18 and misses AC 19', 12, 19, 'miss'],
            ['nat 1 totals 7 and misses AC 8', 1, 8, 'miss'],
            // Byte-parity pin vs the old Math.floor(Math.random()*20)+1 inline: the
            // cleave lane has no manual nat-1 auto-miss — the AC comparison is the
            // only gate, and routing preserves it.
            ['nat 1 totals 7 and tie-hits AC 7 (no auto-miss rule in this lane)', 1, 7, 'hit'],
        ])('seeded face %s', async (_label, face, ac, expectation) => {
            rollD20.mockReturnValue(face);
            rollExpression.mockReturnValue(CLEAVE_HIT_ROLL);
            const deps = makeDeps();
            deps.getCombatContext.mockResolvedValue({ creatures: [{ name: 'Goblin', ac }] });

            const { handleCleaveAttack } = useCharActionsCleave(deps);
            await handleCleaveAttack('Goblin');

            if (expectation === 'hit') {
                expect(rollExpression).toHaveBeenCalledTimes(1);
                expect(rollExpression).toHaveBeenCalledWith('1d8');
                expect(deps.rollDamage).toHaveBeenCalledWith(expect.objectContaining({
                    total: 8,
                    rolls: [5, 3],
                }));
                expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                    abilityName: 'Cleave',
                    description: 'TestFighter used Cleave on Longsword against Goblin',
                }));
            } else {
                expect(rollExpression).not.toHaveBeenCalled();
                expect(deps.rollDamage).toHaveBeenCalledWith(expect.objectContaining({
                    total: 0,
                    rolls: [],
                    context: expect.objectContaining({ isAutoMiss: true }),
                }));
                expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                    description: 'TestFighter used Cleave on Longsword against Goblin — Miss',
                }));
            }
        });

        it('falls back to the raw formula and same_as_weapon damage type for a malformed lastAttack, auto-missing on a roll failure', async () => {
            rollExpression.mockReturnValue(null);
            const deps = makeDeps({
                playerStats: makeStats({ attacks: [] }),
                storeSeed: {
                    'campaign:lastAttack': {
                        attackName: 'Longsword',
                        damageFormula: 'No Dice',
                        targetName: 'Goblin',
                    },
                },
            });

            const { handleCleaveAttack } = useCharActionsCleave(deps);
            await handleCleaveAttack('Goblin');

            // Guaranteed hit (ac 5) reached the roll, which failed — the auto-miss
            // degrade path — with the unstripped raw formula (no dice in 'No Dice')
            // and the same_as_weapon damage-type fallback both pinned.
            expect(rollExpression).toHaveBeenCalledWith('No Dice');
            expect(deps.rollDamage).toHaveBeenCalledWith({
                name: 'Longsword (Cleave)',
                formula: 'No Dice',
                total: 0,
                rolls: [],
                modifier: 0,
                context: {
                    targetName: 'Goblin',
                    damageType: 'same_as_weapon',
                    attackerName: 'TestFighter',
                    isAutoMiss: true,
                },
            });
            expect(deps.addEntry).toHaveBeenCalledTimes(1);
        });

        it('dismisses the cleave modal without rolling, logging, or reading the store when no target is selected', async () => {
            const deps = makeDeps();

            const { handleCleaveAttack } = useCharActionsCleave(deps);
            await handleCleaveAttack(null);

            expect(deps.setShowCleaveTargetSelection).toHaveBeenCalledWith(false);
            expect(deps.rollDamage).not.toHaveBeenCalled();
            expect(deps.addEntry).not.toHaveBeenCalled();
            // Guard is upstream of everything: no combat read, no roll, no log.
            expect(deps.getCombatContext).not.toHaveBeenCalled();
            expect(deps.getRuntimeValue).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
        });

        it('dismisses the cleave modal without damage or log when lastAttack is missing', async () => {
            const deps = makeDeps({ storeSeed: { 'campaign:lastAttack': undefined } });

            const { handleCleaveAttack } = useCharActionsCleave(deps);
            await handleCleaveAttack('Goblin');

            expect(deps.setShowCleaveTargetSelection).toHaveBeenCalledWith(false);
            expect(deps.rollDamage).not.toHaveBeenCalled();
            expect(deps.addEntry).not.toHaveBeenCalled();
            expect(rollExpression).not.toHaveBeenCalled();
            // Positive leg: the guarded read happened and the combat context resolved first.
            expect(deps.getRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', 'test-campaign');
            expect(deps.getCombatContext).toHaveBeenCalledWith('test-campaign');
        });
    });

    describe('handleTacticalMasterConfirm', () => {
        it('closes the modal immediately on confirm or dismiss without applying any mastery', async () => {
            const deps = makeDeps();

            const { handleTacticalMasterConfirm, handleTacticalMasterDismiss } = useCharActionsCleave(deps);
            handleTacticalMasterDismiss();
            const result = await handleTacticalMasterConfirm(null);

            expect(result).toBeUndefined();
            expect(deps.setTacticalMasterModal).toHaveBeenCalledTimes(2);
            expect(deps.setTacticalMasterModal).toHaveBeenCalledWith(null);
            expect(deps.applyMasteryEffect).not.toHaveBeenCalled();
            expect(deps.createSaveListener).not.toHaveBeenCalled();
            expect(deps.addEntry).not.toHaveBeenCalled();
            // Both branches read pending before the close/early-return seam; confirm
            // then stops, dismiss stops at the same close-null.
            expect(deps.getRuntimeValue).toHaveBeenCalledTimes(1);
            expect(deps.getRuntimeValue).toHaveBeenCalledWith('campaign', 'tacticalMasterPending', 'test-campaign');
        });

        // Channel-precedence pair: same execution path, distinguishable only by the
        // byte-exact description/abilityName of each log channel.
        it('logs the replace-mode mastery change and delegates to applyMasteryEffect for Tactical Master', async () => {
            // Log target comes from pending (Goblin); the applied target comes from the
            // live lastAttack (Ogre) — a seed where the two differ pins both resolutions.
            const deps = makeDeps({
                storeSeed: {
                    'campaign:lastAttack': {
                        attackName: 'Longsword',
                        damageFormula: '1d8+3',
                        damageType: 'slashing',
                        targetName: 'Ogre',
                    },
                },
            });

            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            await handleTacticalMasterConfirm('Vex');

            expect(deps.setTacticalMasterModal).toHaveBeenCalledWith(null);
            expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Master',
                description: 'TestFighter used Tactical Master on Longsword against Goblin — changed mastery from Piercing to Vex',
                targetName: 'Goblin',
            });
            expect(deps.applyMasteryEffect).toHaveBeenCalledWith('Vex', deps.playerStats, 'test-campaign', 'Ogre');
        });

        it('logs the granting feature and additive wording for choice-mode (Battering Roots)', async () => {
            const deps = makeDeps({
                storeSeed: {
                    'campaign:tacticalMasterPending': {
                        baseMastery: 'Sap',
                        attackName: 'Longsword',
                        targetName: 'Goblin',
                        isChoiceMode: true,
                        featureName: 'Battering Roots',
                    },
                },
            });

            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            await handleTacticalMasterConfirm('Push');

            expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Battering Roots',
                description: 'TestFighter used Battering Roots on Longsword against Goblin — applied Push mastery in addition to Sap',
                targetName: 'Goblin',
            });
            expect(deps.applyMasteryEffect).toHaveBeenCalledWith('Push', deps.playerStats, 'test-campaign', 'Goblin');
        });

        it.each([
            ['lastAttack has no targetName', { attackName: 'Longsword', damageFormula: '1d8+3', targetName: null }],
            ['lastAttack is missing entirely', undefined],
        ])('logs the mastery change but applies nothing when the live lastAttack carries no target — %s', async (_name, lastAttack) => {
            const deps = makeDeps({ storeSeed: { 'campaign:lastAttack': lastAttack } });

            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            const result = await handleTacticalMasterConfirm('Vex');

            expect(deps.setTacticalMasterModal).toHaveBeenCalledWith(null);
            // The log fired from pending's target, but nothing is applied past the
            // missing live target.
            expect(deps.addEntry).toHaveBeenCalledTimes(1);
            expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Master',
                description: 'TestFighter used Tactical Master on Longsword against Goblin — changed mastery from Piercing to Vex',
                targetName: 'Goblin',
            });
            expect(result).toBeUndefined();
            expect(deps.applyMasteryEffect).not.toHaveBeenCalled();
            expect(deps.createSaveListener).not.toHaveBeenCalled();
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
        });

        it('routes Topple to a CON save, grants Prone on a failed save, and logs the full Topple chain byte-exact without touching applyMasteryEffect', async () => {
            // Pending is byte-identical to the default store; the name is the lane label.
            const deps = makeDeps();

            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            const result = await handleTacticalMasterConfirm('Topple');

            // STR 3 + prof 3 → DC 14 (8 + 3 + 3), weapon ability from Longsword.
            expect(deps.createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 14,
            });
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['prone'], 'test-campaign');
            // Channel log (mastery change) lands first — confirm logs before routing —
            // then save prompt, save failure, and the Topple ability_use.
            expect(deps.addEntry).toHaveBeenNthCalledWith(1, 'test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Tactical Master',
                description: 'TestFighter used Tactical Master on Longsword against Goblin — changed mastery from Piercing to Topple',
                targetName: 'Goblin',
            });
            expect(deps.addEntry).toHaveBeenNthCalledWith(2, 'test-campaign', {
                type: 'save_result',
                characterName: 'TestFighter',
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 14,
                description: 'Topple: Goblin must make a DC 14 CON save (weapon Strength) or fall Prone.',
                success: null,
            });
            expect(deps.addEntry).toHaveBeenNthCalledWith(3, 'test-campaign', {
                type: 'save_result',
                characterName: 'TestFighter',
                rollType: 'save-topple',
                targetName: 'Goblin',
                saveDc: 14,
                saveType: 'CON',
                success: false,
                description: 'Goblin failed CON save vs Topple. Gains Prone condition.',
            });
            expect(deps.addEntry).toHaveBeenNthCalledWith(4, 'test-campaign', {
                type: 'ability_use',
                characterName: 'TestFighter',
                abilityName: 'Topple',
                description: 'TestFighter used Topple on Goblin — target failed CON save (DC 14, weapon Strength), fell Prone.',
                targetName: 'Goblin',
            });
            expect(deps.applyMasteryEffect).not.toHaveBeenCalled();
            expect(result).toBeNull();
        });

        it('defaults Topple to the Strength modifier when the attack-name lookup misses', async () => {
            const deps = makeDeps({
                playerStats: makeStats({ attacks: [] }),
                storeSeed: {
                    'campaign:tacticalMasterPending': { baseMastery: 'Piercing', attackName: 'NonexistentWeapon', targetName: 'Goblin' },
                },
            });

            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            await handleTacticalMasterConfirm('Topple');

            // Same DC 14 as the Longsword lane — but via the 'Strength' fallback lookup,
            // pinned by the weapon name in the prompt description.
            expect(deps.createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 14,
            });
            expect(deps.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
                type: 'save_result',
                description: 'Topple: Goblin must make a DC 14 CON save (weapon Strength) or fall Prone.',
            }));
            expect(deps.setRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeConditions', ['prone'], 'test-campaign');
        });

        it.each([
            ['target already Prone (no duplicate write)', { success: false, roll: 5, saveBonus: 2, total: 7 }, ['prone']],
            ['save passed', { success: true, roll: 15, saveBonus: 2, total: 17 }, []],
            ['save result null', null, []],
        ])('never grants Prone when %s', async (_name, saveResult, stored) => {
            const deps = makeDeps({
                saveResult,
                storeSeed: { 'Goblin:activeConditions': stored },
            });

            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            await handleTacticalMasterConfirm('Topple');

            // Positive leg: the save lane executed up to the guard.
            expect(deps.createSaveListener).toHaveBeenCalledWith('test-campaign', {
                targetName: 'Goblin',
                saveType: 'CON',
                saveDc: 14,
            });
            expect(deps.setRuntimeValue).not.toHaveBeenCalled();
            // No failure logs on pass/null rows; the already-prone row still logs the
            // save failure but never re-writes the condition (guard above is the pin).
            if (!saveResult || saveResult.success) {
                expect(deps.addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ rollType: 'save-topple' }));
            }
        });

        it('WM-003: returns the applyMasteryEffect popup unchanged so refusal is never mislabeled success', async () => {
            const refusal = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Nick', refused: true, description: 'TestFighter can use Nick only once per turn.' },
            };
            const success = {
                type: 'popup',
                payload: { type: 'automation_info', name: 'Nick', description: 'Nick applied.', automation: { type: 'mastery_rider', masteries: ['Nick'] } },
            };
            const deps = makeDeps();
            deps.applyMasteryEffect.mockResolvedValueOnce(refusal);

            const { handleTacticalMasterConfirm } = useCharActionsCleave(deps);
            const refusalResult = await handleTacticalMasterConfirm('Nick');
            deps.applyMasteryEffect.mockResolvedValueOnce(success);
            const successResult = await handleTacticalMasterConfirm('Nick');

            expect(deps.applyMasteryEffect).toHaveBeenCalledWith('Nick', deps.playerStats, 'test-campaign', 'Goblin');
            expect(refusalResult).toBe(refusal);
            expect(successResult).toBe(success);
        });
    });
});
