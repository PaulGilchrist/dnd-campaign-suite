// @maintained-by-ai
// CLA-217 lane: owns attackRollBonuses.js buildWeaponHitBonusesStep's ROUND PLUMBING for
// the Lunar Form rider — the bug itself: the once-per-turn gate called getCurrentCombatRound()
// WITHOUT campaignName, combatData returned null, the round resolved to a permanently-stale
// constant 1, and the _Lunar_Form_usedRound stamp (written 1 forever) suppressed the
// 2d10 Radiant bonus for the rest of the page session. No sibling can catch this: every
// round in the automationBonuses fold is mocked to 1, so a stale-constant round is
// byte-identical there. This lane's falsifier is DISTINCT round bytes — round 2 vs the
// stale 1 — in fetch, gate-read, formula and stamp call bytes.
//
// combatData mock-path note: attackRollBonuses.js imports '../../../encounters/combatData.js'
// = src/encounters/combatData.js, a shim `export * from '../services/encounters/combatData.js'`.
// The mock below targets the REAL module (src/services/encounters/) directly; it reaches the
// step through the shim's live binding.
//
// steps/ rider-family split (#1022/#1023 cites): weaponHitBonuses generic guards
// (oncePerTurn same-round skip, uses-depleted, option-skip, upgraded-suppress, ' or ' modal,
// usedRound stamp, both-trigger acceptance, condition) are CANON in
// attackRollDamageSteps-automationBonuses.test.js on steps[12] (attackRollDamageSteps.js:21)
// — never re-driven here (#936). Spell-attack discriminator is CANON in
// attackRollBonuses-spellDiscriminator.test.js. brutalStrike application #1022;
// celestial resolve-first #1023. This file's unique lane = the round-re-arm falsifier (the
// only lane in the family with storedRound !== round) + the exact-byte application leg of
// the REAL Lunar Form rider + disk data lock of its classes.json authoring.
//
// Applied recs: toContain→exact bytes (#995); full-acc pins hand-derived, never a loop
// oracle (#829/#710); collaborator call-bytes exact once (#786); campaign-keyed stores
// (#1021); RNG stubbed exact, range-only banned (#973/#872); no wall-clock, no timers
// (#app); negative-pinned absence of te/log/modal where by-design; honest titles (#910);
// this step never logs (weapon riders' log lane is elsewhere) — negative-pinned in t1.
//
// old->new map: old t1 (campaignName call-bytes alone) folded into t1; old t2 (first-hit
// apply+stamp, toBe formula) → t1 strengthened to exact acc + single-stamp pins; old t3
// (re-arm, toContain) → t2 strengthened to exact acc; old t4 (same-round suppress) →
// dropped, folded into attackRollDamageSteps-automationBonuses.test.js
// 'skips oncePerTurn when already used' (same weaponHitBonusSpent guard, :281).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildWeaponHitBonusesStep } from './attackRollBonuses.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 14, rolls: [6, 8], modifier: 0 })),
}));
vi.mock('../../encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
}));
vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../combat/automation/automationService.js', () => ({
    evaluateAutoExpression: vi.fn(() => null),
}));
vi.mock('../../automation/common/buffToggle.js', () => ({
    getActiveBuffs: vi.fn(() => []),
}));
vi.mock('../automation/automationExpressions.js', () => ({
    resolveDiceExpression: vi.fn((expr) => expr),
}));
vi.mock('../../ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve({})),
}));

import { rollExpression } from '../../dice/diceRoller.js';
import { getCurrentCombatRound } from '../../encounters/combatData.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../ui/logService.js';

// The real Lunar Form rider (Moon Druid lv14, 2024) — same shape the classes.json
// data-lock below pins verbatim from disk. 2d10 [radiant] is distinguishable from the
// 1d4-1 weapon base, so selection bytes are unambiguous (#1022 lesson).
const lunarBonus = {
    name: 'Lunar Form',
    type: 'damage_bonus',
    trigger: 'weapon_or_beast_form_attack_hit',
    damageExpression: '2d10',
    damageType: 'Radiant',
    oncePerTurn: true,
};

function makeCtx(overrides = {}) {
    return {
        campaignName: 'test-campaign',
        playerStats: {
            name: 'Wild_Sage_Druid',
            automation: { actions: [lunarBonus], passives: [] },
        },
        formula: '1d4-1',
        total: 0,
        rolls: [1],
        ...overrides,
    };
}

