// @maintained-by-ai
// autoRerollHandler — misc-paths lane: handleAbilityCheck / handleSaveRoll popup
// composition, consumeResourceCost gating (refusals + max fallbacks),
// findAllyMissedAttack internals, getBardicDieSize guard, bardic not-fresh refusal.
//
// Seam map for the autoRerollHandler.test.js quint:
//   autoRerollHandler.test.js             — router dispatch, Guarded Mind, resource costs,
//                                           bardic/psionic die lanes, ally-range routing
//   autoRerollHandler.attackRoll.test.js  — handleAttackRoll popup description full-string
//                                           composition + rerollAttackLeg delegation
//                                           (exactly-once miss→hit damage)
//   autoRerollHandler.damagePaths.test.js — applyMissTurnedHitDamage payload content
//   autoRerollHandler.miscPaths.test.js (this file) — handleAbilityCheck / handleSaveRoll
//                                           composition, consumeResourceCost internals,
//                                           findAllyMissedAttack guard ordering,
//                                           getBardicDieSize guard, bardic not-fresh refusal
//   autoRerollHandler.soul-blades.test.js — Homing Strikes (CLA-320) gates and economy
//
// Production traffic (verified against public/data JSON):
//   - saving_throw reroll lane: Indomitable / Fanatical Focus / Disciplined Survivor
//     (2024/classes.json) → handleSavingThrowReroll → consumeResourceCost → handleSaveRoll.
//   - numeric lane: Guided Strike (bonus 10 + channel_divinity + range) → consume first,
//     findAllyMissedAttack for the ally leg.
//   - bardic lane: Peerless Skill → getBardicDieSize / handleBardicInspiration refusal.
//   - rollType 'skill' check events come from the live skill-popup producers.
//
// Honest gaps (do NOT re-add tests for these — they are unreachable via handle()):
//   - handleAbilityCheck/handleSaveRoll own "No recent ... found" early returns: every
//     router caller guards freshness/isSave BEFORE calling, so those branches are dead.
//   - handleGuardedMind branch here is legacy: the authored Guarded Mind row
//     (2024/feats.json) carries no target:'saving_throw' and runs via SavePromptModal
//     (findGuardedMindAction). Guarded Mind tests live in the main lane only.
//
// Deterministic by construction: fixed authored numbers, mocked dice; the one Math.random
// consumption (bardic die) is value-independent of every assertion below.
// Turn-based only: no game timers.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { handle } from './autoRerollHandler.js';

// Re-import after mocking
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { isWithinRange } from '../../../rules/combat/rangeCheck.js';
import { rollExpression } from '../../../dice/diceRoller.js';
import { applyDamageToTarget } from '../../../rules/combat/applyDamage.js';
import { getClassFeatures } from '../../../../services/character/classFeatures.js';

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

vi.mock('../../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(),
}));

vi.mock('../../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/applyDamage.js', () => ({
    applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

const CAMPAIGN = 'test-campaign';

function makeAction(overrides = {}) {
    return {
        name: 'Test Auto Reroll',
        description: 'Reroll ability.',
        automation: {
            type: 'auto_reroll',
            bonus: 2,
            ...overrides.automation,
        },
        ...overrides,
    };
}

function makePlayerStats(overrides = {}) {
    return {
        name: 'TestHero',
        proficiency: 3,
        class: { class_levels: [{ level: 1 }] },
        level: 1,
        resources: {},
        ...overrides,
    };
}

// Seed the runtime mock: lastAttack plus any '<name>.<key>' pairs.
function mockRuntime({ lastAttack = null, ...rest } = {}) {
    getRuntimeValue.mockImplementation((name, key) => {
        if (name === 'campaign' && key === 'lastAttack') return lastAttack;
        return rest[`${name}.${key}`] ?? null;
    });
}

describe('autoRerollHandler - handleSaveRoll composition + reroll-lane guards (Indomitable-shaped live row)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    it('pins the full handleSaveRoll popup for a named save, free reroll (no runtime writes)', async () => {
        // Indomitable / Fanatical Focus rows: target saving_throw, no resourceCost →
        // handleSavingThrowReroll hardcodes bonus 0 into handleSaveRoll.
        mockRuntime({ lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Wisdom' } });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', trigger: 'failed_saving_throw' },
        });
        const result = await handle(action, makePlayerStats(), CAMPAIGN, 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Test Auto Reroll');
        expect(result.payload.description).toBe(
            '<b>Test Auto Reroll</b><br/>' +
            'Bonus: +0<br/>' +
            'WISDOM: d20(3) + 2 = 5 → Modified: d20(3) + 2 = <b>5</b>'
        );
        // No resource cost on this row: the lane must touch nothing.
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(getCombatContext).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('falls back to the generic "Save" label when saveType is null', async () => {
        mockRuntime({ lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 8, bonus: 2, saveType: null } });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', trigger: 'failed_saving_throw' },
        });
        const result = await handle(action, makePlayerStats(), CAMPAIGN, 'map');

        expect(result.payload.description).toBe(
            '<b>Test Auto Reroll</b><br/>' +
            'Bonus: +0<br/>' +
            'Save: d20(8) + 2 = 10 → Modified: d20(8) + 2 = <b>10</b>'
        );
    });

    it('reroll lane refuses a non-save lastAttack (distinct from the main lane Guarded Mind guard)', async () => {
        // No effect/oncePer on this row, so this dispatches through
        // handleSavingThrowReroll — not handleGuardedMind (main lane owns that guard).
        mockRuntime({ lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false } });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', trigger: 'failed_saving_throw' },
        });
        const result = await handle(action, makePlayerStats(), CAMPAIGN, 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            'No recent saving throw found for TestHero. This feature can only be used shortly after a saving throw.'
        );
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('reroll lane refuses a save that belongs to another creature', async () => {
        mockRuntime({ lastAttack: { rollType: 'save', targetName: 'OtherPlayer', d20: 3, bonus: 2, saveType: 'Wisdom' } });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', trigger: 'failed_saving_throw' },
        });
        const result = await handle(action, makePlayerStats(), CAMPAIGN, 'map');

        expect(result.payload.description).toBe(
            'No recent saving throw found for TestHero. This feature can only be used shortly after a saving throw.'
        );
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});

