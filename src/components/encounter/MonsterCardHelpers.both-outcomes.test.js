// @maintained-by-ai
// MA-0303/MA-0590: parseBothOutcomesClause helper-lane canon — the tail after
// the byte-exact "Failure or Success:" marker arms the AoE picker SUCCESS-leg
// grant (MonsterCardModal.jsx:384 consumer): canonical conditions (MA-0063
// extraction scoped to the tail) + registered no_reactions te (MA-0087 key),
// drained by ONE rounds:2 clock (MA-0073 shape). Distinct-branch truth table:
// disk fixtures BY NAME verbatim (arch-hag Crackling Wave = condition+Reactions,
// demilich Howl = condition-only); fake strings in the it.each below are
// JUSTIFIED fiction (#498 precedent) — no disk row in this armed family carries
// a Reactions-only tail or the curly-apostrophe byte (monsters.json uses ASCII
// apostrophes in both armed rows), so the guardrail scan below can only cover
// what exists. Kraken Toxic Ink / Solar Blinking Gaze tail-scope nulls are
// consumer echoes — cite-skip here: parse-null pinned verbatim at
// SaveAttackAoeModal.kraken-toxic-ink.test.jsx:146 and
// MonsterCardModal.legendary-uses-kraken.test.jsx:190, and EVERY other
// "Failure or Success:" row in monsters.json (caster recharge restrictions,
// 0-HP thresholds, resistance notes, Animal Lord variant lists, HP-max drain)
// stays byte-inert null via the full-file guardrail scan.
import { describe, it, expect } from 'vitest';
import { parseBothOutcomesClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const HAG = monstersData.find(m => m.index === 'arch-hag');
const WAVE = HAG.actions.find(a => a.name === 'Crackling Wave');
const HOWL = monstersData.find(m => m.index === 'demilich').actions.find(a => a.name === 'Howl');

describe('MA-0303 parseBothOutcomesClause', () => {
  // Disk fixtures BY NAME verbatim (#387): the two armed rows, save_effect
  // byte-pinned as the exact parse input.
  it('arch-hag Crackling Wave tail arms cursed + no_reactions', () => {
    expect(WAVE.save_effect).toBe('32 (5d12) Lightning damage. Success: Half damage. Failure or Success: The target is cursed until the end of the hag\'s next turn. The target can\'t take Reactions until the curse ends.');
    expect(parseBothOutcomesClause(WAVE.save_effect)).toEqual({
      conditions: ['cursed'],
      effects: ['no_reactions'],
    });
  });

  it('demilich Howl tail arms frightened condition only (MA-0590)', () => {
    expect(HOWL.save_effect).toBe("Failure or Success: The target has the Frightened condition until the start of the demilich's next turn.");
    expect(parseBothOutcomesClause(HOWL.save_effect)).toEqual({
      conditions: ['frightened'],
      effects: [],
    });
  });

  // Fiction-only branches (#498 header justification): Reactions-arm with zero
  // conditions and the curly-apostrophe tolerance have no disk exemplar.
  it.each([
    ['Reactions-only tail arms with empty conditions', 'Failure or Success: The target can\'t take Reactions until the end of the next turn.', { conditions: [], effects: ['no_reactions'] }],
    ['curly apostrophe tolerant', 'Failure or Success: The target can\u2019t take Reactions until the end of the next turn.', { conditions: [], effects: ['no_reactions'] }],
    ['caster-side restriction tail names nothing in the tail', 'Failure: 31 (9d6) Necrotic damage. Success: Half damage. Failure or Success: The lich can\'t take this action again until the start of its next turn.', null],
    ['no marker: conditions + Reactions prose is byte-inert', 'The target is Poisoned and can\'t take Reactions.', null],
    ['null input', null, null],
    ['undefined input', undefined, null],
    ['non-string input', 42, null],
  ])('%s', (_name, input, expected) => {
    expect(parseBothOutcomesClause(input)).toEqual(expected);
  });

  it('guardrail: EVERY "Failure or Success:" row in monsters.json outside the armed pair stays byte-inert', () => {
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
});

describe('MA-0303 Arch-hag Crackling Wave data locks', () => {
  // Fields NOT read by the parse but consumed by the same picker seam
  // (SaveAttackAoeModal.crackling-wave.test.jsx hardcodes them as props —
  // disk-side lock lives only here).
  it('row: DEX save DC 22, 5d12 Lightning, dc_success defaults to half (no field)', () => {
    expect(WAVE.save_dc).toBe(22);
    expect(WAVE.save_type).toBe('Dexterity');
    expect(WAVE.damage_dice_primary).toBe('5d12');
    expect(WAVE.damage_type_primary).toBe('Lightning');
    expect(WAVE.dc_success).toBeUndefined();
    expect(WAVE.recharge).toBeUndefined();
  });
});
