// MA-1563: Swarm of Poisonous Snakes "Bites" — the save leg shipped with the
// attack pool only (damage_dice_primary "2d6" piercing), so every DC-chip
// press rolled/logged 2d6 piercing instead of the RAW 4d6 Poison pool quoted
// verbatim in save_effect ("14 (4d6) Poison damage. Success: Half damage.").
// DATA fix authors structured save_damage_dice/save_damage_type adjacent to
// save_dc (MA-0427 save-transport family); CODE fix adds
// parseSaveDamageFields — structured keys only, byte-inert null for every row
// without them.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSaveDamageFields } from './MonsterCardHelpers.js';

const swarmRow = JSON.parse(readFileSync(resolve(__dirname, '../../../public/data/monsters.json'), 'utf8'))
  .find((m) => m.index === 'swarm-of-poisonous-snakes').actions[0];

describe('MA-1563 swarm-of-poisonous-snakes Bites — save_damage data lock', () => {
  it('disk row authors the save pool "4d6" Poison beside the DC 10 CON leg', () => {
    expect(swarmRow.name).toBe('Bites');
    expect(swarmRow.attack_bonus).toBe(6);
    expect(swarmRow.save_dc).toBe(10);
    expect(swarmRow.save_type).toBe('Constitution');
    expect(swarmRow.save_damage_dice).toBe('4d6');
    expect(swarmRow.save_damage_type).toBe('Poison');
    expect(swarmRow.damage_dice_primary).toBe('2d6');
    expect(swarmRow.damage_type_primary).toBe('piercing');
  });

  it('save_effect prose quotes the same 4d6 Poison pool byte', () => {
    expect(swarmRow.save_effect.includes('4d6')).toBe(true);
    expect(swarmRow.save_effect.includes('Poison')).toBe(true);
  });
});

describe('MA-1563 parseSaveDamageFields — structured keys only', () => {
  it('swarm row resolves { dice: "4d6", damageType: "Poison" }', () => {
    expect(parseSaveDamageFields(swarmRow)).toEqual({ dice: '4d6', damageType: 'Poison' });
  });

  it('byte-inert null for every row without the keys (legacy rows untouched)', () => {
    const legacy = { ...swarmRow };
    delete legacy.save_damage_dice;
    delete legacy.save_damage_type;
    expect(parseSaveDamageFields(legacy)).toBeNull();
    expect(parseSaveDamageFields({ name: 'Bite', damage_dice_primary: '1d8' })).toBeNull();
    expect(parseSaveDamageFields(undefined)).toBeNull();
    expect(parseSaveDamageFields(null)).toBeNull();
  });

  it('dice-only row carries a null type (consumer falls back), whitespace trimmed', () => {
    expect(parseSaveDamageFields({ save_damage_dice: ' 8d6 ' })).toEqual({ dice: '8d6', damageType: null });
    expect(parseSaveDamageFields({ save_damage_dice: '' })).toBeNull();
  });
});
