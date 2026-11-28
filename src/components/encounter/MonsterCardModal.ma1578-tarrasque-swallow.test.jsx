// @maintained-by-ai 2026-11-28
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
// This file owns: the Swallow disk-row byte-lock AND the swarm Bites MA-1563 twin
// byte-lock (delegated HERE as the FULL row by MonsterCardHelpers.ma1563-swarm-save-damage
// .test.js :12-13 and MonsterCardModal.ma1563-swarm-save-damage.test.js header — both
// full-row toEqual exhaustiveness also locks ABSENCE of fake fields: Swallow carries no
// swallowed/acid_tick/regurgitate/escape_dc state machine (GM-advisory prose, zero
// consumers), swarm Bites carries no dc_success), the saveChipPlan shape (positive plan,
// attackerCannotAct disarm gate — the only saveChipPlan unit pin asserting the gated
// press; stripped-row null fallback proving the chip never fabricates dice from prose),
// and the DC 20 CON ctx transport discriminator + dc_success:'none' canary pin.
// Cited owners (not re-asserted here):
// - parseSaveDamageFields truth table incl. delete-keys → null (the Swallow-row and
//   harvest re-reads were shed here: both keys are byte-locked by the full-row toEqual):
//   MonsterCardHelpers.ma1563-swarm-save-damage.test.js :27-40
// - generic dc/type/secondary transport + predicate forks:
//   MonsterCardModal.secondary-save-transport.test.js; half/zero computeDamageAfterSave
//   branch math incl. 'none'→full-on-fail/zero-on-success and 'half' floor-halving:
//   applyDamage.helpers.test.js :91-98 (MA-0218 owner lane)
// - default dc_success 'half' for unauthored rows (MV-20): MonsterCard.ma1971-wing-defense
//   .test.jsx :71 pins buildSaveOptions generically; the swarm absence-of-dc_success byte
//   is locked in the disk test below, so the row-specific 'half' re-derivation was shed
// - FP full row + repeat-save lane + typo residual "within 10 feet ofthe tarrasque" byte:
//   MonsterCardModal.ma1577-tarrasque-frightful-presence.test.jsx :100-119 (#711) — the
//   FP presence guard here was dropped: its full-row toEqual strictly dominates
// - Bite grapple twin + Swallow clause-less guard: MonsterCardModal.ma1573-tarrasque-bite
//   -grapple.test.js :157-166; condition landing machinery (applyFailedSaveConditions/
//   meta stamps): handlePlainDamage .hitClause owner lane — transport pins stop at ctx.
//
// CANARY FLIPPED LAWFUL (#712, fix 2026-10-23): the row authors dc_success:"none"
// (MA-0030 Chilling Gaze precedent — key sits after save_type). The MV-20 'half' default
// (resolveBlockSaveDcSuccess :286) no longer fires: a SUCCESSFUL DC 20 CON save pays ZERO
// damage and no swallowed conditions (RAW: success = not swallowed); the fail face still
// pays the authored 8d6 + 6 Bludgeoning verbatim. Pins below assert the fixed 'none' shape.
import { describe, it, expect } from 'vitest';
import monstersData from '../../../public/data/monsters.json';
import { saveChipPlan, buildSaveOptions, buildAbilitySaveRollContext } from './MonsterCardModal.jsx';

const TARRASQUE = monstersData.find((m) => m.index === 'tarrasque');
const SWALLOW = TARRASQUE.actions.find((a) => a.name === 'Swallow');
const SWARM_BITES = monstersData.find((m) => m.index === 'swarm-of-poisonous-snakes').actions.find((a) => a.name === 'Bites');

