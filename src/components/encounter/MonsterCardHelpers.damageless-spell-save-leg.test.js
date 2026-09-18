// MA-0348: damageless spell save-leg helpers. Bandit Deceiver Hold Person —
// damageless spells.json entry (dc WIS, dc_success none, no damage) whose
// failed-save condition lives only in the spell's own description text
// ("The target must succeed on a wisdom saving throw or be paralyzed").
// spellDamagelessSaveCondition arms the save leg ONLY for single-target
// damageless spells whose clause ability agrees with dc_type; zone spells
// (Gust of Wind line, MA-0003) and non-condition tails ("or be pushed")
// stay advisory (CLA-325). spellSaveLegOutcome keeps damage legs
// byte-identical to the pre-fix save_effect parse.
import { describe, it, expect } from 'vitest';
import { spellDamagelessSaveCondition, spellConditionDurationNote, spellSaveLegOutcome, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import spellsData from '../../../public/data/spells.json';

const HOLD_PERSON = spellsData.find(s => s.index === 'hold-person');
const GUST = spellsData.find(s => s.index === 'gust-of-wind');

describe('MA-0348 spellDamagelessSaveCondition', () => {
  it('Hold Person arms paralyzed (dc WIS agrees with the clause ability)', () => {
    expect(spellDamagelessSaveCondition(HOLD_PERSON)).toBe('paralyzed');
  });

  it('Gust of Wind stays null: area_of_effect zone spell, and "or be pushed" names no canonical condition', () => {
    expect(GUST.area_of_effect).toBeTruthy();
    expect(spellDamagelessSaveCondition(GUST)).toBeNull();
    const text = (GUST.description || []).join(' ');
    expect(/or be ([a-z]+)/i.exec(text)[1].toLowerCase()).not.toContain('prone');
  });

  it('no dc / no dc_type spells never arm', () => {
    expect(spellDamagelessSaveCondition(null)).toBeNull();
    expect(spellDamagelessSaveCondition({ name: 'Light' })).toBeNull();
    expect(spellDamagelessSaveCondition({ name: 'Mage Armor', dc: null, description: ['Ac creates armor.'] })).toBeNull();
  });

  it('clause ability must agree with dc_type — mismatched spell never arms', () => {
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'CON' },
      description: ['The target must succeed on a wisdom saving throw or be paralyzed for the duration.'],
    })).toBeNull();
  });

  it('non-canonical tail words never arm (cursed IS canonical and does arm)', () => {
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'WIS' },
      description: ['The target must succeed on a wisdom saving throw or be bewildered beyond reckoning.'],
    })).toBeNull();
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'CHA' },
      description: ['The target must succeed on a charisma saving throw or be cursed for 1d4 days.'],
    })).toBe('cursed');
  });
});

describe('MA-0348 spellConditionDurationNote', () => {
  it('concentration spell carries an honest GM-enforced note', () => {
    expect(spellConditionDurationNote(HOLD_PERSON)).toBe("for the spell's duration — Concentration, Up to 1 minute (GM-enforced)");
  });

  it('non-concentration spell omits the Concentration tag; no duration -> null', () => {
    expect(spellConditionDurationNote({ duration: 'Instantaneous' })).toBe("for the spell's duration — Instantaneous (GM-enforced)");
    expect(spellConditionDurationNote({})).toBeNull();
    expect(spellConditionDurationNote(null)).toBeNull();
  });
});

describe('MA-0348 spellSaveLegOutcome — damage legs byte-unchanged', () => {
  it('with a damage formula the fail-leg comes from save_effect only, no note', () => {
    const spell = { save_effect: 'Failure: the target is stunned.', description: ['irrelevant text'] };
    expect(spellSaveLegOutcome(spell, '3d8', null)).toEqual({
      saveConditions: extractConditionsFromSaveEffect(spell.save_effect),
      conditionDurationNote: null,
    });
  });

  it('damageless armed leg grants the parsed condition + honest note', () => {
    expect(spellSaveLegOutcome(HOLD_PERSON, null, 'paralyzed')).toEqual({
      saveConditions: ['paralyzed'],
      conditionDurationNote: "for the spell's duration — Concentration, Up to 1 minute (GM-enforced)",
    });
  });

  it('damageless unarmed leg grants nothing', () => {
    expect(spellSaveLegOutcome({ name: 'Light' }, null, null)).toEqual({ saveConditions: [], conditionDurationNote: null });
  });
});
