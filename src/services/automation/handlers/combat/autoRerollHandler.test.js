// @maintained-by-ai
// autoRerollHandler — main lane: handle() router dispatch, Guarded Mind, save-reroll
// resource-cost decrements (success side), bardic die lane, generic psionic_energy_die
// lane (incl. zero-pool + _trackedResources-default ordering BEFORE the homing
// dispatch), and ally-range routing.
//
// Seam map for the autoRerollHandler.test.js quint:
//   autoRerollHandler.test.js (this file)   — router dispatch, Guarded Mind, resource
//                                               costs, bardic/psionic die lanes, ally-range routing
//   autoRerollHandler.attackRoll.test.js    — handleAttackRoll popup description full-string
//                                               composition + rerollAttackLeg delegation
//                                               (exactly-once miss→hit damage, own ability_use log)
//   autoRerollHandler.damagePaths.test.js   — applyMissTurnedHitDamage payload content
//   autoRerollHandler.miscPaths.test.js     — handleAbilityCheck / handleSaveRoll popup
//                                               composition, consumeResourceCost refusals at
//                                               zero, findAllyMissedAttack guard ordering
//                                               (incl. out-of-range fallback), getBardicDieSize guard
//   autoRerollHandler.soul-blades.test.js   — Homing Strikes (CLA-320) gates and economy
//
// Production traffic (verified against public/data JSON + automation/index.js
// `auto_reroll: handleAutoReroll`):
//   - Peerless Skill (5e + 2024 classes.json) → bardic_inspiration_die lane.
//   - Indomitable / Fanatical Focus / Disciplined Survivor → target:'saving_throw' reroll
//     lane (Disciplined Survivor carries resourceCost:'focus_points' — live focus shape).
//   - Soul Blades (2024) → psionic_energy_die WITH psychic_blade_miss trigger: homing
//     gates live in the soul-blades lane; the zero-pool check and _trackedResources
//     default are computed BEFORE that dispatch and are owned here.
//   - Lucky / Fearless Aim carry no numeric bonus → terminal automationInfoPopup
//     fallthrough, pinned here.
//
// Honest findings (verified against source + data, this pass):
//   - Guarded Mind legacy caveat (confirmed): the authored feat row (2024/feats.json)
//     carries effect:'override_fail_to_success' + oncePer but NO target:'saving_throw',
//     so via this router it falls through to automationInfoPopup — live execution goes
//     through SavePromptModal.findGuardedMindAction. The handleGuardedMind branch below
//     pins the routable shape (any custom row with target+effect+oncePer) and, per the
//     quint map, stays main-lane only.
//   - Removed 'map positions unavailable (range check skipped)' test: findAllyMissedAttack
//     has NO position-based skip — it defers to isWithinRange's verdict, and this file
//     mocks isWithinRange wholesale, so resolveMapPositions' null positions were never
//     consumed. The test replayed the in-range case under a false label. Removed, not
//     replaced.
//   - Removed exact-subset dupes owned elsewhere: own-attack numeric boost substring
//     (attackRoll lane pins the full popup + own ability_use log), own-check numeric
//     boost (miscPaths pins the full popup + own check log — byte-identical scenario),
//     out-of-range ally fallback (miscPaths pins exact isWithinRange delegation args +
//     exact fallback text — same scenario).
//   - Confirmed miscPaths header claims: handleAbilityCheck/handleSaveRoll "No recent…"
//     early returns are unreachable via handle() (every router caller guards freshness
//     first) — honestly dead.
//   - makeAction helper fixed this pass: the sibling-quint pattern `{ automation: {...},
//     ...overrides }` lets a trailing overrides-spread REPLACE automation wholesale,
//     silently dropping type:'auto_reroll' (exposed by pinning automationInfoPopup's
//     automationType here). Other files mask it by restating type in every override.
//
// Deterministic by construction: authored numbers fixed, dice mocked; the Math.random
// die rolls (bardic/psionic) are value-independent of every assertion — rolls are never
// pinned. Turn-based only: no game timers.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
    setRuntimeValue: vi.fn(async () => {}),
}));

vi.mock('../../../ui/logService.js', () => ({
    addEntry: vi.fn(async () => {}),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    loadCombatSummary: vi.fn(),
}));

vi.mock('../../../rules/combat/rangeValidation.js', () => ({
    getDistanceFeet: vi.fn(),
    rangeToFeet: vi.fn((r) => {
        const m = String(r).match(/^(\d+)_?ft$/i);
        return m ? parseInt(m[1], 10) : null;
    }),
}));

