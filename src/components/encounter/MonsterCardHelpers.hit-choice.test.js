// @maintained-by-ai
// MA-0855 helper lane: hit_choice condition-choice rider (Githzerai Psion
// Psychic Warp — "the githzerai's choice of (A) Charmed … or (B) Prone").
// hitChoiceArmed/buildHitChoiceOffer arm the HIT-popup chooser; unlike the
// MA-0325/0436 damage-dice offers this selects WHICH CONDITION to grant, so
// hitClauseAutoGrantConditions SUPPRESSES the hit_conditions array auto-grant
// whenever hit_choice carries options (over-granting Charmed+Prone together is
// RAW-wrong) — the clause collapses to null (no te/riders alongside) and the
// consumer grants ONLY the GM's popup pick. Byte-inert when the structured key
// is absent. Consumer lanes (cited, not repeated): MonsterCardModal.hit-choice
// .test.jsx covers offer forwarding to rollAttack ctx, disk-row suppression
// (ctx.hitClause null), MA-0841 Draconic Strike byte-inert through the modal,
// selected/advisory description content, and the condition-applied log;
// DiceRollResult.hit-choice.test.jsx covers popup rendering of the notice.
// Here: disk row by name (#387), the helper branch tables, and the applied
// log's reason/note shape (helper-only contract).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildHitChoiceOffer,
  buildHitChoiceSelectedLog,
  buildHitChoiceAppliedLog,
  buildHitChoiceAdvisoryLog,
  buildHitConditionClause,
  hitChoiceArmed,
} from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WARP = monsters.find((m) => m.index === 'githzerai-psion').actions.find((a) => a.name === 'Psychic Warp');

describe('MA-0855 data contract (monsters.json Psychic Warp)', () => {
  it('authors the hit_conditions ledger + hit_choice chooser; no save leg, no te', () => {
    expect(WARP).toMatchObject({
      attack_bonus: 8,
      reach: '5 ft.',
      range: '120 ft.',
      damage_dice_primary: '4d10 + 4',
      damage_type_primary: 'Psychic',
      hit_conditions: ['charmed', 'prone'],
      hit_choice: { options: ['charmed', 'prone'], note: 'Prone requires Large or smaller' },
    });
    expect(WARP.save_dc).toBeUndefined();
    expect(WARP.save_type).toBeUndefined();
    expect(WARP.escape_dc).toBeUndefined();
    expect(WARP.hit_target_effect).toBeUndefined();
    expect(WARP.hit_condition_roll).toBeUndefined();
  });
});

describe('MA-0855 chooser offer + hit-clause suppression', () => {
  it('arms from hit_choice.options — compiles label, lowercases options, defaults note/null attackName fallback', () => {
    expect(hitChoiceArmed(WARP)).toBe(true);
    expect(buildHitChoiceOffer(WARP, 'Psychic Warp')).toEqual({
      options: ['charmed', 'prone'],
      label: 'Condition Choice: Charmed or Prone',
      note: 'Prone requires Large or smaller',
      attackName: 'Psychic Warp',
    });
    // normalization + note-default + name-arg-absent fallback (row name wins)
    expect(buildHitChoiceOffer({ name: 'Claw', hit_choice: { options: ['Frightened', 'Stunned'] } })).toMatchObject({
      options: ['frightened', 'stunned'],
      label: 'Condition Choice: Frightened or Stunned',
      note: null,
      attackName: 'Claw',
    });
  });

  it('byte-inert null once-only across malformed shapes (no key / no options / empty / undefined row)', () => {
    expect(buildHitChoiceOffer({ name: 'Claw', attack_bonus: 4 }, 'Claw')).toBeNull();
    expect(buildHitChoiceOffer({ name: 'Claw', hit_choice: {} }, 'Claw')).toBeNull();
    expect(buildHitChoiceOffer({ name: 'Claw', hit_choice: { options: [] } }, 'Claw')).toBeNull();
    expect(buildHitChoiceOffer(undefined, 'Claw')).toBeNull();
    expect(hitChoiceArmed({ name: 'Claw' })).toBe(false);
  });

  it('suppression: armed clause collapses to null (no array auto-grant); a alongside hit_target_effect survives', () => {
    expect(buildHitConditionClause(WARP)).toBeNull();
    const row = { name: 'Rider', attack_bonus: 5, hit_conditions: ['charmed', 'prone'], hit_choice: { options: ['charmed', 'prone'] }, hit_target_effect: 'no_healing' };
    expect(buildHitConditionClause(row)).toMatchObject({ conditions: [], targetEffect: 'no_healing' });
  });

  it('MA-0841 frightened row (NO hit_choice) still auto-grants normally', () => {
    // modal-lane twin (byte-inert through ctx incl. this exact clause): MonsterCardModal.hit-choice.test.jsx "stays byte-inert (no offer)… MA-0841"
    const strike = monsters.find((m) => m.index === 'githyanki-dracomancer').actions.find((a) => a.name === 'Draconic Strike');
    expect(hitChoiceArmed(strike)).toBe(false);
    expect(buildHitConditionClause(strike)).toEqual({ conditions: ['frightened'], escapeDc: null, attackName: 'Draconic Strike', targetEffect: null });
  });
});

describe('MA-0855 log builders', () => {
  const offer = buildHitChoiceOffer(WARP, 'Psychic Warp');

  it('selected names pick-of-options + only-applied (note omitted when null); advisory records undecided honestly', () => {
    const sel = buildHitChoiceSelectedLog({ monsterName: 'Githzerai Psion 1', offer, chosen: 'charmed', targetName: 'Bandit 1' });
    expect(sel).toMatchObject({ type: 'automation', automationType: 'hit_choice_selected', characterName: 'Githzerai Psion 1', abilityName: 'Psychic Warp', targetName: 'Bandit 1' });
    expect(sel.description).toContain('GM chose Charmed of (Charmed or Prone); only Charmed applied');
    expect(sel.description).toContain('Prone requires Large or smaller');
    expect(buildHitChoiceSelectedLog({ monsterName: 'M', offer: { ...offer, note: null }, chosen: 'prone', targetName: 'T' }).description).not.toContain('Large or smaller');

    const adv = buildHitChoiceAdvisoryLog({ monsterName: 'Githzerai Psion 1', offer, targetName: 'Bandit 1' });
    expect(adv.automationType).toBe('hit_choice_undecided');
    expect(adv.description).toContain('choice undecided — no condition granted');
    expect(adv.description).toContain('options were Charmed or Prone');
  });

  // shape must match handlePlainDamage.applyHitClauseConditions so badges treat
  // the chooser grant like any hit-clause grant; reason/note are helper-only
  // (modal lane asserts presence + condition name only).
  it('applied log is a condition-applied entry naming ONLY the chosen condition', () => {
    const log = buildHitChoiceAppliedLog({ offer, chosen: 'prone', targetName: 'Bandit 1' });
    expect(log).toMatchObject({
      type: 'condition',
      action: 'applied',
      characterName: 'Bandit 1',
      condition: 'Prone',
      reason: 'Psychic Warp (GM choice)',
      note: 'Prone requires Large or smaller',
    });
    expect(log.condition).not.toBe('Charmed');
  });
});
