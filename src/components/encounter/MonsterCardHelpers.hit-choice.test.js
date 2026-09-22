// MA-0855: Githzerai Psion "Psychic Warp" — prose carries "the githzerai's
// choice of (A) the Charmed condition … or (B) the Prone condition, provided
// the target is a Large or smaller creature" but the row shipped WITHOUT any
// hit_conditions / choice metadata, so the rider was structurally inert. The
// fix is BOTH layers: DATA (hit_conditions ledger + hit_choice chooser) plus a
// HIT-popup condition CHOOSER. Unlike MA-0325/0436 (ALTERNATIVE damage dice)
// this selects WHICH CONDITION to grant, so buildHitConditionClause SUPPRESSES
// the hit_conditions array auto-grant whenever hit_choice is armed — otherwise
// the consumer would grant Charmed+Prone together on every hit (RAW-wrong).
// Locks: disk row shape + placement, buildHitChoiceOffer arms, clause
// suppression (null), MA-0841 frightened row byte+behavior identical (inert
// without hit_choice), and each log builder.
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
const PSION = monsters.find((m) => m.index === 'githzerai-psion');
const WARP = PSION.actions[1];

describe('MA-0855 data lock (monsters.json Githzerai Psion Psychic Warp)', () => {
  it('actions[1] authors hit_conditions ["charmed","prone"] + hit_choice after damage_type_primary', () => {
    expect(WARP.name).toBe('Psychic Warp');
    expect(WARP.attack_bonus).toBe(8);
    expect(WARP.reach).toBe('5 ft.');
    expect(WARP.range).toBe('120 ft.');
    expect(WARP.damage_dice_primary).toBe('4d10 + 4');
    expect(WARP.damage_type_primary).toBe('Psychic');
    const keys = Object.keys(WARP);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(WARP.hit_conditions).toEqual(['charmed', 'prone']);
    expect(keys.indexOf('hit_choice')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(WARP.hit_choice).toEqual({ options: ['charmed', 'prone'], note: 'Prone requires Large or smaller' });
  });

  it('no save fields / no escape_dc / no hit_target_effect on the row', () => {
    expect(WARP.save_dc).toBeUndefined();
    expect(WARP.save_type).toBeUndefined();
    expect(WARP.escape_dc).toBeUndefined();
    expect(WARP.hit_target_effect).toBeUndefined();
    expect(WARP.hit_condition_roll).toBeUndefined();
  });
});

describe('MA-0855 buildHitChoiceOffer', () => {
  it('arms the HIT-popup chooser from hit_choice.options', () => {
    const offer = buildHitChoiceOffer(WARP, 'Psychic Warp');
    expect(offer).toMatchObject({
      options: ['charmed', 'prone'],
      attackName: 'Psychic Warp',
      note: 'Prone requires Large or smaller',
    });
    expect(offer.label).toContain('Charmed');
    expect(offer.label).toContain('Prone');
  });

  it('byte-inert null when the hit_choice key is absent or malformed', () => {
    expect(buildHitChoiceOffer({ name: 'Claw', attack_bonus: 4 }, 'Claw')).toBeNull();
    expect(buildHitChoiceOffer({ name: 'Claw', hit_choice: {} }, 'Claw')).toBeNull();
    expect(buildHitChoiceOffer({ name: 'Claw', hit_choice: { options: [] } }, 'Claw')).toBeNull();
    expect(buildHitChoiceOffer(undefined, 'Claw')).toBeNull();
    expect(hitChoiceArmed(WARP)).toBe(true);
    expect(hitChoiceArmed({ name: 'Claw' })).toBe(false);
  });
});

describe('MA-0855 hit-clause array-grant suppression', () => {
  it('buildHitConditionClause collapses to null when hit_choice is armed (no auto-grant)', () => {
    expect(buildHitConditionClause(WARP)).toBeNull();
  });

  it('suppression is scoped to hit_conditions — a hit_target_effect alongside hit_choice survives', () => {
    const row = { name: 'Rider', attack_bonus: 5, hit_conditions: ['charmed', 'prone'], hit_choice: { options: ['charmed', 'prone'] }, hit_target_effect: 'no_healing' };
    const clause = buildHitConditionClause(row);
    expect(clause).toMatchObject({ conditions: [], targetEffect: 'no_healing' });
  });

  it('MA-0841 frightened row (NO hit_choice) stays byte+behavior identical', () => {
    const strike = monsters.find((m) => m.index === 'githyanki-dracomancer').actions[1];
    expect(hitChoiceArmed(strike)).toBe(false);
    expect(buildHitChoiceOffer(strike, 'Draconic Strike')).toBeNull();
    expect(buildHitConditionClause(strike)).toEqual({
      conditions: ['frightened'],
      escapeDc: null,
      attackName: 'Draconic Strike',
      targetEffect: null,
    });
  });
});

describe('MA-0855 log builders', () => {
  const offer = buildHitChoiceOffer(WARP, 'Psychic Warp');

  it('selected log names both options + the GM pick, automationType hit_choice_selected', () => {
    const log = buildHitChoiceSelectedLog({ monsterName: 'Githzerai Psion 1', offer, chosen: 'charmed', targetName: 'Bandit 1' });
    expect(log.type).toBe('automation');
    expect(log.automationType).toBe('hit_choice_selected');
    expect(log.characterName).toBe('Githzerai Psion 1');
    expect(log.abilityName).toBe('Psychic Warp');
    expect(log.description).toContain('Charmed');
    expect(log.description).toContain('Prone');
    expect(log.description).toContain('only Charmed applied');
    expect(log.description).toContain('Prone requires Large or smaller');
  });

  it('applied log is a condition-applied entry naming ONLY the chosen condition', () => {
    const log = buildHitChoiceAppliedLog({ offer, chosen: 'prone', targetName: 'Bandit 1' });
    expect(log.type).toBe('condition');
    expect(log.action).toBe('applied');
    expect(log.characterName).toBe('Bandit 1');
    expect(log.condition).toBe('Prone');
    expect(log.description ?? '').not.toContain('Charmed');
  });

  it('advisory log records the undecided leg honestly (nothing granted)', () => {
    const log = buildHitChoiceAdvisoryLog({ monsterName: 'Githzerai Psion 1', offer, targetName: 'Bandit 1' });
    expect(log.automationType).toBe('hit_choice_undecided');
    expect(log.description).toContain('choice undecided');
    expect(log.description).toContain('no condition granted');
  });
});