describe('autoRerollHandler - consumeResourceCost internals (Disciplined Survivor / Guided Strike rows)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    it('refuses focus_points at zero with the exact popup and no writes or logs', async () => {
        // Disciplined Survivor row: target saving_throw + resourceCost focus_points.
        mockRuntime({
            lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' },
            'TestHero.focusPoints': 0,
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', resourceCost: 'focus_points', trigger: 'failed_saving_throw' },
        });
        const stats = makePlayerStats({ class: { class_levels: [{ level: 1, focus_points: 5 }] } });
        const result = await handle(action, stats, CAMPAIGN, 'map');

        // consume* refusals title the popup with the player name, not the action name.
        expect(result.payload.name).toBe('TestHero');
        expect(result.payload.description).toBe('No Focus Points remaining.');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('derives maxFocusPoints from getClassFeatures when class_levels omits focus_points and nothing is stored', async () => {
        // Runtime empty: maxFocus falls back to getClassFeatures(stats).maxFocusPoints (3),
        // so the consumption write must be 3 - 1 = 2. Without the fallback current is 0
        // and the lane refuses — this pins the fallback, not just its invocation.
        vi.mocked(getClassFeatures).mockReturnValue({ maxFocusPoints: 3 });
        mockRuntime({ lastAttack: { rollType: 'save', targetName: 'TestHero', d20: 3, bonus: 2, saveType: 'Intelligence' } });

        const action = makeAction({
            automation: { type: 'auto_reroll', target: 'saving_throw', resourceCost: 'focus_points', trigger: 'failed_saving_throw' },
        });
        const stats = makePlayerStats({ class: { class_levels: [{ level: 1 }] } });
        const result = await handle(action, stats, CAMPAIGN, 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toContain('INTELLIGENCE: d20(3) + 2 = 5');
        expect(getClassFeatures).toHaveBeenCalledWith(stats);
        expect(setRuntimeValue).toHaveBeenCalledWith('TestHero', 'focusPoints', 2, CAMPAIGN);
    });

    it('consults channel_divinity before the reroll seam and refuses at zero (Guided Strike shape)', async () => {
        // Guided Strike row: numeric bonus + channel_divinity (+range in prod).
        // The miss is own and fresh — the resource gate must refuse anyway,
        // proving consumeResourceCost is consulted before any reroll work.
        mockRuntime({
            lastAttack: { rollType: 'attack', attackerName: 'TestHero', d20: 5, bonus: 5, targetAc: 15, hit: false },
            'TestHero.channelDivinityCharges': 0,
        });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: 10, resourceCost: 'channel_divinity', trigger: 'missed_attack_roll' },
        });
        const result = await handle(action, makePlayerStats(), CAMPAIGN, 'map');

        expect(result.payload.name).toBe('TestHero');
        expect(result.payload.description).toBe('No Channel Divinity charges remaining.');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
        expect(rollExpression).not.toHaveBeenCalled();
        expect(getCombatContext).not.toHaveBeenCalled();
    });
});