vi.mock('../../../rules/combat/rangeCheck.js', () => ({
    isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

// ── Re-import after mocking ────────────────────────────────────

import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { evaluateAutoExpression } from '../../../combat/automation/automationService.js';

// ── Helpers ────────────────────────────────────────────────────

function makeAction(overrides = {}) {
    // NOTE: automation overrides MERGE onto the authored base (type/bonus survive) —
    // a naive trailing `...overrides` would replace automation wholesale and silently
    // drop type:'auto_reroll' (automationInfoPopup reads action.automation.type).
    const { automation: automationOverrides, ...rest } = overrides;
    return {
        name: 'Test Auto Reroll',
        description: 'Reroll ability.',
        automation: {
            type: 'auto_reroll',
            bonus: 2,
            ...automationOverrides,
        },
        ...rest,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3 }] },
        level: 1,
        resources: {},
        ...overrides,
    };
}

function makePlayerStatsForLevel(level, classOverrides = {}) {
    return makePlayerStats({
        level,
        class: {
            class_levels: [{ level, ...classOverrides }],
        },
    });
}

function mockLastAttack(attack) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'lastAttack') return attack;
        return null;
    });
}

// ── Tests ──────────────────────────────────────────────────────

describe('autoRerollHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLastAttack(null);
        isWithinRange.mockResolvedValue(true);
    });

    // ── Router terminal exits ─────────────────────────────────────

    describe('router terminal exits', () => {
        it('should return the fallback popup when there is no lastAttack at all', async () => {
            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should fall through to automationInfoPopup when bonusExpression is unrecognized and no bonus exists', async () => {
            // Live-shaped by Lucky (target 'd20', no bonus) and Fearless Aim rows:
            // rows this router sends to the terminal builder. Fresh failed miss +
            // no bonus + unrecognized expression → automationInfoPopup, and the
            // numeric lane is never entered (description stays the action's own).
            mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false });

            const action = makeAction({
                automation: { bonusExpression: 'unknown_expression', bonus: undefined },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.name).toBe('Test Auto Reroll');
            expect(result.payload.automationType).toBe('auto_reroll');
            expect(result.payload.name).toBe('Test Auto Reroll');
            expect(result.payload.automationType).toBe('auto_reroll');
            expect(result.payload.description).toBe('Reroll ability.');
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should not let a saving throw enter the numeric-bonus lane', async () => {
            mockLastAttack({ rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    // ── Ally missed attack with range (main owns ally routing) ───

    describe('ally missed attack with range', () => {
        it('should apply bonus to ally missed attack within range and log the ally-routed ability_use', async () => {
            mockLastAttack({ rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false });

            const action = makeAction({
                automation: { bonus: 2, range: '30_ft' },
            });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            // Ally-routed ability_use log composition is owned by this lane
            // (attackRoll lane owns the own-attack string, miscPaths the guards).
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    abilityName: 'Test Auto Reroll',
                    targetName: 'Ally',
                    description: "TestHero used Test Auto Reroll: +2 to Ally's failed attack roll.",
                })
            );
        });

        it('should never consult range or boost an ally when no range is authored', async () => {
            mockLastAttack({ rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false });

            const result = await handle(makeAction(), makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('No recent failed attack roll or ability check');
            expect(isWithinRange).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    // ── Guarded Mind (target:'saving_throw' + override_fail_to_success + oncePer) ──

    describe('saving_throw with override_fail_to_success (Guarded Mind)', () => {
        const guardedAutomation = {
            target: 'saving_throw',
            effect: 'override_fail_to_success',
            oncePer: 'short_rest',
        };

        it('should override a failed save to SUCCESS, stamp the rest tracker, and log the override', async () => {
            mockLastAttack({ rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' });

            const action = makeAction({ automation: guardedAutomation });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                '<b>Test Auto Reroll</b><br/>WISDOM: d20(3) + 2 = 5 → <strong>SUCCESS (Guarded Mind)</strong>'
            );
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', '_guardedMind_usedRest', 'rest', 'campaign');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    description: 'TestHero used Test Auto Reroll to override a failed WISDOM save.',
                })
            );
        });

        it('should accept abbreviated save type (INT) and pin the abbreviated label', async () => {
            mockLastAttack({ rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'INT' });

            const action = makeAction({ automation: guardedAutomation });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toBe(
                '<b>Test Auto Reroll</b><br/>INT: d20(3) + 2 = 5 → <strong>SUCCESS (Guarded Mind)</strong>'
            );
        });

        it('should reject if already used this rest', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' };
                if (name === 'TestHero' && key === '_guardedMind_usedRest') return 'rest';
                return null;
            });

            const action = makeAction({ automation: guardedAutomation });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toBe('Test Auto Reroll can only be used once per Short or Long Rest.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should reject if save is not for the player', async () => {
            mockLastAttack({ rollType: 'save', targetName: 'OtherPlayer', d20: 3, bonus: 2, saveType: 'Wisdom' });

            const action = makeAction({ automation: guardedAutomation });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toBe(
                'No recent saving throw found for TestHero. This feature can only be used shortly after a saving throw.'
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should reject invalid save type (Strength)', async () => {
            mockLastAttack({ rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Strength' });

            const action = makeAction({ automation: guardedAutomation });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toBe(
                'Test Auto Reroll only works on Intelligence, Wisdom, or Charisma saving throws.'
            );
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should reject if lastAttack is not a save', async () => {
            // Router-level Guarded Mind guard: an attack-shaped lastAttack never reaches
            // the override even though it is a fresh own miss (miscPaths pins the
            // identical-message guard on handleSavingThrowReroll — different function).
            mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 8, bonus: 5, targetAc: 15, hit: false });

            const action = makeAction({ automation: guardedAutomation });
            const result = await handle(action, makePlayerStats(), 'campaign', 'map');

            expect(result.payload.description).toContain('No recent saving throw found');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });
    });

    // ── Saving-throw reroll lane resource-cost decrements (success side) ──
    // Refusals-at-zero are owned by miscPaths; the successful consumption
    // decrements are owned here (verified: no sibling asserts these writes).

    describe('saving_throw with resource cost', () => {
        it('should consume channel divinity charges on success', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' };
                if (name === 'TestHero' && key === 'channelDivinityCharges') return 2;
                return null;
            });

            const action = makeAction({
                automation: { bonus: undefined, target: 'saving_throw', resourceCost: 'channel_divinity' },
            });
            const stats = makePlayerStatsForLevel(5, { channel_divinity: 2 });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'channelDivinityCharges', 1, 'campaign');
            // Reroll-lane ability_use log string is owned here.
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    type: 'ability_use',
                    characterName: 'TestHero',
                    description: 'TestHero used Test Auto Reroll to reroll a saving throw.',
                })
            );
        });

        it('should consume focus points on success (Disciplined Survivor shape)', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'lastAttack') return { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' };
                if (name === 'TestHero' && key === 'focusPoints') return 3;
                return null;
            });

            const action = makeAction({
                automation: { bonus: undefined, target: 'saving_throw', resourceCost: 'focus_points' },
            });
            const stats = makePlayerStatsForLevel(1, { focus_points: 5 });
            const result = await handle(action, stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'focusPoints', 2, 'campaign');
        });
    });

    // ── Bardic inspiration die lane (Peerless Skill rows) ─────────

    describe('bardic_inspiration_die', () => {
        const bardicAction = () => makeAction({
            automation: { bonus: undefined, bonusExpression: 'bardic_inspiration_die' },
        });

        it('should roll bardic die and apply to own failed attack', async () => {
            mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false });

            const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 6 });
            const result = await handle(bardicAction(), stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('d20(5)');
            // Die roll itself is Math.random — pin only the deterministic composition.
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    biDieSize: 6,
                    characterName: 'TestHero',
                    description: expect.stringContaining('on attack: d20(5) + 5 = 10'),
                })
            );
        });

        it('should roll bardic die and apply to own failed ability check', async () => {
            mockLastAttack({ rollType: 'check', attackerName: 'TestHero', d20: 8, bonus: 3, checkName: 'Athletics' });

            const stats = makePlayerStatsForLevel(3, { bardic_inspiration_uses: 4, bardic_die: 6 });
            const result = await handle(bardicAction(), stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Athletics');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    biDieSize: 6,
                    description: expect.stringContaining('on Athletics: d20(8) + 3 = 11'),
                })
            );
        });

        it('should decrement bardic inspiration uses after applying', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false };
                if (name === 'TestHero' && key === 'bardicInspirationUses') return 3;
                return null;
            });

            const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 6 });
            await handle(bardicAction(), stats, 'campaign', 'map');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'bardicInspirationUses', 2, 'campaign');
        });

        it('should return info when bardic inspiration has no uses remaining', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false };
                if (name === 'TestHero' && key === 'bardicInspirationUses') return 0;
                return null;
            });

            const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 6 });
            const result = await handle(bardicAction(), stats, 'campaign', 'map');

            expect(result.payload.description).toBe('Test Auto Reroll has no uses remaining. Recharges on a Long Rest.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('should use usesMax as default when bardicInspirationUses runtime value is null', async () => {
            mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false });

            const stats = makePlayerStatsForLevel(2, { bardic_inspiration_uses: 3, bardic_die: 6 });
            const result = await handle(bardicAction(), stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('d20(5)');
            // currentUses defaulted from usesMax (3) — the write proves the ?? fallback.
            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'bardicInspirationUses', 2, 'campaign');
        });

        it('should skip the bardic lane when bardic_die is 0 and route to the terminal popup', async () => {
            // Distinct from miscPaths' class:null guard pin: here class_levels exist but
            // bardic_die resolves 0, so the router's `bardicDieSize > 0` gate must skip
            // the lane — with no numeric bonus the row lands on automationInfoPopup.
            mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false });

            const stats = makePlayerStatsForLevel(1, { bardic_inspiration_uses: 3, bardic_die: 0 });
            const result = await handle(bardicAction(), stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.type).toBe('automation_info');
            expect(result.payload.description).toBe('Reroll ability.');
            expect(getRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'bardicInspirationUses');
            expect(setRuntimeValue).not.toHaveBeenCalled();
        });
    });

    // ── Generic psionic_energy_die lane ───────────────────────────
    // Homing gates live in soul-blades.test.js; the zero-pool check and the
    // _trackedResources default run BEFORE the homing dispatch and are owned here.

    describe('psionic_energy_die (generic path)', () => {
        const psionicAction = () => makeAction({
            automation: { bonus: undefined, bonusExpression: 'psionic_energy_die' },
        });

        it('should use psionic energy die on own failed attack, preferring _trackedResources max', async () => {
            mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);

            const stats = makePlayerStats({ level: 1, _trackedResources: { psionicEnergy: { max: 8 } } });
            const result = await handle(psionicAction(), stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('d20(5)');
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    characterName: 'TestHero',
                    description: expect.stringMatching(/Psionic Energy Die: 1d6 \(\d\)\. Psionic Energy: 7\/8\./),
                })
            );
        });

        it('should use psionic energy die on own failed ability check', async () => {
            mockLastAttack({ rollType: 'check', attackerName: 'TestHero', d20: 8, bonus: 3, checkName: 'Perception' });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);

            const stats = makePlayerStats({ level: 1, _trackedResources: { psionicEnergy: { max: 4 } } });
            const result = await handle(psionicAction(), stats, 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('Perception');
            // Pins the _trackedResources.max read on the check leg too.
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    description: expect.stringContaining('Psionic Energy: 3/4'),
                })
            );
        });

        it('should decrement psionic energy after applying', async () => {
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false };
                if (name === 'TestHero' && key === 'psionicEnergy') return 4;
                return null;
            });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);

            await handle(psionicAction(), makePlayerStats({ level: 1, _trackedResources: { psionicEnergy: { max: 6 } } }), 'campaign', 'map');

            expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'psionicEnergy', 3, 'campaign');
        });

        it('should reject at zero pool BEFORE homing dispatch even on a valid psychic-blade miss', async () => {
            // Ordering contract soul-blades.test.js defers to this lane: the zero-pool
            // check sits above the psychic_blade_miss dispatch, so a fully homing-valid
            // miss still refuses with the pool message, never a homing refusal.
            getRuntimeValue.mockImplementation((name, key) => {
                if (key === 'lastAttack') return { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false, isPsychicBlade: true };
                if (name === 'TestHero' && key === 'psionicEnergy') return 0;
                return null;
            });

            const action = makeAction({
                automation: {
                    bonus: undefined,
                    bonusExpression: 'psionic_energy_die',
                    trigger: 'psychic_blade_miss',
                    condition: 'psychic_blade_miss',
                },
            });
            const result = await handle(action, makePlayerStats({ level: 1 }), 'campaign', 'map');

            expect(result.payload.description).toBe('Test Auto Reroll: No Psionic Energy remaining. Recharges on a Short or Long Rest.');
            expect(setRuntimeValue).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
            expect(evaluateAutoExpression).not.toHaveBeenCalled();
        });

        it('should default to 6 psionic energy when _trackedResources is missing', async () => {
            mockLastAttack({ rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false });
            vi.mocked(evaluateAutoExpression).mockReturnValue(6);

            const result = await handle(psionicAction(), makePlayerStats({ level: 1 }), 'campaign', 'map');

            expect(result.type).toBe('popup');
            expect(result.payload.description).toContain('d20(5)');
            // The log denominators pin the `|| 6` defaultMax (vs max-8 tracked above).
            expect(addEntry).toHaveBeenCalledWith(
                'campaign',
                expect.objectContaining({
                    description: expect.stringContaining('Psionic Energy: 5/6'),
                })
            );
        });
    });
});