describe('CLA-217: weaponHitBonuses round plumbing for Lunar Form', () => {
    let step;

    beforeEach(() => {
        vi.clearAllMocks();
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockReturnValue(null);
        step = buildWeaponHitBonusesStep();
    });

    it('fresh turn, round 2: rolls 2d10 once, appends exact bytes, fetches and stamps round 2 campaign-scoped — no modal, no log, no targetEffects', async () => {
        const ctx = makeCtx();
        const result = await step.handler(ctx);

        // Round fetched WITH campaignName exactly once — the CLA-217 crux (no-arg call
        // resolved to stale constant 1). Gate read uses the campaign-keyed store too.
        expect(getCurrentCombatRound).toHaveBeenCalledTimes(1);
        expect(getCurrentCombatRound).toHaveBeenCalledWith('test-campaign');
        expect(getRuntimeValue).toHaveBeenCalledWith(
            'Wild_Sage_Druid', '_Lunar_Form_usedRound', 'test-campaign',
        );

        // Dice consulted exactly once, exact expression byte; hand-derived acc (#829):
        // '1d4-1' + ' + 2d10 [radiant]', stubbed roll 14 → total 14, rolls [1]+[6,8].
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('2d10');
        expect(result.data).toEqual({
            formula: '1d4-1 + 2d10 [radiant]',
            total: 14,
            rolls: [1, 6, 8],
        });
        expect(result.modal).toBeUndefined();

        // Single sticky write: the ACTUAL round (2), not the stale constant — pre-fix
        // this stamped 1 forever. Exactly one runtime write, so no targetEffects spill.
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Wild_Sage_Druid', '_Lunar_Form_usedRound', 2, 'test-campaign',
        );

        // This step never logs (weapon-rider log lane is elsewhere) — negative-pinned.
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('re-arms on a later round: stale usedRound 1 (pre-fix constant) does not suppress a round-2 hit', async () => {
        // The regression falsifier: pre-fix the gate compared stored 1 against the
        // stale fetched round 1 → suppressed forever. Distinct bytes (stored 1,
        // fetched 2) make this leg fail loudly on any revert.
        getRuntimeValue.mockImplementation((_key, prop) =>
            prop === '_Lunar_Form_usedRound' ? 1 : null);

        const ctx = makeCtx();
        const result = await step.handler(ctx);

        expect(result.data).toEqual({
            formula: '1d4-1 + 2d10 [radiant]',
            total: 14,
            rolls: [1, 6, 8],
        });
        expect(setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(setRuntimeValue).toHaveBeenCalledWith(
            'Wild_Sage_Druid', '_Lunar_Form_usedRound', 2, 'test-campaign',
        );
    });
});

describe('CLA-217 classes.json data lock — Lunar Form authoring', () => {
    const data = JSON.parse(readFileSync(resolve(__dirname, '../../../../public/data/2024/classes.json'), 'utf8'));

    function findLunarForm(node) {
        if (Array.isArray(node)) {
            for (const item of node) {
                const hit = findLunarForm(item);
                if (hit) return hit;
            }
            return null;
        }
        if (node && typeof node === 'object') {
            if (node.name === 'Lunar Form' && Array.isArray(node.automation)) return node;
            for (const value of Object.values(node)) {
                const hit = findLunarForm(value);
                if (hit) return hit;
            }
        }
        return null;
    }

    it('carries the exact 2d10 Radiant once-per-turn weapon_or_beast_form rider bytes this step consumes', () => {
        const lunar = findLunarForm(data);
        expect(lunar.level).toBe(14);

        // Verbatim disk bytes. The entry has NO name field — the character loader
        // stamps the feature name onto the action, and the application lane above
        // pins the derived '_Lunar_Form_usedRound' key bytes. 'oncePerTurn' true is
        // the CLA-217 gate source; trigger must stay exactly this byte for the
        // collectWeaponHitBonuses filter (attackRollBonuses.js:326).
        expect(lunar.automation).toEqual([
            { type: 'damage_bonus', damageExpression: '2d10', damageType: 'Radiant', trigger: 'weapon_or_beast_form_attack_hit', oncePerTurn: true, upgrades: 'Improved Circle Forms', casting_time: 'passive' },
            { type: 'moonlight_step_rider', casting_time: 'passive' },
        ]);
    });
});
