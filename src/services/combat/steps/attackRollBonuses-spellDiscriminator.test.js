// @maintained-by-ai
// SP-112 lane: owns ONLY the spell/weapon DISCRIMINATOR of buildWeaponHitBonusesStep —
// isSpellAttackContext (attackRollBonuses.js:313-319). Consulted bytes census (#967):
// ctx.autoDamageSchool || attack.weaponType==='spell' || attack.attackType==='spell' ||
// attack.school || attack.isWeaponAttack===false; true ⇒ early-return { data: pass-through }
// BEFORE collectWeaponHitBonuses / getCurrentCombatRound / rollExpression / any stamp.
// The bug: a Spiritual Weapon SPELL attack collected the weapon-only Divine Strike rider
// (stray "+2d8 [radiant]" on force damage) and opened the damage-type modal.
//
// Rider-family split (#1022/#1023/#1024 cites):
//   #1022 brutalStrike        — exact-byte te application + guard-fold cites
//   #1023 cla048-celestial    — resolve-first falsifier, disk-lock, negative-pinned absences
//   #1024 lunarForm           — round-re-arm falsifier (the ONLY family lane with
//                                storedRound !== round); its distinct face PRESERVED — this
//                                file never pins round bytes, only spell/weapon routing
//   #936  automationBonuses/natural20 fold — CANON for this same step (steps[12],
//         attackRollDamageSteps.js:21): oncePerTurn same-round skip, uses-depleted,
//         option-skip, upgraded-suppress, ' or ' modal-on-weapon fire, usedRound stamp
//         call, both-trigger acceptance, condition — never re-driven here.
//
// This lane: discrimination pairs with byte-distinct legs (#842) — armed/unarmed weapon
// legs fire with hand-derived exact bytes (#815, #903/#932), each of the five
// single-flag spell disjuncts routes to exact pass-through bytes in isolation, and a
// co-located spell-flavoured near-miss trigger rider must not discriminate-through on a
// WEAPON leg (#948). RNG stubbed exact (#872); no wall-clock (#app); full-object pins
// (#1007); collaborator call-bytes pinned once (#786); honest titles (#910).
//
// old->new map: old t1 (weapon control, modal toBeTruthy) → folded — modal-fire on a
// weapon ' or ' rider is CANON at attackRollDamageSteps-automationBonuses.test.js:278;
// the weapon leg here strengthened to exact appended bytes with a single-damage-type
// rider. Old t2 (autoDamageSchool) + old t3 (4-variant loop, two flags co-flagged) →
// consolidated into t2 as five SINGLE-flag isolated legs, strengthened to full-object
// pass-through pins + zero-call pins. Added: t1 unarmed leg (#903/#932), t3 near-miss
// falsifier (#948).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildWeaponHitBonusesStep } from './attackRollBonuses.js';

