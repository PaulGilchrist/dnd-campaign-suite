// @maintained-by-ai
// MA-1578: Tarrasque "Swallow" (save, DC 20 Constitution) — pre-fix the fail face paid
// NOTHING: dice lived only in save_effect prose, every structured key was absent, so
// saveChipPlan.formula was null → raw d20 popup ("DC Unknown"), applySaveDamage's damage
// gate never fired, and extractConditionsFromSaveEffect harvested []. FIX was pure data on
// the MA-1563 save-damage seam (parseSaveDamageFields → resolveSaveLegDamageFields,
// MonsterCardModal.jsx:1720-1733): save_damage_dice "8d6 + 6" + save_damage_type
// "Bludgeoning" arm a rollable save chip rolled verbatim on a fail; save_effect's canonical
// Blinded/Prone/Restrained words harvest all three on the fail face (ungated harvest is
// RAW-correct §1105: every failed save = swallowed = all three).
//
// This file owns: the Swallow disk-row byte-lock (full-row toEqual — exhaustiveness also
// locks the ABSENCE of fake swallow-state fields: acid tick, regurgitation gate, grapple
// prerequisite stay GM-enforced advisory prose, zero consumers app-wide), the swarm Bites
// MA-1563 twin save-byte-lock (delegated HERE by MonsterCardModal.ma1563-swarm-save-damage
// .test.js :11-12), the saveChipPlan shape, and the DC 20 CON ctx transport discriminator.
// Cited owners (not re-asserted here):
// - parseSaveDamageFields truth table incl. delete-keys → null:
//   MonsterCardHelpers.ma1563-swarm-save-damage.test.js :27-40
// - generic dc/type/secondary transport + predicate forks:
//   MonsterCardModal.secondary-save-transport.test.js; full/zero/half save math:
//   applyDamage computeDamageAfterSave (MA-0218 owner lane)
// - FP full row + repeat-save lane: MonsterCardModal.ma1577-tarrasque-frightful-presence
//   .test.js :100-119 (#711) — presence-guard only below; Bite grapple twin + Swallow
//   clause-less guard: MonsterCardModal.ma1573-tarrasque-bite-grapple.test.js :159-166
// - condition landing machinery (applyFailedSaveConditions/meta stamps): handlePlainDamage
//   .hitClause owner lane — transport pins here stop at the ctx.
// - typo residual "within 10 feet ofthe tarrasque" byte: owned by ma1577 :118.
//
// CANARY FLIPPED LAWFUL (#712, fix 2026-10-23): the row now authors dc_success:"none"
// (MA-0030 Chilling Gaze precedent — key sits after save_type). The MV-20 'half' default
// (resolveBlockSaveDcSuccess :286 → computeDamageAfterSave :93) no longer fires: a
// SUCCESSFUL DC 20 CON save pays ZERO damage and no swallowed conditions (RAW: success =
// not swallowed); the fail face still pays the authored 8d6 + 6 Bludgeoning verbatim.
// Pins below assert the fixed 'none' shape and lock default-'half' for unauthored rows.
import { describe, it, expect } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import { computeDamageAfterSave } from '../../services/rules/combat/applyDamage.js';
import { extractConditionsFromSaveEffect, parseSaveDamageFields } from './MonsterCardHelpers.js';
import { saveChipPlan, buildSaveOptions, buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const TARRASQUE = monstersData.find((m) => m.index === 'tarrasque');
const SWALLOW = TARRASQUE.actions.find((a) => a.name === 'Swallow');
const FP = TARRASQUE.actions.find((a) => a.name === 'Frightful Presence');
const SWARM_BITES = monstersData.find((m) => m.index === 'swarm-of-poisonous-snakes').actions.find((a) => a.name === 'Bites');

// Exact disk row, byte-for-byte — one toEqual locks the full MA-1563-key-layout arm
// (save_dc → save_damage_dice → save_damage_type → save_type → dc_success → save_effect)
// AND, by exhaustiveness, the absence of every other fake swallow-state field
// (swallowed/acid_tick/regurgitate/escape_dc/hit_conditions/target_prerequisite...).
const FULL_ROW = {
  name: 'Swallow',
  description: 'The tarrasque makes one bite attack against a Large or smaller creature it is grappling. If the attack hits, the target takes the bite\'s damage, the target is swallowed, and the grapple ends. While swallowed, the creature is blinded and restrained, it has total cover against attacks and other effects outside the tarrasque, and it takes 56 (16d6) acid damage at the start of each of the tarrasque\'s turns. If the tarrasque takes 60 damage or more on a single turn from a creature inside it, the tarrasque must succeed on a DC 20 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, which fall prone in a space within 10 feet ofthe tarrasque. If the tarrasque dies, a swallowed creature is no longer restrained by it and can escape from the corpse by using 30 feet of movement, exiting prone.',
  save_dc: 20,
  save_damage_dice: '8d6 + 6',
  save_damage_type: 'Bludgeoning',
  save_type: 'Constitution',
  dc_success: 'none',
  save_effect: 'Failure: 28 (8d6 + 6) Bludgeoning damage. If the target is a creature, it is swallowed — Blinded, Prone, and Restrained until it is regurgitated.',
};

const countCarriers = (dice) => monstersData.reduce(
  (n, m) => n + (m.actions || []).filter((a) => a.save_damage_dice === dice).length, 0);

describe('MA-1578 disk data lock: Swallow row arms the fail face, advisory state machine stays prose-only', () => {
  it('full-row byte-lock + key order + parseSaveDamageFields + harvest yields EXACTLY [blinded, prone, restrained]; Swallow is the sole 8d6 + 6 carrier file-wide', () => {
    expect(SWALLOW).toEqual(FULL_ROW);
    expect(Object.keys(SWALLOW)).toEqual(['name', 'description', 'save_dc', 'save_damage_dice', 'save_damage_type', 'save_type', 'dc_success', 'save_effect']);
    expect(parseSaveDamageFields(SWALLOW)).toEqual({ dice: '8d6 + 6', damageType: 'Bludgeoning' });
    expect(extractConditionsFromSaveEffect(SWALLOW.save_effect)).toEqual(['blinded', 'prone', 'restrained']);
    expect(countCarriers('8d6 + 6')).toBe(1);
  });
});

describe('MA-1578 saveChipPlan: authored pool owns the chip, gates honored, byte-inert stripped', () => {
  it('exact plan shape rollable+clickable (pure-save row, no attack_bonus); attackerCannotAct disarms; stripped row falls back to null → pre-fix raw-save popup face', () => {
    expect(saveChipPlan(SWALLOW, false)).toEqual({ riderOnly: false, formula: '8d6 + 6', rollable: true, clickable: true });
    const disarmed = saveChipPlan(SWALLOW, true);
    expect(disarmed.clickable).toBe(false);
    expect(disarmed.rollable).toBe(true); // formula stays — only the press is gated
    const stripped = { ...SWALLOW };
    delete stripped.save_damage_dice;
    delete stripped.save_damage_type;
    const legacyPlan = saveChipPlan(stripped, false);
    expect(legacyPlan.formula).toBe(null); // no fabricated pool from prose
    expect(legacyPlan.rollable).toBe(false); // parseSaveDamageFields → null owned by Helpers.ma1563 :32
  });
});

describe('MA-1578 DC 20 Constitution threading + save transport', () => {
  it('buildSaveOptions arms DC 20 con + triple conditions (dc_success:"none" authored — success pays ZERO); ctx overrides the pre-fix null handoff with authored 8d6 + 6 Bludgeoning, single leg', () => {
    const opts = buildSaveOptions(SWALLOW);
    expect(opts.saveDc).toBe(20);
    expect(opts.saveType).toBe('con');
    expect(opts.saveConditions).toEqual(['blinded', 'prone', 'restrained']);
    // LAWFUL PIN (#712 flip): row authors dc_success:'none' (MA-0030 precedent) →
    // resolveBlockSaveDcSuccess/buildSaveOptions surface 'none', not the MV-20 'half'.
    expect(opts.dcSuccess).toBe('none');
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Tarrasque 1',
      target: { name: 'Bandit 1', type: 'monster' },
      spellName: null,
      action: SWALLOW,
      saveType: SWALLOW.save_type, // press passes action.save_type verbatim (:425)
      dcSuccess: opts.dcSuccess,
      // Discriminator: the PRE-fix chip handoff (plan.formula was null → "DC Unknown").
      // If the MA-1563 row-override branch (:1727) were removed, autoDamageFormula
      // falls through to this null and the fail face pays nothing again — the exact bug.
      saveDamageFormula: null,
      saveConditions: opts.saveConditions,
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction: () => [], // proves 'Bludgeoning' rides from the ROW, not the getter
    });
    expect(ctx.saveDc).toBe(20);
    expect(ctx.saveType).toBe('Constitution');
    expect(ctx.dcSuccess).toBe('none');
    expect(ctx.autoDamageFormula).toBe('8d6 + 6');
    expect(ctx.autoDamageDamageType).toBe('Bludgeoning');
    // fail face rolls the save pool exactly once — no fabricated second leg
    expect(ctx.autoDamageSecondaryFormula).toBe(null);
    expect(ctx.autoDamageSecondaryDamageType).toBe(null);
    expect(ctx.saveConditions).toEqual(['blinded', 'prone', 'restrained']);
    // #1348 save-outcome arms on this row's transport: fail pays the FULL authored
    // pool, success pays ZERO (applySaveDamage :1665 → computeDamageAfterEvasion →
    // computeDamageAfterSave :91, dc_success 'none' hits the terminal zero branch).
    expect(computeDamageAfterSave(28, false, ctx.dcSuccess)).toBe(28);
    expect(computeDamageAfterSave(28, true, ctx.dcSuccess)).toBe(0);
    // default-'half' stays intact for OTHER unauthored rows (MV-20 untouched):
    // swarm Bites ships no dc_success and must keep resolving 'half' via :286/:1332.
    expect('dc_success' in SWARM_BITES).toBe(false);
    expect(buildSaveOptions(SWARM_BITES).dcSuccess).toBe('half');
    expect(computeDamageAfterSave(14, true, 'half')).toBe(7);
  });
});

describe('MA-1578 sibling guards (full bytes owned elsewhere)', () => {
  it('swarm Bites MA-1563 twin save-byte-lock + sole 4d6 carrier (bytes delegated HERE by ma1563 :11-12); FP MA-1577 structured keys PRESENT (full row + repeat-save lane owned by ma1577 :100-119)', () => {
    expect(SWARM_BITES.save_dc).toBe(10);
    expect(SWARM_BITES.save_damage_dice).toBe('4d6');
    expect(SWARM_BITES.save_damage_type).toBe('Poison');
    expect(SWARM_BITES.save_type).toBe('Constitution');
    expect(SWARM_BITES.save_effect).toBe('14 (4d6) Poison damage. Success: Half damage.');
    expect(countCarriers('4d6')).toBe(1);
    expect(FP.save_dc).toBe(17);
    expect(FP.save_type).toBe('Wisdom');
    expect(FP.success_immunity).toBeDefined();
    expect(FP.repeat_save).toBeDefined();
  });
});
