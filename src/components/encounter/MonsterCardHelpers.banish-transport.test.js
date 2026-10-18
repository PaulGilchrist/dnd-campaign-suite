// @maintained-by-ai
// MA-0104 helper lane: parseBanishTransportClause truth-table owner (MonsterCardHelpers.js:241-244
// — guard / case-insensitive match / non-match). Disk fixtures BY NAME verbatim (#387): Adult +
// Ancient Gold Dragon Banish rows. Adult numerics stay locked here too — save_dc/dc_success are
// e2e-locked by MonsterCardModal.banish-demiplane.test.jsx:103-104 but 3d6/Force have no other
// disk lock. Dropped legs (owners cited): Soul Tome discrimination →
// MonsterCardHelpers.soul-tome-trap.test.js:32-33 + :60 (real Arcanaloth disk row; the previous
// local leg looked up non-existent monster "Death kiss" so its disk leg vacuously passed through
// the non-string guard). Consumer arm → MonsterCardModal.jsx:1849 (modal lane owns wiring).
import { describe, it, expect } from 'vitest';
import { parseBanishTransportClause } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const gold = () => monstersData.find(m => m.name === 'Adult Gold Dragon');

describe('MA-0104 parseBanishTransportClause', () => {
  it('truth table: match (case-insensitive) arms te; non-match and non-string guard return null', () => {
    expect(parseBanishTransportClause('Transported to a Harmless Demiplane until the start of the dragon’s next turn')).toEqual({ effect: 'banished_demiplane' });
    expect(parseBanishTransportClause('Target is Poisoned.')).toBeNull();
    expect(parseBanishTransportClause(null)).toBeNull();
    expect(parseBanishTransportClause(undefined)).toBeNull();
    expect(parseBanishTransportClause(42)).toBeNull();
  });

  it('disk fixtures by name: Adult Gold Dragon Banish (numerics + transport clause armed) and Ancient Gold Dragon Banish (transport clause armed)', () => {
    const row = gold().legendary_actions.find(a => a.name === 'Banish');
    expect(row.save_dc).toBe(21);
    expect(row.save_type).toBe('Charisma');
    expect(row.dc_success).toBe('none');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Force');
    expect(row.save_effect).toMatch(/transported to a harmless demiplane until the start of the dragon's next turn/i);
    expect(row.save_effect).toMatch(/reappearance placement GM-enforced/i);
    expect(row.description).toMatch(/banished_demiplane te granted on a failed save/i);
    expect(row.description).toMatch(/can'?t take this action again until the start of its next turn/i);
    expect(parseBanishTransportClause(row.save_effect)).toEqual({ effect: 'banished_demiplane' });

    const ancient = monstersData.find(m => m.name === 'Ancient Gold Dragon')
      .legendary_actions.find(a => a.name === 'Banish');
    expect(parseBanishTransportClause(ancient.save_effect)).toEqual({ effect: 'banished_demiplane' });
  });
});