vi.mock('../../dice/diceRoller.js', () => ({
    rollExpression: vi.fn(() => ({ total: 8, rolls: [5, 3], modifier: 0 })),
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

// The weapon-only rider under discrimination. Single damage type on purpose: the
// ' or ' modal-on-weapon leg is CANON in the automationBonuses fold (#936); this
// lane pins the appended BYTES, so oncePerTurn stays only to keep the
// '_Divine_Strike_usedRound' absence pins meaningful.
const divineStrike = {
    name: 'Divine Strike',
    type: 'damage_bonus',
    trigger: 'weapon_attack_hit',
    damageExpression: '2d8',
    damageType: 'Radiant',
    oncePerTurn: true,
};

function makeCtx(overrides = {}) {
    return {
        campaignName: 'test-campaign',
        playerStats: {
            name: 'Divine_Cleric',
            automation: { actions: [divineStrike], passives: [] },
        },
        attack: { name: 'Mace', weaponType: 'weapon', damageType: 'Bludgeoning' },
        formula: '1d8 + 3',
        total: 7,
        rolls: [4],
        ...overrides,
    };
}

function weaponOnlyActions(extra = []) {
    return {
        playerStats: {
            name: 'Divine_Cleric',
            automation: { actions: [divineStrike, ...extra], passives: [] },
        },
    };
}

describe('SP-112: weaponHitBonuses spell/weapon discriminator (isSpellAttackContext)', () => {
    let step;

    beforeEach(() => {
        vi.clearAllMocks();
        step = buildWeaponHitBonusesStep();
        // Faithful keyed store: nothing chosen, nothing spent, round 1.
        getRuntimeValue.mockImplementation(() => null);
        getCurrentCombatRound.mockReturnValue(1);
    });

    it('fires the rider with exact appended bytes on WEAPON legs — armed mace and unarmed strike (#903/#932)', async () => {
        // Hand-derived once (#815): mock roll = {total:8, rolls:[5,3]};
        // append = ' + 2d8 [radiant]' (damageType lowercased).
        const legs = [
            { ctx: makeCtx(), expected: { formula: '1d8 + 3 + 2d8 [radiant]', total: 15, rolls: [4, 5, 3] } },
            { ctx: makeCtx({ attack: { name: 'Unarmed Strike', weaponType: 'unarmed', damageType: 'Bludgeoning' }, formula: '1d4 + 5', total: 8, rolls: [3] }), expected: { formula: '1d4 + 5 + 2d8 [radiant]', total: 16, rolls: [3, 5, 3] } },
        ];
        for (const { ctx, expected } of legs) {
            vi.clearAllMocks();
            getRuntimeValue.mockImplementation(() => null);
            const result = await step.handler(ctx);
            // Full-object pin (#1007): no modal key, exact acc bytes.
            expect(result, ctx.attack.name).toEqual({ data: expected });
            // The rider rolls exactly once, on its own expression (#786).
            expect(rollExpression, ctx.attack.name).toHaveBeenCalledTimes(1);
            expect(rollExpression, ctx.attack.name).toHaveBeenCalledWith('2d8');
        }
        // This step never logs — weapon riders' log lane lives elsewhere.
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('routes a SPELL attack to exact pass-through bytes via each of its five flags, in isolation', async () => {
        const spellAttack = { name: 'Spiritual Weapon', damageType: 'Force' };
        const base = { formula: '1d8 + 3', total: 7, rolls: [4] };
        const variants = [
            { label: 'ctx.autoDamageSchool', ctx: { autoDamageSchool: 'Evocation', attack: spellAttack } },
            { label: 'attack.attackType spell', ctx: { attack: { ...spellAttack, attackType: 'spell' } } },
            { label: 'attack.weaponType spell', ctx: { attack: { ...spellAttack, weaponType: 'spell' } } },
            { label: 'attack.school', ctx: { attack: { ...spellAttack, school: 'Evocation' } } },
            { label: 'attack.isWeaponAttack false', ctx: { attack: { ...spellAttack, isWeaponAttack: false } } },
        ];
        for (const { label, ctx } of variants) {
            vi.clearAllMocks();
            getRuntimeValue.mockImplementation(() => null);
            const result = await step.handler(makeCtx(ctx));
            // No rider appended, no modal opened — byte-exact pass-through.
            expect(result, label).toEqual({ data: base });
            // Discriminated BEFORE any collection/round/stamp work: zero dice,
            // zero store writes (no '_Divine_Strike_usedRound' stamp possible),
            // zero round fetches, zero logs.
            expect(rollExpression, label).not.toHaveBeenCalled();
            expect(setRuntimeValue, label).not.toHaveBeenCalled();
            expect(getCurrentCombatRound, label).not.toHaveBeenCalled();
            expect(addEntry, label).not.toHaveBeenCalled();
        }
    });

    it('does not let a spell-flavoured near-miss trigger rider discriminate through on a WEAPON leg (#948)', async () => {
        // 'spell_attack_hit' near-misses the collected 'weapon_attack_hit' by shape
        // and carries a spell flavour + distinguishable 4d6 [force] — its bytes must
        // never ride into the output, even when the attack is genuinely armed.
        const spellFlavoured = {
            name: 'Spiritual Blessing',
            type: 'damage_bonus',
            trigger: 'spell_attack_hit',
            damageExpression: '4d6',
            damageType: 'Force',
        };
        const ctx = makeCtx(weaponOnlyActions([spellFlavoured]));

        const result = await step.handler(ctx);

        expect(result).toEqual({ data: { formula: '1d8 + 3 + 2d8 [radiant]', total: 15, rolls: [4, 5, 3] } });
        expect(rollExpression).toHaveBeenCalledTimes(1);
        expect(rollExpression).toHaveBeenCalledWith('2d8');
    });
});
