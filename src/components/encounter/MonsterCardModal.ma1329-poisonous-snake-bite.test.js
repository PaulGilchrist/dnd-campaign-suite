// @maintained-by-ai
// MA-1329: Poisonous Snake "Bite" (attack+save composite) — the row shipped
// damage_dice_primary "2d4" (the SAVE-leg poison pool) with no authored flat
// primary, so extractDamageDiceFromDescription short-circuited and the attack
// chip paid the save-gated 2d4 poison FULL as direct hit damage
// (combined_damage_roll), while the RAW flat 1 Piercing never landed.
// DATA fix mirrors the giant-poisonous-snake byte-twins (MA-0816):
// damage_dice_primary "1" Piercing (MA-0885/MA-0710 flat lane) +
// damage_dice_secondary "2d4" Poison save leg (byte rides save_effect
// failure clause "5 (2d4)"), so buildAttackChipSaveOptions pays fixed flat 1
// with save keys nulled and the DC chip adjudicates 2d4 full/half.
// CODE guard (unique here): saveChipPlan must keep the DC chip CLICKABLE on a
// composite row whose flat "1" primary is not rollExpression-parseable — the
// clickable secondary save leg is the save adjudication affordance (MA-0551
// fork; giant-snake twins are byte-inert via their rollable primaries).
//
// Cite-skips (covered byte-exact elsewhere, never re-anchored here):
// predicate truth tables (isCompositeAttackSaveRow / saveLegCarriesSecondaryDamage
// / saveLegIsConditionRider) + buildSaveOptions save-key + secondary transport:
// MonsterCardModal.secondary-save-transport.test.js :111-128/:155-160/:186-202;
// giant-snake disk-bytes + save-chip ctx twin:
// MonsterCardModal.giant-snake-save-leg.test.js; rider-only clickable plan face:
// MonsterCardModal.ma1000-homunculus-bite-save-rider.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildAutoDamageOptions,
  buildAbilitySaveRollContext,
  isCompositeAttackSaveRow,
  saveLegCarriesSecondaryDamage,
  saveLegIsConditionRider,
  saveChipPlan,
} from './MonsterCardModal.jsx';

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Piercing'];

const snakeRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'poisonous-snake').actions[0];

describe('MA-1329 poisonous-snake Bite — flat primary + save-leg secondary composite', () => {
  it('disk row BY-name bytes: flat "1" Piercing primary + "2d4" Poison save leg inside save_effect', () => {
    expect(snakeRow.name).toBe('Bite');
    expect(snakeRow.attack_bonus).toBe(5);
    expect(snakeRow.save_dc).toBe(10);
    expect(snakeRow.save_type).toBe('Constitution');
    expect(snakeRow.damage_dice_primary).toBe('1');
    expect(snakeRow.damage_type_primary).toBe('Piercing');
    expect(snakeRow.damage_dice_secondary).toBe('2d4');
    expect(snakeRow.damage_type_secondary).toBe('Poison');
    expect(snakeRow.save_effect.includes('2d4')).toBe(true);
    // discriminators arming the MA-0551 fork on THIS disk row
    // (predicate truth tables owned by secondary-save-transport.test.js)
    expect(isCompositeAttackSaveRow(snakeRow)).toBe(true);
    expect(saveLegCarriesSecondaryDamage(snakeRow)).toBe(true);
    expect(saveLegIsConditionRider(snakeRow)).toBe(false);
  });

  it('attack chip pays flat "1" — the MA-1329 regression (was the save-gated 2d4 pool)', () => {
    const opts = buildAutoDamageOptions(snakeRow, 'Bite');
    expect(opts.autoDamageFormula).toBe('1');
    expect(opts.autoDamageName).toBe('Bite');
  });

  it('save chip seam: unrollable flat "1" plan stays clickable, ctx adjudicates 2d4 Poison full/half', () => {
    const plan = saveChipPlan(snakeRow, false);
    expect(plan).toEqual({ riderOnly: false, formula: '1', rollable: false, clickable: true });
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Poisonous Snake 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: snakeRow,
      saveType: 'CON',
      dcSuccess: 'half',
      saveDamageFormula: plan.formula, // ActionSaveRoll hands off the chip plan
      saveConditions: [],
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    // save leg rides the secondary dice, NOT the flat attack primary
    expect(ctx.autoDamageFormula).toBe('2d4');
    expect(ctx.autoDamageDamageType).toBe('Poison');
    expect(ctx.autoDamageSecondaryFormula).toBeNull();
    expect(ctx.autoDamageSecondaryDamageType).toBeNull();
    expect(ctx.dcSuccess).toBe('half');
  });
});
