// MA-0303: Arch-hag Crackling Wave "Failure or Success:" both-outcome tail
// parse + data locks. The tail after the byte-exact "Failure or Success:"
// marker names canonical conditions + a Reactions clause; the parse arms the
// picker SUCCESS-leg grant (cursed + registered no_reactions te, rounds:2
// clock, MA-0073/MA-0087 shapes). Every OTHER "Failure or Success:" row in
// monsters.json — caster recharge restrictions ("can't take this action
// again"), 0-HP disintegrate/kill thresholds, Animal Lord variant lists,
// resistance notes, HP-max drain — names no condition and no Reactions
// clause in its tail → null (byte-inert guardrail).
import { describe, it, expect } from 'vitest';
import { parseBothOutcomesClause, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const HAG = monstersData.find(m => m.index === 'arch-hag');

describe('MA-0303 parseBothOutcomesClause', () => {
  it('Arch-hag Crackling Wave arms cursed condition + no_reactions te', () => {
    const row = HAG.actions.find(a => a.name === 'Crackling Wave');
    expect(parseBothOutcomesClause(row.save_effect)).toEqual({
      conditions: ['cursed'],
      effects: ['no_reactions'],
    });
  });

  // MA-0590: Demilich Howl — DATA-marked "Failure or Success:" Frightened
  // tail arms the picker success-leg Frightened grant (condition only, no te).
  it('MA-0590 Demilich Howl arms frightened condition (no te)', () => {
    const howl = monstersData.find(m => m.index === 'demilich').actions.find(a => a.name === 'Howl');
    expect(howl.save_effect).toBe("Failure or Success: The target has the Frightened condition until the start of the demilich's next turn.");
    expect(parseBothOutcomesClause(howl.save_effect)).toEqual({
      conditions: ['frightened'],
      effects: [],
    });
  });

  it('tail-scoped: Blinded/Poisoned BEFORE the marker never arm (Kraken, Solar)', () => {
    const kraken = monstersData.find(m => m.name === 'Kraken');
    const toxic = kraken.legendary_actions.find(a => a.name === 'Toxic Ink');
    expect(extractConditionsFromSaveEffect(toxic.save_effect)).toContain('blinded');
    expect(parseBothOutcomesClause(toxic.save_effect)).toBeNull();
    const solar = monstersData.find(m => m.name === 'Solar');
    const gaze = solar.legendary_actions.find(a => a.name === 'Blinking Gaze');
    expect(extractConditionsFromSaveEffect(gaze.save_effect)).toContain('blinded');
    expect(parseBothOutcomesClause(gaze.save_effect)).toBeNull();
  });

  it('guardrail: EVERY other "Failure or Success:" row in monsters.json stays byte-inert', () => {
    const armed = [];
    for (const m of monstersData) {
      for (const section of ['actions', 'bonus_actions', 'reactions', 'legendary_actions', 'lair_actions']) {
        for (const a of (m[section] || [])) {
          if (!a || typeof a.save_effect !== 'string') continue;
          if (!/failure or success:/i.test(a.save_effect)) continue;
          if (parseBothOutcomesClause(a.save_effect)) armed.push(`${m.name} / ${a.name}`);
        }
      }
    }
    expect(armed).toEqual(['Arch-hag / Crackling Wave', 'Demilich / Howl']);
  });

  it('caster-side restriction tails never arm (no condition, no Reactions)', () => {
    expect(parseBothOutcomesClause('Failure: 31 (9d6) Necrotic damage. Success: Half damage. Failure or Success: The lich can\'t take this action again until the start of its next turn.')).toBeNull();
    expect(parseBothOutcomesClause('Failure or Success: A creature reduced to 0 Hit Points by this beam disintegrates into dust.')).toBeNull();
    expect(parseBothOutcomesClause('Failure or Success: Being underwater doesn\'t grant Resistance to this Fire damage')).toBeNull();
  });

  it('Reactions-only tail arms with empty conditions; curly apostrophe tolerant', () => {
    expect(parseBothOutcomesClause('Failure or Success: The target can\u2019t take Reactions until the end of the next turn.')).toEqual({ conditions: [], effects: ['no_reactions'] });
  });

  it('byte-inert: no marker / clauseless rows / non-strings', () => {
    expect(parseBothOutcomesClause('The target is cursed.')).toBeNull();
    expect(parseBothOutcomesClause('The target is Poisoned and can\'t take Reactions.')).toBeNull();
    expect(parseBothOutcomesClause(null)).toBeNull();
    expect(parseBothOutcomesClause(undefined)).toBeNull();
    expect(parseBothOutcomesClause(42)).toBeNull();
  });
});

describe('MA-0303 Arch-hag Crackling Wave data locks', () => {
  it('row: DEX save DC 22, 5d12 Lightning, dc_success defaults to half (no field)', () => {
    const row = HAG.actions.find(a => a.name === 'Crackling Wave');
    expect(row.save_dc).toBe(22);
    expect(row.save_type).toBe('Dexterity');
    expect(row.damage_dice_primary).toBe('5d12');
    expect(row.damage_type_primary).toBe('Lightning');
    expect(row.dc_success).toBeUndefined();
    expect(row.recharge).toBeUndefined();
  });

  it('save_effect byte-carries the both-outcomes cursed + Reactions clause', () => {
    const row = HAG.actions.find(a => a.name === 'Crackling Wave');
    expect(row.save_effect).toBe('32 (5d12) Lightning damage. Success: Half damage. Failure or Success: The target is cursed until the end of the hag\'s next turn. The target can\'t take Reactions until the curse ends.');
  });
});
