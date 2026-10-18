// @maintained-by-ai — MA-0348 OWNER truth-table for spellDamagelessSaveCondition /
// spellConditionDurationNote / spellSaveLegOutcome (MonsterCardHelpers.js:480, :512, :522).
// Damageless spell save-leg helpers: Bandit Deceiver Hold Person — damageless
// spells.json entry (dc WIS, dc_success none, no damage) whose failed-save
// condition lives only in the spell's own description text ("The target must
// succeed on a wisdom saving throw or be paralyzed"). spellDamagelessSaveCondition
// arms the save leg ONLY for single-target damageless spells whose clause ability
// agrees with dc_type; zone spells (Gust of Wind line, MA-0003) and non-condition
// tails ("or be pushed") stay advisory (CLA-325). spellSaveLegOutcome keeps
// damage legs byte-identical to the pre-fix save_effect parse.
// Consumers: MonsterCardModal.jsx:878 (routesToSave), :2566 (saveLegCondition),
// :1639 (outcome). Disk fixtures HOLD_PERSON/GUST re-pulled BY NAME from
// public/data/spells.json. Synthetic-fixture justification (#498): no disk spell
// pairs area_of_effect with a canonical "or be X" tail (Gust's tail is
// non-canonical "pushed", which nulls at the tail guard even if the zone guard
// regressed) and none carries the clause in save_effect — the two synthetic
// inputs each kill a distinct guard that disk data cannot.
// MA-0362 cite-skip: the formula-leg text-sourced branch (:526-527) is owned by
// MonsterCardModal.ma0860-githzerai-zerth-spellcasting.test.jsx:196 (and
// spellDamageLegFailCondition itself by MonsterCardModal.spellcasting-barlgura.test.jsx:191).
import { describe, it, expect } from 'vitest';
import { spellDamagelessSaveCondition, spellConditionDurationNote, spellSaveLegOutcome } from './MonsterCardHelpers.js';
import spellsData from '../../../public/data/spells.json';

const HOLD_PERSON = spellsData.find(s => s.index === 'hold-person');
const GUST = spellsData.find(s => s.index === 'gust-of-wind');

describe('MA-0348 spellDamagelessSaveCondition', () => {
  it('single-target damageless spell arms: clause from description (disk) or save_effect', () => {
    expect(HOLD_PERSON.dc).toEqual({ dc_type: 'WIS', dc_success: 'none' });
    expect(spellDamagelessSaveCondition(HOLD_PERSON)).toBe('paralyzed');
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'WIS' },
      save_effect: 'The target must succeed on a wisdom saving throw or be stunned.',
    })).toBe('stunned');
  });

  it('never arms: no spell, no dc_type, or no "or be X" clause', () => {
    expect(spellDamagelessSaveCondition(null)).toBeNull();
    expect(spellDamagelessSaveCondition({ name: 'Light' })).toBeNull();
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'WIS' },
      description: ['Arcane armor surrounds the target.'],
    })).toBeNull();
  });

  it('zone guard: area_of_effect stays advisory (CLA-325), even with a canonical tail', () => {
    expect(GUST.area_of_effect).toBeTruthy();
    expect(spellDamagelessSaveCondition(GUST)).toBeNull();
    // Gust's own tail is non-canonical ("pushed") — this synthetic WIS/paralyzed
    // zone spell is what kills a removed area_of_effect guard.
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'WIS' },
      area_of_effect: { type: 'sphere', size: 20 },
      description: ['Each target must succeed on a wisdom saving throw or be paralyzed.'],
    })).toBeNull();
  });

  it('clause ability must agree with dc_type — mismatched spell never arms', () => {
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'CON' },
      description: ['The target must succeed on a wisdom saving throw or be paralyzed for the duration.'],
    })).toBeNull();
  });

  it('non-canonical tail word never arms', () => {
    expect(spellDamagelessSaveCondition({
      dc: { dc_type: 'WIS' },
      description: ['The target must succeed on a wisdom saving throw or be bewildered beyond reckoning.'],
    })).toBeNull();
  });
});

describe('MA-0348 spellConditionDurationNote', () => {
  it('duration note: Concentration prefix when concentration, plain when not, null without duration', () => {
    expect(HOLD_PERSON.concentration).toBe(true);
    expect(spellConditionDurationNote(HOLD_PERSON)).toBe("for the spell's duration — Concentration, Up to 1 minute (GM-enforced)");
    expect(spellConditionDurationNote({ duration: 'Instantaneous' })).toBe("for the spell's duration — Instantaneous (GM-enforced)");
    expect(spellConditionDurationNote(null)).toBeNull();
  });
});

describe('MA-0348 spellSaveLegOutcome', () => {
  it('damage legs parse save_effect only, with no duration note (byte-identical pre-fix)', () => {
    const spell = { save_effect: 'Failure: the target is stunned.', duration: 'Instantaneous' };
    expect(spellSaveLegOutcome(spell, '3d8', null)).toEqual({
      saveConditions: ['stunned'],
      conditionDurationNote: null,
    });
    // damage leg with no save_effect and no MA-0362 clause stays empty
    expect(spellSaveLegOutcome({ name: 'Light' }, '1d6', null)).toEqual({
      saveConditions: [],
      conditionDurationNote: null,
    });
  });

  it('damageless armed leg grants the parsed condition + honest note; unarmed grants nothing', () => {
    expect(spellSaveLegOutcome(HOLD_PERSON, null, 'paralyzed')).toEqual({
      saveConditions: ['paralyzed'],
      conditionDurationNote: "for the spell's duration — Concentration, Up to 1 minute (GM-enforced)",
    });
    expect(spellSaveLegOutcome({ name: 'Light' }, null, null)).toEqual({
      saveConditions: [],
      conditionDurationNote: null,
    });
  });
});
