// @improved-by-ai
// MA-1578: Tarrasque "Swallow" (save, DC 20 Constitution) — FAIL: the fail face paid
// NOTHING (no 8d6+6 Bludgeoning), the popup showed "DC Unknown", and no conditions landed.
// The dice lived ONLY in save_effect prose and every structured key was absent, so
// saveChipPlan.formula was null → the raw d20 save popup rendered DiceRollResult.jsx
// showDcUnknown ("DC Unknown — no success or failure"), applySaveOutcome's damage gate
// (context.autoDamageFormula && saveDc != null) never fired → applySaveDamage skipped,
// and extractConditionsFromSaveEffect harvested [] (applyDamagelessSaveConditions early-
// returned) → zero swallowed-state delta.
//
// DATA fix rides the LIVE MA-1563 save-damage seam (parseSaveDamageFields + saveChipPlan +
// resolveSaveLegDamageFields in MonsterCardModal) — the exact swarm-of-poisonous-snakes
// key layout (save_dc → save_damage_dice → save_damage_type → save_type → save_effect):
//   save_damage_dice:"8d6 + 6" + save_damage_type:"Bludgeoning" arm a rollable save chip
//     (canRollExpression handles the "+ N" modifier exactly like every base formula "1d8 + 4")
//     → resolveSaveLegDamageFields overrides autoDamageFormula/autoDamageDamageType on the
//     SAVE transport → saveProcessing.applySaveDamage rolls 8d6+6 verbatim on a fail,
//     re-setting the popup via buildSaveDamagePopupData(saveDc:20) → "DC Unknown" gone.
//   save_effect gains canonical words Blinded/Prone/Restrained → extractConditionsFromSaveEffect
//     harvests [blinded,prone,restrained] → applyFailedSaveConditions grants all three + the
//     condition-applied log (MA-1546 charmed-floor precedent). Ungated harvest (playbook §1105)
//     is RAW-CORRECT HERE: every failed save = swallowed = blinded + restrained + prone.
//
// ADVISORY RESIDUAL — FULL RAW STATE MACHINE IS NOT IN SCOPE (zero consumers, prose-only):
//   • 16d6 acid EOT tick while swallowed — no swallowed-state turn-end tick consumer (§87/§70).
//   • 60-damage regurgitation gate + "fall prone within 10 feet" — no regurgitate consumer.
//   • grapple prerequisite / bite-hit gate / "can't bite another target" — §59 grapple machine
//     absent; the Swallow row has NO target_prerequisite/hit_conditions authored BY DESIGN.
//   This ticket arms ONLY the fail-face damage + swallowed-conditions harvest lanes; the
//   state-machine clauses above remain GM-enforced advisory. data-lock asserts the row gains
//   NO fake swallow-state fields (no swallowed te, no acid_tick, no regurgitate key).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import monstersData from '../../../public/data/monsters.json';
import { extractConditionsFromSaveEffect, parseSaveDamageFields } from './MonsterCardHelpers.js';
import { saveChipPlan, buildSaveOptions, buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const TARRASQUE = monstersData.find((m) => m.index === 'tarrasque');
const SWALLOW = TARRASQUE.actions.find((a) => a.name === 'Swallow');
const FP = TARRASQUE.actions.find((a) => a.name === 'Frightful Presence');
const BITE = TARRASQUE.actions.find((a) => a.name === 'Bite');
const SWARM = monstersData.find((m) => m.index === 'swarm-of-poisonous-snakes');
const SWARM_BITES = SWARM.actions.find((a) => a.name === 'Bites');

function rawCount(haystack, needle) {
  return haystack.split(needle).length - 1;
}

describe('MA-1578 monsters.json data lock: Tarrasque Swallow save_damage fields + harvested save_effect', () => {
  it('save_damage fields toEqual pin — rides the MA-1563 structured seam', () => {
    expect(SWALLOW.save_dc).toBe(20);
    expect(SWALLOW.save_damage_dice).toBe('8d6 + 6');
    expect(SWALLOW.save_damage_type).toBe('Bludgeoning');
    expect(SWALLOW.save_type).toBe('Constitution');
    expect(parseSaveDamageFields(SWALLOW)).toEqual({ dice: '8d6 + 6', damageType: 'Bludgeoning' });
  });

  it('key layout mirrors swarm-of-poisonous-snakes MA-1563 twin (save_dc → save_damage_dice → save_damage_type → save_type)', () => {
    // anchor on tarrasque-Swallow-unique bytes (the 8d6+6 pool appears once file-wide)
    const diceIdx = RAW.indexOf('"save_damage_dice": "8d6 + 6"');
    expect(diceIdx).toBeGreaterThan(-1);
    const rawSlice = RAW.slice(RAW.lastIndexOf('"save_dc": 20', diceIdx), RAW.indexOf('"save_effect"', diceIdx));
    expect(rawSlice.indexOf('"save_dc"')).toBeLessThan(rawSlice.indexOf('"save_damage_dice"'));
    expect(rawSlice.indexOf('"save_damage_dice"')).toBeLessThan(rawSlice.indexOf('"save_damage_type"'));
    expect(rawSlice.indexOf('"save_damage_type"')).toBeLessThan(rawSlice.indexOf('"save_type"'));
  });

  it('save_effect extended honestly + harvest yields EXACTLY [blinded, prone, restrained] via the actual extractor', () => {
    expect(SWALLOW.save_effect).toBe('Failure: 28 (8d6 + 6) Bludgeoning damage. If the target is a creature, it is swallowed — Blinded, Prone, and Restrained until it is regurgitated.');
    expect(extractConditionsFromSaveEffect(SWALLOW.save_effect)).toEqual(['blinded', 'prone', 'restrained']);
    // ungated harvest is RAW-correct (§1105): every failed save = swallowed = all three.
    // no foreign canonical condition word leaks into the wording.
    expect(extractConditionsFromSaveEffect(SWALLOW.save_effect)).not.toContain('grappled');
    expect(extractConditionsFromSaveEffect(SWALLOW.save_effect)).not.toContain('paralyzed');
  });

  it('tarrasque-Swallow-unique fixed bytes appear exactly once file-wide', () => {
    expect(rawCount(RAW, '"save_damage_dice": "8d6 + 6"')).toBe(1);
    expect(rawCount(RAW, '"save_damage_type": "Bludgeoning"')).toBe(1);
    expect(rawCount(RAW, 'it is swallowed — Blinded, Prone, and Restrained until it is regurgitated.')).toBe(1);
    expect(RAW).toContain('within 10 feet ofthe tarrasque'); // MA-1577 cosmetic residual stays put
  });

  it('NO fake swallow-state machinery authored (advisory state machine stays prose-only)', () => {
    expect(SWALLOW.swallowed).toBeUndefined();
    expect(SWALLOW.acid_tick).toBeUndefined();
    expect(SWALLOW.regurgitate).toBeUndefined();
    expect(SWALLOW.save_damage_secondary).toBeUndefined();
    expect(SWALLOW.damage_dice_primary).toBeUndefined();
    expect(SWALLOW.attack_bonus).toBeUndefined();
    expect(SWALLOW.hit_conditions).toBeUndefined();
    expect(SWALLOW.escape_dc).toBeUndefined();
    expect(SWALLOW.target_prerequisite).toBeUndefined();
  });
});

describe('MA-1578 save chip plan: rollable + clickable, not a condition rider', () => {
  it('saveChipPlan(formula:"8d6 + 6") rollable && clickable (pure save row, no attack_bonus)', () => {
    const plan = saveChipPlan(SWALLOW, false);
    expect(plan.formula).toBe('8d6 + 6');
    expect(plan.rollable).toBe(true);
    expect(plan.clickable).toBe(true);
    expect(plan.riderOnly).toBe(false);
  });

  it('attackerCannotAct disarms the chip (byte-inert gate honored)', () => {
    const plan = saveChipPlan(SWALLOW, true);
    expect(plan.clickable).toBe(false);
    expect(plan.rollable).toBe(true);
  });

  it('legacy row without the keys stays byte-inert (formula null → not rollable)', () => {
    const legacy = { ...SWALLOW };
    delete legacy.save_damage_dice;
    delete legacy.save_damage_type;
    const plan = saveChipPlan(legacy, false);
    expect(plan.formula).toBe(null);
    expect(plan.rollable).toBe(false);
    expect(parseSaveDamageFields(legacy)).toBe(null);
  });
});

describe('MA-1578 DC 20 Constitution threading + save transport', () => {
  it('buildSaveOptions threads DC 20 + con + harvested conditions', () => {
    const opts = buildSaveOptions(SWALLOW);
    expect(opts.saveDc).toBe(20);
    expect(opts.saveType).toBe('con');
    expect(opts.saveConditions).toEqual(['blinded', 'prone', 'restrained']);
  });

  it('buildAbilitySaveRollContext rolls 8d6+6 Bludgeoning at DC 20 — the fail-face damage leg', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Tarrasque 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: SWALLOW,
      saveType: 'CON',
      dcSuccess: 'none',
      saveDamageFormula: '8d6 + 6',
      saveConditions: extractConditionsFromSaveEffect(SWALLOW.save_effect),
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction: () => ['Bludgeoning'],
    });
    expect(ctx.saveDc).toBe(20);
    expect(ctx.saveType).toBe('CON');
    expect(ctx.autoDamageFormula).toBe('8d6 + 6');
    expect(ctx.autoDamageDamageType).toBe('Bludgeoning');
    expect(ctx.saveConditions).toEqual(['blinded', 'prone', 'restrained']);
    // save_effect carries no "half on success" wording → row honest zero on success face.
    expect(SWALLOW.dc_success).toBeUndefined();
  });
});

