// @maintained-by-ai
// MA-1656: Vampire Umbral Lord "Hunger of Hadar" (actions[3]) save-lane DATA
// lock. Pre-fix the row was a DC chip shell (save_dc 18 + save_type Charisma
// ONLY): chip fired, DC enforced, extractConditionsFromSaveEffect(undefined)=[]
// and extractDamageDiceFromDescription(description, undefined)=null → failed
// save produced ZERO outcome vs RAW (MA-1546 successor, playbook §52).
// Fix = row-local DATA authoring mirroring the verified twins (MA-0839
// Gibbering Mouther Blinding Spittle / MA-1301 Piercer Drop): save axis +
// dc_success harvested from the 2024 disk spell (spells.json is the
// authority — 5e spells.json carries NO hunger-of-hadar entry), level-5
// 4d6 Acid pool = the end-of-turn DEX-save leg ("...must succeed on a
// Dexterity saving throw or take 2d6 Acid damage", damage_at_slot_level 5 =
// 4d6); the start-of-turn 4d6 Cold pool is a save-less RECURRING tick —
// §70/§87 zero-consumer advisory (MA-0875 Hunger-of-Yeenoghu precedent), so
// the chip adjudicates the Acid pool alone with dc_success:"none" (success
// pays no acid — NOT the half-default, MonsterCardModal.jsx:1332). save_effect
// byte-carries the canonical "Blinded" word from the spell's status_effects
// (§52/MV-31). Generic machinery NOT re-asserted here: saveChipPlan
// save_damage_dice/legacy forks (ma1563), MA-0427 secondary transport
// (secondary-save-transport), picker/zoneTe lanes (ma1212/§615 owners).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildSaveOptions,
  buildAbilitySaveRollContext,
  saveChipPlan,
} from './MonsterCardModal.jsx';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'));
const spells2024 = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/2024/spells.json'), 'utf8'));
const spells5e = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/spells.json'), 'utf8'));

const row = monsters.find((m) => m.index === 'vampire-umbral-lord').actions[3];
const spell = spells2024.find((s) => s.index === 'hunger-of-hadar');

describe('MA-1656 hunger-of-hadar row data lock (2024 disk spell = authority)', () => {
  it('full row identity: DEX/none axis + 4d6 Acid save pool + Blinded-only rider, mirrored from the 2024-only spell', () => {
    // Authority premise: the spell exists ONLY in the 2024 DB (5e carries no entry).
    expect(spells5e.some((s) => s.index === 'hunger-of-hadar')).toBe(false);
    // Full disk identity of the row (byte-exact; any key add/drop/rename fails).
    expect(row).toEqual({
      name: 'Hunger of Hadar',
      description: 'The vampire casts Hunger of Hadar (level 5 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 18).',
      save_dc: 18,
      save_type: 'Dexterity', // NOT Charisma — the casting-ability conflation, §MA-1665
      dc_success: 'none', // success pays no acid — NOT the half-default
      save_effect: 'Failure: 14 (4d6) Acid damage, and the target has the Blinded condition while inside the sphere of darkness (GM-enforced).',
      damage_dice_primary: '4d6', // save gates the end-of-turn Acid pool only;
      damage_type_primary: 'Acid', // start-of-turn Cold is save-less recurring (§70/§87 advisory)
    });
    // Row mirrors the disk spell's authority values, not hand-typed constants.
    expect(row.dc_success).toBe(spell.dc.dc_success);
    expect(row.damage_dice_primary).toBe(spell.damage.damage_at_slot_level['5']);
    // The parser reads the byte-pinned prose as exactly the spell's status_effects.
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(spell.status_effects.map((w) => w.toLowerCase()));
  });
});

describe('MA-1656 chip plan + save transport (row-local fields reach the seam)', () => {
  it('saveChipPlan exact-shape: rollable 4d6 formula — not a condition rider', () => {
    expect(saveChipPlan(row, false)).toEqual({
      riderOnly: false, // pre-fix: no save_effect → rider extraction, zero outcome
      formula: '4d6', // pre-fix: extractDamageDice(description, undefined) → null
      rollable: true,
      clickable: true, // pure-save row (no attack_bonus)
    });
  });

  it('buildSaveOptions exact-shape → buildAbilitySaveRollContext stamps dc_success none + 4d6 Acid inline', () => {
    const opts = buildSaveOptions(row);
    // Exact shape also pins every rider arm inert: no secondary (single-pool
    // judgment — MA-0427 secondary would half-on-success, RAW-wrong here),
    // no stagedPetrify/soulTomeTrap/repeatSave/infernalWound/saveMargin,
    // and dcSuccess is 'none' — not the :1332 half-default.
    expect(opts).toEqual({
      saveDc: 18,
      saveType: 'dex',
      dcSuccess: 'none',
      stagedPetrify: null,
      saveConditions: ['blinded'],
      soulTomeTrap: null,
      repeatSave: null,
      infernalWound: null,
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
      saveMargin: null,
    });
    // Chain the VERIFIED opts into the inline save context (runtime flow).
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Vampire Umbral Lord 1',
      target: { name: 'Bandit 1', type: 'npc' },
      spellName: null,
      action: row,
      saveType: 'Dexterity',
      dcSuccess: opts.dcSuccess,
      saveDamageFormula: saveChipPlan(row, false).formula,
      saveConditions: opts.saveConditions,
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction: (action) => [action.damage_type_primary],
    });
    expect(ctx.saveDc).toBe(18);
    expect(ctx.dcSuccess).toBe('none');
    expect(ctx.autoDamageFormula).toBe('4d6');
    expect(ctx.autoDamageDamageType).toBe('Acid');
    expect(ctx.autoDamageName).toBe('Hunger of Hadar');
    expect(ctx.autoDamageSecondaryFormula).toBeNull(); // single-pool ride
    expect(ctx.saveConditions).toEqual(['blinded']);
    expect(ctx.isSpellDamage).toBe(false); // inline ability save, not spell slot
  });
});
