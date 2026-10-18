// @maintained-by-ai
// MA-1563: Swarm of Poisonous Snakes "Bites" — the save leg shipped with the
// attack pool only (damage_dice_primary "2d6" piercing), so every DC-chip
// press rolled/logged 2d6 piercing instead of the RAW 4d6 Poison pool quoted
// verbatim in save_effect ("14 (4d6) Poison damage. Success: Half damage.").
// DATA fix authors structured save_damage_dice/save_damage_type adjacent to
// save_dc (MA-0427 save-transport family); CODE fix adds
// parseSaveDamageFields — structured keys only, byte-inert null for every row
// without them.
//
// Owners cited-skip (this file keeps ONLY the helper-level MA-1563 deltas):
// • swarm Bites row data lock (exact save_effect bytes + file-wide 4d6
//   uniqueness): MonsterCardModal.ma1578-tarrasque-swallow.test.js:156-165
// • generic parseSaveDamageFields shape (both keys → structured / legacy
//   delete-keys → null, BY NAME on tarrasque-Swallow): same file :55, :119
// • save chip plan + buildAbilitySaveRollContext transport + no attack-side
//   bleed for this row: MonsterCardModal.ma1563-swarm-save-damage.test.js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveDamageFields } from './MonsterCardHelpers.js';

const swarmRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'swarm-of-poisonous-snakes').actions[0];

describe('MA-1563 parseSaveDamageFields — structured keys only', () => {
  it('swarm Bites row fingerprints { dice: "4d6", damageType: "Poison" } BY NAME', () => {
    expect(swarmRow.name).toBe('Bites');
    expect(parseSaveDamageFields(swarmRow)).toEqual({ dice: '4d6', damageType: 'Poison' });
  });

  it('byte-inert null for the legacy swarm row without the keys (attack pool never bleeds up)', () => {
    const legacy = { ...swarmRow };
    delete legacy.save_damage_dice;
    delete legacy.save_damage_type;
    expect(parseSaveDamageFields(legacy)).toBeNull();
  });

  it('dice-only row carries a null type (consumer falls back), whitespace trimmed', () => {
    expect(parseSaveDamageFields({ save_damage_dice: ' 8d6 ' })).toEqual({ dice: '8d6', damageType: null });
    expect(parseSaveDamageFields({ save_damage_dice: '' })).toBeNull();
  });
});