describe('MA-1578 sibling byte-locks (MA-1563 swarm + MA-1577 FP + Bite grapple twin intact)', () => {
  it('swarm-of-poisonous-snakes Bites MA-1563 row byte-intact', () => {
    expect(SWARM_BITES.save_dc).toBe(10);
    expect(SWARM_BITES.save_damage_dice).toBe('4d6');
    expect(SWARM_BITES.save_damage_type).toBe('Poison');
    expect(SWARM_BITES.damage_dice_primary).toBe('2d6');
    expect(SWARM_BITES.damage_type_primary).toBe('piercing');
    expect(SWARM_BITES.save_type).toBe('Constitution');
    expect(SWARM_BITES.save_effect).toBe('14 (4d6) Poison damage. Success: Half damage.');
    expect(rawCount(RAW, '"save_damage_dice": "4d6"')).toBe(1);
  });

  it('tarrasque Frightful Presence MA-1577 row byte-intact (DC 17 Wisdom + FP structured keys)', () => {
    expect(FP.save_dc).toBe(17);
    expect(FP.save_type).toBe('Wisdom');
    expect(FP.success_immunity).toEqual({ effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 });
    expect(FP.repeat_save).toEqual({ condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 });
    expect(extractConditionsFromSaveEffect(FP.save_effect)).toEqual(['frightened']);
  });

  it('tarrasque Bite grapple twin MA-1573 stays clause-shaped + Swallow gains no attack_bonus', () => {
    expect(BITE.attack_bonus).toBe(19);
    expect(BITE.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(BITE.escape_dc).toBe(20);
    expect(SWALLOW.attack_bonus).toBeUndefined();
  });

  it('whole-diff scope: file parses and Swallow is the only row carrying the 8d6+6 save pool', () => {
    const parsed = JSON.parse(RAW);
    const row = parsed.find((m) => m.index === 'tarrasque').actions.find((a) => a.name === 'Swallow');
    expect(row).toEqual(SWALLOW);
    const carriers = parsed.reduce((n, m) => n + (m.actions || []).filter((a) => a.save_damage_dice === '8d6 + 6').length, 0);
    expect(carriers).toBe(1);
  });
});