// Exact disk rows, byte-for-byte — each one toEqual locks the full MA-1563-key-layout arm
// AND, by exhaustiveness, the absence of every other field (see header).
const SWALLOW_FULL_ROW = {
  name: 'Swallow',
  description: 'The tarrasque makes one bite attack against a Large or smaller creature it is grappling. If the attack hits, the target takes the bite\'s damage, the target is swallowed, and the grapple ends. While swallowed, the creature is blinded and restrained, it has total cover against attacks and other effects outside the tarrasque, and it takes 56 (16d6) acid damage at the start of each of the tarrasque\'s turns. If the tarrasque takes 60 damage or more on a single turn from a creature inside it, the tarrasque must succeed on a DC 20 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, which fall prone in a space within 10 feet ofthe tarrasque. If the tarrasque dies, a swallowed creature is no longer restrained by it and can escape from the corpse by using 30 feet of movement, exiting prone.',
  save_dc: 20,
  save_damage_dice: '8d6 + 6',
  save_damage_type: 'Bludgeoning',
  save_type: 'Constitution',
  dc_success: 'none',
  save_effect: 'Failure: 28 (8d6 + 6) Bludgeoning damage. If the target is a creature, it is swallowed — Blinded, Prone, and Restrained until it is regurgitated.',
};

const SWARM_FULL_ROW = {
  name: 'Bites',
  description: 'Melee Weapon Attack: +6 to hit, reach 0 ft., one creature in the swarm\'s space. Hit: 7 (2d6) piercing damage, or 3 (1d6) piercing damage if the swarm has half of its hit points or fewer. The target must make a DC 10 Constitution saving throw, taking 14 (4d6) poison damage on a failed save, or half as much damage on a successful one.',
  attack_bonus: 6,
  reach: '0 ft.',
  save_dc: 10,
  save_damage_dice: '4d6',
  save_damage_type: 'Poison',
  damage_dice_primary: '2d6',
  damage_type_primary: 'piercing',
  save_type: 'Constitution',
  save_effect: '14 (4d6) Poison damage. Success: Half damage.',
};

const countCarriers = (dice) => monstersData.reduce(
  (n, m) => n + (m.actions || []).filter((a) => a.save_damage_dice === dice).length, 0);

describe('MA-1578 disk data locks: Swallow arms the fail face (advisory state machine stays prose-only); swarm Bites MA-1563 twin delegated here', () => {
  it('both rows are byte-exact full toEqual with authored key order, and each dice pool is the sole carrier file-wide', () => {
    expect(SWALLOW).toEqual(SWALLOW_FULL_ROW);
    expect(Object.keys(SWALLOW)).toEqual(['name', 'description', 'save_dc', 'save_damage_dice', 'save_damage_type', 'save_type', 'dc_success', 'save_effect']);
    expect(countCarriers('8d6 + 6')).toBe(1);
    // Swarm twin (delegated by ma1563 lanes): full-row exhaustiveness ALSO locks the
    // absence of dc_success — the MV-20 default-'half' path stays exercised (:286).
    expect(SWARM_BITES).toEqual(SWARM_FULL_ROW);
    expect(Object.keys(SWARM_BITES)).toEqual(['name', 'description', 'attack_bonus', 'reach', 'save_dc', 'save_damage_dice', 'save_damage_type', 'damage_dice_primary', 'damage_type_primary', 'save_type', 'save_effect']);
    expect(countCarriers('4d6')).toBe(1);
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
  it('buildSaveOptions arms DC 20 con + triple harvest (dc_success:"none" authored, not the MV-20 half default); ctx overrides the pre-fix null handoff with authored 8d6 + 6 Bludgeoning, single leg', () => {
    const opts = buildSaveOptions(SWALLOW);
    expect(opts.saveDc).toBe(20);
    expect(opts.saveType).toBe('con');
    expect(opts.saveConditions).toEqual(['blinded', 'prone', 'restrained']);
    // LAWFUL PIN (#712 flip): row authors dc_success:'none' (MA-0030 precedent) →
    // resolveBlockSaveDcSuccess/buildSaveOptions surface 'none', not the MV-20 'half'.
    // The half/zero payout math on 'none' is owned by applyDamage.helpers.test.js :91-98.
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
  });
});
