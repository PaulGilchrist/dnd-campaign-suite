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
// pays no acid — NOT the half-default). save_effect byte-carries the
// canonical "Blinded" word from the spell's status_effects (§52/MV-31).
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

const getDamageTypesForAction = (action) => [action?.damage_type_primary || 'Slashing'];

describe('MA-1656 disk spell authority (spells.json = truth)', () => {
  it('hunger-of-hadar lives ONLY in the 2024 DB: DEX save axis, dc_success none', () => {
    expect(spells5e.some((s) => s.index === 'hunger-of-hadar')).toBe(false);
    expect(spell).toBeTruthy();
    expect(spell.dc.dc_type).toBe('DEX');
    expect(spell.dc.dc_success).toBe('none');
    expect(spell.damage.damage_at_slot_level['5']).toBe('4d6');
    expect(spell.status_effects).toContain('Blinded');
  });
});

describe('MA-1656 vampire-umbral-lord actions[3] data lock', () => {
  it('row name/description/save_dc byte-unchanged vs the broken row', () => {
    expect(row.name).toBe('Hunger of Hadar');
    expect(row.save_dc).toBe(18);
    expect(row.description).toBe('The vampire casts Hunger of Hadar (level 5 version), requiring no spell components and using Charisma as the spellcasting ability (spell save DC 18).');
  });

  it('save axis + dc_success mirror the disk spell (Charisma was the casting-ability conflation, §MA-1665)', () => {
    expect(row.save_type).toBe('Dexterity');
    expect(row.dc_success).toBe(spell.dc.dc_success);
    expect(row.dc_success).toBe('none');
  });

  it('level-5 save-leg damage pool authored: 4d6 Acid (save gates the end-of-turn acid)', () => {
    expect(row.damage_dice_primary).toBe('4d6');
    expect(row.damage_dice_primary).toBe(spell.damage.damage_at_slot_level['5']);
    expect(row.damage_type_primary).toBe('Acid');
    // single-pool judgment: start-of-turn Cold is save-less recurring (§70/§87);
    // MA-0427 secondary would half-on-success — RAW-wrong for a save-less pool.
    expect(row.damage_dice_secondary).toBeUndefined();
    expect(row.save_damage_dice).toBeUndefined();
  });

  it('save_effect byte-carries the canonical Blinded word and the 4d6 pool (§52/MV-31)', () => {
    expect(row.save_effect).toContain('4d6');
    expect(row.save_effect).toContain('Acid');
    expect(row.save_effect).toMatch(/Blinded/);
    // §MA-1584 over-grant scan: no OTHER canonical condition words.
    const others = ['charmed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
    const lower = row.save_effect.toLowerCase();
    for (const w of others) expect(lower.includes(w)).toBe(false);
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['blinded']);
  });
});

describe('MA-1656 chip plan + save transport (row-local fields reach the seam)', () => {
  it('saveChipPlan arms a rollable 4d6 formula — not a condition rider', () => {
    const plan = saveChipPlan(row, false);
    expect(plan.formula).toBe('4d6');
    expect(plan.rollable).toBe(true);
    expect(plan.riderOnly).toBe(false);
    expect(plan.clickable).toBe(true);
  });

  it('buildSaveOptions: dc_success none rides the transport (half-default closed)', () => {
    const opts = buildSaveOptions(row);
    expect(opts.saveDc).toBe(18);
    expect(opts.saveType).toBe('dex');
    expect(opts.dcSuccess).toBe('none');
    expect(opts.saveConditions).toEqual(['blinded']);
  });

  it('buildAbilitySaveRollContext stamps autoDamage 4d6 Acid + saveConditions blinded', () => {
    const ctx = buildAbilitySaveRollContext({
      monsterName: 'Vampire Umbral Lord 1',
      target: { name: 'Bandit 1', type: 'npc' },
      spellName: null,
      action: row,
      saveType: 'Dexterity',
      dcSuccess: buildSaveOptions(row).dcSuccess,
      saveDamageFormula: saveChipPlan(row, false).formula,
      saveConditions: extractConditionsFromSaveEffect(row.save_effect),
      usesGate: null,
      prerequisite: null,
      getDamageTypesForAction,
    });
    expect(ctx.saveDc).toBe(18);
    expect(ctx.saveType).toBe('Dexterity');
    expect(ctx.dcSuccess).toBe('none');
    expect(ctx.autoDamageFormula).toBe('4d6');
    expect(ctx.autoDamageDamageType).toBe('Acid');
    expect(ctx.saveConditions).toEqual(['blinded']);
    expect(ctx.autoDamageName).toBe('Hunger of Hadar');
  });
});