describe('autoRerollHandler - handleAbilityCheck composition (numeric-bonus lane)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    it('pins the full check popup and the own-failed-check ability_use log', async () => {
        mockRuntime({ lastAttack: { rollType: 'check', attackerName: 'TestHero', d20: 12, bonus: 3, checkName: 'Stealth' } });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(
            '<b>Test Auto Reroll</b><br/>' +
            'Bonus: +2<br/>' +
            'Stealth: d20(12) + 3 = 15 → Modified: d20(14) + 3 = <b>17</b>'
        );
        // Own failed-check log string is owned by this lane (attackRoll lane owns
        // the own-attack string; main pins only a substring).
        expect(addEntry).toHaveBeenCalledWith(
            CAMPAIGN,
            expect.objectContaining({
                type: 'ability_use',
                characterName: 'TestHero',
                abilityName: 'Test Auto Reroll',
                description: 'TestHero used Test Auto Reroll: +2 to own failed ability check.',
            })
        );
    });

    it('accepts rollType "skill" check events through the same composition', async () => {
        // Live skill-popup producers emit rollType:'skill' events (see CharSheet handlers).
        mockRuntime({ lastAttack: { rollType: 'skill', attackerName: 'TestHero', d20: 4, bonus: 5, checkName: "Thieves' Tools" } });

        const result = await handle(makeAction(), makePlayerStats(), CAMPAIGN, 'map');

        expect(result.payload.description).toBe(
            '<b>Test Auto Reroll</b><br/>' +
            'Bonus: +2<br/>' +
            "Thieves' Tools: d20(4) + 5 = 9 → Modified: d20(6) + 5 = <b>11</b>"
        );
    });
});

describe('autoRerollHandler - findAllyMissedAttack guard ordering (ranged row)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    const rangedAction = () => makeAction({ automation: { type: 'auto_reroll', bonus: 5, range: '30_ft' } });
    const fallbackPopupText = 'No recent failed attack roll or ability check found for you or any ally within range.';

    it('short-circuits on null lastAttack before any range check', async () => {
        mockRuntime({ lastAttack: null });

        const result = await handle(rangedAction(), makePlayerStats(), CAMPAIGN, 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.description).toBe(fallbackPopupText);
        expect(isWithinRange).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('rejects a hit ally attack by guard — range is never consulted', async () => {
        mockRuntime({ lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 18, bonus: 5, targetAc: 15, hit: true } });

        const result = await handle(rangedAction(), makePlayerStats(), CAMPAIGN, 'map');

        expect(result.payload.description).toBe(fallbackPopupText);
        expect(isWithinRange).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('delegates to isWithinRange with exact args and falls back when out of range', async () => {
        vi.mocked(isWithinRange).mockResolvedValueOnce(false);
        mockRuntime({ lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 3, bonus: 5, targetAc: 15, hit: false } });

        const result = await handle(rangedAction(), makePlayerStats(), CAMPAIGN, 'map');

        expect(result.payload.description).toBe(fallbackPopupText);
        expect(isWithinRange).toHaveBeenCalledWith('TestHero', 'Ally', 30);
        expect(addEntry).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });
});

describe('autoRerollHandler - getBardicDieSize guard + bardic not-fresh refusal (Peerless Skill row)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRuntime();
    });

    it('skips the bardic lane entirely when the character has no class_levels', async () => {
        // Distinct from the main lane's bardic_die:0 test: this pins the
        // !class?.class_levels guard, then the router fallthrough to automationInfoPopup.
        mockRuntime({ lastAttack: null });

        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: undefined, bonusExpression: 'bardic_inspiration_die', trigger: 'failed_ability_check_or_attack_roll' },
        });
        const result = await handle(action, makePlayerStats({ class: null }), CAMPAIGN, 'map');

        expect(result.type).toBe('popup');
        expect(result.payload.type).toBe('automation_info');
        expect(result.payload.name).toBe('Test Auto Reroll');
        expect(result.payload.automationType).toBe('auto_reroll');
        expect(result.payload.description).toBe('Reroll ability.');
        // The bardic handler must never have been entered.
        expect(getRuntimeValue).not.toHaveBeenCalledWith('TestHero', 'bardicInspirationUses');
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('refuses bardic inspiration when the last roll is not the player\'s failed roll — no expends, no log', async () => {
        mockRuntime({ lastAttack: { rollType: 'attack', attackerName: 'Ally', d20: 5, bonus: 5, targetAc: 15, hit: false } });

        const stats = makePlayerStats({ class: { class_levels: [{ level: 1, bardic_inspiration_uses: 3, bardic_die: 6 }] } });
        const action = makeAction({
            automation: { type: 'auto_reroll', bonus: undefined, bonusExpression: 'bardic_inspiration_die', trigger: 'failed_ability_check_or_attack_roll' },
        });
        const result = await handle(action, stats, CAMPAIGN, 'map');

        expect(result.payload.description).toBe(
            'No recent failed ability check or attack roll found. Test Auto Reroll can only be used shortly after a failure.'
        );
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});
