// MA-1353: Psychic Gray Ooze "Psychic Crush" (actions[1], DC 10 Intelligence, 3d8
// Psychic) RAW carries NO half-on-success clause — "Failure: 13 (3d8) Psychic
// damage.", successful save pays ZERO. dc_success was ABSENT → engine half-default
// paid half on a SAVE SUCCESS (MV-20 half-default leak, MA-0481/MA-0622/MA-0781/
// MA-1301/MA-1334 family): live proof int+19 stamp → SAVE SUCCESS (37 vs DC 10) yet
// save-damage finalDamage 4 (half of rolled 8), HP 999→995, dcSuccess:"half"
// stamped on the save_result. DATA fix: dc_success:"none" after save_effect
// (MA-1334 Poltergeist byte placement), consumed via computeDamageAfterSave
// zero-on-success.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const ooze = () => monsters.find(m => m.index === 'psychic-gray-ooze');
const crush = () => ooze().actions.find(a => a.name === 'Psychic Crush');

describe('MA-1353 monsters.json data lock: Psychic Gray Ooze Psychic Crush row', () => {
  const row = crush();

  it('is the Psychic Crush block-save row', () => {
    expect(row.name).toBe('Psychic Crush');
    expect(row.save_dc).toBe(10);
    expect(row.save_type).toBe('Intelligence');
    expect(row.damage_dice_primary).toBe('3d8');
    expect(row.damage_type_primary).toBe('Psychic');
  });

  it('canonical prose carries NO half-on-success clause (success = zero)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });

  it('fail leg byte-identical', () => {
    expect(row.save_effect).toBe('Failure: 13 (3d8) Psychic damage.');
    expect(row.description).toBe('Intelligence Saving Throw: DC 10, one creature the ooze can see within 60 feet. Failure: 13 (3d8) Psychic damage.');
  });
});

describe('MA-1353 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = crush().dc_success;

  it('computeDamageAfterSave: raw 13 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(13, false, dcSuccess)).toBe(13);
    expect(computeDamageAfterSave(13, true, dcSuccess)).toBe(0);
  });
});
